import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ConnectionStatus({ connectionStatus, onRetry }) {
  const [showStatus, setShowStatus] = useState(false)
  const [lastSeen, setLastSeen] = useState(new Date())

  useEffect(() => {
    if (connectionStatus === 'connected') {
      setLastSeen(new Date())
      setShowStatus(false)
    } else if (connectionStatus === 'error' || connectionStatus === 'closed') {
      setShowStatus(true)
    }
  }, [connectionStatus])

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'bg-green-500',
          icon: '🟢',
          text: 'Connected',
          description: 'Real-time updates active'
        }
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          icon: '🟡',
          text: 'Connecting...',
          description: 'Establishing connection'
        }
      case 'error':
        return {
          color: 'bg-red-500',
          icon: '🔴',
          text: 'Connection Lost',
          description: 'Tap to retry connection'
        }
      case 'closed':
        return {
          color: 'bg-gray-500',
          icon: '⚪',
          text: 'Offline',
          description: 'Using cached data'
        }
      default:
        return {
          color: 'bg-gray-500',
          icon: '⚪',
          text: 'Unknown',
          description: 'Connection status unknown'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <>
      {/* Always visible connection dot */}
      <div className="fixed top-4 left-4 z-[1900]">
        <motion.div
          animate={{ 
            scale: connectionStatus === 'connecting' ? [1, 1.2, 1] : 1,
            opacity: connectionStatus === 'connected' ? 0.7 : 1
          }}
          transition={{ 
            repeat: connectionStatus === 'connecting' ? Infinity : 0,
            duration: 1.5 
          }}
          className={`w-3 h-3 rounded-full ${config.color} shadow-lg`}
          onClick={() => setShowStatus(!showStatus)}
        />
      </div>

      {/* Expandable status panel */}
      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-12 left-4 bg-white rounded-lg shadow-xl border p-3 z-[1900] min-w-[200px]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{config.icon}</span>
              <span className="font-medium text-sm text-gray-900">{config.text}</span>
            </div>
            
            <p className="text-xs text-gray-600 mb-2">{config.description}</p>
            
            {connectionStatus === 'connected' && (
              <p className="text-xs text-green-600">
                Last seen: {lastSeen.toLocaleTimeString()}
              </p>
            )}
            
            {(connectionStatus === 'error' || connectionStatus === 'closed') && (
              <button
                onClick={() => {
                  onRetry?.()
                  setShowStatus(false)
                }}
                className="w-full mt-2 bg-blue-500 text-white text-xs py-1.5 rounded hover:bg-blue-600 transition-colors"
              >
                Retry Connection
              </button>
            )}
            
            <button
              onClick={() => setShowStatus(false)}
              className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection lost banner */}
      <AnimatePresence>
        {connectionStatus === 'error' && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-[1800] max-w-sm"
          >
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span className="text-sm">Connection lost. Retrying...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}