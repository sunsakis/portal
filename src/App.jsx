import React, { useEffect, useState } from 'react'
import Map from './components/Map'
import AuthScreen from './components/AuthScreen'
import { useSupabaseAuth } from './hooks/useSupabase'
import { registerSW } from 'virtual:pwa-register'
import './App.css'

function App() {
  const { user, loading, error, authenticateWithCode, isAuthenticated } = useSupabaseAuth()

  useEffect(() => {
    // Register service worker silently
    registerSW({
      onNeedRefresh() {
        console.log('PWA update available')
      },
      onOfflineReady() {
        console.log('PWA ready to work offline')
      },
      onRegistered(r) {
        console.log('SW Registered: ' + r)
      },
      onRegisterError(error) {
        console.log('SW registration error', error)
      }
    })
  }, [])

  const handleAuth = async (email, action, code) => {
    return await authenticateWithCode(email, action, code)
  }

  // Show loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Portal...</p>
        </div>
      </div>
    )
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return (
      <AuthScreen 
        onAuth={handleAuth}
        loading={loading}
        error={error}
      />
    )
  }

  // Show main app if authenticated
  return (
    <div className="App">
      <Map />
    </div>
  )
}

export default App