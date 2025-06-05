import React, { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

// Mobile detection
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768 ||
         'ontouchstart' in window
}

// Standard map controls - familiar behavior like Google Maps
export const MapControls = () => {
  const map = useMap()
  
  useEffect(() => {
    // Enable ALL standard map interactions
    map.doubleClickZoom.enable()  // Double click/tap to zoom
    map.scrollWheelZoom.enable()  // Mouse wheel zoom
    map.boxZoom.enable()          // Shift+drag to zoom
    map.keyboard.enable()         // Arrow keys and +/- keys
    map.dragging.enable()         // Pan/drag
    map.touchZoom.enable()        // Pinch to zoom on mobile
    
    // Position zoom controls appropriately for device
    const zoomControl = L.control.zoom({ 
      position: isMobileDevice() ? 'bottomright' : 'topleft'
    })
    map.addControl(zoomControl)
    
    // Set reasonable zoom limits
    map.setMinZoom(3)   // World view
    map.setMaxZoom(19)  // Street level detail
    
    return () => {
      map.removeControl(zoomControl)
    }
  }, [map])
  
  return null
}

// Minimal event handler - just for analytics/debugging, no portal actions
export const MapEventHandler = () => {
  // No map click handlers needed - pure navigation experience
  // Portal creation is ONLY via the dedicated button
  
  return null
}