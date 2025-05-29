import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, Marker, Popup, useMap, TileLayer, useMapEvents } from 'react-leaflet'
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk'
import { useDrag } from '@use-gesture/react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import L from 'leaflet'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001')

// Mobile detection utility
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768 ||
         'ontouchstart' in window
}

// Custom hook for geolocation
const useGeolocation = () => {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser')
      return Promise.reject('Geolocation not supported')
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
          setLocation(newLocation)
          setLoading(false)
          resolve(newLocation)
        },
        (error) => {
          let errorMessage = 'Unable to get your location'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.'
              break
          }
          setError(errorMessage)
          setLoading(false)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    })
  }, [])

  return { location, error, loading, getCurrentLocation }
}

// Toast notification component
const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-orange-500'
  }[type]

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm mx-auto`}
      style={{ zIndex: 2000 }}
    >
      <div className="flex items-center gap-2">
        <span>{type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="ml-auto text-white/80 hover:text-white">
          ✕
        </button>
      </div>
    </motion.div>
  )
}

// Map event handler for double taps
const MapEventHandler = ({ onDoubleTap }) => {
  const map = useMap()
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef(null)

  useMapEvents({
    click: (e) => {
      if (!isMobileDevice()) return

      const now = Date.now()
      const timeSinceLastTap = now - lastTapRef.current

      if (timeSinceLastTap < 300) {
        // Double tap detected
        clearTimeout(tapTimeoutRef.current)
        onDoubleTap(e)
      } else {
        // Single tap - wait to see if another tap comes
        tapTimeoutRef.current = setTimeout(() => {
          // Single tap confirmed (no double tap)
        }, 300)
      }

      lastTapRef.current = now
    }
  })

  return null
}

const MapControls = () => {
  const map = useMap()
  
  useEffect(() => {
    map.doubleClickZoom.disable()
    const zoomControl = L.control.zoom({ position: 'bottomright' })
    map.addControl(zoomControl)
    return () => map.removeControl(zoomControl)
  }, [map])
  
  return null
}

// Proper MapTiler integration using Leaflet plugin
const MapTilerLayer = ({ apiKey, map }) => {
  useEffect(() => {
    if (!apiKey || !map) return

    try {
      const mtLayer = new MaptilerLayer({
        apiKey: apiKey,
        style: 'streets-v2'
      })
      
      mtLayer.addTo(map)
      
      mtLayer.on('ready', () => {
        console.log('MapTiler layer loaded successfully!')
      })
      
      return () => {
        if (map.hasLayer(mtLayer)) {
          map.removeLayer(mtLayer)
        }
      }
    } catch (error) {
      console.log('MapTiler layer failed to load:', error)
    }
  }, [apiKey, map])

  return null
}

// Enhanced map layers with better fallback
const MapLayers = ({ maptilerApiKey }) => {
  const map = useMap()
  const [useOSM, setUseOSM] = useState(false)

  if (!maptilerApiKey || useOSM) {
    return (
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
    )
  }

  return (
    <>
      <MapTilerLayer apiKey={maptilerApiKey} map={map} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        eventHandlers={{
          tileerror: () => {
            console.log('Falling back to OpenStreetMap')
            setUseOSM(true)
          }
        }}
      />
    </>
  )
}

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
            animate={{ opacity: 0.5 }}
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
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl touch-none"
            style={{ maxHeight: '70vh', zIndex: 1900 }}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-8 overflow-y-auto max-h-full">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Custom marker icon for user's location
const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div class="user-location-wrapper">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
    className: 'user-location-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

export default function Map() {
  const user_id = 'user_id'
  const [showBottomSheet, setShowBottomSheet] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [toasts, setToasts] = useState([])
  const [userPin, setUserPin] = useState(null)
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  
  const { location, error, loading, getCurrentLocation } = useGeolocation()
  
  // Default to Vilnius coordinates
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }
  
  const [markers, setMarkers] = useState({
    [user_id]: { 
      ...defaultLocation,
      live_period: null,
      quest: '',
      name: ''
    }
  })

  // Add toast utility
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  useEffect(() => {
    socket.on("receive_location", (data) => {
      const { latitude, longitude, live_period, user_id, quest, name } = data
      setMarkers(prevMarkers => ({ 
        ...prevMarkers,
        [user_id]: { latitude, longitude, live_period, quest, name }
      }))
    })

    return () => socket.off("receive_location")
  }, [])

  const handleMarkerClick = useCallback((marker, userId) => {
    setSelectedMarker({ ...marker, userId })
    setShowBottomSheet(true)
  }, [])

  const handlePlacePin = useCallback(async (e) => {
    setIsPlacingPin(true)
    addToast('Getting your location...', 'info')

    try {
      const userLocation = await getCurrentLocation()
      
      // Create user pin at GPS location
      const newPin = {
        id: 'user-location',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy,
        timestamp: Date.now()
      }

      setUserPin(newPin)

      // Send location to socket
      socket.emit('send_location', {
        user_id,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        live_period: Date.now() + 300000, // 5 minutes from now
        quest: 'Available for chat',
        name: 'You'
      })

      addToast(`Pin placed! Accuracy: ${Math.round(userLocation.accuracy)}m`, 'success')
      
    } catch (err) {
      console.error('Location error:', err)
      addToast(error || 'Could not get your location', 'error')
    } finally {
      setIsPlacingPin(false)
    }
  }, [getCurrentLocation, addToast, error, user_id])

  const handleDoubleTap = useCallback(async (e) => {
    if (!isMobileDevice()) {
      addToast('This action is only available on mobile devices', 'warning')
      return
    }

    // Only allow double tap if no pin is placed yet
    if (!userPin) {
      handlePlacePin(e)
    }
  }, [userPin, handlePlacePin, addToast])

  // Use default location as center
  const centerPosition = [defaultLocation.latitude, defaultLocation.longitude]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Toast notifications */}
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

      {/* Loading overlay for pin placement */}
      {isPlacingPin && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2100, backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span>Getting your location...</span>
          </div>
        </div>
      )}

      {/* Instructions overlay for mobile */}
      {isMobileDevice() && !userPin && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="absolute top-4 left-4 right-4 bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg"
          style={{ zIndex: 1500 }}
        >
          <div className="flex items-center gap-2">
            <span>👆</span>
            <span className="text-sm">Tap the "Place Pin" button below to share your location</span>
          </div>
        </motion.div>
      )}

      {/* Desktop message */}
      {!isMobileDevice() && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg max-w-md mx-auto"
          style={{ zIndex: 1500 }}
        >
          <div className="flex items-center gap-2">
            <span>🖥️</span>
            <span className="text-sm">Click the "Place Pin" button below to share your location</span>
          </div>
        </motion.div>
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
        
        {/* User's location pin */}
        {userPin && (
          <Marker 
            position={[userPin.latitude, userPin.longitude]}
            icon={createUserLocationIcon()}
          >
            <Popup>
              <div className="p-2">
                <strong className="block text-sm text-blue-600">Your Location</strong>
                <span className="text-xs text-gray-600">
                  Accuracy: {Math.round(userPin.accuracy)}m
                </span>
                <br />
                <span className="text-xs text-gray-500">
                  {new Date(userPin.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Other markers */}
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
                  <strong className="block text-sm">{name}</strong>
                  <span className="text-xs text-gray-600">{quest}</span>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      <BottomSheet isOpen={showBottomSheet} onClose={() => setShowBottomSheet(false)}>
        {selectedMarker && (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">{selectedMarker.name}</h3>
            <p className="text-gray-600 mb-4">{selectedMarker.quest}</p>
            <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600">
              Start Chat
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Pin placement/removal button - centered at bottom */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 ${
          userPin 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-medium`}
        style={{ zIndex: 1600 }}
        onClick={userPin ? 
          () => {
            setUserPin(null)
            addToast('Location pin removed', 'info')
          } :
          handlePlacePin
        }
        disabled={isPlacingPin}
      >
        {isPlacingPin ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span className="text-sm">Getting location...</span>
          </>
        ) : userPin ? (
          <>
            <span className="text-lg">📍</span>
            <span className="text-sm">Remove Pin</span>
          </>
        ) : (
          <>
            <span className="text-lg">📍</span>
            <span className="text-sm">Place Pin</span>
          </>
        )}
      </motion.button>
    </div>
  )
}