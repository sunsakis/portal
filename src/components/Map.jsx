import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, Marker, Popup, useMap, TileLayer } from 'react-leaflet'
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk'
import { useDrag } from '@use-gesture/react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import L from 'leaflet'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css'

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001')

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
        style: 'streets-v2' // You can change this to other styles
      })
      
      mtLayer.addTo(map)
      
      // Handle ready event
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

export default function Map() {
  const user_id = 'user_id'
  const [showBottomSheet, setShowBottomSheet] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState(null)
  
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

  // Use default location as center
  const centerPosition = [defaultLocation.latitude, defaultLocation.longitude]

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
        <MapControls />
        
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
    </div>
  )
}