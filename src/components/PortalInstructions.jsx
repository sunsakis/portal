import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function PortalInstructions({ userPortal }) {
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    // Show instructions on first visit if no portal exists
    const hasSeenInstructions = localStorage.getItem('portalInstructionsSeen')
    
    if (!hasSeenInstructions && !userPortal) {
      const timer = setTimeout(() => {
        setShowInstructions(true)
      }, 2000) // Show after 2 seconds

      return () => clearTimeout(timer)
    }
  }, [userPortal])

  const handleDismiss = () => {
    setShowInstructions(false)
    localStorage.setItem('portalInstructionsSeen', 'true')
  }

  return (
    <AnimatePresence>
      {showInstructions && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[3000]"
            onClick={handleDismiss}
          />
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 bg-white rounded-xl shadow-2xl p-6 z-[3001]"
            style={{ 
              maxWidth: '350px',
              margin: '0 auto',
              marginBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)'
            }}
          >
            <div className="text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                How to use Portal
              </h3>
              
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🌀</span>
                  <span>Use the button below to open your portal</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-lg">📍</span>
                  <span>Tap any portal on the map to join chat</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-lg">🗺️</span>
                  <span>Navigate like any map app - zoom, pan, explore</span>
                </div>
              </div>
              
              <button
                onClick={handleDismiss}
                className="mt-4 w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}