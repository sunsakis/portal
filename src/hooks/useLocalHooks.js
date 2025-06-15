import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase/portals';
import { getPetName, portalMessages, waku_SendPortalMessage } from '../waku/node';

// Generate portal ID from coordinates for Waku compatibility
const generatePortalId = (latitude, longitude) => {
  const x = Math.round(latitude * 1000000);
  const y = Math.round(longitude * 1000000);
  return `${x},${y}`;
};

// Simple local user management - no external auth needed
export const useLocalAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check for existing user in localStorage
    const existingUser = localStorage.getItem('portal_user');
    if (existingUser) {
      try {
        setUser(JSON.parse(existingUser));
      } catch (err) {
        console.error('Invalid user data, creating new user');
        localStorage.removeItem('portal_user');
      }
    }

    // If no user exists, create anonymous user
    if (!existingUser) {
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: `anonymous_${Date.now()}@local.app`,
        created_at: new Date().toISOString(),
        anonymous: true,
      };

      localStorage.setItem('portal_user', JSON.stringify(newUser));
      setUser(newUser);
    }

    setLoading(false);
  }, []);

  const signInAnonymously = async () => {
    try {
      setLoading(true);
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: `anonymous_${Date.now()}@local.app`,
        created_at: new Date().toISOString(),
        anonymous: true,
      };

      localStorage.setItem('portal_user', JSON.stringify(newUser));
      setUser(newUser);
      setError(null);
      setLoading(false);
      return true;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const authenticateWithCode = async (email, action, code = null) => {
    // Mock authentication for development
    if (action === 'send') {
      console.log(`Mock: Sending code to ${email}`);
      return true;
    }

    if (action === 'verify' && code) {
      console.log(`Mock: Verifying code ${code} for ${email}`);
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email,
        created_at: new Date().toISOString(),
        anonymous: false,
      };

      localStorage.setItem('portal_user', JSON.stringify(newUser));
      setUser(newUser);
      return true;
    }

    return false;
  };

  const signOut = async () => {
    localStorage.removeItem('portal_user');
    localStorage.removeItem('portal_messages');
    localStorage.removeItem('portal_data');
    setUser(null);
  };

  return {
    user,
    loading,
    error,
    authenticateWithCode,
    signInAnonymously,
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
            typeof lat !== 'number' || typeof lng !== 'number'
            || isNaN(lat) || isNaN(lng)
            || lat < -90 || lat > 90 || lng < -180 || lng > 180
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
              errorMessage =
                'Location permission denied. Please allow location access and reload the page.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage =
                'GPS unavailable. Please check location settings and try outdoors.';
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

// Portal management with server-side proximity checking
export const useLocalPortals = (user) => {
  const [portals, setPortals] = useState([]);
  const [userPortal, setUserPortal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Fetch all portals from Supabase
  const fetchPortals = useCallback(async () => {
    try {
      console.log('Fetching portals from Supabase...');

      const { data, error } = await supabase
        .from('portals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase portal fetch error:', error);
        setConnectionStatus('error');
        return;
      }

      console.log(`Fetched ${data.length} portals from Supabase`);

      // Add frontend compatibility fields
      const formattedPortals = data.map(portal => ({
        ...portal,
        id: generatePortalId(portal.latitude, portal.longitude), // Generate ID for frontend compatibility
        profiles: {
          username: portal.user_id === user?.id ? 'You' : 'Anonymous',
          avatar_url: null,
        },
      }));

      setPortals(formattedPortals);

      // Find user's portal
      const myPortal = formattedPortals.find(p => p.user_id === user?.id);
      setUserPortal(myPortal || null);

      setConnectionStatus('connected');
    } catch (err) {
      console.error('Error fetching portals:', err);
      setConnectionStatus('error');
    }
  }, [user?.id]);

  // Monitor Supabase portals
  useEffect(() => {
    if (!user) return;

    console.log('Starting Supabase portal monitoring for user:', user.id);

    // Initial fetch
    fetchPortals();

    // Set up realtime subscription
    const channel = supabase
      .channel('portals_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'portals',
      }, payload => {
        console.log('Supabase portal change:', payload);
        fetchPortals();
      })
      .subscribe();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchPortals, 10000);

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [user, fetchPortals]);

  const createPortal = async (location) => {
    if (!user) {
      return { error: 'Not authenticated' };
    }

    if (
      !location
      || typeof location.latitude !== 'number'
      || typeof location.longitude !== 'number'
      || isNaN(location.latitude)
      || isNaN(location.longitude)
      || location.latitude < -90 || location.latitude > 90
      || location.longitude < -180 || location.longitude > 180
    ) {
      return { error: 'Invalid location coordinates' };
    }

    try {
      setLoading(true);
      console.log(
        'Creating Supabase portal with server-side proximity check at:',
        location,
      );

      // Call the server-side proximity check function
      console.log('Calling server-side proximity check function...');
      const { data, error } = await supabase.rpc('check_portal_proximity_and_create', {
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_user_id: user.id,
      });

      if (error) {
        console.error('Supabase RPC error:', error);
        setLoading(false);
        return { error: error.message || 'Portal creation failed' };
      }

      console.log('Server response:', data);

      // Handle server response
      if (!data.success) {
        console.log(`Server rejected portal: ${data.message}`);
        if (data.error === 'PROXIMITY_VIOLATION') {
          console.log(`Distance to nearest portal: ${data.distance}m`);
        }
        setLoading(false);
        return { error: data.message };
      }

      // Success - portal created with server-side validation
      console.log('Server-side portal creation successful:', data.data);

      // Refresh portals list to show the new portal
      await fetchPortals();

      setLoading(false);
      return { data: data.data, error: null };
    } catch (err) {
      console.error('Portal creation failed:', err);
      setLoading(false);
      return { error: err.message || 'Portal creation failed' };
    }
  };

  const closePortal = async () => {
    if (!userPortal || !user) {
      return { error: 'No portal to close' };
    }

    try {
      console.log(
        'Closing Supabase portal at:',
        `${userPortal.latitude}, ${userPortal.longitude}`,
      );

      // Simply delete the portal
      const { error } = await supabase
        .from('portals')
        .delete()
        .eq('latitude', userPortal.latitude)
        .eq('longitude', userPortal.longitude)
        .eq('user_id', user.id);

      if (error) {
        console.error('Portal close failed:', error);
        return { error: error.message };
      }

      // Refresh portals list
      await fetchPortals();

      console.log('Portal deleted successfully');
      return { error: null };
    } catch (err) {
      console.error('Portal close failed:', err);
      return { error: err.message };
    }
  };

  return {
    portals,
    userPortal,
    loading,
    connectionStatus,
    createPortal,
    closePortal,
  };
};

// Waku-powered message management for chat (unchanged)
export const useLocalMessages = (portalId, user) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Monitor Waku messages for this portal
  useEffect(() => {
    if (!portalId || !user) {
      setMessages([]);
      return;
    }

    console.log('Starting Waku message monitoring for portal:', portalId);

    const updateMessages = () => {
      try {
        // Get messages for this portal from Waku
        const wakuMessages = portalMessages[portalId] || [];

        // Convert to frontend format
        //
        //
        console.log(wakuMessages);
        const formattedMessages = wakuMessages.map(msg => ({
          id: `${msg.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          portal_id: portalId,
          user_id: msg.portalPubkey, // Simple user identification
          content: msg.message,
          message_type: 'text',
          created_at: new Date(msg.timestamp).toISOString(),
          profiles: {
            username: getPetName(msg.portalPubkey),
            avatar_url: null,
          },
        }));

        // Sort by timestamp
        const sortedMessages = formattedMessages.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );

        setMessages(sortedMessages);
        console.log(
          `Waku messages updated: ${sortedMessages.length} messages for portal ${portalId}`,
        );
      } catch (err) {
        console.error('Error processing Waku messages:', err);
      }
    };

    // Initial update
    updateMessages();

    // Poll for updates every 1 second
    const interval = setInterval(updateMessages, 1000);

    return () => clearInterval(interval);
  }, [portalId, user]);

  const sendMessage = async (content) => {
    if (!content.trim() || !portalId || !user) return false;

    try {
      console.log('Sending Waku message:', content, 'to portal:', portalId);

      // Send through Waku
      await waku_SendPortalMessage({
        portalId: portalId,
        timestamp: Date.now(),
        message: content.trim(),
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
