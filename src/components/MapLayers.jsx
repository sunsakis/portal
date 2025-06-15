import React, { useState, useEffect } from 'react'
import { TileLayer, useMap } from 'react-leaflet'
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk'

const MapLayers = ({ maptilerApiKey }) => {
  const map = useMap()
  const [mapProvider, setMapProvider] = useState('maptiler')
  const [currentStyle, setCurrentStyle] = useState('streets-dark') // Start with dark mode
  const [retryCount, setRetryCount] = useState(0)
  const [showStyleSelector, setShowStyleSelector] = useState(false)

  // Available MapTiler styles with proper variants
  const availableStyles = [
    // Streets variants (same data, different colors)
    { id: 'streets-v2', name: 'Streets (Default)', category: 'Streets', variant: 'DEFAULT' },
    { id: 'streets-dark', name: 'Streets Dark', category: 'Streets', variant: 'DARK' },
    { id: 'streets-light', name: 'Streets Light', category: 'Streets', variant: 'LIGHT' },
    
    // Basic variants
    { id: 'basic-v2', name: 'Basic (Default)', category: 'Basic', variant: 'DEFAULT' },
    { id: 'basic-dark', name: 'Basic Dark', category: 'Basic', variant: 'DARK' },
    { id: 'basic-light', name: 'Basic Light', category: 'Basic', variant: 'LIGHT' },
    
    // Outdoor variants
    { id: 'outdoor-v2', name: 'Outdoor (Default)', category: 'Outdoor', variant: 'DEFAULT' },
    { id: 'outdoor-dark', name: 'Outdoor Dark', category: 'Outdoor', variant: 'DARK' },
    
    // Other specialized styles
    { id: 'satellite', name: 'Satellite', category: 'Satellite' },
    { id: 'hybrid', name: 'Hybrid', category: 'Satellite' },
    { id: 'topo-v2', name: 'Topographic', category: 'Special' },
    { id: 'winter-v2', name: 'Winter', category: 'Special' },
    
    // DataViz optimized
    { id: 'dataviz', name: 'DataViz (Default)', category: 'DataViz', variant: 'DEFAULT' },
    { id: 'dataviz-dark', name: 'DataViz Dark', category: 'DataViz', variant: 'DARK' },
    { id: 'dataviz-light', name: 'DataViz Light', category: 'DataViz', variant: 'LIGHT' },
    
    // Custom tile JSON examples
    { id: 'land-gradient-dark', name: 'Land Gradient Dark', category: 'Custom', isCustom: true },
    { id: 'ocean', name: 'Ocean Blue', category: 'Custom', isCustom: true }
  ]

  useEffect(() => {
    if (!maptilerApiKey || mapProvider === 'osm') {
      return
    }

    let layer = null
    let retryTimeout = null

    const initMapTiler = async () => {
      try {
        // Handle custom tile JSON URLs
        const styleConfig = availableStyles.find(s => s.id === currentStyle)
        
        if (styleConfig?.isCustom) {
          // For custom tile JSON, use the direct URL format
          const tileJsonUrl = `https://api.maptiler.com/tiles/${currentStyle}/tiles.json?key=${maptilerApiKey}`
          
          layer = new MaptilerLayer({
            apiKey: maptilerApiKey,
            style: tileJsonUrl, // Use full URL for custom styles
            tileSize: 512,
            zoomOffset: -1,
            detectRetina: true,
            attribution: '© MapTiler © OpenStreetMap contributors'
          })
        } else {
          // For standard styles, use the style ID
          layer = new MaptilerLayer({
            apiKey: maptilerApiKey,
            style: currentStyle,
            tileSize: 512,
            zoomOffset: -1,
            detectRetina: true,
            attribution: '© MapTiler © OpenStreetMap contributors'
          })
        }

        // Error handling
        layer.on('tileerror', (e) => {
          console.error(`MapTiler error for style ${currentStyle}:`, e)
          if (retryCount < 2) {
            setRetryCount(prev => prev + 1)
            retryTimeout = setTimeout(() => {
              console.log(`MapTiler retry ${retryCount + 1} for ${currentStyle}`)
            }, 1000)
          } else {
            console.log('MapTiler failed, using OpenStreetMap')
            setMapProvider('osm')
          }
        })

        layer.addTo(map)
        console.log(`MapTiler loaded successfully with style: ${currentStyle}`)

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
  }, [map, maptilerApiKey, mapProvider, currentStyle, retryCount])

  const handleStyleChange = (styleId) => {
    setCurrentStyle(styleId)
    setRetryCount(0) // Reset retry count when changing styles
    setShowStyleSelector(false)
  }

  const resetToOSM = () => {
    setMapProvider('osm')
    setShowStyleSelector(false)
  }

  // Fallback to OpenStreetMap
  if (!maptilerApiKey || mapProvider === 'osm') {
    return (
      <>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          tileSize={256}
          detectRetina={true}
        />
        
        {/* Style selector for OSM fallback */}
        <div className="fixed top-16 left-4 z-[1600] bg-white rounded-lg shadow-lg p-2">
          <button 
            onClick={() => setMapProvider('maptiler')}
            className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try MapTiler
          </button>
        </div>
      </>
    )
  }

  // MapTiler handles its own tiles
  return (
    <>
      {/* Style Selector */}
      <div className="fixed top-16 left-4 z-[1600]">
        <button
          onClick={() => setShowStyleSelector(!showStyleSelector)}
          className="bg-white rounded-lg shadow-lg p-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          🗺️ Styles
        </button>
        
        {showStyleSelector && (
          <div className="absolute top-12 left-0 bg-white rounded-lg shadow-xl border max-w-xs max-h-80 overflow-y-auto">
            <div className="p-2 border-b">
              <h3 className="font-semibold text-sm">Map Styles</h3>
              <p className="text-xs text-gray-600">Current: {availableStyles.find(s => s.id === currentStyle)?.name}</p>
            </div>
            
            <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
              {/* Group by category */}
              {['Streets', 'Basic', 'Outdoor', 'DataViz', 'Satellite', 'Special', 'Custom'].map(category => {
                const categoryStyles = availableStyles.filter(s => s.category === category)
                if (categoryStyles.length === 0) return null
                
                return (
                  <div key={category}>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1">
                      {category} {category === 'Streets' && '⭐ Full Details'}
                    </div>
                    {categoryStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => handleStyleChange(style.id)}
                        className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors ${
                          currentStyle === style.id ? 'bg-blue-100 text-blue-700' : ''
                        }`}
                      >
                        {style.name}
                        {style.isCustom && <span className="text-xs text-gray-500 ml-1">(Custom)</span>}
                        {style.variant === 'DARK' && <span className="text-xs text-blue-600 ml-1">🌙</span>}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
            
            <div className="p-2 border-t">
              <button
                onClick={resetToOSM}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 text-gray-600"
              >
                🔄 Fallback to OpenStreetMap
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default MapLayers