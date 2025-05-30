import React, { useEffect, useRef } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

// Mobile detection
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768 ||
         'ontouchstart' in window
}

// Map controls and zoom positioning
export const MapControls = () => {
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
export const MapEventHandler = ({ onDoubleTap }) => {
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