import { useCallback, useEffect, useState } from 'react';
import { 
  supabase, 
  createEvent as createSupabaseEvent, 
  joinEvent as joinSupabaseEvent,
  leaveEvent as leaveSupabaseEvent,
  cancelEvent as cancelSupabaseEvent,
  fetchEvents as fetchSupabaseEvents
} from '../services/supabase';
import {
  frenRequests,
  idStore,
  nickname,
  portalMessages,
  waku_SendPortalMessage,
} from '../waku/node';

// Generate portal ID from coordinates for Waku compatibility
const generatePortalId = (latitude, longitude) => {
  const x = Math.round(latitude * 1000000);
  const y = Math.round(longitude * 1000000);
  return `${x},${y}`;
};

export const useCryptoIdentity = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Get the Waku cryptographic identity
      const wakuIdent = idStore.getMasterIdent();
      
      // Create user object with address as the primary ID (simplified system)
      const cryptoUser = {
        address: wakuIdent.account.address,     // Primary ID (42 chars, familiar format)
        publicKey: wakuIdent.publicKey,         // Keep for Waku operations
        wakuIdent: wakuIdent,                   // Full crypto identity object
        nickname: nickname,
        created_at: new Date().toISOString(),
        displayName: nickname || 'Anon',
      };

      console.log('✅ Crypto identity initialized:', {
        address: cryptoUser.address,
        publicKey: cryptoUser.publicKey.slice(0, 20) + '...',
        nickname: cryptoUser.nickname
      });

      setUser(cryptoUser);
    } catch (err) {
      console.error('Failed to initialize crypto identity:', err);
      // Could fall back to creating a new identity here if needed
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    // For crypto-only identity, "signing out" means clearing local storage
    // and forcing page reload to generate new identity
    localStorage.removeItem('live.portal.portalKey');
    localStorage.removeItem('portal_friends');
    localStorage.removeItem('portal_processed_requests');
    localStorage.removeItem('portal_events_cache');
    window.location.reload();
  }, []);

  return {
    user,
    loading,
    signOut,
    isAuthenticated: !!user,
  };
};

// GPS-only location hook (unchanged)
export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const errorMsg = 'GPS not supported on this device';
      setError(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const errorMsg = 'GPS timeout - please try outdoors for better signal';
        setError(errorMsg);
        setLoading(false);
        reject(new Error(errorMsg));
      }, 20000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const acc = position.coords.accuracy;

          if (
            typeof lat !== 'number' || typeof lng !== 'number' ||
            isNaN(lat) || isNaN(lng) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180
          ) {
            const errorMsg = 'Invalid GPS coordinates - please try again';
            setError(errorMsg);
            setLoading(false);
            reject(new Error(errorMsg));
            return;
          }

          if (acc && acc > 1000) {
            const errorMsg = 'GPS signal too weak - please try outdoors';
            setError(errorMsg);
            setLoading(false);
            reject(new Error(errorMsg));
            return;
          }

          const newLocation = {
            latitude: lat,
            longitude: lng,
            accuracy: typeof acc === 'number' && !isNaN(acc) ? Math.round(acc) : 100,
            timestamp: Date.now(),
          };

          console.log('Valid GPS location:', newLocation);
          setLocation(newLocation);
          setLoading(false);
          resolve(newLocation);
        },
        (error) => {
          clearTimeout(timeoutId);
          let errorMessage = 'GPS unavailable';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please allow location access and reload the page.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'GPS unavailable. Please check location settings and try outdoors.';
              break;
            case error.TIMEOUT:
              errorMessage = 'GPS timeout. Try moving outdoors for better signal.';
              break;
            default:
              errorMessage = `GPS error: ${error.message || 'Please try again'}`;
          }

          console.error('GPS error:', error);
          setError(errorMessage);
          setLoading(false);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        },
      );
    });
  }, []);

  return { location, error, loading, getCurrentLocation };
};

export const useEvents = (user) => {
  const [events, setEvents] = useState([]);
  const [userEvent, setUserEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Fetch all events from Supabase
  const fetchEvents = useCallback(async () => {
    try {
      console.log('Fetching events from Supabase...');

      // Pass user address for context setting
      const { data, error: fetchError } = await fetchSupabaseEvents(user?.address);

      if (fetchError) {
        console.error('Supabase event fetch error:', fetchError);
        setConnectionStatus('error');
        setError(fetchError);
        return;
      }

      console.log(`Fetched ${data.length} events from Supabase`);

      // Add frontend compatibility fields and Waku portal identities
      const formattedEvents = data.map(event => {
        // For coordinate-based IDs, portalId is the same as event ID
        const portalId = event.id; // Already in "lat,lng" format

        // Ensure each event has a Waku identity for chat
        idStore.getPortalIdent(portalId);

        return {
          ...event,
          // Add portal-compatible fields
          portalId,
          isMyEvent: event.creator_address === user?.address, // Changed from publicKey to address
          // Keep original event fields
          attendees: event.attendees || [],
          attendeeCount: (event.attendees || []).length,
          // Add backward compatibility
          profiles: {
            username: event.creator_address === user?.address ? 'You' : 'Event Creator',
            avatar_url: null,
          },
          // Map address fields for backward compatibility
          creator_pubkey: event.creator_address, // For components that still expect this
        };
      });

      setEvents(formattedEvents);

      // Find user's event (they can only have one active event at a time)
      const myEvent = formattedEvents.find(e => e.creator_address === user?.address);
      setUserEvent(myEvent || null);

      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      console.error('Error fetching events:', err);
      setConnectionStatus('error');
      setError(err.message);
    }
  }, [user?.address]); // Changed dependency from publicKey to address

  // Monitor Supabase events
  useEffect(() => {
    if (!user) return;

    console.log('Starting Supabase event monitoring for user:', user.address);

    // Initial fetch
    fetchEvents();

    // Set up realtime subscription
    const channel = supabase
      .channel('events_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events',
      }, payload => {
        console.log('Supabase event change:', payload);
        fetchEvents();
      })
      .subscribe();

    // Poll for updates every 60 seconds
    const interval = setInterval(fetchEvents, 60000);

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [user, fetchEvents]);

  const createEvent = async (eventData) => {
    if (!user) {
      return { data: null, error: 'Not authenticated' };
    }

    if (
      !eventData ||
      typeof eventData.latitude !== 'number' ||
      typeof eventData.longitude !== 'number' ||
      isNaN(eventData.latitude) ||
      isNaN(eventData.longitude) ||
      eventData.latitude < -90 || eventData.latitude > 90 ||
      eventData.longitude < -180 || eventData.longitude > 180
    ) {
      return { data: null, error: 'Invalid location coordinates' };
    }

    try {
      setLoading(true);
      console.log('Creating event/portal with server-side proximity check:', eventData);

      // Pass user object (contains address)
      const { data, error: createError } = await createSupabaseEvent(eventData, user);

      if (createError) {
        console.error('Event creation error:', createError);
        setLoading(false);
        return { data: null, error: createError };
      }

      console.log('Event creation successful:', data);

      // Create Waku identity for this event's chat using coordinate-based ID
      const portalId = generatePortalId(eventData.latitude, eventData.longitude);
      idStore.getPortalIdent(portalId);
      console.log('Created Waku identity for event chat:', portalId);

      // Refresh events list to show the new event
      await fetchEvents();

      setLoading(false);
      return { data, error: null };
    } catch (err) {
      console.error('Event creation failed:', err);
      setLoading(false);
      return { data: null, error: err.message || 'Event creation failed' };
    }
  };

  const joinEvent = async (eventId) => {
    if (!user?.address) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Joining event:', eventId);
      
      // Pass user's address directly
      const { data, error: joinError } = await joinSupabaseEvent(eventId, user.address);
      
      if (joinError) {
        throw new Error(joinError);
      }
      
      console.log('✅ Successfully joined event:', data.title);
      
      // Refresh events to show updated attendee list
      await fetchEvents();
      
      return { data, error: null };
    } catch (err) {
      const errorMsg = err.message || 'Failed to join event';
      console.error('❌ Failed to join event:', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const leaveEvent = async (eventId) => {
    if (!user?.address) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Leaving event:', eventId);
      
      // Pass user's address directly
      const { data, error: leaveError } = await leaveSupabaseEvent(eventId, user.address);
      
      if (leaveError) {
        throw new Error(leaveError);
      }
      
      console.log('✅ Successfully left event:', data.title);
      
      // Refresh events to show updated attendee list
      await fetchEvents();
      
      return { data, error: null };
    } catch (err) {
      const errorMsg = err.message || 'Failed to leave event';
      console.error('❌ Failed to leave event:', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const cancelEvent = async (eventId) => {
    if (!user?.address) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Cancelling event:', eventId);
      
      // Pass user's address directly
      const { data, error: cancelError } = await cancelSupabaseEvent(eventId, user.address);
      
      if (cancelError) {
        throw new Error(cancelError);
      }
      
      console.log('✅ Successfully cancelled event:', data.title);

      // Remove Waku identity for this event's chat
      const portalId = eventId; // For coordinate-based IDs, portalId = eventId
      idStore.removePortalIdent(portalId);
      console.log('Removed Waku identity for event chat:', portalId);
      
      // Refresh events to remove the cancelled event
      await fetchEvents();
      
      return { data, error: null };
    } catch (err) {
      const errorMsg = err.message || 'Failed to cancel event';
      console.error('❌ Failed to cancel event:', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Computed values for backward compatibility
  const nearbyEvents = useCallback((latitude, longitude, radiusKm = 5) => {
    if (!latitude || !longitude) return [];
    
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    return events.filter(event => {
      const distance = calculateDistance(latitude, longitude, event.latitude, event.longitude);
      return distance <= radiusKm;
    });
  }, [events]);

  const upcomingEvents = useCallback(() => {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return events.filter(event => {
      const startTime = new Date(event.start_datetime);
      return startTime >= now && startTime <= next24Hours;
    });
  }, [events]);

  const myEvents = useCallback(() => {
    return events.filter(event => event.creator_address === user?.address);
  }, [events, user]);

  const attendingEvents = useCallback(() => {
    if (!user?.address) return [];
    return events.filter(event => 
      event.attendees.includes(user.address) && 
      event.creator_address !== user.address
    );
  }, [events, user]);

  // Statistics
  const eventStats = useCallback(() => {
    return {
      total: events.length,
      upcoming: upcomingEvents().length,
      myEvents: myEvents().length,
      attending: attendingEvents().length
    };
  }, [events, upcomingEvents, myEvents, attendingEvents]);

  return {
    // Event-related exports
    events,
    loading,
    error,
    createEvent,
    joinEvent,
    leaveEvent,
    cancelEvent,
    nearbyEvents,
    upcomingEvents,
    myEvents,
    attendingEvents,
    eventStats,
    clearError: () => setError(null),
    
    // Portal-compatible exports for backward compatibility
    portals: events, // events are now portals
    userPortal: userEvent, // user's event is their portal
    connectionStatus,
    createPortal: createEvent, // same function, different name
    closePortal: cancelEvent, // closing = cancelling for user's own event
  };
};

// Enhanced Waku-powered message management (unchanged, but now works with events)
export const useP2PMessages = (portalId, user) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Monitor Waku messages for this portal/event
  useEffect(() => {
    if (!portalId || !user) {
      setMessages([]);
      return;
    }

    console.log('Starting Waku message monitoring for portal/event:', portalId);

    const updateMessages = () => {
      try {
        // Get messages for this portal from Waku
        const wakuMessages = portalMessages[portalId] || [];

        // Convert to frontend format
        const formattedMessages = wakuMessages.map(msg => ({
          ...msg,
          id: `${msg.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          portal_id: portalId,
          user_id: msg.portalPubkey,
          content: msg.message,
          message_type: 'text',
          created_at: new Date(msg.timestamp).toISOString(),
          profiles: {
            username: `User_${msg.timestamp.toString().slice(-4)}`,
            avatar_url: null,
          },
        }));

        // Sort by timestamp
        const sortedMessages = formattedMessages.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );

        setMessages(sortedMessages);
        console.log(
          `Waku messages updated: ${sortedMessages.length} messages for portal/event ${portalId}`,
        );
      } catch (err) {
        console.error('Error processing Waku messages:', err);
      }
    };

    // Initial update
    updateMessages();

    // Poll for updates every 10 seconds
    const interval = setInterval(updateMessages, 10000);

    return () => clearInterval(interval);
  }, [portalId, user]);

  const sendMessage = async (content) => {
    if (!content.trim() || !portalId || !user) return false;

    try {
      console.log('Sending Waku message:', content, 'to portal/event:', portalId);

      // Send through Waku with portal identity
      await waku_SendPortalMessage({
        portalId: portalId,
        timestamp: Date.now(),
        message: content.trim(),
        portalPubkey: null, // Will be set by waku_SendPortalMessage
      });

      console.log('Waku message sent successfully');
      return true;
    } catch (err) {
      console.error('Waku message send failed:', err);
      return false;
    }
  };

  return {
    messages,
    loading,
    sendMessage,
  };
};

// Enhanced friend request management hook (updated for crypto-only identity)
export const useFriendRequests = (user) => {
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [processedRequests, setProcessedRequests] = useState(new Set());
  const [lastProcessedCount, setLastProcessedCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Load existing friends from localStorage
    const storedFriends = localStorage.getItem('portal_friends');
    if (storedFriends) {
      try {
        setFriends(JSON.parse(storedFriends));
      } catch (err) {
        console.error('Error loading friends:', err);
      }
    }

    // Load processed requests from localStorage
    const storedProcessed = localStorage.getItem('portal_processed_requests');
    if (storedProcessed) {
      try {
        const processedArray = JSON.parse(storedProcessed);
        setProcessedRequests(new Set(processedArray));
        setLastProcessedCount(processedArray.length);
      } catch (err) {
        console.error('Error loading processed requests:', err);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Monitor incoming friend requests from Waku
    const checkFriendRequests = () => {
      if (frenRequests.length > 0) {
        // Filter out already processed requests
        const newRequests = frenRequests.filter(fren => {
          const requestId = `${fren.nik}_${fren.publicKey}_${fren.address}`;
          return !processedRequests.has(requestId);
        });

        if (newRequests.length > 0) {
          setFriendRequests(prev => {
            // Avoid duplicates by checking if request already exists
            const existingNiks = new Set(prev.map(req => req.nik));
            const filteredNew = newRequests.filter(req => !existingNiks.has(req.nik));
            if (filteredNew.length > 0) {
              console.log('New friend requests detected:', filteredNew.length);
              return [...prev, ...filteredNew];
            }
            return prev;
          });
        }
      } else if (friendRequests.length > 0) {
        setFriendRequests([]);
      }
    };

    // Check every 30 seconds for new friend requests
    const interval = setInterval(checkFriendRequests, 30000);

    return () => clearInterval(interval);
  }, [user, lastProcessedCount]);

  const acceptFriendRequest = async (fren) => {
    try {
      // Add to friends list
      const newFriend = {
        nik: fren.nik,
        publicKey: fren.publicKey,
        address: fren.address,
        acceptedAt: new Date().toISOString(),
      };

      const updatedFriends = [...friends, newFriend];
      setFriends(updatedFriends);

      // Save to localStorage
      localStorage.setItem('portal_friends', JSON.stringify(updatedFriends));

      // Mark as processed
      const requestId = `${fren.nik}_${fren.publicKey}_${fren.address}`;
      const updatedProcessed = new Set([...processedRequests, requestId]);
      setProcessedRequests(updatedProcessed);
      setLastProcessedCount(updatedProcessed.size);
      localStorage.setItem(
        'portal_processed_requests',
        JSON.stringify([...updatedProcessed]),
      );

      // Remove from pending requests
      setFriendRequests(prev => prev.filter(req => req.nik !== fren.nik));

      console.log('Friend request accepted:', fren.nik);
      return true;
    } catch (err) {
      console.error('Error accepting friend request:', err);
      return false;
    }
  };

  const declineFriendRequest = (fren) => {
    // Mark as processed so it doesn't come back
    const requestId = `${fren.nik}_${fren.publicKey}_${fren.address}`;
    const updatedProcessed = new Set([...processedRequests, requestId]);
    setProcessedRequests(updatedProcessed);
    setLastProcessedCount(updatedProcessed.size);
    localStorage.setItem(
      'portal_processed_requests',
      JSON.stringify([...updatedProcessed]),
    );

    // Remove from pending requests
    setFriendRequests(prev => prev.filter(req => req.nik !== fren.nik));

    console.log('Friend request declined:', fren.nik);
  };

  return {
    friendRequests,
    friends,
    acceptFriendRequest,
    declineFriendRequest,
  };
};

// Hook for managing event filters and search (unchanged)
export const useEventFilters = (events) => {
  const [filters, setFilters] = useState({
    timeRange: 'all',
    distance: 'all',
    search: '',
  });

  const filteredEvents = useCallback(() => {
    let filtered = [...events];

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(event => {
        const eventStart = new Date(event.start_datetime);
        
        switch (filters.timeRange) {
          case 'today':
            return eventStart >= today && eventStart < tomorrow;
          case 'tomorrow':
            return eventStart >= tomorrow && eventStart < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
          case 'this_week':
            return eventStart >= today && eventStart < nextWeek;
          default:
            return true;
        }
      });
    }

    // Search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm) ||
        (event.description && event.description.toLowerCase().includes(searchTerm))
      );
    }

    return filtered;
  }, [events, filters]);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      timeRange: 'all',
      distance: 'all',
      search: '',
    });
  }, []);

  return {
    filters,
    filteredEvents,
    updateFilter,
    clearFilters,
    hasActiveFilters: filters.timeRange !== 'all' || filters.distance !== 'all' || filters.search.trim()
  };
};