import { useEffect, useState, useCallback } from 'react'
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

// Clean OTP authentication hook using Edge Functions
export const useSupabaseAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
      setLoading(false)
      
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
        setLoading(false)
        setError(null)

        // Create/update profile when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserProfile(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Anonymous sign-in for development
  const signInAnonymously = async () => {
    if (!supabase) {
      setError('Supabase not configured')
      return false
    }

    try {
      setLoading(true)
      console.log('Attempting anonymous sign-in...')
      
      const { data, error } = await supabase.auth.signInAnonymously()
      
      if (error) {
        console.error('Anonymous sign-in failed:', error)
        setError(error.message)
        setLoading(false)
        return false
      }

      console.log('Anonymous sign-in successful')
      // Profile will be created via onAuthStateChange
      return true
    } catch (err) {
      console.error('Anonymous sign-in error:', err)
      setError(err.message)
      setLoading(false)
      return false
    }
  }

  // Simple OTP authentication using Supabase's built-in system
  const authenticateWithCode = async (email, action, code = null) => {
    if (!supabase) {
      setError('Supabase not configured')
      return false
    }

    try {
      if (action === 'verify') {
        setLoading(true)
      }
      setError(null)

      if (action === 'send') {
        // Use Supabase's built-in OTP system
        console.log('Sending OTP via Supabase to:', email)
        
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true, // Allow new user creation
            emailRedirectTo: undefined // No redirect needed for PWA
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
        // Verify the OTP code using Supabase's verification
        console.log('Verifying OTP code:', code)
        
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'email'
        })

        if (error) {
          console.error('OTP verification failed:', error)
          setError('Invalid or expired code. Please try again.')
          setLoading(false)
          return false
        }

        console.log('OTP verified successfully, user authenticated')
        setLoading(false)
        return true
      }

    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message)
      if (action === 'verify') {
        setLoading(false)
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

// GPS-only location hook
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
      }, 20000) // Longer timeout for GPS

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId)
          
          // CRITICAL: Validate all coordinate data
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const acc = position.coords.accuracy

          // Strict validation - reject invalid GPS data
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
          enableHighAccuracy: true,  // Force GPS, not network location
          timeout: 15000,            // 15 second timeout
          maximumAge: 60000          // Cache for 1 minute max
        }
      )
    })
  }, [])

  return { location, error, loading, getCurrentLocation }
}

// Optimized portal management hook with instant real-time updates
export const usePortals = (user) => {
  const [portals, setPortals] = useState([])
  const [userPortal, setUserPortal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  // Track connection health
  useEffect(() => {
    if (!supabase) return

    const channel = supabase.channel('connection_status')
    
    channel
      .on('system', {}, (payload) => {
        if (payload.extension === 'postgres_changes') {
          setConnectionStatus('connected')
        }
      })
      .subscribe((status) => {
        setConnectionStatus(status)
        console.log('Real-time connection status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
        } else {
          setPortals(data || [])
          const myPortal = data?.find(p => p.user_id === user.id)
          setUserPortal(myPortal || null)
        }
      } catch (err) {
        console.error('Portal loading failed:', err)
      }
      setLoading(false)
    }

    loadPortals()

    // OPTIMIZED Real-time subscription with specific event handling
    const channel = supabase
      .channel('portals_realtime')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'portals',
          filter: 'is_active=eq.true' // Only active portals
        },
        async (payload) => {
          console.log('Portal created:', payload.new)
          
          // Fetch complete portal data with profile
          const { data, error } = await supabase
            .from('portals')
            .select(`
              *,
              profiles:user_id (username, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data && !error) {
            // Add to portals list
            setPortals(prev => {
              // Avoid duplicates
              if (prev.find(p => p.id === data.id)) return prev
              return [data, ...prev]
            })

            // Update user portal if it's theirs
            if (data.user_id === user.id) {
              setUserPortal(data)
            }
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
          
          // Remove from portals list
          setPortals(prev => prev.filter(p => p.id !== payload.old.id))
          
          // Clear user portal if it was theirs
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
          
          // Fetch complete updated data
          const { data, error } = await supabase
            .from('portals')
            .select(`
              *,
              profiles:user_id (username, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data && !error) {
            // Update in portals list
            setPortals(prev => prev.map(p => 
              p.id === data.id ? data : p
            ))

            // Update user portal if it's theirs
            if (data.user_id === user.id) {
              setUserPortal(data)
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Portal subscription status:', status)
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('error')
          // Retry connection after 5 seconds
          setTimeout(loadPortals, 5000)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Optimistic portal creation
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

    // Optimistic update - show portal immediately
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
      _optimistic: true // Flag for styling
    }

    setUserPortal(optimisticPortal)
    setPortals(prev => [optimisticPortal, ...prev])

    try {
      // Ensure profile exists first
      await ensureUserProfile(user)

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

      if (error) {
        // Remove optimistic update on error
        setUserPortal(null)
        setPortals(prev => prev.filter(p => p.id !== optimisticPortal.id))
        return { error: error.message || 'Failed to create portal' }
      }

      // Replace optimistic update with real data
      const realPortal = { ...data, profiles: optimisticPortal.profiles }
      setUserPortal(realPortal)
      setPortals(prev => prev.map(p => 
        p.id === optimisticPortal.id ? realPortal : p
      ))

      return { data, error: null }
    } catch (err) {
      // Remove optimistic update on error
      setUserPortal(null)
      setPortals(prev => prev.filter(p => p.id !== optimisticPortal.id))
      return { error: err.message || 'Portal creation failed' }
    }
  }

  // Optimistic portal deletion
  const closePortal = async () => {
    if (!userPortal || !user || !supabase) {
      return { error: 'No portal to close' }
    }

    const portalToDelete = userPortal

    // Optimistic update - hide portal immediately
    setUserPortal(null)
    setPortals(prev => prev.filter(p => p.id !== portalToDelete.id))

    try {
      const { error } = await supabase
        .from('portals')
        .delete()
        .eq('id', portalToDelete.id)

      if (error) {
        // Restore portal on error
        setUserPortal(portalToDelete)
        setPortals(prev => [portalToDelete, ...prev])
        return { error: error.message }
      }

      return { error: null }
    } catch (err) {
      // Restore portal on error
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
    closePortal
  }
}

export { supabase }