import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer } from 'react-leaflet';

import {
  useFriendRequests,
  useGeolocation,
  useP2PAuth,
  useEvents, // Updated import
} from '../hooks/hooks';
import { frenRequests, getWakuStatus } from '../waku/node';
import { MapControls, MapEventHandler } from './MapControls';
import MapLayers from './MapLayers';
import { EventMarkers } from './EventMarkers';
import MessageFlowOverlay from './MessageFlowOverlay';
import EventCreationModal from './EventCreationModal';
import EventDetailsModal from './EventDetailsModal'; // Updated modal

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';

const maptilerApiKey = import.meta.env.VITE_MAPTILER_API;

// Enhanced Friend Request Status Indicator
const FriendRequestIndicator = ({ friendRequests, onShowRequests }) => {
  if (friendRequests.length === 0) return null;

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onShowRequests}
      className='fixed top-16 right-4 z-[1500] bg-blue-600 text-white rounded-full shadow-xl flex items-center gap-2 px-4 py-2'
    >
      <span className='text-lg'>👋</span>
      <span className='text-sm font-medium'>{friendRequests.length}</span>
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className='w-2 h-2 bg-white rounded-full'
      />
    </motion.button>
  );
};

// Enhanced Error Toast
const ErrorToast = ({ error, onDismiss }) => {
  if (!error) return null;

  const getErrorConfig = (errorMsg) => {
    if (errorMsg.includes('only') && errorMsg.includes('away')) {
      return {
        icon: '📍',
        title: 'Too Close to Another Event',
        message: errorMsg,
        color: 'bg-orange-500',
        suggestion: 'Try moving at least 10 meters away from other events',
      };
    }

    if (errorMsg.includes('GPS') || errorMsg.includes('location')) {
      return {
        icon: '🛰️',
        title: 'Location Issue',
        message: errorMsg,
        color: 'bg-red-500',
        suggestion: 'Make sure location services are enabled and try moving outdoors',
      };
    }

    if (errorMsg.includes('network') || errorMsg.includes('connection')) {
      return {
        icon: '📡',
        title: 'Connection Problem',
        message: errorMsg,
        color: 'bg-blue-500',
        suggestion: 'Check your internet connection and try again',
      };
    }

    return {
      icon: '⚠️',
      title: 'Error',
      message: errorMsg,
      color: 'bg-gray-500',
    };
  };

  const config = getErrorConfig(error);

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 ${config.color} text-white rounded-lg shadow-xl z-[2000] mx-auto max-w-sm`}
    >
      <div className='p-4'>
        <div className='flex items-start gap-3'>
          <span className='text-2xl flex-shrink-0'>{config.icon}</span>
          <div className='flex-1 min-w-0'>
            <h3 className='font-semibold text-sm mb-1'>{config.title}</h3>
            <p className='text-sm opacity-90 mb-2'>{config.message}</p>
            <p className='text-xs opacity-75'>{config.suggestion}</p>
          </div>
          <button
            onClick={onDismiss}
            className='text-white/60 hover:text-white text-lg leading-none'
          >
            ×
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default function Map() {
  const { user, signInAnonymously } = useP2PAuth();
  const { error: geoError, getCurrentLocation, location: userLocation } = useGeolocation();
  
  // Updated to use  events instead of separate portals and events
  const { 
    events, 
    userEvent, 
    createEvent, 
    joinEvent, 
    leaveEvent, 
    cancelEvent, 
    connectionStatus,
    eventStats,
    loading: eventsLoading,
    error: eventsError,
    clearError: clearEventsError,
  } = useEvents(user);
  
  const { friendRequests, friends, acceptFriendRequest, declineFriendRequest } = useFriendRequests(user);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [wakuStatus, setWakuStatus] = useState('connecting');
  const [portalError, setPortalError] = useState(null);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  
  // Event states
  const [showEventCreation, setShowEventCreation] = useState(false);
  const [eventCreationLocation, setEventCreationLocation] = useState(null);
  const [showEventsOnMap, setShowEventsOnMap] = useState(true);

  // Default hardcoded location
  const staticLocation = { latitude: 56.96472220, longitude: 24.01670780 };

  // Check Waku status periodically
  useEffect(() => {
    const checkWakuStatus = () => {
      try {
        const status = getWakuStatus();
        setWakuStatus(status);
      } catch (err) {
        console.error('Error checking Waku status:', err);
        setWakuStatus('error');
      }
    };

    checkWakuStatus();
    const interval = setInterval(checkWakuStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  // Auto-show friend requests when new ones arrive
  useEffect(() => {
    if (friendRequests.length > 0) {
      setShowFriendRequests(true);
    } else {
      setShowFriendRequests(false);
    }
  }, [friendRequests.length]);

  // Handle event and portal errors
  const currentError = portalError || eventsError;
  const clearCurrentError = () => {
    setPortalError(null);
    clearEventsError();
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }, []);

  // Find the closest event to user's location or Berlin if no user location
  const closestEvent = useMemo(() => {
    if (!events || events.length === 0) return null;

    const referenceLocation = userLocation || staticLocation;

    let closest = events[0];
    let minDistance = calculateDistance(
      referenceLocation.latitude,
      referenceLocation.longitude,
      closest.latitude,
      closest.longitude,
    );

    for (let i = 1; i < events.length; i++) {
      const distance = calculateDistance(
        referenceLocation.latitude,
        referenceLocation.longitude,
        events[i].latitude,
        events[i].longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        closest = events[i];
      }
    }

    return { event: closest, distance: minDistance };
  }, [events, userLocation, calculateDistance, staticLocation]);

  // Dynamic map center: user location > closest event > Berlin Prenzlauer Berg
  const mapCenter = useMemo(() => {
    // Priority 1: User's actual location (most private and relevant)
    if (userLocation) {
      return [userLocation.latitude, userLocation.longitude];
    }

    // Priority 2: Closest event location (shows activity)
    if (closestEvent?.event) {
      return [closestEvent.event.latitude, closestEvent.event.longitude];
    }

    // Priority 3: Berlin Prenzlauer Berg fallback
    return [staticLocation.latitude, staticLocation.longitude];
  }, [userLocation, closestEvent, staticLocation]);

  // Auto sign-in anonymously for privacy
  useEffect(() => {
    if (!user) {
      signInAnonymously();
    }
  }, [user, signInAnonymously]);

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (currentError) {
      const timer = setTimeout(() => {
        clearCurrentError();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [currentError]);

  const handleCreateEvent = async () => {
    if (!user || isPlacingPin) return;

    setIsPlacingPin(true);
    setPortalError(null);

    try {
      const location = await getCurrentLocation();
      const { data, error } = await createEvent(location);

      if (error) {
        setPortalError(error);
      }
    } catch (err) {
      const errorMsg = err.message || err.toString();
      setPortalError(errorMsg);
    } finally {
      setIsPlacingPin(false);
    }
  };

  const handleCloseEvent = async () => {
    setPortalError(null);
    const { error } = await cancelEvent();
    if (error) {
      setPortalError(error);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventDetails(true);

    // Force focus on mobile to ensure the modal appears
    setTimeout(() => {
      const eventModal = document.querySelector('[role="dialog"]');
      if (eventModal) {
        eventModal.focus();
      }
    }, 100);
  };

  const handleAcceptFriendRequest = async (fren) => {
    try {
      const success = await acceptFriendRequest(fren);
      if (success) {
        console.log('Friend request accepted successfully');
      }
    } catch (err) {
      setPortalError('Failed to accept friend request');
    }
  };

  const handleDeclineFriendRequest = (fren) => {
    declineFriendRequest(fren);
  };

  // Event handlers for long press creation
  const handleLongPress = (latlng, containerPoint) => {
    console.log('Long press detected at:', latlng);
    setEventCreationLocation(latlng);
    setShowEventCreation(true);
  };

  const handleCreateEventFromModal = async (eventData) => {
    try {
      const { data, error } = await createEvent(eventData);
      if (error) {
        throw new Error(error);
      }
      console.log('Event created successfully:', data);
      return data;
    } catch (err) {
      console.error('Event creation failed:', err);
      throw err;
    }
  };

  const handleJoinEvent = async (eventId) => {
    try {
      const { data, error } = await joinEvent(eventId);
      if (error) {
        throw new Error(error);
      }
      // Update the selected event if it's the same one
      if (selectedEvent && selectedEvent.id === eventId) {
        setSelectedEvent(data);
      }
      return data;
    } catch (err) {
      console.error('Failed to join event:', err);
      throw err;
    }
  };

  const handleLeaveEvent = async (eventId) => {
    try {
      const { data, error } = await leaveEvent(eventId);
      if (error) {
        throw new Error(error);
      }
      // Update the selected event if it's the same one
      if (selectedEvent && selectedEvent.id === eventId) {
        setSelectedEvent(data);
      }
      return data;
    } catch (err) {
      console.error('Failed to leave event:', err);
      throw err;
    }
  };

  const handleCancelEvent = async (eventId) => {
    try {
      const { data, error } = await cancelEvent(eventId);
      if (error) {
        throw new Error(error);
      }
      // Close details modal if the cancelled event is currently selected
      if (selectedEvent && selectedEvent.id === eventId) {
        setShowEventDetails(false);
        setSelectedEvent(null);
      }
      return data;
    } catch (err) {
      console.error('Failed to cancel event:', err);
      throw err;
    }
  };

  return (
    <div className='relative h-screen w-full overflow-hidden'>
      {/* Enhanced Error Toast */}
      <AnimatePresence>
        <ErrorToast
          error={currentError}
          onDismiss={clearCurrentError}
        />
      </AnimatePresence>

      {/* Friend Request Indicator */}
      <FriendRequestIndicator
        friendRequests={friendRequests}
        onShowRequests={() => setShowFriendRequests(true)}
      />

      {/* Loading overlay */}
      <AnimatePresence>
        {(isPlacingPin || eventsLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 flex items-center justify-center bg-black/30 z-[2100]'
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className='bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl'
            >
              <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-500'>
              </div>
              <span className='font-medium'>
                {isPlacingPin ? 'Creating event...' : 'Loading events...'}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friend Requests Modal */}
      <AnimatePresence>
        {showFriendRequests && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2200]'
            onClick={() => setShowFriendRequests(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className='bg-gray-800 rounded-2xl p-6 m-4 max-w-md w-full border border-gray-700 shadow-2xl max-h-96 overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-xl font-semibold text-white'>Friend Requests</h2>
                <button
                  onClick={() => setShowFriendRequests(false)}
                  className='text-gray-400 hover:text-white'
                >
                  ✕
                </button>
              </div>

              {friendRequests.length === 0
                ? (
                  <p className='text-gray-400 text-center py-8'>
                    No pending friend requests
                  </p>
                )
                : (
                  <div className='space-y-3'>
                    {friendRequests.map((fren, index) => (
                      <div
                        key={index}
                        className='flex items-center justify-between p-3 bg-gray-700 rounded-lg'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center'>
                            <span className='text-white font-bold'>
                              {fren.nik.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className='text-white font-medium'>{fren.nik}</p>
                            <p className='text-gray-400 text-xs'>Wants to connect</p>
                          </div>
                        </div>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => handleAcceptFriendRequest(fren)}
                            className='bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm'
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineFriendRequest(fren)}
                            className='bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-lg text-sm'
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Container with Dynamic Center */}
      <MapContainer
        key={`${mapCenter[0]}-${mapCenter[1]}`}
        center={mapCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        boxZoom={true}
        keyboard={true}
      >
        <MapLayers maptilerApiKey={maptilerApiKey} />
        <MapControls />
        <MapEventHandler onLongPress={handleLongPress} />

        {/* User's Event Marker (shows user's own event) */}
        {userEvent && (
          <EventMarkers
            events={[userEvent]}
            user={user}
            onJoin={handleJoinEvent}
            onLeave={handleLeaveEvent}
            onCancel={handleCancelEvent}
            onViewDetails={handleEventClick}
          />
        )}

        {/* Other Event Markers (all events except user's own) */}
        {showEventsOnMap && (
          <EventMarkers
            events={events.filter(event => event.creator_user_id !== user?.id)}
            user={user}
            onJoin={handleJoinEvent}
            onLeave={handleLeaveEvent}
            onCancel={handleCancelEvent}
            onViewDetails={handleEventClick}
          />
        )}

        {/* Message Flow Animation Overlay */}
        <MessageFlowOverlay portals={events} />
      </MapContainer>

      {/* Event Creation Modal */}
      <EventCreationModal
        isOpen={showEventCreation}
        onClose={() => {
          setShowEventCreation(false);
          setEventCreationLocation(null);
        }}
        onCreateEvent={handleCreateEventFromModal}
        location={eventCreationLocation}
      />

      {/*  Event Details Modal with Chat */}
      <EventDetailsModal
        isOpen={showEventDetails}
        onClose={() => {
          setShowEventDetails(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        user={user}
        onJoin={handleJoinEvent}
        onLeave={handleLeaveEvent}
        onCancel={handleCancelEvent}
      />

      {/* Enhanced Hybrid Status Indicator */}
      <div className='fixed top-4 right-4 z-[1500]'>
        <motion.div
          animate={{
            scale: (connectionStatus === 'connecting' || wakuStatus === 'connecting')
              ? [1, 1.2, 1]
              : 1,
            opacity: (connectionStatus === 'connected' && wakuStatus === 'connected')
              ? 0.8
              : 1,
          }}
          transition={{
            repeat: (connectionStatus === 'connecting' || wakuStatus === 'connecting')
              ? Infinity
              : 0,
            duration: 1.5,
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
            connectionStatus === 'connected' && wakuStatus === 'connected'
              ? 'bg-green-500 text-white'
              : (connectionStatus === 'connecting' || wakuStatus === 'connecting')
              ? 'bg-yellow-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          <span className='text-sm'>🌀</span>
          <span>
            {connectionStatus === 'connected' && wakuStatus === 'connected'
              ? 'p2p on'
              : (connectionStatus === 'connecting' || wakuStatus === 'connecting')
              ? 'Connecting...'
              : 'p2p off'}
          </span>
          {friends.length > 0 && (
            <>
              <div className='w-1 h-1 bg-white rounded-full opacity-60'></div>
              <span className='text-xs'>{friends.length} friends</span>
            </>
          )}
        </motion.div>
      </div>

      {/* Footer Banner */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm text-white py-2 px-4 z-[1500]">
        <div className="flex items-center justify-center gap-4 text-sm">
          <a 
            href="https://github.com/sunsakis/portal" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-blue-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </a>
          
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          
          <a 
            href="mailto:dev@portal.live"
            className="hover:text-blue-400 transition-colors"
          >
            dev@portal.live
          </a>

          {/* Event count indicator */}
          {events.length > 0 && (
            <>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <span className="text-purple-400">
                📅 {events.length} events
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}