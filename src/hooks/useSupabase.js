import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// Simple username generation - just use the email
const generateUsername = (email, userId) => {
  return email || `user_${userId.slice(0, 8)}`
}

// Helper function to ensure user profile exists
const ensureUserProfile = async (user) => {
  if (!user || !supabase) return

  try {
    console.log('Ensuring profile exists for user:', user.id)
    
    // First check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Profile check error:', checkError)
      return
    }

    if (!existingProfile) {
      console.log('Creating new profile for user:', user.id)
      
      // Generate username (just use email)
      const username = generateUsername(user.email, user.id)
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Profile creation failed:', insertError)
      } else {
        console.log('Profile created successfully with username:', username)
      }
    } else {
      console.log('Profile already exists')
    }
  } catch (err) {
    console.error('Profile creation error:', err)
  }
}

// Enhanced auth hook with proper loading state management
export const useSupabaseAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadingTimeoutRef = useRef(null)

  // Clear loading after timeout to prevent infinite loading
  const setLoadingWithTimeout = useCallback((isLoading) => {
    setLoading(isLoading)
    
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    
    if (isLoading) {
      // Auto-clear loading after 30 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Loading timeout reached, clearing loading state')
        setLoading(false)
        setError('Connection timeout - please check your internet and try again')
      }, 30000)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setError('Supabase not configured')
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error)
        setError(error.message)
      }
      setUser(session?.user ?? null)
      setLoadingWithTimeout(false)
      
      // Ensure profile exists for existing session
      if (session?.user) {
        ensureUserProfile(session.user)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event)
        setUser(session?.user ?? null)
        setLoadingWithTimeout(false)
        setError(null)

        // Create/update profile when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserProfile(session.user)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [setLoadingWithTimeout])

  // Anonymous sign-in with timeout
  const signInAnonymously = async () => {
    if (!supabase) {
      setError('Supabase not configured')
      return false
    }

    try {
      setLoadingWithTimeout(true)
      console.log('Attempting anonymous sign-in...')
      
      const { data, error } = await supabase.auth.signInAnonymously()
      
      if (error) {
        console.error('Anonymous sign-in failed:', error)
        setError(error.message)
        setLoadingWithTimeout(false)
        return false
      }

      console.log('Anonymous sign-in successful')
      return true
    } catch (err) {
      console.error('Anonymous sign-in error:', err)
      setError(err.message)
      setLoadingWithTimeout(false)
      return false
    }
  }

  // Enhanced OTP authentication with proper error handling
  const authenticateWithCode = async (email, action, code = null) => {
    if (!supabase) {
      setError('Supabase not configured')
      return false
    }

    try {
      if (action === 'verify') {
        setLoadingWithTimeout(true)
      }
      setError(null)

      if (action === 'send') {
        console.log('Sending OTP via Supabase to:', email)
        
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: undefined
          }
        })

        if (error) {
          console.error('OTP send failed:', error)
          setError('Failed to send verification code')
          return false
        }

        console.log('OTP sent successfully to:', email)
        return true

      } else if (action === 'verify' && code) {
        console.log('Verifying OTP code:', code)
        
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'email'
        })

        if (error) {
          console.error('OTP verification failed:', error)
          setError('Invalid or expired code. Please try again.')
          setLoadingWithTimeout(false)
          return false
        }

        console.log('OTP verified successfully, user authenticated')
        setLoadingWithTimeout(false)
        return true
      }

    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message)
      if (action === 'verify') {
        setLoadingWithTimeout(false)
      }
      return false
    }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
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

// Enhanced geolocation hook with cancellation support
export const useGeolocation = () => {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const watchIdRef = useRef(null)
  const timeoutRef = useRef(null)

  // Cancel any ongoing location request
  const cancelLocationRequest = useCallback(() => {
    console.log('Cancelling location request')
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    setLoading(false)
    setError('Location request cancelled')
  }, [])

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const errorMsg = 'GPS not supported on this device'
      setError(errorMsg)
      return Promise.reject(new Error(errorMsg))
    }

    // Cancel any existing request
    cancelLocationRequest()
    
    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      // Set timeout for location request
      timeoutRef.current = setTimeout(() => {
        const errorMsg = 'GPS timeout - please try outdoors for better signal'
        console.warn('GPS timeout reached')
        setError(errorMsg)
        setLoading(false)
        reject(new Error(errorMsg))
      }, 20000)

      const successCallback = (position) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        // Validate coordinates
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

        // Reject extremely inaccurate readings (>1km)
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
      }

      const errorCallback = (error) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
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
      }

      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      )
    })
  }, [cancelLocationRequest])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelLocationRequest()
    }
  }, [cancelLocationRequest])

  return { 
    location, 
    error, 
    loading, 
    getCurrentLocation, 
    cancelLocationRequest 
  }
}

// Enhanced portal management with connection state handling
export const usePortals = (user) => {
  const [portals, setPortals] = useState([])
  const [userPortal, setUserPortal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [createPortalAbortController, setCreatePortalAbortController] = useState(null)

  // Cancel portal creation
  const cancelPortalCreation = useCallback(() => {
    if (createPortalAbortController) {
      createPortalAbortController.abort()
      setCreatePortalAbortController(null)
    }
    setLoading(false)
  }, [createPortalAbortController])

  // Track connection health with proper error handling
  useEffect(() => {
    if (!supabase) {
      setConnectionStatus('error')
      return
    }

    const channel = supabase.channel('connection_status')
    
    channel
      .on('system', {}, (payload) => {
        if (payload.extension === 'postgres_changes') {
          setConnectionStatus('connected')
        }
      })
      .subscribe((status) => {
        console.log('Real-time connection status:', status)
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error')
        } else if (status === 'CLOSED') {
          setConnectionStatus('closed')
        } else {
          setConnectionStatus('connecting')
        }
      })

    // Connection timeout
    const connectionTimeout = setTimeout(() => {
      if (connectionStatus === 'connecting') {
        console.warn('Connection timeout, setting to error state')
        setConnectionStatus('error')
      }
    }, 10000)

    return () => {
      clearTimeout(connectionTimeout)
      supabase.removeChannel(channel)
    }
  }, [connectionStatus])

  // Load portals with error handling
  useEffect(() => {
    if (!user || !supabase) return

    const loadPortals = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('portals')
          .select(`
            *,
            profiles:user_id (username, avatar_url)
          `)
          .eq('is_active', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading portals:', error)
          setConnectionStatus('error')
        } else {
          setPortals(data || [])
          const myPortal = data?.find(p => p.user_id === user.id)
          setUserPortal(myPortal || null)
          if (connectionStatus !== 'connected') {
            setConnectionStatus('connected')
          }
        }
      } catch (err) {
        console.error('Portal loading failed:', err)
        setConnectionStatus('error')
      } finally {
        setLoading(false)
      }
    }

    loadPortals()

    // Enhanced real-time subscription with better error handling
    const channel = supabase
      .channel('portals_realtime')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'portals',
          filter: 'is_active=eq.true'
        },
        async (payload) => {
          console.log('Portal created:', payload.new)
          
          try {
            const { data, error } = await supabase
              .from('portals')
              .select(`
                *,
                profiles:user_id (username, avatar_url)
              `)
              .eq('id', payload.new.id)
              .single()

            if (data && !error) {
              setPortals(prev => {
                if (prev.find(p => p.id === data.id)) return prev
                return [data, ...prev]
              })

              if (data.user_id === user.id) {
                setUserPortal(data)
              }
            }
          } catch (err) {
            console.error('Error fetching new portal:', err)
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'portals' 
        },
        (payload) => {
          console.log('Portal deleted:', payload.old)
          setPortals(prev => prev.filter(p => p.id !== payload.old.id))
          if (payload.old.user_id === user.id) {
            setUserPortal(null)
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'portals' 
        },
        async (payload) => {
          console.log('Portal updated:', payload.new)
          
          try {
            const { data, error } = await supabase
              .from('portals')
              .select(`
                *,
                profiles:user_id (username, avatar_url)
              `)
              .eq('id', payload.new.id)
              .single()

            if (data && !error) {
              setPortals(prev => prev.map(p => 
                p.id === data.id ? data : p
              ))

              if (data.user_id === user.id) {
                setUserPortal(data)
              }
            }
          } catch (err) {
            console.error('Error fetching updated portal:', err)
          }
        }
      )
      .subscribe((status) => {
        console.log('Portal subscription status:', status)
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error')
          setTimeout(loadPortals, 5000)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, connectionStatus])

  // Enhanced portal creation with cancellation support
  const createPortal = async (location) => {
    if (!user || !supabase) {
      return { error: 'Not authenticated' }
    }

    // Validate location
    if (!location || 
        typeof location.latitude !== 'number' || 
        typeof location.longitude !== 'number' ||
        isNaN(location.latitude) || 
        isNaN(location.longitude) ||
        location.latitude < -90 || location.latitude > 90 ||
        location.longitude < -180 || location.longitude > 180) {
      return { error: 'Invalid location coordinates' }
    }

    // Create abort controller for cancellation
    const abortController = new AbortController()
    setCreatePortalAbortController(abortController)

    // Optimistic update
    const optimisticPortal = {
      id: `temp_${Date.now()}`,
      user_id: user.id,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || 100,
      title: 'Chat Portal',
      description: 'Available for chat',
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      profiles: { username: user.email || 'You', avatar_url: null },
      _optimistic: true
    }

    setUserPortal(optimisticPortal)
    setPortals(prev => [optimisticPortal, ...prev])

    try {
      // Check if request was cancelled
      if (abortController.signal.aborted) {
        throw new Error('Portal creation cancelled')
      }

      await ensureUserProfile(user)

      if (abortController.signal.aborted) {
        throw new Error('Portal creation cancelled')
      }

      const portalData = {
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 100,
        title: 'Chat Portal',
        description: 'Available for chat',
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }

      const { data, error } = await supabase
        .from('portals')
        .insert(portalData)
        .select()
        .single()

      if (abortController.signal.aborted) {
        throw new Error('Portal creation cancelled')
      }

      if (error) {
        setUserPortal(null)
        setPortals(prev => prev.filter(p => p.id !== optimisticPortal.id))
        return { error: error.message || 'Failed to create portal' }
      }

      const realPortal = { ...data, profiles: optimisticPortal.profiles }
      setUserPortal(realPortal)
      setPortals(prev => prev.map(p => 
        p.id === optimisticPortal.id ? realPortal : p
      ))

      setCreatePortalAbortController(null)
      return { data, error: null }
    } catch (err) {
      if (err.message === 'Portal creation cancelled') {
        console.log('Portal creation was cancelled')
      } else {
        console.error('Portal creation error:', err)
      }
      
      setUserPortal(null)
      setPortals(prev => prev.filter(p => p.id !== optimisticPortal.id))
      setCreatePortalAbortController(null)
      return { error: err.message || 'Portal creation failed' }
    }
  }

  // Portal deletion with proper cleanup
  const closePortal = async () => {
    if (!userPortal || !user || !supabase) {
      return { error: 'No portal to close' }
    }

    const portalToDelete = userPortal

    setUserPortal(null)
    setPortals(prev => prev.filter(p => p.id !== portalToDelete.id))

    try {
      const { error } = await supabase
        .from('portals')
        .delete()
        .eq('id', portalToDelete.id)

      if (error) {
        setUserPortal(portalToDelete)
        setPortals(prev => [portalToDelete, ...prev])
        return { error: error.message }
      }

      return { error: null }
    } catch (err) {
      setUserPortal(portalToDelete)
      setPortals(prev => [portalToDelete, ...prev])
      return { error: err.message }
    }
  }

  return {
    portals,
    userPortal,
    loading,
    connectionStatus,
    createPortal,
    closePortal,
    cancelPortalCreation
  }
}

export { supabase }