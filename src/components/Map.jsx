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

// Z-Index hierarchy constants - Updated for Leaflet's high z-index values
const Z_INDEX = {
  MAP_BASE: 0,                    // Map tiles
  MAP_PANES: 200,                 // Leaflet panes (overlayPane, etc.)
  MAP_MARKERS: 600,               // Leaflet markers
  MAP_POPUPS: 1000,               // Leaflet popups
  MAP_TOOLTIPS: 1500,             // Leaflet tooltips
  MAP_CONTROLS: 2000,             // Leaflet controls (zoom, attribution, etc.)
  PIN_INDICATOR: 5000,            // Pin placement indicator - must be above all map elements
  UI_CONTROLS: 6000,              // App UI controls
  INSTRUCTIONS: 7000,             // Instructions overlay
  BOTTOM_SHEET_BACKDROP: 8000,    // Bottom sheet backdrop
  BOTTOM_SHEET: 9000,             // Bottom sheet content
  NOTIFICATIONS: 10000,           // Top notifications
  MODAL_OVERLAY: 11000            // Emergency modals/alerts
}

// Custom hook for handling long press to place pins
const PinPlacer = ({ onPinPlace, isEnabled }) => {
  const map = useMap()
  const longPressTimer = useRef(null)
  const [isLongPressing, setIsLongPressing] = useState(false)
  const [pressPosition, setPressPosition] = useState(null)
  const [screenPosition, setScreenPosition] = useState(null)

  useMapEvents({
    mousedown: (e) => {
      if (!isEnabled) return
      
      setPressPosition(e.latlng)
      setScreenPosition(e.containerPoint)
      setIsLongPressing(false)
      
      longPressTimer.current = setTimeout(() => {
        setIsLongPressing(true)
        navigator.vibrate?.(100) // Haptic feedback
        onPinPlace(e.latlng)
      }, 600) // 600ms for long press
    },
    
    mouseup: () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      setTimeout(() => {
        setIsLongPressing(false)
        setPressPosition(null)
        setScreenPosition(null)
      }, 100)
    },
    
    mousemove: (e) => {
      // Update screen position for accurate indicator placement
      if (pressPosition && longPressTimer.current) {
        setScreenPosition(e.containerPoint)
        
        // Cancel long press if user moves finger too much
        const distance = map.distance(pressPosition, e.latlng)
        if (distance > 50) { // 50 meters tolerance
          clearTimeout(longPressTimer.current)
          longPressTimer.current = null
          setIsLongPressing(false)
          setPressPosition(null)
          setScreenPosition(null)
        }
      }
    }
  })

  // Show visual feedback during long press - positioned at actual touch point
  return isLongPressing && screenPosition ? (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="pin-placement-indicator fixed pointer-events-none"
      style={{
        left: screenPosition.x,
        top: screenPosition.y,
        transform: 'translate(-50%, -50%)',
        zIndex: Z_INDEX.PIN_INDICATOR
      }}
    >
      <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
    </motion.div>
  ) : null
}

const MapControls = ({ onLocationRequest, onPinModeToggle, isPinMode }) => {
  const map = useMap()
  const [isLocating, setIsLocating] = useState(false)
  
  useEffect(() => {
    map.doubleClickZoom.disable()
    // Position zoom controls to avoid conflicts with our UI
    // Leaflet controls have z-index around 1000-2000, our UI is at 6000+
    const zoomControl = L.control.zoom({ position: 'bottomleft' })
    map.addControl(zoomControl)
    return () => map.removeControl(zoomControl)
  }, [map])

  const handleLocateUser = useCallback(() => {
    setIsLocating(true)
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        map.setView([latitude, longitude], 16)
        onLocationRequest(latitude, longitude)
        setIsLocating(false)
      },
      (error) => {
        console.log('Location access denied or unavailable')
        setIsLocating(false)
        alert('Location access is needed to find your position. Please enable location in your browser settings.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [map, onLocationRequest])
  
  return (
    <>
      {/* Location Button */}
      <motion.button
        onClick={handleLocateUser}
        disabled={isLocating}
        className="fixed bottom-32 right-4 bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-full shadow-lg border border-gray-200"
        style={{ zIndex: Z_INDEX.UI_CONTROLS }}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
      >
        {isLocating ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="text-lg"
          >
            ⟳
          </motion.div>
        ) : (
          <div className="text-lg">📍</div>
        )}
      </motion.button>

      {/* Pin Mode Toggle */}
      <motion.button
        onClick={onPinModeToggle}
        className={`fixed bottom-20 right-4 p-3 rounded-full shadow-lg border transition-colors ${
          isPinMode 
            ? 'bg-red-500 text-white border-red-600' 
            : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
        }`}
        style={{ zIndex: Z_INDEX.UI_CONTROLS }}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
      >
        <div className="text-lg">📌</div>
      </motion.button>

      {/* Instructions overlay */}
      <AnimatePresence>
        {isPinMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg"
            style={{ zIndex: Z_INDEX.INSTRUCTIONS }}
          >
            <div className="text-center">
              <div className="text-lg mb-2">📌 Pin Mode Active</div>
              <div className="text-sm">Long press on the map to place a pin</div>
              <div className="text-xs text-gray-300 mt-1">Tap the pin button again to exit</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Enhanced map layers with better fallback
const MapLayers = ({ maptilerApiKey }) => {
  const map = useMap()
  const [useOSM, setUseOSM] = useState(false)

  // If no API key or we decided to use OSM, show OpenStreetMap
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
      {/* Fallback to OSM if MapTiler fails */}
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
            style={{ zIndex: Z_INDEX.BOTTOM_SHEET_BACKDROP }}
            onClick={onClose}
          />
          <motion.div
            {...bind()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl touch-none"
            style={{ 
              maxHeight: '70vh',
              zIndex: Z_INDEX.BOTTOM_SHEET
            }}
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

export default function Map() {
  const user_id = 'user_id'
  const [userLocation, setUserLocation] = useState(null)
  const [isSharing, setIsSharing] = useState(false)
  const [showBottomSheet, setShowBottomSheet] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [locationRequested, setLocationRequested] = useState(false)
  const [isPinMode, setIsPinMode] = useState(false)
  const [customPins, setCustomPins] = useState([])
  
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

  // Try to get user location once on mount
  useEffect(() => {
    if (locationRequested) return
    
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ latitude, longitude })
        setMarkers(prev => ({
          ...prev,
          [user_id]: { ...prev[user_id], latitude, longitude }
        }))
      },
      (error) => {
        console.log('Location not available, using default location')
        setUserLocation(defaultLocation)
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    )
    
    setLocationRequested(true)
  }, [user_id, locationRequested])

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

  const handleLocationShare = useCallback(() => {
    setIsSharing(true)
    
    navigator.geolocation?.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords
      const locationData = {
        latitude, longitude,
        live_period: Date.now(),
        user_id,
        quest: 'Available for chat',
        name: 'You'
      }
      
      socket.emit('send_location', locationData)
      setMarkers(prev => ({ ...prev, [user_id]: locationData }))
      setIsSharing(false)
      navigator.vibrate?.(100)
    }, (error) => {
      console.log('Location sharing failed')
      setIsSharing(false)
      alert('Please enable location access to share your position')
    })
  }, [user_id])

  const handleMarkerClick = useCallback((marker, userId) => {
    setSelectedMarker({ ...marker, userId })
    setShowBottomSheet(true)
  }, [])

  const handleLocationRequest = useCallback((latitude, longitude) => {
    setUserLocation({ latitude, longitude })
    setMarkers(prev => ({
      ...prev,
      [user_id]: { ...prev[user_id], latitude, longitude }
    }))
  }, [user_id])

  const handlePinModeToggle = useCallback(() => {
    setIsPinMode(prev => !prev)
  }, [])

  const handlePinPlace = useCallback((latlng) => {
    const newPin = {
      id: Date.now(),
      latitude: latlng.lat,
      longitude: latlng.lng,
      title: 'Custom Pin',
      description: 'Added by you',
      timestamp: new Date().toISOString()
    }
    
    setCustomPins(prev => [...prev, newPin])
    setIsPinMode(false) // Exit pin mode after placing
    
    // Optional: Auto-open bottom sheet for the new pin
    setSelectedMarker(newPin)
    setShowBottomSheet(true)
    
    console.log('Pin placed at:', latlng)
  }, [])

  // Use user location if available, otherwise use default
  const centerPosition = userLocation 
    ? [userLocation.latitude, userLocation.longitude]
    : [defaultLocation.latitude, defaultLocation.longitude]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MapContainer
        center={centerPosition}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={true}
      >
        <MapLayers maptilerApiKey={import.meta.env.VITE_MAPTILER_API} />
        <PinPlacer onPinPlace={handlePinPlace} isEnabled={isPinMode} />
        <MapControls 
          onLocationRequest={handleLocationRequest}
          onPinModeToggle={handlePinModeToggle}
          isPinMode={isPinMode}
        />
        
        {/* Share Location Button */}
        <motion.button
          onClick={handleLocationShare}
          disabled={isSharing}
          className="fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-full shadow-lg"
          style={{ zIndex: Z_INDEX.UI_CONTROLS }}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
        >
          {isSharing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="text-lg"
            >
              📡
            </motion.div>
          ) : (
            <div className="text-lg">📡</div>
          )}
        </motion.button>
        
        {/* Live location markers */}
        {Object.entries(markers).map(([userId, marker]) => {
          const { latitude, longitude, live_period, quest, name } = marker
          return live_period && (
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

        {/* Custom pins */}
        {customPins.map((pin) => (
          <Marker 
            key={pin.id} 
            position={[pin.latitude, pin.longitude]}
            eventHandlers={{
              click: () => handleMarkerClick(pin, `custom_${pin.id}`)
            }}
          >
            <Popup>
              <div className="p-2">
                <strong className="block text-sm">{pin.title}</strong>
                <span className="text-xs text-gray-600">{pin.description}</span>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(pin.timestamp).toLocaleString()}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <BottomSheet isOpen={showBottomSheet} onClose={() => setShowBottomSheet(false)}>
        {selectedMarker && (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">
              {selectedMarker.name || selectedMarker.title || 'Location'}
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedMarker.quest || selectedMarker.description || 'No description'}
            </p>
            
            {selectedMarker.userId?.startsWith('custom_') ? (
              <div className="space-y-2">
                <button 
                  className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600"
                  onClick={() => {
                    setCustomPins(prev => prev.filter(p => p.id !== selectedMarker.id))
                    setShowBottomSheet(false)
                  }}
                >
                  Remove Pin
                </button>
                <button className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300">
                  Edit Pin
                </button>
              </div>
            ) : (
              <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600">
                Start Chat
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}