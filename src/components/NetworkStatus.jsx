import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showOfflineMessage, setShowOfflineMessage] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOfflineMessage(false)
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      setShowOfflineMessage(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (showOfflineMessage) {
      const timer = setTimeout(() => setShowOfflineMessage(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showOfflineMessage])

  return (
    <AnimatePresence>
      {showOfflineMessage && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
        >
          <div className="flex items-center gap-2">
            <span>📡</span>
            <span className="text-sm">You're offline. Using cached content.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}