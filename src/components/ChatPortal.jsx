import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
import { supabase } from '../hooks/useSupabase'

const ChatPortal = ({ isOpen, onClose, portal, user }) => {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

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

  // Load existing messages and set up real-time subscription
  useEffect(() => {
    if (!isOpen || !portal?.id) return

    const loadMessages = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('portal_id', portal.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading messages:', error)
      } else {
        setMessages(data || [])
      }
      setLoading(false)
    }

    loadMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`portal_${portal.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `portal_id=eq.${portal.id}`
        },
        async (payload) => {
          // Fetch the new message with profile data
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              profiles:user_id (username, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages(prev => [...prev, data])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, portal?.id])

  const sendMessage = async () => {
    if (!message.trim() || !portal?.id || !user) return

    const { error } = await supabase
      .from('messages')
      .insert({
        portal_id: portal.id,
        user_id: user.id,
        content: message.trim(),
        message_type: 'text'
      })

    if (error) {
      console.error('Error sending message:', error)
    } else {
      setMessage('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

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

  const bind = useDrag(
    ({ last, velocity: [, vy], direction: [, dy], movement: [, my] }) => {
      if (last && (my > 100 || (vy > 0.5 && dy > 0))) {
        onClose()
      }
    },
    { from: () => [0, 0], filterTaps: true, bounds: { top: 0 }, rubberband: true }
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black"
            style={{ zIndex: 1800 }}
            onClick={onClose}
          />
          <motion.div
            {...bind()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl touch-none flex flex-col"
            style={{ 
              maxHeight: '70vh', 
              zIndex: 1900,
              paddingBottom: 'env(safe-area-inset-bottom, 20px)'
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    🧌 {portal?.title || 'Portal Chat'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {portal?.description || 'Chat with people at this location'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">👋</div>
                  <p className="text-gray-500">
                    Start a conversation with people at this location!
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl ${
                      msg.user_id === user?.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      {msg.user_id !== user?.id && (
                        <div className="text-xs opacity-70 mb-1">
                          {getUsername(msg)}
                        </div>
                      )}
                      <div className="text-sm">{msg.content}</div>
                      <div className={`text-xs mt-1 ${
                        msg.user_id === user?.id ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="1"
                    style={{ minHeight: '44px', maxHeight: '100px' }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className={`p-3 rounded-full font-medium transition-colors ${
                    message.trim()
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  style={{ minWidth: '44px', height: '44px' }}
                >
                  <span className="text-lg">➤</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ChatPortal