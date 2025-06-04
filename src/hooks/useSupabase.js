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

  // Ensure user profile exists - FIXED VERSION
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
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (insertError) {
          console.error('Profile creation failed:', insertError)
        } else {
          console.log('Profile created successfully')
        }
      } else {
        console.log('Profile already exists')
      }
    } catch (err) {
      console.error('Profile creation error:', err)
    }
  }

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
        acc: location.accuracy,
        userId: user.id,
        userEmail: user.email
      })

      // DETAILED PROFILE CHECK AND CREATION
      console.log('=== PROFILE CHECK START ===')
      
      const { data: profileCheck, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('Profile check result:', { 
        data: profileCheck, 
        error: profileError,
        errorCode: profileError?.code,
        errorMessage: profileError?.message 
      })

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Profile missing, creating it now...')
        
        const profileData = {
          id: user.id,
          username: user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        console.log('Attempting to insert profile with data:', profileData)
        
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single()

        console.log('Profile creation result:', { 
          data: newProfile, 
          error: createProfileError,
          errorCode: createProfileError?.code,
          errorMessage: createProfileError?.message,
          errorDetails: createProfileError?.details
        })

        if (createProfileError) {
          console.error('DETAILED PROFILE ERROR:', {
            code: createProfileError.code,
            message: createProfileError.message,
            details: createProfileError.details,
            hint: createProfileError.hint
          })
          return { error: `Profile creation failed: ${createProfileError.message || 'Unknown error'}` }
        }
        
        console.log('Profile created successfully:', newProfile)
      } else if (profileError) {
        console.error('Profile check failed with unexpected error:', profileError)
        return { error: `Profile verification failed: ${profileError.message}` }
      } else {
        console.log('Profile already exists:', profileCheck)
      }

      console.log('=== PROFILE CHECK END ===')

      // Small delay to ensure profile is properly committed
      await new Promise(resolve => setTimeout(resolve, 100))

      // Now create the portal
      console.log('=== PORTAL CREATION START ===')
      
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
      
      console.log('Creating portal with data:', portalData)

      const { data, error } = await supabase
        .from('portals')
        .insert(portalData)
        .select()
        .single()

      console.log('Portal creation result:', { 
        data, 
        error,
        errorCode: error?.code,
        errorMessage: error?.message 
      })

      if (error) {
        console.error('Portal creation database error:', error)
        return { error: error.message || 'Failed to create portal' }
      }

      if (data) {
        console.log('Portal created successfully in database:', data)
        setUserPortal(data)
      }

      console.log('=== PORTAL CREATION END ===')
      return { data, error: null }
    } catch (err) {
      console.error('Portal creation exception:', err)
      return { error: err.message || 'Portal creation failed' }
    }
  }

  const closePortal = async () => {
    console.log('=== CLOSE PORTAL START ===')
    console.log('UserPortal:', userPortal)
    console.log('User:', user?.id)
    console.log('Supabase available:', !!supabase)

    if (!userPortal || !user || !supabase) {
      const error = 'No portal to close'
      console.log('Close portal failed - missing requirements:', { userPortal: !!userPortal, user: !!user, supabase: !!supabase })
      return { error }
    }

    try {
      console.log('Attempting to update portal:', userPortal.id, 'for user:', user.id)
      
      const { data, error } = await supabase
        .from('portals')
        .update({ is_active: false })
        .eq('id', userPortal.id)
        .eq('user_id', user.id) // Extra safety check
        .select()

      console.log('Update result:', { data, error })

      if (error) {
        console.error('Portal close database error:', error)
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        return { error: error.message }
      }

      console.log('Portal close successful, clearing userPortal state')
      setUserPortal(null)
      console.log('=== CLOSE PORTAL END ===')
      return { error: null }
    } catch (err) {
      console.error('Portal close exception:', err)
      console.log('=== CLOSE PORTAL END (ERROR) ===')
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