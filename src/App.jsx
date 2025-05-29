import React, { useEffect, useState } from 'react'
import Map from './components/Map'
import InstallPrompt from './components/InstallPrompt'
import NetworkStatus from './components/NetworkStatus'
import { registerSW } from 'virtual:pwa-register'
import './App.css'

function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [swRegistration, setSwRegistration] = useState(null)

  useEffect(() => {
    // Register service worker
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('PWA update available')
        setUpdateAvailable(true)
      },
      onOfflineReady() {
        console.log('PWA ready to work offline')
      },
      onRegistered(r) {
        console.log('SW Registered: ' + r)
        setSwRegistration(r)
      },
      onRegisterError(error) {
        console.log('SW registration error', error)
      }
    })

    // Force update if available
    if (updateAvailable && updateSW) {
      // Auto-update after 60 seconds if update is available
      setTimeout(() => {
        updateSW(true)
      }, 60000)
    }

    // Debug: Check if we're in a PWA context
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('Running as PWA')
    } else {
      console.log('Running in browser')
    }

    // Debug: Check if beforeinstallprompt is supported
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('beforeinstallprompt event fired')
    })

  }, [updateAvailable])

  const handleUpdate = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="App">
      <NetworkStatus />
      
      {/* Use enhanced Map with vector support */}
      <Map />
      
      <InstallPrompt />
      
      {updateAvailable && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <span className="text-sm">New version available!</span>
            <button
              onClick={handleUpdate}
              className="text-xs bg-white text-blue-500 px-2 py-1 rounded ml-3"
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App