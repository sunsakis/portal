import React from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Calculate appropriate marker size based on zoom level
const getMarkerSizeForZoom = (zoom) => {
  // At zoom 13 (city level), use base size of 30px
  // At zoom 16 (street level), use larger size of 40px  
  // At zoom 10 (regional), use smaller size of 20px
  const baseZoom = 13
  const baseSize = 30
  
  if (zoom >= 16) return 40 // Street level - larger markers
  if (zoom >= 14) return 35 // Neighborhood level
  if (zoom >= 12) return baseSize // City level - base size
  if (zoom >= 10) return 25 // District level
  return 20 // Regional level and out - smaller markers
}

// Calculate pulse ring size (represents ~50m radius at different zooms)
const getPulseRangeForZoom = (zoom) => {
  // Approximate 50m radius representation at different zoom levels
  if (zoom >= 18) return 80 // Very close - large pulse
  if (zoom >= 16) return 65 // Street level
  if (zoom >= 14) return 55 // Neighborhood
  if (zoom >= 12) return 50 // City level
  if (zoom >= 10) return 40 // District
  return 35 // Regional and out - minimal pulse
}

// Create zoom-aware portal icon
export const createPortalIcon = (isUserPortal = false, zoom = 13) => {
  const emoji = isUserPortal ? '🟢' : '🌀'
  const color = isUserPortal ? '#10b981' : '#3b82f6'
  const pulseColor = isUserPortal ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'
  
  const markerSize = getMarkerSizeForZoom(zoom)
  const pulseSize = getPulseRangeForZoom(zoom)
  const fontSize = Math.max(12, Math.min(20, markerSize * 0.6)) // Scale font with marker
  
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${markerSize}px;
        height: ${markerSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulse ring representing ~50m range -->
        <div style="
          position: absolute;
          width: ${pulseSize}px;
          height: ${pulseSize}px;
          background: ${pulseColor};
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse-animation-${zoom} 2s infinite;
        "></div>
        
        <!-- Main marker -->
        <div style="
          width: ${markerSize}px;
          height: ${markerSize}px;
          background: white;
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${fontSize}px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
          cursor: pointer;
        ">${emoji}</div>
      </div>
      
      <style>
        @keyframes pulse-animation-${zoom} {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 0;
          }
        }
      </style>
    `,
    className: '',
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize/2, markerSize/2] // Always center
  })
}

// Create zoom-aware user location icon
export const createUserLocationIcon = (zoom = 13) => {
  const locationSize = Math.max(16, Math.min(24, getMarkerSizeForZoom(zoom) * 0.7))
  const pulseSize = Math.max(30, Math.min(50, getPulseRangeForZoom(zoom) * 0.8))
  
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${locationSize}px;
        height: ${locationSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulse ring -->
        <div style="
          position: absolute;
          width: ${pulseSize}px;
          height: ${pulseSize}px;
          background: rgba(34, 197, 94, 0.3);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: user-pulse-animation-${zoom} 2s infinite;
        "></div>
        
        <!-- Location dot -->
        <div style="
          width: ${locationSize}px;
          height: ${locationSize}px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
        "></div>
      </div>
      
      <style>
        @keyframes user-pulse-animation-${zoom} {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.6);
            opacity: 0;
          }
        }
      </style>
    `,
    className: '',
    iconSize: [locationSize, locationSize],
    iconAnchor: [locationSize/2, locationSize/2] // Always center
  })
}

// Hook to get current map zoom
const useMapZoom = () => {
  const map = useMap()
  const [zoom, setZoom] = React.useState(map.getZoom())
  
  React.useEffect(() => {
    const updateZoom = () => {
      const currentZoom = map.getZoom()
      setZoom(currentZoom)
      console.log(`Map zoom changed to: ${currentZoom}`) // Keep console logs for mobile debugging
    }
    
    map.on('zoomend', updateZoom)
    return () => map.off('zoomend', updateZoom)
  }, [map])
  
  return zoom
}

// User Portal Marker Component with zoom awareness
export const UserPortalMarker = ({ portal, onPortalClick }) => {
  const zoom = useMapZoom()
  console.log('UserPortalMarker render:', portal, 'zoom:', zoom)
  
  if (!portal) return null

  const handleClick = (e) => {
    console.log('User portal marker clicked at zoom', zoom, e)
    e.originalEvent?.preventDefault()
    e.originalEvent?.stopPropagation()
    onPortalClick(portal)
  }

  return (
    <Marker 
      position={[portal.latitude, portal.longitude]}
      icon={createPortalIcon(true, zoom)}
      eventHandlers={{
        click: handleClick
      }}
    >
      <Popup>
        <div className="p-2">
          <strong className="block text-sm text-green-600 mb-1">Your Chat Portal</strong>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Range: ~50m radius</div>
            <div>Accuracy: ±{Math.round(portal.accuracy || 0)}m</div>
            <div>Active since: {new Date(portal.created_at).toLocaleTimeString()}</div>
            <div className="text-xs text-gray-500 mt-1">Zoom: {zoom}</div>
            <button 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onPortalClick(portal)
              }}
              className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-colors"
            >
              Open Chat
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

// Other Portals Markers Component with zoom awareness
export const OtherPortalsMarkers = ({ portals, userId, onPortalClick }) => {
  const zoom = useMapZoom()
  console.log('OtherPortalsMarkers render:', portals?.length, 'portals at zoom:', zoom)
  
  return (
    <>
      {portals.map((portal) => {
        if (portal.user_id === userId) return null
        
        const handleClick = (e) => {
          console.log('Other portal marker clicked', portal.id, 'zoom:', zoom, e)
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
          onPortalClick(portal)
        }

        return (
          <Marker
            key={portal.id}
            position={[portal.latitude, portal.longitude]}
            icon={createPortalIcon(false, zoom)}
            eventHandlers={{
              click: handleClick
            }}
          >
            <Popup>
              <div className="p-2">
                <strong className="block text-sm mb-1">{portal.title}</strong>
                <span className="text-xs text-gray-600 block mb-2">{portal.description}</span>
                <div className="text-xs text-gray-500 mb-2">
                  <div>Range: ~50m radius</div>
                  <div>Zoom level: {zoom}</div>
                </div>
                <button 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onPortalClick(portal)
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
                >
                  Join Chat
                </button>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}