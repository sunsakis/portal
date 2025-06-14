import { useEffect, useState, useCallback } from 'react'
import { 
  portalList, 
  portalMessages, 
  waku_CreatePortal, 
  waku_SendPortalMessage 
} from '../waku/node'

// Simple local user management - no external auth needed
export const useLocalAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check for existing user in localStorage
    const existingUser = localStorage.getItem('portal_user')
    if (existingUser) {
      try {
        setUser(JSON.parse(existingUser))
      } catch (err) {
        console.error('Invalid user data, creating new user')
        localStorage.removeItem('portal_user')
      }
    }
    
    // If no user exists, create anonymous user
    if (!existingUser) {
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: `anonymous_${Date.now()}@local.app`,
        created_at: new Date().toISOString(),
        anonymous: true
      }
      
      localStorage.setItem('portal_user', JSON.stringify(newUser))
      setUser(newUser)
    }
    
    setLoading(false)
  }, [])

  const signInAnonymously = async () => {
    try {
      setLoading(true)
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: `anonymous_${Date.now()}@local.app`,
        created_at: new Date().toISOString(),
        anonymous: true
      }
      
      localStorage.setItem('portal_user', JSON.stringify(newUser))
      setUser(newUser)
      setError(null)
      setLoading(false)
      return true
    } catch (err) {
      setError(err.message)
      setLoading(false)
      return false
    }
  }

  const authenticateWithCode = async (email, action, code = null) => {
    // Mock authentication for development
    if (action === 'send') {
      console.log(`Mock: Sending code to ${email}`)
      return true
    }
    
    if (action === 'verify' && code) {
      console.log(`Mock: Verifying code ${code} for ${email}`)
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email,
        created_at: new Date().toISOString(),
        anonymous: false
      }
      
      localStorage.setItem('portal_user', JSON.stringify(newUser))
      setUser(newUser)
      return true
    }
    
    return false
  }

  const signOut = async () => {
    localStorage.removeItem('portal_user')
    localStorage.removeItem('portal_messages')
    localStorage.removeItem('portal_data')
    setUser(null)
  }

  return { 
    user, 
    loading, 
    error, 
    authenticateWithCode, 
    signInAnonymously,
    signOut,
    isAuthenticated: !!user 
  }
}

// GPS-only location hook (unchanged)
export const useGeolocation = () => {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const errorMsg = 'GPS not supported on this device'
      setError(errorMsg)
      return Promise.reject(new Error(errorMsg))
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const errorMsg = 'GPS timeout - please try outdoors for better signal'
        setError(errorMsg)
        setLoading(false)
        reject(new Error(errorMsg))
      }, 20000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId)
          
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const acc = position.coords.accuracy

          if (typeof lat !== 'number' || typeof lng !== 'number' || 
              isNaN(lat) || isNaN(lng) || 
              lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            const errorMsg = 'Invalid GPS coordinates - please try again'
            setError(errorMsg)
            setLoading(false)
            reject(new Error(errorMsg))
            return
          }

          if (acc && acc > 1000) {
            const errorMsg = 'GPS signal too weak - please try outdoors'
            setError(errorMsg)
            setLoading(false)
            reject(new Error(errorMsg))
            return
          }

          const newLocation = {
            latitude: lat,
            longitude: lng,
            accuracy: typeof acc === 'number' && !isNaN(acc) ? Math.round(acc) : 100,
            timestamp: Date.now()
          }
          
          console.log('Valid GPS location:', newLocation)
          setLocation(newLocation)
          setLoading(false)
          resolve(newLocation)
        },
        (error) => {
          clearTimeout(timeoutId)
          let errorMessage = 'GPS unavailable'
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please allow location access and reload the page.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'GPS unavailable. Please check location settings and try outdoors.'
              break
            case error.TIMEOUT:
              errorMessage = 'GPS timeout. Try moving outdoors for better signal.'
              break
            default:
              errorMessage = `GPS error: ${error.message || 'Please try again'}`
          }
          
          console.error('GPS error:', error)
          setError(errorMessage)
          setLoading(false)
          reject(new Error(errorMessage))
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      )
    })
  }, [])

  return { location, error, loading, getCurrentLocation }
}

// Convert coordinates to fixed integers for Waku compatibility
const coordsToInt = (coord) => {
  return Math.round(coord * 1000000) // 6 decimal precision
}

const intToCoords = (intCoord) => {
  return intCoord / 1000000
}

// Waku-powered portal management
export const useLocalPortals = (user) => {
  const [portals, setPortals] = useState([])
  const [userPortal, setUserPortal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  // Monitor Waku portal list for updates
  useEffect(() => {
    if (!user) return

    console.log('Starting Waku portal monitoring for user:', user.id)
    
    const updatePortals = () => {
      try {
        // Convert Waku portals to frontend format
        const wakuPortals = portalList.map(portal => ({
          id: portal.id,
          user_id: portal.id.includes(user.id) ? user.id : `waku_user_${portal.id}`,
          latitude: intToCoords(portal.x),
          longitude: intToCoords(portal.y),
          is_active: true,
          created_at: new Date(portal.timestamp).toISOString(),
          expires_at: new Date(portal.timestamp + 24 * 60 * 60 * 1000).toISOString(),
          profiles: { 
            username: portal.id.includes(user.id) ? 'You' : 'Anonymous',
            avatar_url: null 
          }
        }))

        // Filter out expired portals
        const activePortals = wakuPortals.filter(portal => {
          const expiresAt = new Date(portal.expires_at)
          return expiresAt > new Date()
        })

        setPortals(activePortals)
        
        // Find user's portal
        const myPortal = activePortals.find(p => p.user_id === user.id)
        setUserPortal(myPortal || null)
        
        console.log(`Waku portals updated: ${activePortals.length} active portals`)
        setConnectionStatus(activePortals.length > 0 ? 'connected' : 'connecting')
        
      } catch (err) {
        console.error('Error processing Waku portals:', err)
        setConnectionStatus('error')
      }
    }

    // Initial update
    updatePortals()
    
    // Poll for updates every 2 seconds
    const interval = setInterval(updatePortals, 2000)
    
    return () => clearInterval(interval)
  }, [user])

  const createPortal = async (location) => {
    if (!user) {
      return { error: 'Not authenticated' }
    }

    if (!location || 
        typeof location.latitude !== 'number' || 
        typeof location.longitude !== 'number' ||
        isNaN(location.latitude) || 
        isNaN(location.longitude) ||
        location.latitude < -90 || location.latitude > 90 ||
        location.longitude < -180 || location.longitude > 180) {
      return { error: 'Invalid location coordinates' }
    }

    try {
      setLoading(true)
      console.log('Creating Waku portal at:', location)
      
      // Convert to integer coordinates for Waku
      const x = coordsToInt(location.latitude)
      const y = coordsToInt(location.longitude)
      
      // Create portal through Waku (using your original function)
      await waku_CreatePortal(x, y)
      
      // Create local representation
      const newPortal = {
        id: `${x},${y}`,
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 100,
        is_active: true,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        profiles: { 
          username: user.email?.split('@')[0] || 'Anonymous', 
          avatar_url: null 
        }
      }

      console.log('Waku portal created successfully:', newPortal.id)
      setLoading(false)
      return { data: newPortal, error: null }
      
    } catch (err) {
      console.error('Waku portal creation failed:', err)
      setLoading(false)
      return { error: err.message || 'Portal creation failed' }
    }
  }

  const closePortal = async () => {
    if (!userPortal || !user) {
      return { error: 'No portal to close' }
    }

    try {
      console.log('Closing Waku portal:', userPortal.id)
      
      // For now, we'll just remove from local state
      // Your original Waku doesn't have a direct "delete" - portals expire naturally
      setUserPortal(null)
      
      console.log('Portal closed successfully')
      return { error: null }
      
    } catch (err) {
      console.error('Portal close failed:', err)
      return { error: err.message }
    }
  }

  return {
    portals,
    userPortal,
    loading,
    connectionStatus,
    createPortal,
    closePortal
  }
}

// Waku-powered message management for chat
export const useLocalMessages = (portalId, user) => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  // Monitor Waku messages for this portal
  useEffect(() => {
    if (!portalId || !user) {
      setMessages([])
      return
    }

    console.log('Starting Waku message monitoring for portal:', portalId)

    const updateMessages = () => {
      try {
        // Get messages for this portal from Waku
        const wakuMessages = portalMessages[portalId] || []
        
        // Convert to frontend format
        const formattedMessages = wakuMessages.map(msg => ({
          id: `${msg.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          portal_id: portalId,
          user_id: `waku_user_${msg.timestamp}`, // Simple user identification
          content: msg.message,
          message_type: 'text',
          created_at: new Date(msg.timestamp).toISOString(),
          profiles: {
            username: `User_${msg.timestamp.toString().slice(-4)}`,
            avatar_url: null
          }
        }))

        // Sort by timestamp
        const sortedMessages = formattedMessages.sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        )

        setMessages(sortedMessages)
        console.log(`Waku messages updated: ${sortedMessages.length} messages for portal ${portalId}`)
        
      } catch (err) {
        console.error('Error processing Waku messages:', err)
      }
    }

    // Initial update
    updateMessages()
    
    // Poll for updates every 1 second
    const interval = setInterval(updateMessages, 1000)
    
    return () => clearInterval(interval)
  }, [portalId, user])

  const sendMessage = async (content) => {
    if (!content.trim() || !portalId || !user) return false

    try {
      console.log('Sending Waku message:', content, 'to portal:', portalId)
      
      // Send through Waku
      await waku_SendPortalMessage({
        portalId: portalId,
        timestamp: Date.now(),
        message: content.trim()
      })

      console.log('Waku message sent successfully')
      return true
      
    } catch (err) {
      console.error('Waku message send failed:', err)
      return false
    }
  }

  return {
    messages,
    loading,
    sendMessage
  }
}