import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'

import { useSupabaseAuth, useGeolocation, usePortals } from '../hooks/useSupabase'
import { MapControls, MapEventHandler } from './MapControls'
import { UserPortalMarker, OtherPortalsMarkers } from './MapMarkers'
import ChatPortal from './ChatPortal'
import MapLayers from './MapLayers'
import ConnectionStatus from './ConnectionStatus'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

export default function Map() {
  const { user, signInAnonymously } = useSupabaseAuth()
  const { error: geoError, getCurrentLocation } = useGeolocation()
  const { portals, userPortal, createPortal, closePortal, connectionStatus } = usePortals(user)
  
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [showChatPortal, setShowChatPortal] = useState(false)
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  
  // ALWAYS VISIBLE Debug Console for Mobile Testing
  const [debugInfo, setDebugInfo] = useState([])
  const [debugMinimized, setDebugMinimized] = useState(false)

  // Default location (Vilnius) - Privacy-friendly fallback
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }

  // Debug logging - ALWAYS ACTIVE for mobile testing
  const addDebugLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugInfo(prev => [...prev.slice(-20), { timestamp, message, type }])
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`)
  }, [])

  // Auto sign-in anonymously for privacy
  useEffect(() => {
    if (!user) {
      addDebugLog('Attempting anonymous sign-in...', 'info')
      signInAnonymously()
    }
  }, [user, signInAnonymously, addDebugLog])

  // Initial debug info
  useEffect(() => {
    addDebugLog('Portal app initialized', 'info')
    addDebugLog(`Environment: ${import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'}`, 'info')
    addDebugLog('Privacy mode: Anonymous authentication', 'success')
  }, [addDebugLog])

  // Log connection status changes
  useEffect(() => {
    addDebugLog(`Connection: ${connectionStatus}`, connectionStatus === 'connected' ? 'success' : 'warning')
  }, [connectionStatus, addDebugLog])

  // Log portal changes
  useEffect(() => {
    addDebugLog(`Portals nearby: ${portals.length}`, 'info')
    if (userPortal) {
      addDebugLog(`User portal active`, 'success')
    }
  }, [portals, userPortal, addDebugLog])

  const handleCreatePortal = async () => {
    if (!user || isPlacingPin) return

    addDebugLog('Creating portal...', 'info')
    setIsPlacingPin(true)

    try {
      addDebugLog('Requesting GPS location...', 'info')
      const userLocation = await getCurrentLocation()
      addDebugLog(`Location: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)} (±${userLocation.accuracy}m)`, 'success')
      
      const { data, error } = await createPortal(userLocation)

      if (error) {
        addDebugLog(`Portal creation failed: ${error}`, 'error')
      } else {
        addDebugLog('Portal created successfully', 'success')
        
        // Auto-close after 5 minutes for privacy
        setTimeout(() => {
          handleClosePortal()
          addDebugLog('Portal auto-closed for privacy', 'info')
        }, 300000)
      }
    } catch (err) {
      const errorMsg = err.message || err.toString()
      addDebugLog(`GPS error: ${errorMsg}`, 'error')
    } finally {
      setIsPlacingPin(false)
    }
  }

  const handleClosePortal = async () => {
    addDebugLog('Closing portal...', 'info')
    const { error } = await closePortal()
    if (error) {
      addDebugLog(`Close failed: ${error}`, 'error')
    } else {
      addDebugLog('Portal closed', 'success')
    }
  }

  const handlePortalClick = (portal) => {
    addDebugLog(`Opening chat for portal: ${portal.id.slice(0, 8)}`, 'info')
    setSelectedPortal(portal)
    setShowChatPortal(true)
  }

  const centerPosition = [defaultLocation.latitude, defaultLocation.longitude]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Connection Status */}
      <ConnectionStatus 
        connectionStatus={connectionStatus}
        onRetry={() => {
          addDebugLog('Manual connection retry', 'info')
          signInAnonymously()
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
          <h3 className="text-xs font-bold">🐛 Debug Console</h3>
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
                <div>GPS: {connectionStatus === 'connected' ? '🟢' : '🔴'}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-2 border-b border-gray-600">
              <div className="flex gap-1">
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
            </div>

            {/* Console Logs */}
            <div className="flex-1 overflow-y-auto p-2 max-h-48">
              <div className="text-xs space-y-1">
                {debugInfo.length === 0 ? (
                  <div className="text-gray-400">Console ready...</div>
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
              <span className="font-medium">Getting your location...</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Container */}
      <MapContainer
        center={centerPosition}
        zoom={13}
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
        className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 justify ${
          userPortal 
            ? 'bg-red-500 hover:bg-red-600 opacity-50' 
            : 'bg-green-500 hover:bg-green-600 opacity-50'
        } text-white px-6 py-4 rounded-full shadow-xl flex items-center gap-3 font-semibold transition-colors z-[1600]`}
        style={{ marginBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
        onClick={userPortal ? handleClosePortal : handleCreatePortal}
        disabled={isPlacingPin}
      >
        {isPlacingPin ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Locating...</span>
          </>
        ) : userPortal ? (
          <>
            <span className="text-xl">🔴</span>
            <span>Close Portal</span>
          </>
        ) : (
          <>
            <span className="text-xl">🌀</span>
            <span>Open Portal</span>
          </>
        )}
      </motion.button>
    </div>
  )
}