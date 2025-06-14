import React from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Smooth, continuous scaling functions
const getMarkerSizeForZoom = (zoom) => {
  // Smooth interpolation between zoom levels
  // Base size at zoom 13 = 30px, grows/shrinks smoothly
  const baseZoom = 13
  const baseSize = 30
  const scaleFactor = 1.15 // How much size changes per zoom level
  
  // Smooth exponential scaling
  const size = baseSize * Math.pow(scaleFactor, zoom - baseZoom)
  
  // Clamp between reasonable bounds for mobile
  return Math.max(20, Math.min(50, size))
}

const getPulseSizeForZoom = (zoom) => {
  // Pulse size represents ~50m radius, scales with zoom
  const baseZoom = 13
  const baseSize = 50
  const scaleFactor = 1.2 // Pulse grows faster than marker
  
  const size = baseSize * Math.pow(scaleFactor, zoom - baseZoom)
  return Math.max(35, Math.min(80, size))
}

const getFontSizeForZoom = (zoom) => {
  // Font scales with marker but stays readable
  const markerSize = getMarkerSizeForZoom(zoom)
  return Math.max(14, Math.min(22, markerSize * 0.6))
}

// Create smoothly scaling portal icon with CSS transforms
export const createPortalIcon = (isUserPortal = false, zoom = 13) => {
  const emoji = '🟢'
  const pulseColor = 'rgba(34, 197, 94, 0.4)'
  
  const markerSize = getMarkerSizeForZoom(zoom)
  const pulseSize = getPulseSizeForZoom(zoom)
  const fontSize = getFontSizeForZoom(zoom)
  
  // Use CSS transforms for smooth scaling
  const scale = markerSize / 30 // Relative to base size
  
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: scale(${scale});
        transform-origin: center center;
        transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      ">
        <!-- Smooth pulse ring -->
        <div style="
          position: absolute;
          width: ${pulseSize / scale}px;
          height: ${pulseSize / scale}px;
          background: ${pulseColor};
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: smooth-pulse-${Math.round(zoom * 10)} 2s ease-in-out infinite;
        "></div>
        
        <!-- Just the emoji, no borders or background -->
        <div style="
          font-size: ${fontSize / scale}px;
          position: relative;
          z-index: 2;
          cursor: pointer;
          transition: font-size 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          line-height: 1;
        ">${emoji}</div>
      </div>
      
      <style>
        @keyframes smooth-pulse-${Math.round(zoom * 10)} {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.6);
            opacity: 0;
          }
        }
      </style>
    `,
    className: 'smooth-portal-marker',
    iconSize: [30, 30], // Keep consistent base size
    iconAnchor: [15, 15] // Always centered
  })
}

// Smooth user location icon
export const createUserLocationIcon = (zoom = 13) => {
  const baseSize = 20
  const scale = getMarkerSizeForZoom(zoom) / 30 // Relative scaling
  const pulseSize = getPulseSizeForZoom(zoom)
  
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${baseSize}px;
        height: ${baseSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: scale(${scale});
        transform-origin: center center;
        transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      ">
        <!-- Smooth user pulse -->
        <div style="
          position: absolute;
          width: ${pulseSize / scale}px;
          height: ${pulseSize / scale}px;
          background: rgba(34, 197, 94, 0.3);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: smooth-user-pulse-${Math.round(zoom * 10)} 2s ease-in-out infinite;
        "></div>
        
        <!-- User location dot -->
        <div style="
          width: ${baseSize}px;
          height: ${baseSize}px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
          transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        "></div>
      </div>
      
      <style>
        @keyframes smooth-user-pulse-${Math.round(zoom * 10)} {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
      </style>
    `,
    className: 'smooth-user-marker',
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize/2, baseSize/2]
  })
}

// Enhanced zoom hook with smooth updates
const useMapZoom = () => {
  const map = useMap()
  const [zoom, setZoom] = React.useState(map.getZoom())
  
  React.useEffect(() => {
    let animationFrame = null
    
    const updateZoom = () => {
      // Cancel any pending updates
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
      
      // Smooth update on next frame
      animationFrame = requestAnimationFrame(() => {
        const currentZoom = map.getZoom()
        setZoom(currentZoom)
        console.log(`Map zoom smoothly updated to: ${currentZoom.toFixed(2)}`)
      })
    }
    
    // Listen to both zoom and zoomend for ultra-smooth scaling
    map.on('zoom', updateZoom)
    map.on('zoomend', updateZoom)
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
      map.off('zoom', updateZoom)
      map.off('zoomend', updateZoom)
    }
  }, [map])
  
  return zoom
}

// User Portal Marker with smooth zoom scaling
export const UserPortalMarker = ({ portal, onPortalClick }) => {
  const zoom = useMapZoom()
  const [currentIcon, setCurrentIcon] = React.useState(null)
  
  console.log('UserPortalMarker render at zoom:', zoom.toFixed(2))
  
  // Update icon smoothly when zoom changes
  React.useEffect(() => {
    const newIcon = createPortalIcon(true, zoom)
    setCurrentIcon(newIcon)
  }, [zoom])
  
  if (!portal || !currentIcon) return null

  const handleClick = (e) => {
    console.log('User portal clicked at zoom', zoom.toFixed(2))
    e.originalEvent?.preventDefault()
    e.originalEvent?.stopPropagation()
    onPortalClick(portal)
  }

  return (
    <Marker 
      position={[portal.latitude, portal.longitude]}
      icon={currentIcon}
      eventHandlers={{
        click: handleClick
      }}
    >
    </Marker>
  )
}

// Other Portals with smooth zoom scaling
export const OtherPortalsMarkers = ({ portals, userId, onPortalClick }) => {
  const zoom = useMapZoom()
  
  console.log('OtherPortalsMarkers render:', portals?.length, 'portals at zoom:', zoom.toFixed(2))
  
  return (
    <>
      {portals.map((portal) => {
        if (portal.user_id === userId) return null
        
        const handleClick = (e) => {
          console.log('Other portal clicked:', portal.id.slice(0, 8), 'zoom:', zoom.toFixed(2))
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
          onPortalClick(portal)
        }

        return (
          <PortalMarkerItem
            key={portal.id}
            portal={portal}
            zoom={zoom}
            onClick={handleClick}
          />
        )
      })}
    </>
  )
}

// Separate component for individual portal markers to optimize re-renders
const PortalMarkerItem = React.memo(({ portal, zoom, onClick }) => {
  const [currentIcon, setCurrentIcon] = React.useState(null)
  
  React.useEffect(() => {
    const newIcon = createPortalIcon(false, zoom)
    setCurrentIcon(newIcon)
  }, [zoom])
  
  if (!currentIcon) return null
  
  return (
    <Marker
      position={[portal.latitude, portal.longitude]}
      icon={currentIcon}
      eventHandlers={{
        click: onClick
      }}
    >
    </Marker>
  )
})