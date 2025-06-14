import { useEffect, useState, useCallback } from 'react'

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

// Local portal management with localStorage persistence
export const useLocalPortals = (user) => {
  const [portals, setPortals] = useState([])
  const [userPortal, setUserPortal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connected') // Always connected in local mode

  // Load portals from localStorage on mount
  useEffect(() => {
    if (!user) return

    const loadPortals = () => {
      try {
        const savedPortals = localStorage.getItem('portal_data')
        if (savedPortals) {
          const parsedPortals = JSON.parse(savedPortals)
          
          // Filter out expired portals
          const activePortals = parsedPortals.filter(portal => {
            const expiresAt = new Date(portal.expires_at)
            return expiresAt > new Date() && portal.is_active
          })
          
          setPortals(activePortals)
          
          // Find user's portal
          const myPortal = activePortals.find(p => p.user_id === user.id)
          setUserPortal(myPortal || null)
          
          // Save cleaned portals back to localStorage
          localStorage.setItem('portal_data', JSON.stringify(activePortals))
          
          console.log(`Loaded ${activePortals.length} active portals`)
        }
      } catch (err) {
        console.error('Error loading portals:', err)
        localStorage.removeItem('portal_data')
      }
    }

    loadPortals()
    
    // Cleanup expired portals every 30 seconds
    const cleanupInterval = setInterval(loadPortals, 30000)
    
    return () => clearInterval(cleanupInterval)
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
      const newPortal = {
        id: `portal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 100,
        is_active: true,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        profiles: { 
          username: user.email?.split('@')[0] || 'Anonymous', 
          avatar_url: null 
        }
      }

      // Get existing portals
      const existingPortals = JSON.parse(localStorage.getItem('portal_data') || '[]')
      
      // Remove any existing portal by this user
      const filteredPortals = existingPortals.filter(p => p.user_id !== user.id)
      
      // Add new portal
      const updatedPortals = [newPortal, ...filteredPortals]
      
      // Save to localStorage
      localStorage.setItem('portal_data', JSON.stringify(updatedPortals))
      
      // Update state
      setPortals(updatedPortals)
      setUserPortal(newPortal)
      
      console.log('Portal created successfully:', newPortal.id)
      return { data: newPortal, error: null }
      
    } catch (err) {
      console.error('Portal creation failed:', err)
      return { error: err.message || 'Portal creation failed' }
    }
  }

  const closePortal = async () => {
    if (!userPortal || !user) {
      return { error: 'No portal to close' }
    }

    try {
      // Get existing portals
      const existingPortals = JSON.parse(localStorage.getItem('portal_data') || '[]')
      
      // Remove user's portal
      const updatedPortals = existingPortals.filter(p => p.user_id !== user.id)
      
      // Save to localStorage
      localStorage.setItem('portal_data', JSON.stringify(updatedPortals))
      
      // Update state
      setPortals(updatedPortals)
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

// Local message management for chat
export const useLocalMessages = (portalId, user) => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  // Load messages for specific portal
  useEffect(() => {
    if (!portalId || !user) {
      setMessages([])
      return
    }

    try {
      const savedMessages = localStorage.getItem('portal_messages')
      if (savedMessages) {
        const allMessages = JSON.parse(savedMessages)
        const portalMessages = allMessages.filter(msg => msg.portal_id === portalId)
        setMessages(portalMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      }
    } catch (err) {
      console.error('Error loading messages:', err)
      localStorage.removeItem('portal_messages')
    }
  }, [portalId, user])

  const sendMessage = async (content) => {
    if (!content.trim() || !portalId || !user) return false

    try {
      const newMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        portal_id: portalId,
        user_id: user.id,
        content: content.trim(),
        message_type: 'text',
        created_at: new Date().toISOString(),
        profiles: {
          username: user.email?.split('@')[0] || 'Anonymous',
          avatar_url: null
        }
      }

      // Get existing messages
      const existingMessages = JSON.parse(localStorage.getItem('portal_messages') || '[]')
      
      // Add new message
      const updatedMessages = [...existingMessages, newMessage]
      
      // Save to localStorage
      localStorage.setItem('portal_messages', JSON.stringify(updatedMessages))
      
      // Update state
      setMessages(prev => [...prev, newMessage])
      
      console.log('Message sent:', newMessage.id)
      return true
      
    } catch (err) {
      console.error('Message send failed:', err)
      return false
    }
  }

  return {
    messages,
    loading,
    sendMessage
  }
}