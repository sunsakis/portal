import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { useDrag } from '@use-gesture/react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import L from 'leaflet'

import MapLayers from './MapLayers'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001')

// Mobile detection
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768 ||
         'ontouchstart' in window
}

// Geolocation hook
const useGeolocation = () => {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return Promise.reject('Geolocation not supported')
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        setError('Location request timed out')
        setLoading(false)
        reject(new Error('Timeout'))
      }, 15000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId)
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          }
          setLocation(newLocation)
          setLoading(false)
          resolve(newLocation)
        },
        (error) => {
          clearTimeout(timeoutId)
          let errorMessage = 'Unable to get location'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable. Check GPS settings.'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Try again.'
              break
          }
          setError(errorMessage)
          setLoading(false)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000
        }
      )
    })
  }, [])

  return { location, error, loading, getCurrentLocation }
}

// Simple toast notification
const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const config = {
    success: { bg: 'bg-green-500', icon: '✅' },
    error: { bg: 'bg-red-500', icon: '❌' },
    info: { bg: 'bg-blue-500', icon: 'ℹ️' },
    warning: { bg: 'bg-orange-500', icon: '⚠️' }
  }[type]

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 ${config.bg} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm mx-auto`}
      style={{ zIndex: 2000 }}
    >
      <div className="flex items-center gap-2">
        <span>{config.icon}</span>
        <span className="text-sm flex-1">{message}</span>
        <button onClick={onClose} className="ml-auto text-white/80 hover:text-white">
          ×
        </button>
      </div>
    </motion.div>
  )
}

// Map controls and zoom positioning
const MapControls = () => {
  const map = useMap()
  
  useEffect(() => {
    map.doubleClickZoom.disable()
    
    // Position zoom controls on mobile
    const zoomControl = L.control.zoom({ 
      position: isMobileDevice() ? 'bottomright' : 'topleft'
    })
    map.addControl(zoomControl)
    
    return () => map.removeControl(zoomControl)
  }, [map])
  
  return null
}

// Map event handler for pin placement
const MapEventHandler = ({ onDoubleTap }) => {
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef(null)

  useMapEvents({
    click: (e) => {
      if (!isMobileDevice()) return

      const now = Date.now()
      const timeSinceLastTap = now - lastTapRef.current

      if (timeSinceLastTap < 300) {
        clearTimeout(tapTimeoutRef.current)
        onDoubleTap(e)
      } else {
        tapTimeoutRef.current = setTimeout(() => {
          // Single tap - do nothing
        }, 300)
      }

      lastTapRef.current = now
    }
  })

  return null
}

// Bottom sheet for chat interactions
const BottomSheet = ({ isOpen, onClose, children }) => {
  const bind = useDrag(
    ({ last, velocity: [, vy], direction: [, dy], movement: [, my] }) => {
      if (last && (my > 100 || (vy > 0.5 && dy > 0))) {
        onClose()
      }
    },
    { from: () => [0, 0], filterTaps: true, bounds: { top: 0 }, rubberband: true }
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black"
            style={{ zIndex: 1800 }}
            onClick={onClose}
          />
          <motion.div
            {...bind()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl touch-none"
            style={{ 
              maxHeight: '70vh', 
              zIndex: 1900,
              paddingBottom: 'env(safe-area-inset-bottom, 20px)'
            }}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-4 overflow-y-auto max-h-full">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// User location marker
const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div class="user-location-wrapper">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
    className: 'user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

export default function Map() {
  const user_id = 'user_' + Math.random().toString(36).substr(2, 9)
  const [showBottomSheet, setShowBottomSheet] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [toasts, setToasts] = useState([])
  const [userPin, setUserPin] = useState(null)
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  
  const { location, error, loading, getCurrentLocation } = useGeolocation()
  
  // Default location (Vilnius)
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }
  const [markers, setMarkers] = useState({})

  // Toast utilities
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  // Socket handling
  useEffect(() => {
    socket.on("receive_location", (data) => {
      const { latitude, longitude, live_period, user_id, quest, name } = data
      setMarkers(prevMarkers => ({ 
        ...prevMarkers,
        [user_id]: { latitude, longitude, live_period, quest, name }
      }))
    })

    socket.on("connect", () => {
      addToast('Connected', 'success')
    })

    socket.on("disconnect", () => {
      addToast('Connection lost', 'warning')
    })

    return () => {
      socket.off("receive_location")
      socket.off("connect")
      socket.off("disconnect")
    }
  }, [addToast])

  const handleMarkerClick = useCallback((marker, userId) => {
    setSelectedMarker({ ...marker, userId })
    setShowBottomSheet(true)
  }, [])

  const handlePlacePin = useCallback(async () => {
    if (isPlacingPin) return
    
    setIsPlacingPin(true)
    addToast('Getting your location...', 'info')

    try {
      const userLocation = await getCurrentLocation()
      
      const newPin = {
        id: 'user-location',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy,
        timestamp: Date.now()
      }

      setUserPin(newPin)

      socket.emit('send_location', {
        user_id,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        live_period: Date.now() + 300000, // 5 minutes
        quest: 'Available for chat',
        name: 'Anonymous'
      })

      addToast(`Portal opened! (±${Math.round(userLocation.accuracy)}m)`, 'success')
      
      // Auto-close after 5 minutes
      setTimeout(() => {
        setUserPin(null)
        addToast('Portal closed automatically', 'info')
      }, 300000)
      
    } catch (err) {
      addToast(error || 'Could not get location', 'error')
    } finally {
      setIsPlacingPin(false)
    }
  }, [getCurrentLocation, addToast, error, user_id, isPlacingPin])

  const handleDoubleTap = useCallback(() => {
    if (!userPin) {
      handlePlacePin()
    }
  }, [userPin, handlePlacePin])

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
        
        {/* User pin */}
        {userPin && (
          <Marker 
            position={[userPin.latitude, userPin.longitude]}
            icon={createUserLocationIcon()}
          >
            <Popup>
              <div className="p-2">
                <strong className="block text-sm text-green-600 mb-1">Your Chat Portal</strong>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Accuracy: ±{Math.round(userPin.accuracy)}m</div>
                  <div>Active since: {new Date(userPin.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Other users */}
        {Object.entries(markers).map(([userId, marker]) => {
          const { latitude, longitude, live_period, quest, name } = marker
          return live_period && userId !== user_id && (
            <Marker 
              key={userId} 
              position={[latitude, longitude]}
              eventHandlers={{
                click: () => handleMarkerClick(marker, userId)
              }}
            >
              <Popup>
                <div className="p-2">
                  <strong className="block text-sm mb-1">{name}</strong>
                  <span className="text-xs text-gray-600">{quest}</span>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Chat interface */}
      <BottomSheet isOpen={showBottomSheet} onClose={() => setShowBottomSheet(false)}>
        {selectedMarker && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">{selectedMarker.name}</h3>
              <p className="text-gray-600">{selectedMarker.quest}</p>
            </div>
            
            <div className="space-y-3">
              <button className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-medium">
                💬 Start Chat
              </button>
              <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg">
                👋 Wave
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Main action button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 ${
          userPin 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-green-500 hover:bg-green-600'
        } text-white px-6 py-4 rounded-full shadow-xl flex items-center gap-3 font-semibold transition-colors z-[1600]`}
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={userPin ? 
          () => {
            setUserPin(null)
            addToast('Portal closed', 'info')
          } :
          handlePlacePin
        }
        disabled={isPlacingPin}
      >
        {isPlacingPin ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Locating...</span>
          </>
        ) : userPin ? (
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