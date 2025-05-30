import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Supabase Auth Hook with fallback
export const useSupabaseAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInAnonymously = async () => {
    try {
      // Try anonymous sign-in first
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return data
    } catch (error) {
      console.log('Anonymous auth disabled, using temporary email auth...')
      
      // Fallback: Create a temporary email account
      const tempEmail = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@temp.local`
      const tempPassword = Math.random().toString(36).substr(2, 12)
      
      try {
        const { data, error } = await supabase.auth.signUp({
          email: tempEmail,
          password: tempPassword,
        })
        
        if (error) throw error
        return data
      } catch (signUpError) {
        console.error('Both auth methods failed:', signUpError)
        return null
      }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signInAnonymously, signOut }
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
          reject(error)
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

// Portal management hook
export const usePortals = (user) => {
  const [portals, setPortals] = useState([])
  const [userPortal, setUserPortal] = useState(null)
  const [loading, setLoading] = useState(false)

  // Load portals and set up real-time subscription
  useEffect(() => {
    if (!user) return

    const loadPortals = async () => {
      setLoading(true)
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
        // Find user's portal
        const myPortal = data?.find(p => p.user_id === user.id)
        setUserPortal(myPortal || null)
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
        () => {
          loadPortals() // Reload all portals when any change occurs
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const createPortal = async (location) => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('portals')
      .insert({
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        title: 'Chat Portal',
        description: 'Available for chat',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .select()
      .single()

    if (!error) {
      setUserPortal(data)
    }

    return { data, error }
  }

  const closePortal = async () => {
    if (!userPortal || !user) return { error: 'No portal to close' }

    const { error } = await supabase
      .from('portals')
      .update({ is_active: false })
      .eq('id', userPortal.id)

    if (!error) {
      setUserPortal(null)
    }

    return { error }
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