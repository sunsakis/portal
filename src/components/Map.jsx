import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'

import { useSupabaseAuth, useGeolocation, usePortals } from '../hooks/useSupabase'
import { MapControls, MapEventHandler } from './MapControls'
import { UserPortalMarker, OtherPortalsMarkers } from './MapMarkers'
import ChatPortal from './ChatPortal'
import Toast from './Toast'
import MapLayers from './MapLayers'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

export default function Map() {
  const { user, loading: authLoading, signInAnonymously, error: authError } = useSupabaseAuth()
  const { error: geoError, getCurrentLocation } = useGeolocation()
  const { portals, userPortal, createPortal, closePortal } = usePortals(user)
  
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [showChatPortal, setShowChatPortal] = useState(false)
  const [toasts, setToasts] = useState([])
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  const [debugInfo, setDebugInfo] = useState([])
  const [showDebug, setShowDebug] = useState(false)

  // Default location (Vilnius)
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }

  // Debug logging function
  const addDebugLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugInfo(prev => [...prev.slice(-10), { timestamp, message, type }]) // Keep last 10 logs
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

  // Debug environment variables and auth state
  useEffect(() => {
    const envCheck = {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      maptilerKey: import.meta.env.VITE_MAPTILER_API ? 'SET' : 'MISSING',
      user: user ? `YES (${user.id.slice(0, 8)}...)` : 'NO',
      authError: authError || 'NONE'
    }
    addDebugLog(`Environment: ${JSON.stringify(envCheck)}`, 'info')
  }, [user, authError, addDebugLog])

  const handleCreatePortal = async () => {
    addDebugLog('=== CREATE PORTAL START ===', 'info')
    
    if (!user || isPlacingPin) {
      addDebugLog(`Cannot create: user=${!!user}, isPlacing=${isPlacingPin}`, 'warning')
      addToast('Please wait, signing you in...', 'info')
      return
    }

    addDebugLog(`Creating portal for user: ${user.id}`, 'info')
    setIsPlacingPin(true)
    addToast('Getting your location...', 'info')

    try {
      addDebugLog('Getting location...', 'info')
      const userLocation = await getCurrentLocation()
      addDebugLog(`Location: ${userLocation.latitude}, ${userLocation.longitude} (±${userLocation.accuracy}m)`, 'success')
      
      addDebugLog('Calling createPortal...', 'info')
      const { data, error } = await createPortal(userLocation)

      if (error) {
        const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error))
        addDebugLog(`Portal creation error: ${errorMsg}`, 'error')
        addToast(`Failed to create portal: ${errorMsg}`, 'error')
      } else {
        addDebugLog(`Portal created successfully: ${data?.id}`, 'success')
        addToast(`Portal opened! (±${Math.round(userLocation.accuracy)}m)`, 'success')
        
        // Auto-close after 5 minutes for demo
        setTimeout(() => {
          handleClosePortal()
          addToast('Portal closed automatically', 'info')
        }, 300000)
      }
    } catch (err) {
      const errorMsg = err.message || err.toString()
      addDebugLog(`Exception: ${errorMsg}`, 'error')
      addToast(geoError || errorMsg || 'Could not get location', 'error')
    } finally {
      setIsPlacingPin(false)
      addDebugLog('=== CREATE PORTAL END ===', 'info')
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
    setSelectedPortal(portal)
    setShowChatPortal(true)
  }

  const handleDoubleTap = useCallback(() => {
    if (!userPortal) {
      handleCreatePortal()
    }
  }, [userPortal, handleCreatePortal])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const centerPosition = [defaultLocation.latitude, defaultLocation.longitude]

  return (
    <div className="relative h-screen w-full overflow-hidden">
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

      {/* Debug Toggle Button - Always visible */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded-full text-xs z-[2001] w-12 h-12 flex items-center justify-center"
      >
        🐛
      </button>

      {/* Debug Panel */}
      <AnimatePresence>
        {showDebug && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 w-80 h-full bg-black/95 text-white p-4 z-[2000] overflow-y-auto"
          >
            <h3 className="text-lg font-bold mb-4">Debug Info</h3>
            
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Environment:</h4>
              <div className="text-xs space-y-1">
                <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ SET' : '❌ MISSING'}</div>
                <div>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING'}</div>
                <div>User: {user ? `✅ ${user.id.slice(0, 8)}...` : '❌ NO USER'}</div>
                <div>Auth Error: {authError || 'None'}</div>
                <div>Geo Error: {geoError || 'None'}</div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Actions:</h4>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    addDebugLog('Manual auth attempt', 'info')
                    signInAnonymously()
                  }}
                  className="block w-full text-xs bg-blue-600 p-2 rounded"
                >
                  Try Auth
                </button>
                <button
                  onClick={() => {
                    addDebugLog('Manual location attempt', 'info')
                    getCurrentLocation().then(loc => {
                      addDebugLog(`Manual location: ${loc.latitude}, ${loc.longitude}`, 'success')
                    }).catch(err => {
                      addDebugLog(`Manual location error: ${err.message}`, 'error')
                    })
                  }}
                  className="block w-full text-xs bg-green-600 p-2 rounded"
                >
                  Test Location
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
              <h4 className="text-sm font-semibold mb-2">Logs:</h4>
              <div className="text-xs space-y-1 max-h-96 overflow-y-auto">
                {debugInfo.map((log, i) => (
                  <div key={i} className={`p-1 rounded ${
                    log.type === 'error' ? 'bg-red-900/50' :
                    log.type === 'success' ? 'bg-green-900/50' :
                    log.type === 'warning' ? 'bg-yellow-900/50' :
                    'bg-gray-800/50'
                  }`}>
                    <span className="text-gray-400">{log.timestamp}</span> {log.message}
                  </div>
                ))}
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
        doubleClickZoom={false}
      >
        <MapLayers maptilerApiKey={import.meta.env.VITE_MAPTILER_API} />
        <MapControls />
        <MapEventHandler onDoubleTap={handleDoubleTap} />
        
        {/* User's portal marker */}
        <UserPortalMarker 
          portal={userPortal} 
          onPortalClick={handlePortalClick} 
        />
        
        {/* Other user portals */}
        <OtherPortalsMarkers 
          portals={portals}
          userId={user?.id}
          onPortalClick={handlePortalClick}
        />
      </MapContainer>

      {/* Chat Portal Interface */}
      <ChatPortal
        isOpen={showChatPortal}
        onClose={() => setShowChatPortal(false)}
        portal={selectedPortal}
        user={user}
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
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
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