import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { MapContainer } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'

import { useLocalAuth, useGeolocation, useLocalPortals, useFriendRequests } from '../hooks/useLocalHooks'
import { MapControls, MapEventHandler } from './MapControls'
import { UserPortalMarker, OtherPortalsMarkers } from './MapMarkers'
import ChatPortal from './ChatPortal'
import MapLayers from './MapLayers'
import ConnectionStatus from './ConnectionStatus'
import MessageFlowOverlay from './MessageFlowOverlay'
import { getWakuStatus, frenRequests } from '../waku/node'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

// Enhanced Friend Request Status Indicator
const FriendRequestIndicator = ({ friendRequests, onShowRequests }) => {
  if (friendRequests.length === 0) return null

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onShowRequests}
      className="fixed top-16 right-4 z-[1500] bg-blue-600 text-white rounded-full shadow-xl flex items-center gap-2 px-4 py-2"
    >
      <span className="text-lg">👋</span>
      <span className="text-sm font-medium">{friendRequests.length}</span>
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-2 h-2 bg-white rounded-full"
      />
    </motion.button>
  )
}

// Enhanced Error Toast with friend request context
const ErrorToast = ({ error, onDismiss }) => {
  if (!error) return null

  const getErrorConfig = (errorMsg) => {
    if (errorMsg.includes('friend request')) {
      return {
        icon: '👋',
        title: 'Friend Request Issue',
        message: errorMsg,
        color: 'bg-blue-500',
        suggestion: 'Check your connection and try again'
      }
    }
    
    if (errorMsg.includes('only') && errorMsg.includes('away')) {
      return {
        icon: '📍',
        title: 'Too Close to Another Portal',
        message: errorMsg,
        color: 'bg-orange-500',
        suggestion: 'Try moving at least 10 meters away from other portals'
      }
    }
    
    if (errorMsg.includes('GPS') || errorMsg.includes('location')) {
      return {
        icon: '🛰️',
        title: 'Location Issue',
        message: errorMsg,
        color: 'bg-red-500',
        suggestion: 'Make sure location services are enabled and try moving outdoors'
      }
    }
    
    if (errorMsg.includes('network') || errorMsg.includes('connection')) {
      return {
        icon: '📡',
        title: 'Connection Problem',
        message: errorMsg,
        color: 'bg-blue-500',
        suggestion: 'Check your internet connection and try again'
      }
    }
    
    return {
      icon: '⚠️',
      title: 'Portal Creation Failed',
      message: errorMsg,
      color: 'bg-gray-500'
    }
  }

  const config = getErrorConfig(error)

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 ${config.color} text-white rounded-lg shadow-xl z-[2000] mx-auto max-w-sm`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">{config.title}</h3>
            <p className="text-sm opacity-90 mb-2">{config.message}</p>
            <p className="text-xs opacity-75">{config.suggestion}</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-white/60 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function Map() {
  const { user, signInAnonymously } = useLocalAuth()
  const { error: geoError, getCurrentLocation, location: userLocation } = useGeolocation()
  const { portals, userPortal, createPortal, closePortal, connectionStatus } = useLocalPortals(user)
  const { friendRequests, friends, acceptFriendRequest, declineFriendRequest } = useFriendRequests(user)
  
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [showChatPortal, setShowChatPortal] = useState(false)
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  const [wakuStatus, setWakuStatus] = useState('connecting')
  const [portalError, setPortalError] = useState(null)
  const [showFriendRequests, setShowFriendRequests] = useState(false)

  // Default fallback location (Berlin Prenzlauer Berg) - Privacy-friendly
  const berlinPrenzlauerBerg = { latitude: 52.5396, longitude: 13.4127 }

  // Check Waku status periodically
  useEffect(() => {
    const checkWakuStatus = () => {
      try {
        const status = getWakuStatus()
        setWakuStatus(status)
      } catch (err) {
        console.error('Error checking Waku status:', err)
        setWakuStatus('error')
      }
    }

    checkWakuStatus()
    const interval = setInterval(checkWakuStatus, 3000)
    
    return () => clearInterval(interval)
  }, [])

  // Auto-show friend requests when new ones arrive
  useEffect(() => {
    if (friendRequests.length > 0) {
      // Show friend requests modal when there are pending requests
      setShowFriendRequests(true)
    } else {
      // Hide modal when no requests
      setShowFriendRequests(false)
    }
  }, [friendRequests.length])

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in kilometers
  }, [])

  // Find the closest portal to user's location or Berlin if no user location
  const closestPortal = useMemo(() => {
    if (!portals || portals.length === 0) return null

    const referenceLocation = userLocation || berlinPrenzlauerBerg
    
    let closest = portals[0]
    let minDistance = calculateDistance(
      referenceLocation.latitude, 
      referenceLocation.longitude,
      closest.latitude, 
      closest.longitude
    )

    for (let i = 1; i < portals.length; i++) {
      const distance = calculateDistance(
        referenceLocation.latitude, 
        referenceLocation.longitude,
        portals[i].latitude, 
        portals[i].longitude
      )
      
      if (distance < minDistance) {
        minDistance = distance
        closest = portals[i]
      }
    }

    return { portal: closest, distance: minDistance }
  }, [portals, userLocation, calculateDistance, berlinPrenzlauerBerg])

  // Dynamic map center: user location > closest portal > Berlin Prenzlauer Berg
  const mapCenter = useMemo(() => {
    // Priority 1: User's actual location (most private and relevant)
    if (userLocation) {
      return [userLocation.latitude, userLocation.longitude]
    }
    
    // Priority 2: Closest portal location (shows activity)
    if (closestPortal?.portal) {
      return [closestPortal.portal.latitude, closestPortal.portal.longitude]
    }
    
    // Priority 3: Berlin Prenzlauer Berg fallback
    return [berlinPrenzlauerBerg.latitude, berlinPrenzlauerBerg.longitude]
  }, [userLocation, closestPortal, berlinPrenzlauerBerg])

  // Auto sign-in anonymously for privacy
  useEffect(() => {
    if (!user) {
      signInAnonymously()
    }
  }, [user, signInAnonymously])

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (portalError) {
      const timer = setTimeout(() => {
        setPortalError(null)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [portalError])

  const handleCreatePortal = async () => {
    if (!user || isPlacingPin) return

    setIsPlacingPin(true)
    setPortalError(null) // Clear any previous errors

    try {
      const location = await getCurrentLocation()
      
      const { data, error } = await createPortal(location)

      if (error) {
        setPortalError(error) // Show UX-friendly error
      }
    } catch (err) {
      const errorMsg = err.message || err.toString()
      setPortalError(errorMsg) // Show UX-friendly error
    } finally {
      setIsPlacingPin(false)
    }
  }

  const handleClosePortal = async () => {
    setPortalError(null) // Clear any errors
    
    const { error } = await closePortal()
    if (error) {
      setPortalError(error) // Show UX-friendly error
    }
  }

  const handlePortalClick = (portal) => {
    setSelectedPortal(portal)
    setShowChatPortal(true)
    
    // Force focus on mobile to ensure the modal appears
    setTimeout(() => {
      const chatModal = document.querySelector('[role="dialog"]')
      if (chatModal) {
        chatModal.focus()
      }
    }, 100)
  }

  const handleAcceptFriendRequest = async (fren) => {
    try {
      const success = await acceptFriendRequest(fren)
      if (success) {
        console.log('Friend request accepted successfully')
      }
    } catch (err) {
      setPortalError('Failed to accept friend request')
    }
  }

  const handleDeclineFriendRequest = (fren) => {
    declineFriendRequest(fren)
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Enhanced Error Toast */}
      <AnimatePresence>
        <ErrorToast 
          error={portalError} 
          onDismiss={() => setPortalError(null)} 
        />
      </AnimatePresence>

      {/* Friend Request Indicator */}
      <FriendRequestIndicator 
        friendRequests={friendRequests}
        onShowRequests={() => setShowFriendRequests(true)}
      />

      {/* Connection Status */}
      <ConnectionStatus 
        connectionStatus={connectionStatus === 'connected' ? 'connected' : connectionStatus === 'connecting' ? 'connecting' : 'error'}
        onRetry={() => {
          window.location.reload()
        }}
      />

      {/* Loading overlay */}
      <AnimatePresence>
        {isPlacingPin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/30 z-[2100]"
          >
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl"
            >
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
              <span className="font-medium">Creating portal...</span>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2200]"
            onClick={() => setShowFriendRequests(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="bg-gray-800 rounded-2xl p-6 m-4 max-w-md w-full border border-gray-700 shadow-2xl max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Friend Requests</h2>
                <button
                  onClick={() => setShowFriendRequests(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              {friendRequests.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No pending friend requests</p>
              ) : (
                <div className="space-y-3">
                  {friendRequests.map((fren, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">
                            {fren.nik.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{fren.nik}</p>
                          <p className="text-gray-400 text-xs">Wants to connect</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptFriendRequest(fren)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineFriendRequest(fren)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-lg text-sm"
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
        zoom={17}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        boxZoom={true}
        keyboard={true}
      >
        <MapLayers maptilerApiKey={import.meta.env.VITE_MAPTILER_API} />
        <MapControls />
        <MapEventHandler />
        
        <UserPortalMarker 
          portal={userPortal} 
          onPortalClick={handlePortalClick} 
        />
        
        <OtherPortalsMarkers 
          portals={portals}
          userId={user?.id}
          onPortalClick={handlePortalClick}
        />

        {/* Message Flow Animation Overlay */}
        <MessageFlowOverlay portals={portals} />
      </MapContainer>

      {/* Enhanced Chat Portal with Friend Requests */}
      <ChatPortal
        isOpen={showChatPortal}
        onClose={() => {
          setShowChatPortal(false)
        }}
        portal={selectedPortal}
        user={user}
      />

      {/* Main Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 justify-center portal-button-center ${
          userPortal 
            ? 'bg-red-500 hover:bg-red-600 opacity-50' 
            : 'bg-green-500 hover:bg-green-600 opacity-50'
        } text-white px-6 py-4 rounded-full shadow-xl flex items-center gap-3 font-semibold transition-colors z-[1600]`}
        style={{ 
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' 
        }}
        onClick={userPortal ? handleClosePortal : handleCreatePortal}
        disabled={isPlacingPin}
      >
        {isPlacingPin ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Opening...</span>
          </>
        ) : userPortal ? (
          <>
            <span>Close Portal</span>
          </>
        ) : (
          <>
            <span className="text-xl">🌀</span>
            <span>Open Portal</span>
          </>
        )}
      </motion.button>

      {/* Enhanced Hybrid Status Indicator */}
      <div className="fixed top-4 right-4 z-[1500]">
        <motion.div
          animate={{ 
            scale: (connectionStatus === 'connecting' || wakuStatus === 'connecting') ? [1, 1.2, 1] : 1,
            opacity: (connectionStatus === 'connected' && wakuStatus === 'connected') ? 0.8 : 1
          }}
          transition={{ 
            repeat: (connectionStatus === 'connecting' || wakuStatus === 'connecting') ? Infinity : 0,
            duration: 1.5 
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
            connectionStatus === 'connected' && wakuStatus === 'connected'
              ? 'bg-green-500 text-white' 
              : (connectionStatus === 'connecting' || wakuStatus === 'connecting')
              ? 'bg-yellow-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          <span className="text-sm">🌀</span>
          <span>
            {connectionStatus === 'connected' && wakuStatus === 'connected' ? 'p2p on' : 
             (connectionStatus === 'connecting' || wakuStatus === 'connecting') ? 'Connecting...' : 
             'p2p off'}
          </span>
          {friends.length > 0 && (
            <>
              <div className="w-1 h-1 bg-white rounded-full opacity-60"></div>
              <span className="text-xs">{friends.length} friends</span>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}