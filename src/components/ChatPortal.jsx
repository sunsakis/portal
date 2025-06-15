import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
import { useLocalMessages } from '../hooks/useLocalHooks'

// User Profile Modal Component
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

// Enhanced Message Component
const MessageBubble = ({ msg, user, onUserClick }) => {
  const isOwnMessage = msg.user_id === user?.id

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getUsername = (msg) => {
    if (msg.user_id === user?.id) return 'You'
    return msg.profiles?.username || 'Anonymous'
  }

  const handleUserClick = () => {
    if (!isOwnMessage) {
      onUserClick({
        user_id: msg.user_id,
        username: getUsername(msg),
        messageCount: 1, // This could be calculated from all messages
        joinedAt: msg.created_at
      })
    }
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <motion.div
        whileHover={!isOwnMessage ? { scale: 1.02 } : {}}
        whileTap={!isOwnMessage ? { scale: 0.98 } : {}}
        onClick={handleUserClick}
        className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl transition-all duration-200 ${
          isOwnMessage
            ? 'bg-green-600 text-white'
            : 'bg-gray-700 text-gray-100 hover:bg-gray-600 cursor-pointer border border-gray-600 hover:border-gray-500'
        }`}
      >
        {!isOwnMessage && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {getUsername(msg).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-gray-300 font-medium">
              {getUsername(msg)}
            </div>
          </div>
        )}
        
        <div className="text-sm leading-relaxed">{msg.content}</div>
        
        <div className={`text-xs mt-1 flex items-center gap-1 ${
          isOwnMessage ? 'text-green-200 justify-end' : 'text-gray-400'
        }`}>
          <span>{formatTime(msg.created_at)}</span>
          {!isOwnMessage && (
            <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

const ChatPortal = ({ isOpen, onClose, portal, user }) => {
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Use local message management
  const { messages, loading, sendMessage } = useLocalMessages(portal?.id, user)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleSendMessage = async () => {
    if (!message.trim() || !portal?.id || !user) return

    const messageContent = message.trim()
    setMessage('') // Clear input immediately
    setError(null)

    try {
      console.log('Sending local message:', messageContent)
      
      const success = await sendMessage(messageContent)

      if (!success) {
        console.error('Local message send failed')
        setMessage(messageContent) // Restore message on error
        setError('Failed to send message')
      }
    } catch (err) {
      console.error('Message send error:', err)
      setMessage(messageContent) // Restore message on error
      setError('Failed to send message')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleUserClick = (messageUser) => {
    setSelectedUser(messageUser)
    setShowUserProfile(true)
  }

  const handleSendFriendRequest = async (messageUser) => {
    // Simulate friend request API call
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Friend request sent to ${messageUser.username}`)
        resolve(true)
      }, 1000)
    })
  }

  const bind = useDrag(
    ({ last, velocity: [, vy], direction: [, dy], movement: [, my] }) => {
      if (last && (my > 100 || (vy > 0.5 && dy > 0))) {
        onClose()
      }
    },
    { from: () => [0, 0], filterTaps: true, bounds: { top: 0 }, rubberband: true }
  )

  if (!portal) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black"
            style={{ zIndex: 1800 }}
            onClick={onClose}
          />
          
          {/* Dark themed chat modal */}
          <motion.div
            {...bind()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl touch-none flex flex-col"
            role="dialog"
            aria-modal="true"
            style={{ 
              maxHeight: '70vh', 
              zIndex: 1900,
              paddingBottom: 'env(safe-area-inset-bottom, 20px)'
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-600 rounded-full"></div>
            </div>

            {/* Portal Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <span className="text-lg">💬</span>
                </div>
                <div>
                  <h3 className="text-gray-100 font-medium">Portal Chat</h3>
                  <p className="text-xs text-gray-400">{messages.length} messages</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">Live</span>
              </div>
            </div>

            {/* Messages Area - Dark theme */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading messages...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">⚠️</div>
                  <p className="text-red-400 text-sm">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-green-400 text-sm hover:text-green-300 transition-colors"
                  >
                    Refresh and try again
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-xl mb-2">💬</div>
                  <p className="text-gray-300">
                    Start a conversation with people at this location!
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Tap on messages to view user profiles
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    user={user}
                    onUserClick={handleUserClick}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Dark theme */}
            <div className="flex-shrink-0 p-4 border-t border-gray-700">
              {error && (
                <div className="mb-2 text-center">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    rows="1"
                    style={{ minHeight: '44px', maxHeight: '100px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim()}
                  className={`p-3 rounded-full font-medium transition-colors ${
                    message.trim()
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                  style={{ minWidth: '44px', height: '44px' }}
                >
                  <span className="text-lg">➤</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* User Profile Modal */}
          <UserProfileModal
            isOpen={showUserProfile}
            onClose={() => {
              setShowUserProfile(false)
              setSelectedUser(null)
            }}
            messageUser={selectedUser}
            currentUser={user}
            onSendFriendRequest={handleSendFriendRequest}
          />
        </>
      )}
    </AnimatePresence>
  )
}

export default ChatPortal