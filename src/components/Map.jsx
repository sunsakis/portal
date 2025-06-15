import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { MapContainer } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'

import { useLocalAuth, useGeolocation, useLocalPortals } from '../hooks/useLocalHooks'
import { MapControls, MapEventHandler } from './MapControls'
import { UserPortalMarker, OtherPortalsMarkers } from './MapMarkers'
import ChatPortal from './ChatPortal'
import MapLayers from './MapLayers'
import ConnectionStatus from './ConnectionStatus'
import MessageFlowOverlay from './MessageFlowOverlay'
import { getWakuStatus } from '../waku/node'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

// UX-friendly error toast component
const ErrorToast = ({ error, onDismiss }) => {
  if (!error) return null

  const getErrorConfig = (errorMsg) => {
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
      color: 'bg-gray-500',
      suggestion: 'Please try again in a moment'
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
  
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [showChatPortal, setShowChatPortal] = useState(false)
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  const [wakuStatus, setWakuStatus] = useState('connecting')
  const [portalError, setPortalError] = useState(null)

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

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* UX-Friendly Error Toast */}
      <AnimatePresence>
        <ErrorToast 
          error={portalError} 
          onDismiss={() => setPortalError(null)} 
        />
      </AnimatePresence>

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

      {/* Map Container with Dynamic Center */}
      <MapContainer
        key={`${mapCenter[0]}-${mapCenter[1]}`} // Force re-render when center changes
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

      {/* Chat Portal Interface */}
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
            <span>Creating...</span>
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

      {/* Hybrid Status Indicator */}
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
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            connectionStatus === 'connected' && wakuStatus === 'connected'
              ? 'bg-green-500 text-white' 
              : (connectionStatus === 'connecting' || wakuStatus === 'connecting')
              ? 'bg-yellow-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {connectionStatus === 'connected' && wakuStatus === 'connected' ? '🌀 Hybrid Online' : 
           (connectionStatus === 'connecting' || wakuStatus === 'connecting') ? '🌀 Connecting...' : 
           '🌀 Hybrid Offline'}
        </motion.div>
      </div>
    </div>
  )
}