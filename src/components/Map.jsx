import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { MapContainer } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'

import { useLocalAuth, useGeolocation, useLocalPortals } from '../hooks/useLocalHooks'
import { MapControls, MapEventHandler } from './MapControls'
import { UserPortalMarker, OtherPortalsMarkers } from './MapMarkers'
import ChatPortal from './ChatPortal'
import MapLayers from './MapLayers'
import ConnectionStatus from './ConnectionStatus'
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
  const [portalError, setPortalError] = useState(null) // UX-friendly error state
  
  // ALWAYS VISIBLE Debug Console for Mobile Testing
  const [debugInfo, setDebugInfo] = useState([])
  const [debugMinimized, setDebugMinimized] = useState(false)

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

  // Debug logging - ALWAYS ACTIVE for mobile testing (FIXED - memoized to prevent loops)
  const addDebugLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugInfo(prev => [...prev.slice(-20), { timestamp, message, type }])
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`)
  }, []) // No dependencies to prevent loops

  // Auto sign-in anonymously for privacy
  useEffect(() => {
    if (!user) {
      addDebugLog('Creating anonymous local user...', 'info')
      signInAnonymously()
    }
  }, [user, signInAnonymously, addDebugLog])

  // Initial debug info
  useEffect(() => {
    addDebugLog('Portal app initialized: Supabase + Waku hybrid', 'info')
    addDebugLog(`Environment: ${import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'}`, 'info')
    addDebugLog('Privacy: Supabase portals + Waku P2P messages', 'success')
  }, [addDebugLog])

  // Log map center changes (FIXED - only log when center actually changes)
  const mapCenterString = `${mapCenter[0].toFixed(4)},${mapCenter[1].toFixed(4)}`
  const prevMapCenterRef = useRef('')
  
  useEffect(() => {
    if (prevMapCenterRef.current !== mapCenterString) {
      prevMapCenterRef.current = mapCenterString
      const centerType = userLocation ? 'User GPS' : 
                        closestPortal ? `Closest Portal (${closestPortal.distance.toFixed(1)}km away)` : 
                        'Berlin Prenzlauer Berg'
      console.log(`Map center: ${centerType} [${mapCenterString}]`)
    }
  }, [mapCenterString, userLocation, closestPortal])

  // Log connection status changes (FIXED - only console.log, no addDebugLog)
  useEffect(() => {
    console.log(`Supabase: ${connectionStatus} | Waku: ${wakuStatus}`)
  }, [connectionStatus, wakuStatus])

  // Log portal changes (FIXED - only console.log, no addDebugLog)
  useEffect(() => {
    console.log(`Supabase portals nearby: ${portals.length}`)
    if (userPortal) {
      console.log(`User portal active: ${userPortal.id}`)
    }
    if (closestPortal) {
      console.log(`Closest portal: ${closestPortal.distance.toFixed(1)}km away`)
    }
  }, [portals.length, userPortal?.id, closestPortal?.distance])

  // Chat state logging (separate, no loops)
  useEffect(() => {
    console.log('Chat state - Selected portal:', selectedPortal?.id)
    console.log('Chat state - Show chat:', showChatPortal)
  }, [selectedPortal?.id, showChatPortal])

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

    addDebugLog('Creating Supabase portal...', 'info')
    setIsPlacingPin(true)
    setPortalError(null) // Clear any previous errors

    try {
      addDebugLog('Requesting GPS location...', 'info')
      const location = await getCurrentLocation()
      addDebugLog(`Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} (±${location.accuracy}m)`, 'success')
      
      const { data, error } = await createPortal(location)

      if (error) {
        addDebugLog(`Supabase portal creation failed: ${error}`, 'error')
        setPortalError(error) // Show UX-friendly error
      } else {
        addDebugLog(`Supabase portal created: ${data.id}`, 'success')
        addDebugLog('Portal saved to database...', 'info')
      }
    } catch (err) {
      const errorMsg = err.message || err.toString()
      addDebugLog(`GPS error: ${errorMsg}`, 'error')
      setPortalError(errorMsg) // Show UX-friendly error
    } finally {
      setIsPlacingPin(false)
    }
  }

  const handleClosePortal = async () => {
    addDebugLog('Closing Supabase portal...', 'info')
    setPortalError(null) // Clear any errors
    
    const { error } = await closePortal()
    if (error) {
      addDebugLog(`Close failed: ${error}`, 'error')
      setPortalError(error) // Show UX-friendly error
    } else {
      addDebugLog('Portal closed successfully', 'success')
    }
  }

  const handlePortalClick = (portal) => {
    console.log('Portal clicked:', portal)
    addDebugLog(`Opening Waku chat for portal: ${portal.id}`, 'info')
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

  const handleClearData = () => {
    addDebugLog('Clearing all local data...', 'warning')
    localStorage.removeItem('portal_user')
    localStorage.removeItem('portal_messages')
    localStorage.removeItem('portal_data')
    window.location.reload()
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
          addDebugLog('Manual refresh (Supabase + Waku mode)', 'info')
          window.location.reload()
        }}
      />

      {/* ALWAYS VISIBLE Debug Console for Mobile Testing */}
      <motion.div
        initial={{ x: debugMinimized ? '85%' : 0 }}
        animate={{ x: debugMinimized ? '85%' : 0 }}
        className="fixed top-16 right-2 w-72 max-h-80 bg-black/90 text-white z-[2000] flex flex-col rounded-lg shadow-xl border border-gray-700"
      >
        {/* Debug Header */}
        <div className="flex items-center justify-between p-2 bg-black/80 border-b border-gray-600 rounded-t-lg">
          <h3 className="text-xs font-bold">🌀 Debug Console (SUPABASE + WAKU)</h3>
          <div className="flex gap-1">
            <button
              onClick={() => setDebugMinimized(!debugMinimized)}
              className="text-white/60 hover:text-white text-xs px-1 py-0.5 rounded"
            >
              {debugMinimized ? '◀' : '▶'}
            </button>
            <button
              onClick={() => setDebugInfo([])}
              className="text-white/60 hover:text-white text-xs px-1 py-0.5 rounded"
            >
              🗑
            </button>
          </div>
        </div>
        
        {!debugMinimized && (
          <>
            {/* Status Section */}
            <div className="p-2 border-b border-gray-600 text-xs">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>User: {user ? '✅' : '❌'}</div>
                <div>Portal: {userPortal ? '🟢' : '⚪'}</div>
                <div>Nearby: {portals.length}</div>
                <div>GPS: {userLocation ? '🟢' : '🔴'}</div>
                <div>Chat: {showChatPortal ? '💬' : '⚪'}</div>
                <div>Supabase: {connectionStatus === 'connected' ? '🟢' : connectionStatus === 'connecting' ? '🟡' : '🔴'}</div>
                <div>Waku: {wakuStatus === 'connected' ? '🟢' : wakuStatus === 'connecting' ? '🟡' : '🔴'}</div>
                <div>Error: {portalError ? '🔴' : '🟢'}</div>
              </div>
              <div className="mt-1 text-xs text-gray-300">
                Mode: SUPABASE PORTALS + WAKU MESSAGES
              </div>
              <div className="text-xs text-gray-300">
                Center: {userLocation ? 'GPS' : closestPortal ? 'Portal' : 'Berlin'}
              </div>
              {selectedPortal && (
                <div className="text-xs text-yellow-300 mt-1">
                  Chat Portal: {selectedPortal.id}
                </div>
              )}
              {portalError && (
                <div className="text-xs text-red-300 mt-1 truncate">
                  Error: {portalError.slice(0, 30)}...
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-2 border-b border-gray-600">
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => getCurrentLocation().then(loc => {
                    addDebugLog(`GPS: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)} ±${loc.accuracy}m`, 'success')
                  }).catch(err => {
                    addDebugLog(`GPS failed: ${err.message}`, 'error')
                  })}
                  className="text-xs bg-green-600 px-2 py-1 rounded flex-1"
                >
                  Test GPS
                </button>
                <button
                  onClick={() => {
                    addDebugLog('Refreshing app...', 'info')
                    window.location.reload()
                  }}
                  className="text-xs bg-blue-600 px-2 py-1 rounded flex-1"
                >
                  Refresh
                </button>
              </div>
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => {
                    if (userPortal) {
                      addDebugLog('Testing user portal click...', 'info')
                      handlePortalClick(userPortal)
                    } else if (portals.length > 0) {
                      addDebugLog('Testing first portal click...', 'info')
                      handlePortalClick(portals[0])
                    } else {
                      addDebugLog('No portals to test', 'warning')
                    }
                  }}
                  className="text-xs bg-purple-600 px-2 py-1 rounded flex-1"
                >
                  Test Chat
                </button>
                <button
                  onClick={() => {
                    addDebugLog('Force closing chat...', 'info')
                    setShowChatPortal(false)
                    setSelectedPortal(null)
                  }}
                  className="text-xs bg-orange-600 px-2 py-1 rounded flex-1"
                >
                  Close Chat
                </button>
              </div>
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => {
                    setPortalError(null)
                    addDebugLog('Cleared portal error', 'info')
                  }}
                  className="text-xs bg-yellow-600 px-2 py-1 rounded flex-1"
                >
                  Clear Error
                </button>
                <button
                  onClick={() => {
                    setPortalError('Test error: Another portal is only 8.3m away. Portals must be at least 10m apart for privacy.')
                    addDebugLog('Testing error toast', 'info')
                  }}
                  className="text-xs bg-red-600 px-2 py-1 rounded flex-1"
                >
                  Test Error
                </button>
              </div>
              <button
                onClick={handleClearData}
                className="text-xs bg-red-600 px-2 py-1 rounded w-full"
              >
                Clear All Data
              </button>
            </div>

            {/* Console Logs */}
            <div className="flex-1 overflow-y-auto p-2 max-h-48">
              <div className="text-xs space-y-1">
                {debugInfo.length === 0 ? (
                  <div className="text-gray-400">Hybrid console ready...</div>
                ) : (
                  debugInfo.slice(-8).map((log, i) => (
                    <div key={i} className={`p-1 rounded text-xs ${
                      log.type === 'error' ? 'bg-red-900/50 text-red-200' :
                      log.type === 'success' ? 'bg-green-900/50 text-green-200' :
                      log.type === 'warning' ? 'bg-yellow-900/50 text-yellow-200' :
                      'bg-gray-800/50 text-gray-300'
                    }`}>
                      <span className="text-gray-400 text-xs">{log.timestamp}</span>
                      <div className="text-xs">{log.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>

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
              <span className="font-medium">Creating Supabase portal...</span>
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
      </MapContainer>

      {/* Chat Portal Interface */}
      <ChatPortal
        isOpen={showChatPortal}
        onClose={() => {
          addDebugLog('Chat closed', 'info')
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