import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if device is iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)
    
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone === true
    setIsStandalone(standalone)

    // Handle beforeinstallprompt event (Android/Chrome)
    const handler = (e) => {
      console.log('beforeinstallprompt event caught')
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Show prompt only if not already standalone and not iOS
      if (!standalone && !iOS) {
        setShowInstallPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    
    // For iOS, show manual install instructions after some delay
    if (iOS && !standalone) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true)
      }, 3000) // Show after 3 seconds on iOS
      
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt && !isIOS) {
      // Android/Chrome installation
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      console.log('User choice:', outcome)
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt')
      }
      
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    setDeferredPrompt(null)
    
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true')
  }

  // Don't show if already dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('installPromptDismissed')
    if (dismissed && showInstallPrompt) {
      setShowInstallPrompt(false)
    }
  }, [showInstallPrompt])

  // Don't render if already running as PWA
  if (isStandalone) {
    return null
  }

  return (
    <AnimatePresence>
      {showInstallPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg border p-4 z-50"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">📱</div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-1">
                {isIOS ? 'Add to Home Screen' : 'Install Pinhopper'}
              </h3>
              {isIOS ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Install this app on your iPhone:</p>
                  <p>1. Tap the Share button <span className="inline-block">⎋</span></p>
                  <p>2. Select "Add to Home Screen"</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Get quick access by adding Pinhopper to your home screen
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleDismiss}
              className="flex-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
            >
              Not now
            </button>
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
              >
                Install
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}