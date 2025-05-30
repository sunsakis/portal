// src/components/MapLayers.jsx - Simplified version
import React, { useState, useEffect } from 'react'
import { TileLayer, useMap } from 'react-leaflet'
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk'

const MapLayers = ({ maptilerApiKey }) => {
  const map = useMap()
  const [mapProvider, setMapProvider] = useState('maptiler')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!maptilerApiKey || mapProvider === 'osm') {
      return
    }

    let layer = null
    let retryTimeout = null

    const initMapTiler = async () => {
      try {
        layer = new MaptilerLayer({
          apiKey: maptilerApiKey,
          style: 'streets-v2', // Single style - clean and readable
          tileSize: 512,
          zoomOffset: -1,
          detectRetina: true,
          attribution: '© MapTiler © OpenStreetMap contributors'
        })

        // Simple error handling - fail fast to OSM
        layer.on('tileerror', (e) => {
          if (retryCount < 2) {
            setRetryCount(prev => prev + 1)
            retryTimeout = setTimeout(() => {
              console.log(`MapTiler retry ${retryCount + 1}`)
            }, 1000)
          } else {
            console.log('MapTiler failed, using OpenStreetMap')
            setMapProvider('osm')
          }
        })

        layer.addTo(map)
        console.log('MapTiler loaded successfully')

      } catch (error) {
        console.error('MapTiler init failed:', error)
        setMapProvider('osm')
      }
    }

    initMapTiler()

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout)
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    }
  }, [map, maptilerApiKey, mapProvider, retryCount])

  // Fallback to OpenStreetMap
  if (!maptilerApiKey || mapProvider === 'osm') {
    return (
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        tileSize={256}
        detectRetina={true}
      />
    )
  }

  // MapTiler handles its own tiles
  return null
}

export default MapLayers