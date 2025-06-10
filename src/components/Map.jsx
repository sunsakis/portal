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
  const { error: geoError, loading: geoLoading, getCurrentLocation, cancelLocationRequest } = useGeolocation()
  const { portals, userPortal, createPortal, closePortal, connectionStatus, cancelPortalCreation } = usePortals(user)
  
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

  // ENHANCED: Cancel all operations when connection is lost
  useEffect(() => {
    if (connectionStatus === 'error' || connectionStatus === 'closed') {
      addDebugLog('Connection lost - cancelling operations', 'warning')
      if (isPlacingPin || geoLoading) {
        handleCancelOperation()
      }
    }
  }, [connectionStatus])

  // ENHANCED: Handle operation cancellation
  const handleCancelOperation = useCallback(() => {
    addDebugLog('Cancelling all operations', 'info')
    
    // Cancel location request
    if (geoLoading && cancelLocationRequest) {
      cancelLocationRequest()
      addDebugLog('Location request cancelled', 'info')
    }
    
    // Cancel portal creation
    if (isPlacingPin && cancelPortalCreation) {
      cancelPortalCreation()
      addDebugLog('Portal creation cancelled', 'info')
    }
    
    setIsPlacingPin(false)
    addToast('Operation cancelled', 'warning')
  }, [geoLoading, isPlacingPin, cancelLocationRequest, cancelPortalCreation, addDebugLog, addToast])

  const handleCreatePortal = async () => {
    if (!user || isPlacingPin) {
      addToast('Please wait...', 'info')
      return
    }

    // Check connection first
    if (connectionStatus === 'error' || connectionStatus === 'closed') {
      addToast('No connection - please check internet and try again', 'error')
      return
    }

    addDebugLog(`Creating portal for user: ${user.id}`, 'info')
    setIsPlacingPin(true)
    addToast('Getting your location...', 'info')

    try {
      addDebugLog('Requesting GPS location...', 'info')
      const userLocation = await getCurrentLocation()
      
      // Check if operation was cancelled during location fetch
      if (!isPlacingPin) {
        addDebugLog('Operation was cancelled during location fetch', 'warning')
        return
      }
      
      addDebugLog(`Location obtained: ${userLocation.latitude}, ${userLocation.longitude} (±${userLocation.accuracy}m)`, 'success')
      
      // Check connection again before creating portal
      if (connectionStatus === 'error' || connectionStatus === 'closed') {
        addToast('Connection lost during location fetch', 'error')
        setIsPlacingPin(false)
        return
      }
      
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
          if (userPortal) {
            handleClosePortal()
            addToast('Portal closed automatically', 'info')
          }
        }, 300000)
      }
    } catch (err) {
      const errorMsg = err.message || err.toString()
      addDebugLog(`Exception during portal creation: ${errorMsg}`, 'error')
      
      // Don't show error if operation was cancelled
      if (errorMsg !== 'Portal creation cancelled' && errorMsg !== 'Location request cancelled') {
        addToast(geoError || errorMsg || 'Could not get location', 'error')
      }
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

  // ENHANCED: Retry connection
  const handleRetryConnection = useCallback(() => {
    addDebugLog('Retrying connection...', 'info')
    addToast('Retrying connection...', 'info')
    
    // Cancel any ongoing operations first
    handleCancelOperation()
    
    // Attempt to reconnect
    if (!user) {
      signInAnonymously()
    } else {
      // Force a simple operation to test connection
      window.location.reload()
    }
  }, [user, signInAnonymously, handleCancelOperation, addDebugLog, addToast])

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
          
          {/* Add cancel button for loading state */}
          <button
            onClick={() => {
              addDebugLog('Loading cancelled by user', 'warning')
              window.location.reload()
            }}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel & Reload
          </button>
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
        onRetry={handleRetryConnection}
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

      {/* ENHANCED Debug Console - Better Positioned with Cancellation */}
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
            {/* Enhanced Status Section */}
            <div className="p-2 border-b border-gray-600 text-xs">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>User: {user ? '✅' : '❌'}</div>
                <div>Portal: {userPortal ? '🟢' : '⚪'}</div>
                <div>Nearby: {portals.length}</div>
                <div>Status: {connectionStatus === 'connected' ? '🟢' : '🔴'}</div>
                <div>GPS: {geoLoading ? '🔄' : '⚪'}</div>
                <div>Creating: {isPlacingPin ? '🔄' : '⚪'}</div>
              </div>
            </div>

            {/* Enhanced Actions with Cancel */}
            <div className="p-2 border-b border-gray-600">
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => getCurrentLocation().then(loc => {
                    addDebugLog(`GPS: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)} ±${loc.accuracy}m`, 'success')
                  }).catch(err => {
                    addDebugLog(`GPS failed: ${err.message}`, 'error')
                  })}
                  className="text-xs bg-green-600 px-2 py-1 rounded flex-1"
                  disabled={geoLoading}
                >
                  GPS
                </button>
                <button
                  onClick={handleRetryConnection}
                  className="text-xs bg-blue-600 px-2 py-1 rounded flex-1"
                >
                  Retry
                </button>
              </div>
              
              {/* ENHANCED: Cancel operations button */}
              {(geoLoading || isPlacingPin) && (
                <button
                  onClick={handleCancelOperation}
                  className="text-xs bg-red-600 px-2 py-1 rounded w-full mt-1"
                >
                  Cancel Operation
                </button>
              )}
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

      {/* ENHANCED: Loading overlay with cancel button and connection status */}
      {(isPlacingPin || geoLoading) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-[2100]">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
              <span className="font-medium">
                {geoLoading ? 'Getting your location...' : 'Creating portal...'}
              </span>
            </div>
            
            {/* Connection status indicator */}
            <div className="text-sm text-gray-600 mb-4">
              Connection: <span className={`font-medium ${
                connectionStatus === 'connected' ? 'text-green-600' :
                connectionStatus === 'error' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {connectionStatus}
              </span>
            </div>
            
            {/* Cancel button */}
            <button
              onClick={handleCancelOperation}
              className="w-full py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Cancel
            </button>
            
            {/* Retry connection if needed */}
            {(connectionStatus === 'error' || connectionStatus === 'closed') && (
              <button
                onClick={handleRetryConnection}
                className="w-full mt-2 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Retry Connection
              </button>
            )}
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

      {/* ENHANCED: Main action button with connection status and disabled states */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[1600]"
        style={{ marginBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        {/* Connection warning banner */}
        {(connectionStatus === 'error' || connectionStatus === 'closed') && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-3 bg-red-500 text-white px-4 py-2 rounded-lg text-sm text-center"
          >
            No connection - check internet
          </motion.div>
        )}
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`${
            userPortal 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white px-6 py-4 rounded-full shadow-xl flex items-center gap-3 font-semibold transition-colors ${
            (isPlacingPin || geoLoading || connectionStatus === 'error') 
              ? 'opacity-50 cursor-not-allowed' 
              : ''
          }`}
          onClick={userPortal ? handleClosePortal : handleCreatePortal}
          disabled={isPlacingPin || geoLoading || connectionStatus === 'error'}
        >
          {isPlacingPin || geoLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>{geoLoading ? 'Locating...' : 'Creating...'}</span>
            </>
          ) : userPortal ? (
            <>
              <span className="text-xl">🔴</span>
              <span>Close Portal</span>
            </>
          ) : connectionStatus === 'error' || connectionStatus === 'closed' ? (
            <>
              <span className="text-xl">⚠️</span>
              <span>No Connection</span>
            </>
          ) : (
            <>
              <span className="text-xl">🌀</span>
              <span>Open Portal</span>
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  )
}