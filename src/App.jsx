import React, { useEffect } from 'react'
import Map from './components/Map'
import { registerSW } from 'virtual:pwa-register'
import './App.css'

function App() {
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (confirm('New content available. Reload?')) {
          updateSW(true)
        }
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
    })
  }, [])

  return (
    <div className="App">
      <Map />
    </div>
  )
}

export default App
