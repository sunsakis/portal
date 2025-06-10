import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'

import { useSupabaseAuth, useGeolocation, usePortals } from '../hooks/useSupabase'
import { MapControls, MapEventHandler } from './MapControls'
import { UserPortalMarker, OtherPortalsMarkers } from './MapMarkers'
import ChatPortal from './ChatPortal'
import Toast from './Toast'
import MapLayers from './MapLayers'
import ConnectionStatus from './ConnectionStatus'
import PortalInstructions from './PortalInstructions'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

export default function Map() {
  const { user, loading: authLoading, signInAnonymously, error: authError } = useSupabaseAuth()
  const { error: geoError, getCurrentLocation } = useGeolocation()
  const { portals, userPortal, createPortal, closePortal, connectionStatus } = usePortals(user)
  
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [showChatPortal, setShowChatPortal] = useState(false)
  const [toasts, setToasts] = useState([])
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  
  // ALWAYS SHOW DEBUG - Console always visible for mobile testing
  const [showDebug, setShowDebug] = useState(true) // Changed from false to true
  const [debugInfo, setDebugInfo] = useState([])
  const [debugMinimized, setDebugMinimized] = useState(false)
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost'

  // Default location (Vilnius)
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }

  // Debug logging function - ALWAYS ACTIVE
  const addDebugLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugInfo(prev => [...prev.slice(-20), { timestamp, message, type }]) // Keep more logs
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`) // Always log to browser console too
  }, [])

  // Toast utilities
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    addDebugLog(`TOAST: ${message}`, type)
  }, [addDebugLog])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  // Auto sign-in anonymously
  useEffect(() => {
    if (!authLoading && !user) {
      addDebugLog('Attempting anonymous sign-in...', 'info')
      signInAnonymously()
    }
  }, [authLoading, user, signInAnonymously, addDebugLog])

  // Initial debug info
  useEffect(() => {
    addDebugLog('Portal app initialized', 'info')
    addDebugLog(`Environment: ${import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'}`, 'info')
    addDebugLog(`Supabase URL: ${import.meta.env.VITE_SUPABASE_URL ? 'configured' : 'missing'}`, 'info')
    addDebugLog(`MapTiler API: ${import.meta.env.VITE_MAPTILER_API ? 'configured' : 'missing'}`, 'info')
  }, [addDebugLog])

  // Log connection status changes
  useEffect(() => {
    addDebugLog(`Connection status: ${connectionStatus}`, connectionStatus === 'connected' ? 'success' : 'warning')
  }, [connectionStatus, addDebugLog])

  // Log auth state changes
  useEffect(() => {
    if (user) {
      addDebugLog(`User authenticated: ${user.id}`, 'success')
    } else if (!authLoading) {
      addDebugLog('User not authenticated', 'warning')
    }
  }, [user, authLoading, addDebugLog])

  // Log portal changes
  useEffect(() => {
    addDebugLog(`Portals nearby: ${portals.length}`, 'info')
    if (userPortal) {
      addDebugLog(`User portal active: ${userPortal.id}`, 'success')
    }
  }, [portals, userPortal, addDebugLog])

  const handleCreatePortal = async () => {
    if (!user || isPlacingPin) {
      addToast('Please wait...', 'info')
      return
    }

    addDebugLog(`Creating portal for user: ${user.id}`, 'info')
    setIsPlacingPin(true)
    addToast('Getting your location...', 'info')

    try {
      addDebugLog('Requesting GPS location...', 'info')
      const userLocation = await getCurrentLocation()
      addDebugLog(`Location obtained: ${userLocation.latitude}, ${userLocation.longitude} (±${userLocation.accuracy}m)`, 'success')
      
      addDebugLog('Sending portal creation request...', 'info')
      const { data, error } = await createPortal(userLocation)

      if (error) {
        addDebugLog(`Portal creation error: ${error}`, 'error')
        addToast(`Failed to create portal: ${error}`, 'error')
      } else {
        addDebugLog(`Portal created successfully: ${data?.id}`, 'success')
        addToast(`Portal opened! (±${Math.round(userLocation.accuracy)}m)`, 'success')
        
        // Auto-close after 5 minutes
        setTimeout(() => {
          handleClosePortal()
          addToast('Portal closed automatically', 'info')
        }, 300000)
      }
    } catch (err) {
      const errorMsg = err.message || err.toString()
      addDebugLog(`Exception during portal creation: ${errorMsg}`, 'error')
      addToast(geoError || errorMsg || 'Could not get location', 'error')
    } finally {
      setIsPlacingPin(false)
      addDebugLog('Portal creation process completed', 'info')
    }
  }

  const handleClosePortal = async () => {
    addDebugLog('Closing portal...', 'info')
    const { error } = await closePortal()
    if (error) {
      addDebugLog(`Portal close error: ${error}`, 'error')
      addToast('Failed to close portal', 'error')
    } else {
      addDebugLog('Portal closed successfully', 'success')
      addToast('Portal closed', 'info')
    }
  }

  const handlePortalClick = (portal) => {
    addDebugLog(`Portal clicked: ${portal.id}`, 'info')
    setSelectedPortal(portal)
    setShowChatPortal(true)
  }

  // Handle debug tab activation (long press on logo area)
  const [debugPressStart, setDebugPressStart] = useState(0)
  const handleDebugActivation = useCallback(() => {
    const pressTime = Date.now() - debugPressStart
    if (pressTime > 2000) { // 2 second long press
      setShowDebug(!showDebug)
      addToast(showDebug ? 'Debug disabled' : 'Debug enabled', 'info')
    }
  }, [debugPressStart, showDebug, addToast])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Portal...</p>
        </div>
      </div>
    )
  }

  const centerPosition = [defaultLocation.latitude, defaultLocation.longitude]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Real-time Connection Status */}
      <ConnectionStatus 
        connectionStatus={connectionStatus}
        onRetry={() => {
          addDebugLog('Manual connection retry triggered', 'info')
          signInAnonymously()
        }}
      />

      {/* Toasts */}
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>

      {/* Debug Toggle - Hidden until activated (kept for compatibility) */}
      {(isDev || showDebug) && (
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded-full text-xs z-[2001] w-10 h-10 flex items-center justify-center"
        >
          🐛
        </button>
      )}

      {/* ALWAYS VISIBLE Debug Console - Better Positioned */}
      <motion.div
        initial={{ x: debugMinimized ? '85%' : 0 }}
        animate={{ x: debugMinimized ? '85%' : 0 }}
        className="fixed top-16 right-2 w-72 max-h-80 bg-black/90 text-white z-[2000] flex flex-col rounded-lg shadow-xl border border-gray-700"
      >
        {/* Debug Header */}
        <div className="flex items-center justify-between p-2 bg-black/80 border-b border-gray-600 rounded-t-lg">
          <h3 className="text-xs font-bold">🐛 Debug</h3>
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
            {/* Compact Status Section */}
            <div className="p-2 border-b border-gray-600 text-xs">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>User: {user ? '✅' : '❌'}</div>
                <div>Portal: {userPortal ? '🟢' : '⚪'}</div>
                <div>Nearby: {portals.length}</div>
                <div>Status: {connectionStatus === 'connected' ? '🟢' : '🔴'}</div>
              </div>
            </div>

            {/* Compact Actions */}
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
                  GPS
                </button>
                <button
                  onClick={() => {
                    addDebugLog('Refreshing...', 'info')
                    window.location.reload()
                  }}
                  className="text-xs bg-blue-600 px-2 py-1 rounded flex-1"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Compact Console Logs */}
            <div className="flex-1 overflow-y-auto p-2 max-h-48">
              <div className="text-xs space-y-1">
                {debugInfo.length === 0 ? (
                  <div className="text-gray-400">Ready...</div>
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

      {/* Original Debug Panel - kept for compatibility (now hidden by default) */}
      <AnimatePresence>
        {showDebug && false && ( // Always false to hide the old panel
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 w-80 h-full bg-black/95 text-white p-4 z-[2000] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Debug Console</h3>
              <button
                onClick={() => setShowDebug(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Status:</h4>
              <div className="text-xs space-y-1">
                <div>Environment: {isDev ? 'DEV' : 'PROD'}</div>
                <div>Supabase: {import.meta.env.VITE_SUPABASE_URL ? '✅' : '❌'}</div>
                <div>User: {user ? `✅ ${user.id.slice(0, 8)}...` : '❌'}</div>
                <div>Portal: {userPortal ? '🟢 Active' : '⚪ Inactive'}</div>
                <div>Portals nearby: {portals.length}</div>
                <div>Connection: {connectionStatus}</div>
                <div>Real-time: {connectionStatus === 'connected' ? '✅' : '❌'}</div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Actions:</h4>
              <div className="space-y-2">
                <button
                  onClick={() => getCurrentLocation().then(loc => {
                    addDebugLog(`Test location: ${loc.latitude}, ${loc.longitude}`, 'success')
                  }).catch(err => {
                    addDebugLog(`Location error: ${err.message}`, 'error')
                  })}
                  className="block w-full text-xs bg-green-600 p-2 rounded"
                >
                  Test GPS
                </button>
                <button
                  onClick={() => setDebugInfo([])}
                  className="block w-full text-xs bg-red-600 p-2 rounded"
                >
                  Clear Logs
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Console:</h4>
              <div className="text-xs space-y-1 max-h-96 overflow-y-auto">
                {debugInfo.length === 0 ? (
                  <div className="text-gray-400">No logs...</div>
                ) : (
                  debugInfo.map((log, i) => (
                    <div key={i} className={`p-1 rounded ${
                      log.type === 'error' ? 'bg-red-900/50' :
                      log.type === 'success' ? 'bg-green-900/50' :
                      log.type === 'warning' ? 'bg-yellow-900/50' :
                      'bg-gray-800/50'
                    }`}>
                      <span className="text-gray-400">{log.timestamp}</span> {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      {isPlacingPin && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-[2100]">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl"
          >
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
            <span className="font-medium">Getting your location...</span>
          </motion.div>
        </div>
      )}

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
          addDebugLog('Chat portal closed', 'info')
          setShowChatPortal(false)
        }}
        portal={selectedPortal}
        user={user}
      />

      {/* Portal Instructions for new users */}
      <PortalInstructions userPortal={userPortal} />

      {/* Hidden debug activation area - Long press app title area */}
      <div 
        className="fixed top-4 left-4 w-20 h-10 z-[1500]"
        onTouchStart={() => setDebugPressStart(Date.now())}
        onTouchEnd={handleDebugActivation}
        onMouseDown={() => setDebugPressStart(Date.now())}
        onMouseUp={handleDebugActivation}
      />

      {/* Main action button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 ${
          userPortal 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-green-500 hover:bg-green-600'
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