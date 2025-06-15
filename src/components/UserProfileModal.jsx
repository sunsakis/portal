import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const UserProfileModal = ({ isOpen, onClose, messageUser, currentUser, onSendFriendRequest }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  if (!isOpen || !messageUser) return null

  const handleSendFriendRequest = async () => {
    setIsLoading(true)
    try {
      await onSendFriendRequest(messageUser)
      setRequestSent(true)
      setTimeout(() => {
        onClose()
        setRequestSent(false)
      }, 1500)
    } catch (error) {
      console.error('Failed to send friend request:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isOwnProfile = messageUser.user_id === currentUser?.id

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-gray-800 rounded-2xl p-6 m-4 max-w-sm w-full border border-gray-700 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Profile Header */}
          <div className="text-center mb-6">
            {/* Avatar */}
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">
                {(messageUser.username || 'Anonymous').charAt(0).toUpperCase()}
              </span>
            </div>
            
            {/* Username */}
            <h2 className="text-xl font-semibold text-gray-100 mb-1">
              {messageUser.username || 'Anonymous User'}
            </h2>
            
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-300">Active in portal</span>
            </div>
          </div>

          {/* Profile Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-700/50 rounded-lg border border-gray-600">
              <div className="text-lg font-bold text-green-400">
                {messageUser.messageCount || 1}
              </div>
              <div className="text-xs text-gray-400">Messages</div>
            </div>
            <div className="text-center p-3 bg-gray-700/50 rounded-lg border border-gray-600">
              <div className="text-lg font-bold text-blue-400">
                {messageUser.joinedAt ? 'Active' : 'New'}
              </div>
              <div className="text-xs text-gray-400">Status</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {!isOwnProfile && (
              <>
                {!requestSent ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSendFriendRequest}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">👋</span>
                        <span>Send Friend Request</span>
                      </>
                    )}
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">✓</span>
                    <span>Friend Request Sent!</span>
                  </motion.div>
                )}
                
                <button
                  onClick={onClose}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 px-4 rounded-xl font-medium transition-colors duration-200 border border-gray-600"
                >
                  Close
                </button>
              </>
            )}
            
            {isOwnProfile && (
              <button
                onClick={onClose}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 px-4 rounded-xl font-medium transition-colors duration-200 border border-gray-600"
              >
                Close Profile
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default UserProfileModal