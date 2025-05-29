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

// Component to handle long press events on the map
const LongPressHandler = ({ onLongPress, longPressDuration = 1000 }) => {
  const map = useMap()
  const pressTimer = useRef(null)
  const pressStartPos = useRef(null)
  const isPressing = useRef(false)
  const [showRipple, setShowRipple] = useState(null)

  useMapEvents({
    mousedown: (e) => handlePressStart(e),
    mouseup: () => handlePressEnd(),
    mousemove: (e) => handlePressMove(e),
    touchstart: (e) => {
      // Prevent default to avoid scroll issues
      if (e.originalEvent.touches.length === 1) {
        handlePressStart(e)
      }
    },
    touchend: () => handlePressEnd(),
    touchmove: (e) => handlePressMove(e),
    touchcancel: () => handlePressEnd(),
  })

  const handlePressStart = (e) => {
    if (isPressing.current) return
    
    isPressing.current = true
    pressStartPos.current = e.latlng
    
    // Show visual feedback
    setShowRipple({
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      pixel: map.latLngToContainerPoint(e.latlng)
    })

    // Start the long press timer
    pressTimer.current = setTimeout(() => {
      if (isPressing.current && pressStartPos.current) {
        onLongPress(pressStartPos.current)
        handlePressEnd()
      }
    }, longPressDuration)
  }

  const handlePressMove = (e) => {
    if (!isPressing.current || !pressStartPos.current) return
    
    // Calculate distance moved from initial press
    const distance = map.distance(pressStartPos.current, e.latlng)
    
    // Cancel long press if moved too far (more than 10 meters)
    if (distance > 10) {
      handlePressEnd()
    }
  }

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    isPressing.current = false
    pressStartPos.current = null
    setShowRipple(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current)
      }
    }
  }, [])

  return (
    <>
      {showRipple && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: showRipple.pixel.x - 30,
            top: showRipple.pixel.y - 30,
          }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-blue-500 rounded-full"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 0.2 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      )}
    </>
  )
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
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          <motion.div
            {...bind()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 touch-none"
            style={{ maxHeight: '70vh' }}
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

// Pin Creation Form Component
const PinCreationForm = ({ location, onSubmit, onCancel }) => {
  const [quest, setQuest] = useState('')
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30') // minutes

  const handleSubmit = (e) => {
    e.preventDefault()
    if (quest.trim() && name.trim()) {
      onSubmit({
        latitude: location.lat,
        longitude: location.lng,
        quest: quest.trim(),
        name: name.trim(),
        live_period: parseInt(duration) * 60 * 1000, // convert to milliseconds
        user_id: `user_${Date.now()}` // Generate unique ID
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Create a Pin</h3>
        <p className="text-sm text-gray-600 mb-4">
          Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          What are you looking for?
        </label>
        <textarea
          value={quest}
          onChange={(e) => setQuest(e.target.value)}
          placeholder="e.g., Looking for coffee buddy, Want to play chess, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows="3"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          How long should this pin stay active?
        </label>
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="120">2 hours</option>
          <option value="240">4 hours</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Create Pin
        </button>
      </div>
    </form>
  )
}

export default function Map() {
  const [showBottomSheet, setShowBottomSheet] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [showPinForm, setShowPinForm] = useState(false)
  const [pendingPinLocation, setPendingPinLocation] = useState(null)
  
  // Default to Vilnius coordinates
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }
  
  const [markers, setMarkers] = useState({})

  useEffect(() => {
    socket.on("receive_location", (data) => {
      const { latitude, longitude, live_period, user_id, quest, name } = data
      setMarkers(prevMarkers => ({ 
        ...prevMarkers,
        [user_id]: { latitude, longitude, live_period, quest, name, created_at: Date.now() }
      }))
    })

    return () => socket.off("receive_location")
  }, [])

  // Clean up expired markers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setMarkers(prevMarkers => {
        const updatedMarkers = { ...prevMarkers }
        Object.entries(updatedMarkers).forEach(([userId, marker]) => {
          if (marker.live_period && marker.created_at) {
            const expiryTime = marker.created_at + marker.live_period
            if (now > expiryTime) {
              delete updatedMarkers[userId]
            }
          }
        })
        return updatedMarkers
      })
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  const handleLongPress = useCallback((location) => {
    console.log('Long press detected at:', location)
    setPendingPinLocation(location)
    setShowPinForm(true)
    setShowBottomSheet(true)
  }, [])

  const handleMarkerClick = useCallback((marker, userId) => {
    setSelectedMarker({ ...marker, userId })
    setShowPinForm(false)
    setShowBottomSheet(true)
  }, [])

  const handlePinSubmit = useCallback((pinData) => {
    // Send to server
    socket.emit('send_location', pinData)
    
    // Add to local state immediately
    setMarkers(prev => ({
      ...prev,
      [pinData.user_id]: { ...pinData, created_at: Date.now() }
    }))

    // Close forms
    setShowPinForm(false)
    setShowBottomSheet(false)
    setPendingPinLocation(null)
  }, [])

  const handlePinCancel = useCallback(() => {
    setShowPinForm(false)
    setShowBottomSheet(false)
    setPendingPinLocation(null)
  }, [])

  const centerPosition = [defaultLocation.latitude, defaultLocation.longitude]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Instruction overlay for first-time users */}
      {Object.keys(markers).length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="absolute top-4 left-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-30 pointer-events-none"
        >
          <div className="text-center">
            <span className="text-2xl mb-2 block">👆</span>
            <p className="text-sm font-medium">Hold your finger on the map for 1 second to place a pin</p>
          </div>
        </motion.div>
      )}

      <MapContainer
        center={centerPosition}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={true}
      >
        <MapLayers maptilerApiKey={import.meta.env.VITE_MAPTILER_API} />
        <MapControls />
        <LongPressHandler onLongPress={handleLongPress} />
        
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
      </MapContainer>

      <BottomSheet isOpen={showBottomSheet} onClose={() => {
        setShowBottomSheet(false)
        setShowPinForm(false)
        setPendingPinLocation(null)
      }}>
        {showPinForm && pendingPinLocation ? (
          <PinCreationForm
            location={pendingPinLocation}
            onSubmit={handlePinSubmit}
            onCancel={handlePinCancel}
          />
        ) : selectedMarker ? (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">{selectedMarker.name}</h3>
            <p className="text-gray-600 mb-4">{selectedMarker.quest}</p>
            <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600">
              Start Chat
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  )
}