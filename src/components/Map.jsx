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
  const { user, loading: authLoading, signInAnonymously } = useSupabaseAuth()
  const { error, getCurrentLocation } = useGeolocation()
  const { portals, userPortal, createPortal, closePortal } = usePortals(user)
  
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [showChatPortal, setShowChatPortal] = useState(false)
  const [toasts, setToasts] = useState([])
  const [isPlacingPin, setIsPlacingPin] = useState(false)

  // Default location (Vilnius)
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }

  // Toast utilities
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  // Auto sign-in anonymously
  useEffect(() => {
    if (!authLoading && !user) {
      signInAnonymously()
    }
  }, [authLoading, user, signInAnonymously])

  const handleCreatePortal = async () => {
    if (!user || isPlacingPin) {
      addToast('Please wait, signing you in...', 'info')
      return
    }

    setIsPlacingPin(true)
    addToast('Getting your location...', 'info')

    try {
      const userLocation = await getCurrentLocation()
      const { data, error } = await createPortal(userLocation)

      if (error) {
        console.error('Error creating portal:', error)
        addToast('Failed to create portal', 'error')
      } else {
        addToast(`Portal opened! (±${Math.round(userLocation.accuracy)}m)`, 'success')
        
        // Auto-close after 5 minutes for demo
        setTimeout(() => {
          handleClosePortal()
          addToast('Portal closed automatically', 'info')
        }, 300000)
      }
    } catch (err) {
      console.error('Location error:', err)
      addToast(error || 'Could not get location', 'error')
    } finally {
      setIsPlacingPin(false)
    }
  }

  const handleClosePortal = async () => {
    const { error } = await closePortal()
    if (error) {
      addToast('Failed to close portal', 'error')
    } else {
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