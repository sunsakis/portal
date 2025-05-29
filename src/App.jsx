import React, { useEffect, useState } from 'react'
import Map from './components/Map'
import InstallPrompt from './components/InstallPrompt'
import NetworkStatus from './components/NetworkStatus'
import { registerSW } from 'virtual:pwa-register'
import './App.css'

function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setUpdateAvailable(true)
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
    })

    // Auto-update after 60 seconds if update is available
    if (updateAvailable) {
      setTimeout(() => {
        updateSW(true)
      }, 60000)
    }
  }, [updateAvailable])

  return (
    <div className="App">
      <NetworkStatus />
      <Map />
      <InstallPrompt />
      
      {updateAvailable && (
        <div className="fixed top-4 left-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <span className="text-sm">New version available!</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs bg-white text-blue-500 px-2 py-1 rounded"
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