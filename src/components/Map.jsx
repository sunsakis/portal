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

// Mobile detection utility
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768 ||
         'ontouchstart' in window
}

// Custom hook for geolocation
const useGeolocation = () => {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser')
      return Promise.reject('Geolocation not supported')
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
          setLocation(newLocation)
          setLoading(false)
          resolve(newLocation)
        },
        (error) => {
          let errorMessage = 'Unable to get your location'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.'
              break
          }
          setError(errorMessage)
          setLoading(false)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    })
  }, [])

  return { location, error, loading, getCurrentLocation }
}

// Toast notification component
const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-green-500',
    warning: 'bg-orange-500'
  }[type]

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm mx-auto`}
      style={{ zIndex: 2000 }}
    >
      <div className="flex items-center gap-2">
        <span>{type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="ml-auto text-white/80 hover:text-white">
          ✕
        </button>
      </div>
    </motion.div>
  )
}

// Chat Portal Component
const ChatPortal = ({ isOpen, onClose, portalData, currentUserId }) => {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure the sheet is fully open
      setTimeout(() => {
        inputRef.current.focus()
      }, 300)
    }
  }, [isOpen])

  // Socket events for chat
  useEffect(() => {
    if (!isOpen || !portalData) return

    const portalId = `portal_${portalData.userId || 'unknown'}`
    
    socket.emit('join_portal', { portalId, userId: currentUserId })

    socket.on('receive_message', (data) => {
      if (data.portalId === portalId) {
        setMessages(prev => [...prev, data])
      }
    })

    socket.on('user_typing', (data) => {
      if (data.portalId === portalId && data.userId !== currentUserId) {
        setTyping(data.isTyping)
      }
    })

    socket.on('portal_joined', (data) => {
      if (data.portalId === portalId) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'system',
          message: `${data.userName} joined the portal`,
          timestamp: new Date().toISOString()
        }])
      }
    })

    return () => {
      socket.off('receive_message')
      socket.off('user_typing')
      socket.off('portal_joined')
      socket.emit('leave_portal', { portalId, userId: currentUserId })
    }
  }, [isOpen, portalData, currentUserId])

  const sendMessage = () => {
    if (!message.trim() || !portalData) return

    const portalId = `portal_${portalData.userId || 'unknown'}`
    const messageData = {
      id: Date.now(),
      portalId,
      userId: currentUserId,
      userName: 'You',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: 'user'
    }

    socket.emit('send_message', messageData)
    setMessages(prev => [...prev, messageData])
    setMessage('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTyping = () => {
    if (!portalData) return
    
    const portalId = `portal_${portalData.userId || 'unknown'}`
    socket.emit('typing', { 
      portalId, 
      userId: currentUserId, 
      isTyping: message.length > 0 
    })
  }

  useEffect(() => {
    handleTyping()
  }, [message])

  const bind = useDrag(
    ({ last, velocity: [, vy], direction: [, dy], movement: [, my] }) => {
      if (last && (my > 100 || (vy > 0.5 && dy > 0))) {
        onClose()
      }
    },
    { from: () => [0, 0], filterTaps: true, bounds: { top: 0 }, rubberband: true }
  )

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getDistanceText = (accuracy) => {
    if (accuracy < 10) return "Very close"
    if (accuracy < 50) return "Nearby"
    if (accuracy < 100) return "Close"
    return "In the area"
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black"
            style={{ zIndex: 1800 }}
            onClick={onClose}
          />
          <motion.div
            {...bind()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl touch-none flex flex-col"
            style={{ height: '80vh', zIndex: 1900 }}
          >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200">
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    🧌 Portal Chat
                  </h3>
                  {portalData && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>{portalData.name || 'Anonymous'}</span>
                      <span>•</span>
                      <span>{getDistanceText(portalData.accuracy || 100)}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">👋</div>
                  <p className="text-gray-500">
                    Start a conversation with people at this location!
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.type === 'system' ? 'justify-center' : msg.userId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                    {msg.type === 'system' ? (
                      <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {msg.message}
                      </div>
                    ) : (
                      <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl ${
                        msg.userId === currentUserId
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}>
                        {msg.userId !== currentUserId && (
                          <div className="text-xs opacity-70 mb-1">
                            {msg.userName}
                          </div>
                        )}
                        <div className="text-sm">{msg.message}</div>
                        <div className={`text-xs mt-1 ${
                          msg.userId === currentUserId ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-900 px-3 py-2 rounded-2xl">
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="1"
                    style={{ 
                      minHeight: '44px', 
                      maxHeight: '100px',
                      paddingBottom: 'env(safe-area-inset-bottom, 12px)'
                    }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className={`p-3 rounded-full font-medium transition-colors ${
                    message.trim()
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  style={{ minWidth: '44px', height: '44px' }}
                >
                  <span className="text-lg">➤</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Map event handler for double taps
const MapEventHandler = ({ onDoubleTap }) => {
  const map = useMap()
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef(null)

  useMapEvents({
    click: (e) => {
      if (!isMobileDevice()) return

      const now = Date.now()
      const timeSinceLastTap = now - lastTapRef.current

      if (timeSinceLastTap < 300) {
        // Double tap detected
        clearTimeout(tapTimeoutRef.current)
        onDoubleTap(e)
      } else {
        // Single tap - wait to see if another tap comes
        tapTimeoutRef.current = setTimeout(() => {
          // Single tap confirmed (no double tap)
        }, 300)
      }

      lastTapRef.current = now
    }
  })

  return null
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

// Custom marker icon for user's location
const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div class="user-location-wrapper">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
    className: 'user-location-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

// Portal marker icon
const createPortalIcon = () => {
  return L.divIcon({
    html: `
      <div class="portal-wrapper">
        <div class="portal-pulse"></div>
        <div class="portal-icon">🧌</div>
      </div>
    `,
    className: 'portal-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })
}

export default function Map() {
  const user_id = 'user_' + Math.random().toString(36).substr(2, 9)
  const [showChatPortal, setShowChatPortal] = useState(false)
  const [selectedPortal, setSelectedPortal] = useState(null)
  const [toasts, setToasts] = useState([])
  const [userPin, setUserPin] = useState(null)
  const [isPlacingPin, setIsPlacingPin] = useState(false)
  
  const { location, error, loading, getCurrentLocation } = useGeolocation()
  
  // Default to Vilnius coordinates
  const defaultLocation = { latitude: 54.697325, longitude: 25.315356 }
  
  const [markers, setMarkers] = useState({
    [user_id]: { 
      ...defaultLocation,
      live_period: null,
      quest: '',
      name: 'You'
    }
  })

  // Add toast utility
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

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
    const portalData = {
      ...marker,
      userId,
      name: userId === user_id ? 'Your Portal' : marker.name || 'Anonymous'
    }
    setSelectedPortal(portalData)
    setShowChatPortal(true)
  }, [user_id])

  const handlePlacePin = useCallback(async (e) => {
    setIsPlacingPin(true)
    addToast('Getting your location...', 'info')

    try {
      const userLocation = await getCurrentLocation()
      
      // Create user pin at GPS location
      const newPin = {
        id: 'user-location',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy,
        timestamp: Date.now()
      }

      setUserPin(newPin)

      // Send location to socket
      socket.emit('send_location', {
        user_id,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        live_period: Date.now() + 300000, // 5 minutes from now
        quest: 'Available for chat',
        name: 'Anonymous'
      })

      // Update local markers
      setMarkers(prev => ({
        ...prev,
        [user_id]: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          live_period: Date.now() + 300000,
          quest: 'Available for chat',
          name: 'You'
        }
      }))

      addToast(`Portal opened! Others can now join your chat`, 'success')
      
    } catch (err) {
      console.error('Location error:', err)
      addToast(error || 'Could not get your location', 'error')
    } finally {
      setIsPlacingPin(false)
    }
  }, [getCurrentLocation, addToast, error, user_id])

  const handleDoubleTap = useCallback(async (e) => {
    if (!isMobileDevice()) {
      addToast('This action is only available on mobile devices', 'warning')
      return
    }

    // Only allow double tap if no pin is placed yet
    if (!userPin) {
      handlePlacePin(e)
    }
  }, [userPin, handlePlacePin, addToast])

  // Use default location as center
  const centerPosition = [defaultLocation.latitude, defaultLocation.longitude]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Toast notifications */}
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>

      {/* Loading overlay for pin placement */}
      {isPlacingPin && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2100, backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
            <span>Getting your location...</span>
          </div>
        </div>
      )}

      <MapContainer
        center={centerPosition}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={true}
        doubleClickZoom={false}
      >
        <MapLayers maptilerApiKey={import.meta.env.VITE_MAPTILER_API} />
        <MapControls />
        <MapEventHandler onDoubleTap={handleDoubleTap} />
        
        {/* User's location pin - now clickable for chat */}
        {userPin && markers[user_id]?.live_period && (
          <Marker 
            position={[userPin.latitude, userPin.longitude]}
            icon={createPortalIcon()}
            eventHandlers={{
              click: () => handleMarkerClick(markers[user_id], user_id)
            }}
          />
        )}
        
        {/* Other user markers */}
        {Object.entries(markers).map(([userId, marker]) => {
          const { latitude, longitude, live_period, quest, name } = marker
          return live_period && userId !== user_id && (
            <Marker 
              key={userId} 
              position={[latitude, longitude]}
              icon={createPortalIcon()}
              eventHandlers={{
                click: () => handleMarkerClick(marker, userId)
              }}
            />
          )
        })}
      </MapContainer>

      {/* Chat Portal */}
      <ChatPortal 
        isOpen={showChatPortal} 
        onClose={() => setShowChatPortal(false)}
        portalData={selectedPortal}
        currentUserId={user_id}
      />

      {/* Pin placement/removal button - centered at bottom */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`fixed bottom-14 left-1/3 transform -translate-x-1/2 ${
          userPin 
            ? 'bg-red-500 hover:bg-red-600 opacity-30' 
            : 'bg-green-500 hover:bg-green-600 opacity-80'
        } text-white px-6 py-4 rounded-full shadow-xl flex items-center gap-2 font-medium`}
        style={{ 
          zIndex: 1600,
          marginBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
        onClick={userPin ? 
          () => {
            setUserPin(null)
            setMarkers(prev => ({
              ...prev,
              [user_id]: { ...prev[user_id], live_period: null }
            }))
            socket.emit('send_location', {
              user_id,
              latitude: 0,
              longitude: 0,
              live_period: null,
              quest: '',
              name: ''
            })
            addToast('Chat portal closed', 'info')
          } :
          handlePlacePin
        }
        disabled={isPlacingPin}
      >
        {isPlacingPin ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span className="text-sm">Getting location...</span>
          </>
        ) : userPin ? (
          <>
            <span className="text-xl">🧌</span>
            <span className="text-sm">Close Portal</span>
          </>
        ) : (
          <>
            <span className="text-xl">🧌</span>
            <span className="text-sm">Open Portal</span>
          </>
        )}
      </motion.button>

      <style jsx>{`
        .portal-marker {
          background: transparent !important;
          border: none !important;
          z-index: 1000 !important;
        }

        .portal-wrapper {
          position: relative;
          width: 30px;
          height: 30px;
        }

        .portal-icon {
          width: 30px;
          height: 30px;
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: absolute;
          top: 0;
          left: 0;
          z-index: 1002;
          cursor: pointer;
        }

        .portal-pulse {
          position: absolute;
          top: -10px;
          left: -10px;
          width: 50px;
          height: 50px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          animation: portalPulse 2s infinite;
          z-index: 1001;
        }

        @keyframes portalPulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}