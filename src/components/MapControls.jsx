import React, { useEffect, useRef, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'
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

// Enhanced event handler with long press detection for event creation
export const MapEventHandler = ({ onLongPress }) => {
  const map = useMap()
  const [isLongPressing, setIsLongPressing] = useState(false)
  const [longPressLocation, setLongPressLocation] = useState(null)
  const [showRipple, setShowRipple] = useState(false)
  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 })
  
  const longPressTimer = useRef(null)
  const pressStartTime = useRef(null)
  const pressStartLocation = useRef(null)
  const hasMoved = useRef(false)
  
  const LONG_PRESS_DURATION = 800 // 800ms for long press
  const MAX_MOVE_DISTANCE = 10 // pixels - cancel if user moves too much

  useMapEvents({
    // Mouse events (desktop)
    mousedown: (e) => {
      if (e.originalEvent.button !== 0) return // Only left click
      
      pressStartTime.current = Date.now()
      pressStartLocation.current = { x: e.containerPoint.x, y: e.containerPoint.y }
      hasMoved.current = false
      
      // Show initial ripple effect
      setRipplePosition({ x: e.containerPoint.x, y: e.containerPoint.y })
      setShowRipple(true)
      
      startLongPressTimer(e.latlng, e.containerPoint)
    },
    
    mouseup: (e) => {
      cancelLongPress()
    },
    
    mousemove: (e) => {
      if (pressStartLocation.current) {
        const distance = Math.sqrt(
          Math.pow(e.containerPoint.x - pressStartLocation.current.x, 2) +
          Math.pow(e.containerPoint.y - pressStartLocation.current.y, 2)
        )
        
        if (distance > MAX_MOVE_DISTANCE) {
          hasMoved.current = true
          cancelLongPress()
        }
      }
    },

    // Touch events (mobile)
    preclick: (e) => {
      // Prevent regular click if it was a long press
      if (isLongPressing) {
        L.DomEvent.stopPropagation(e.originalEvent)
        L.DomEvent.preventDefault(e.originalEvent)
      }
    }
  })

  // Handle touch events separately for better mobile support
  useEffect(() => {
    const mapContainer = map.getContainer()

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return // Only single touch
      
      const touch = e.touches[0]
      const rect = mapContainer.getBoundingClientRect()
      const containerPoint = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      }
      
      pressStartTime.current = Date.now()
      pressStartLocation.current = containerPoint
      hasMoved.current = false
      
      // Convert screen coordinates to lat/lng
      const latlng = map.containerPointToLatLng([containerPoint.x, containerPoint.y])
      
      // Show ripple effect
      setRipplePosition(containerPoint)
      setShowRipple(true)
      
      startLongPressTimer(latlng, containerPoint)
    }

    const handleTouchMove = (e) => {
      if (pressStartLocation.current && e.touches.length === 1) {
        const touch = e.touches[0]
        const rect = mapContainer.getBoundingClientRect()
        const currentPoint = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        }
        
        const distance = Math.sqrt(
          Math.pow(currentPoint.x - pressStartLocation.current.x, 2) +
          Math.pow(currentPoint.y - pressStartLocation.current.y, 2)
        )
        
        if (distance > MAX_MOVE_DISTANCE) {
          hasMoved.current = true
          cancelLongPress()
        }
      }
    }

    const handleTouchEnd = (e) => {
      cancelLongPress()
    }

    // Add touch event listeners
    mapContainer.addEventListener('touchstart', handleTouchStart, { passive: false })
    mapContainer.addEventListener('touchmove', handleTouchMove, { passive: false })
    mapContainer.addEventListener('touchend', handleTouchEnd, { passive: false })
    mapContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    return () => {
      mapContainer.removeEventListener('touchstart', handleTouchStart)
      mapContainer.removeEventListener('touchmove', handleTouchMove)
      mapContainer.removeEventListener('touchend', handleTouchEnd)
      mapContainer.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [map])

  const startLongPressTimer = (latlng, containerPoint) => {
    setIsLongPressing(false)
    setLongPressLocation(latlng)
    
    longPressTimer.current = setTimeout(() => {
      if (!hasMoved.current && pressStartTime.current) {
        setIsLongPressing(true)
        
        // Haptic feedback on supported devices
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
        
        // Call the long press handler
        if (onLongPress) {
          onLongPress(latlng, containerPoint)
        }
        
        // Hide ripple after triggering
        setTimeout(() => {
          setShowRipple(false)
          setIsLongPressing(false)
        }, 200)
      }
    }, LONG_PRESS_DURATION)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    
    pressStartTime.current = null
    pressStartLocation.current = null
    hasMoved.current = false
    
    // Hide ripple effect
    setTimeout(() => {
      setShowRipple(false)
      setIsLongPressing(false)
    }, 100)
  }

  return (
    <>
      {/* Ripple effect overlay */}
      <AnimatePresence>
        {showRipple && (
          <div className="fixed inset-0 pointer-events-none z-[1300]">
            <motion.div
              initial={{ 
                scale: 0, 
                opacity: 0.6,
                x: ripplePosition.x,
                y: ripplePosition.y
              }}
              animate={{ 
                scale: isLongPressing ? 3 : 1.5, 
                opacity: isLongPressing ? 0.8 : 0.3,
                x: ripplePosition.x,
                y: ripplePosition.y
              }}
              exit={{ 
                scale: 4, 
                opacity: 0,
                x: ripplePosition.x,
                y: ripplePosition.y
              }}
              transition={{ 
                duration: isLongPressing ? 0.3 : 0.8,
                ease: "easeOut"
              }}
              className="absolute w-8 h-8 -ml-4 -mt-4 bg-blue-500 rounded-full"
              style={{
                background: isLongPressing 
                  ? 'radial-gradient(circle, rgba(59,130,246,0.6) 0%, rgba(59,130,246,0.2) 50%, rgba(59,130,246,0) 100%)'
                  : 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, rgba(59,130,246,0.1) 50%, rgba(59,130,246,0) 100%)'
              }}
            />
            
            {/* Center dot */}
            <motion.div
              initial={{ 
                scale: 0,
                x: ripplePosition.x,
                y: ripplePosition.y
              }}
              animate={{ 
                scale: 1,
                x: ripplePosition.x,
                y: ripplePosition.y
              }}
              exit={{ 
                scale: 0,
                x: ripplePosition.x,
                y: ripplePosition.y
              }}
              className="absolute w-2 h-2 -ml-1 -mt-1 bg-blue-600 rounded-full"
            />
          </div>
        )}
      </AnimatePresence>

      {/* Long press instruction tooltip */}
      <AnimatePresence>
        {showRipple && !isLongPressing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[1400] pointer-events-none"
          >
            <div className="bg-gray-800/90 text-white text-sm px-3 py-2 rounded-lg backdrop-blur-sm">
              Hold to create event...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success feedback */}
      <AnimatePresence>
        {isLongPressing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[1400] pointer-events-none"
          >
            <div className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
              <span className="text-lg">📅</span>
              <span>Creating event...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}