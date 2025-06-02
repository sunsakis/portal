import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// Magic code authentication hook
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

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error('Profile upsert error:', error)
      }
    } catch (err) {
      console.error('Profile creation error:', err)
    }
  }

  // Custom magic code authentication
  const authenticateWithCode = async (email, action, code = null) => {
    if (!supabase) {
      setError('Supabase not configured')
      return false
    }

    try {
      setLoading(true)
      setError(null)

      if (action === 'send') {
        // Generate and send magic code using our custom function
        const { data, error } = await supabase.rpc('generate_and_send_magic_code', {
          user_email: email
        })

        if (error) {
          setError(error.message)
          setLoading(false)
          return false
        }

        console.log('Magic code sent to:', email)
        return true

      } else if (action === 'verify' && code) {
        // First verify the magic code
        const { data: isValid, error: verifyError } = await supabase.rpc('verify_magic_code', {
          user_email: email,
          input_code: code
        })

        if (verifyError || !isValid) {
          setError('Invalid or expired code. Please try again.')
          setLoading(false)
          return false
        }

        // If code is valid, create/sign in the user
        // For simplicity, we'll create a temporary password and sign them up/in
        const tempPassword = Math.random().toString(36).substring(2, 15)

        // Try to sign in first (user might already exist)
        let authResult = await supabase.auth.signInWithPassword({
          email,
          password: tempPassword
        })

        // If sign in fails, try to sign up
        if (authResult.error) {
          authResult = await supabase.auth.signUp({
            email,
            password: tempPassword,
            options: {
              emailRedirectTo: undefined // Disable email confirmation
            }
          })
        }

        // If both fail, create user manually and sign them in
        if (authResult.error) {
          // For anonymous-like behavior, we'll use signInAnonymously and update email
          const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
          
          if (anonError) {
            setError('Authentication failed')
            setLoading(false)
            return false
          }

          // Update the anonymous user with the email
          await supabase.auth.updateUser({ email })
        }

        console.log('Code verified and user authenticated')
        return true
      }

    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message)
      setLoading(false)
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

// Geolocation hook (unchanged)
export const useGeolocation = () => {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return Promise.reject('Geolocation not supported')
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        setError('Location request timed out')
        setLoading(false)
        reject(new Error('Timeout'))
      }, 15000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId)
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          }
          setLocation(newLocation)
          setLoading(false)
          resolve(newLocation)
        },
        (error) => {
          clearTimeout(timeoutId)
          let errorMessage = 'Unable to get location'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable. Check GPS settings.'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Try again.'
              break
          }
          setError(errorMessage)
          setLoading(false)
          reject(new Error(errorMessage))
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000
        }
      )
    })
  }, [])

  return { location, error, loading, getCurrentLocation }
}

// Portal management hook (unchanged)
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

    // Subscribe to portal changes
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

    try {
      const { data, error } = await supabase
        .from('portals')
        .insert({
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          title: 'Chat Portal',
          description: 'Available for chat',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (!error && data) {
        setUserPortal(data)
      }

      return { data, error }
    } catch (err) {
      console.error('Portal creation failed:', err)
      return { error: err.message }
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

      if (!error) {
        setUserPortal(null)
      }

      return { error }
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