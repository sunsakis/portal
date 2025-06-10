import React, { useEffect } from 'react'
import { motion } from 'framer-motion'

const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const config = {
    success: { bg: 'bg-green-500', icon: '✅' },
    error: { bg: 'bg-red-500', icon: '❌' },
    info: { bg: 'bg-blue-500', icon: 'ℹ️' },
    warning: { bg: 'bg-orange-500', icon: '⚠️' }
  }[type]

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 ${config.bg} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm mx-auto`}
      style={{ zIndex: 2000 }}
    >
      <div className="flex items-center gap-2">
        <span>{config.icon}</span>
        <span className="text-sm flex-1">{message}</span>
        <button onClick={onClose} className="ml-auto text-white/80 hover:text-white">
          ×
        </button>
      </div>
    </motion.div>
  )
}

export default Toast