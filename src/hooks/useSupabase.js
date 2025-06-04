import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

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

  // Ensure user profile exists
  const ensureUserProfile = async (user) => {
    if (!user || !supabase) return

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
          updated_at: new Date().toISOString()
        })

      if (error && error.code !== '23505') {
        console.error('Profile upsert error:', error)
      }
    } catch (err) {
      console.error('Profile creation error:', err)
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

// Production-ready portal management hook
export const usePortals = (user) => {
  const [portals, setPortals] = useState([])
  const [userPortal, setUserPortal] = useState(null)
  const [loading, setLoading] = useState(false)

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

    // Real-time subscription
    const channel = supabase
      .channel('portals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'portals' },
        () => loadPortals()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const createPortal = async (location) => {
    if (!user || !supabase) {
      return { error: 'Not authenticated' }
    }

    // Validate location data before database insertion
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
      console.log('Creating portal with validated coordinates:', {
        lat: location.latitude,
        lng: location.longitude,
        acc: location.accuracy
      })

      const { data, error } = await supabase
        .from('portals')
        .insert({
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || 100,
          title: 'Chat Portal',
          description: 'Available for chat',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Portal creation database error:', error)
        return { error: error.message || 'Failed to create portal' }
      }

      if (data) {
        console.log('Portal created successfully in database:', data)
        setUserPortal(data)
      }

      return { data, error: null }
    } catch (err) {
      console.error('Portal creation exception:', err)
      return { error: err.message || 'Portal creation failed' }
    }
  }

  const closePortal = async () => {
    if (!userPortal || !user || !supabase) {
      return { error: 'No portal to close' }
    }

    try {
      const { error } = await supabase
        .from('portals')
        .update({ is_active: false })
        .eq('id', userPortal.id)

      if (error) {
        console.error('Portal close error:', error)
        return { error: error.message }
      }

      setUserPortal(null)
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
    createPortal,
    closePortal
  }
}

export { supabase }