import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useP2PMessages, useFriendRequests } from '../hooks/hooks'
import {
  frenRequests,
  getPetName,
  idStore,
  waku_acceptFriendRequest,
  waku_SendFrenMessage,
} from '../waku/node'

const MessageBubble = ({ msg, user, onUserClick }) => {
  const isOwnMessage = msg.isMyMessage;

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDisplayName = (msg) => {
    if (isOwnMessage) return 'You';
    if (msg.fren && msg.fren.nik) {
      return msg.fren.nik;
    }
    return getPetName(msg.portalPubkey);
  };

  const getAvatarText = (displayName) => {
    return displayName.charAt(0).toUpperCase();
  };

  const handleUserClick = () => {
    if (!isOwnMessage) {
      const displayName = getDisplayName(msg);
      onUserClick({
        user_id: msg.portalPubkey,
        username: displayName,
        messageCount: 1,
        joinedAt: msg.timestamp,
        portalId: msg.portalId,
        isFriend: !!msg.fren,
        portalPubkey: msg.portalPubkey,
      });
    }
  };

  const displayName = getDisplayName(msg);
  const isFriend = !!msg.fren;

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
        <div className='flex items-center gap-2 mb-1'>
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              isFriend
                ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                : 'bg-gradient-to-br from-green-500 to-emerald-600'
            }`}
          >
            <span className='text-xs font-bold text-white'>
              {getAvatarText(displayName)}
            </span>
          </div>
          <div className='flex items-center gap-1'>
            <div className='text-xs text-gray-300 font-medium'>
              {displayName}
            </div>
            {isFriend && <span className='text-xs text-blue-400' title='Friend'>👥</span>}
          </div>
        </div>

        <div className='text-sm leading-relaxed'>{msg.message}</div>

        <div
          className={`text-xs mt-1 flex items-center gap-1 ${
            isOwnMessage ? 'text-green-200 justify-end' : 'text-gray-400'
          }`}
        >
          <span>{formatTime(msg.timestamp)}</span>
          {!isOwnMessage && <div className='w-1 h-1 bg-gray-500 rounded-full'></div>}
        </div>
      </motion.div>
    </div>
  );
};

const UserProfileModal = ({ isOpen, onClose, messageUser, currentUser, event }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !messageUser) return null;

  const handleSendFriendRequest = async () => {
    if (!event?.portalId || !messageUser.username) {
      setError('Missing event or username information');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Sending friend request via Waku...', {
        username: messageUser.username,
        portalId: event.portalId,
        targetPubkey: messageUser.portalPubkey,
      });

      const portalIdent = idStore.getPortalIdent(event.portalId);
      const friendRequest = await idStore.lesBeFrens(
        messageUser.username,
        messageUser.portalPubkey,
        event.portalId,
      );

      await waku_SendFrenMessage(friendRequest, event.portalId);

      console.log('Friend request sent successfully via Waku');
      setRequestSent(true);

      setTimeout(() => {
        onClose();
        setRequestSent(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to send friend request:', error);
      setError('Failed to send friend request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Use crypto identity
  const isOwnProfile = messageUser.portalPubkey === idStore.getPortalIdent(event?.portalId).publicKey;
  const isFriend = messageUser.isFriend;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2200]'
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className='bg-gray-800 rounded-2xl p-6 m-4 max-w-sm w-full border border-gray-700 shadow-2xl'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='text-center mb-6'>
            <div
              className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${
                isFriend
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                  : 'bg-gradient-to-br from-green-500 to-emerald-600'
              }`}
            >
              <span className='text-2xl font-bold text-white'>
                {(messageUser.username || 'Anonymous').charAt(0).toUpperCase()}
              </span>
            </div>

            <h2 className='text-xl font-semibold text-gray-100 mb-1 flex items-center justify-center gap-2'>
              {messageUser.username || 'Anonymous User'}
              {isFriend && (
                <span className='text-blue-400 text-lg' title='Friend'>👥</span>
              )}
            </h2>

            <div className='inline-flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full'>
              <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
              <span className='text-xs text-gray-300'>
                {isFriend ? 'Friend in event' : 'Active in event'}
              </span>
            </div>
          </div>

          {error && (
            <div className='mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg'>
              <p className='text-red-300 text-sm text-center'>{error}</p>
            </div>
          )}

          <div className='space-y-3'>
            {!isOwnProfile && !isFriend && (
              <>
                {!requestSent ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSendFriendRequest}
                    disabled={isLoading}
                    className='w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                  >
                    {isLoading ? (
                      <>
                        <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
                        <span>Sending via Waku...</span>
                      </>
                    ) : (
                      <>
                        <span className='text-lg'>👋</span>
                        <span>Send Friend Request</span>
                      </>
                    )}
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className='w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2'
                  >
                    <span className='text-lg'>✓</span>
                    <span>Request Sent!</span>
                  </motion.div>
                )}
              </>
            )}

            {isFriend && (
              <div className='w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2'>
                <span className='text-lg'>👥</span>
                <span>Already Friends</span>
              </div>
            )}

            <button
              onClick={onClose}
              className='w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 px-4 rounded-xl font-medium transition-colors duration-200 border border-gray-600'
            >
              {isOwnProfile ? 'Close Profile' : 'Close'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const EventDetailsModal = ({ isOpen, onClose, event, user, onJoin, onLeave, onCancel }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('details')
  
  // Chat functionality
  const [message, setMessage] = useState('')
  const [chatError, setChatError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // IMPORTANT: Always call hooks with consistent parameters to maintain hook order
  // Pass null portalId when modal is closed to ensure hook consistency
  const portalId = isOpen ? event?.portalId : null
  const { messages, loading: messagesLoading, sendMessage } = useP2PMessages(portalId, user)

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab, isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, activeTab]);

  // Early return AFTER all hooks have been called
  if (!isOpen || !event) return null

  const userPubkey = user?.wakuIdent?.publicKey
  const isMyEvent = event.creator_user_id === user?.id
  const isAttending = event.attendees && event.attendees.includes(userPubkey)
  
  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString)
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric',
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  const startTime = formatDateTime(event.start_datetime)
  const endTime = formatDateTime(event.end_datetime)
  const now = new Date()
  const eventStart = new Date(event.start_datetime)
  const eventEnd = new Date(event.end_datetime)
  const hasStarted = eventStart <= now
  const hasEnded = eventEnd <= now

  const categoryInfo = {
    social: { icon: '🎉', label: 'Social', color: 'bg-blue-500' },
    sports: { icon: '⚽', label: 'Sports', color: 'bg-green-500' },
    food: { icon: '🍕', label: 'Food & Drink', color: 'bg-orange-500' },
    culture: { icon: '🎭', label: 'Culture', color: 'bg-purple-500' },
    business: { icon: '💼', label: 'Business', color: 'bg-gray-500' },
    education: { icon: '📚', label: 'Education', color: 'bg-indigo-500' },
    other: { icon: '✨', label: 'Other', color: 'bg-pink-500' }
  }

  const category = categoryInfo[event.category] || categoryInfo.other

  const getEventStatus = () => {
    if (hasEnded) {
      return { label: 'Event Ended', icon: '⚫', color: 'text-gray-500' }
    } else if (hasStarted) {
      return { label: 'In Progress', icon: '🟢', color: 'text-green-600' }
    } else {
      return { label: 'Upcoming', icon: '🔵', color: 'text-blue-600' }
    }
  }

  const status = getEventStatus()

  const handleJoin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await onJoin(event.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeave = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await onLeave(event.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this event? This action cannot be undone.')) {
      setIsLoading(true)
      setError(null)
      try {
        await onCancel(event.id)
        onClose()
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
  }

  // Chat functions
  const handleSendMessage = async () => {
    if (!message.trim() || !event?.portalId || !user) return;

    const messageContent = message.trim();
    setMessage('');
    setChatError(null);

    try {
      const success = await sendMessage(messageContent);
      if (!success) {
        setMessage(messageContent);
        setChatError('Failed to send message');
      }
    } catch (err) {
      console.error('Message send error:', err);
      setMessage(messageContent);
      setChatError('Failed to send message');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUserClick = (messageUser) => {
    setSelectedUser(messageUser);
    setShowUserProfile(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2100] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{event.emoji || category.icon}</div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">{event.title}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 ${category.color} text-white text-xs rounded-full font-medium`}>
                      {category.label}
                    </span>
                    {isMyEvent && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs rounded-full font-medium">
                        Your Event
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Status */}
            <div className={`flex items-center gap-2 ${status.color} font-medium`}>
              <span>{status.icon}</span>
              <span>{status.label}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 flex-shrink-0">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('attendees')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'attendees'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Attendees ({(event.attendees || []).length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span>Chat</span>
                {messages.length > 0 && (
                  <span className="bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                    {messages.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'details' && (
              <div className="p-6 space-y-4 overflow-y-auto">
                {/* Description */}
                {event.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Description</h4>
                    <p className="text-gray-100 text-sm leading-relaxed">{event.description}</p>
                  </div>
                )}

                {/* Date and Time */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">When</h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-gray-100">
                      <span>🗓️</span>
                      <span>{startTime.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-100">
                      <span>🕐</span>
                      <span>{startTime.time} - {endTime.time}</span>
                      {startTime.date !== endTime.date && (
                        <span className="text-gray-400 text-xs">
                          (ends {endTime.date})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Location</h4>
                  <div className="flex items-center gap-2 text-gray-100">
                    <span>📍</span>
                    <span>{event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</span>
                  </div>
                </div>

                {/* Capacity */}
                {event.max_attendees && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Capacity</h4>
                    <div className="flex items-center gap-2 text-gray-100">
                      <span>👥</span>
                      <span>{(event.attendees || []).length} / {event.max_attendees} people</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((event.attendees || []).length / event.max_attendees) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Created */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Created</h4>
                  <div className="text-gray-100 text-sm">
                    {new Date(event.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'attendees' && (
              <div className="p-6 space-y-3 overflow-y-auto">
                {(event.attendees || []).map((attendeePubkey, index) => (
                  <div key={attendeePubkey} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {attendeePubkey === event.creator_pubkey ? '👑' : index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-100 font-medium">
                        {attendeePubkey === userPubkey 
                          ? 'You' 
                          : attendeePubkey === event.creator_pubkey 
                            ? 'Event Creator' 
                            : `Attendee ${index + 1}`}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {attendeePubkey.slice(0, 8)}...{attendeePubkey.slice(-8)}
                      </div>
                    </div>
                    {attendeePubkey === event.creator_pubkey && (
                      <span className="text-yellow-400 text-sm">Creator</span>
                    )}
                  </div>
                ))}

                {(event.attendees || []).length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No attendees yet
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                {/* Chat Messages */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {messagesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                      <p className="text-gray-400 mt-2">Loading messages...</p>
                    </div>
                  ) : chatError ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">⚠️</div>
                      <p className="text-red-400 text-sm">{chatError}</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-xl mb-2">💬</div>
                      <p className="text-gray-300">
                        Start a conversation about this event!
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Tap messages to send friend requests
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

                {/* Chat Input */}
                <div className="border-t border-gray-700 p-4 flex-shrink-0">
                  {chatError && (
                    <div className="mb-2 text-center">
                      <p className="text-red-400 text-xs">{chatError}</p>
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
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
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
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && activeTab !== 'chat' && (
            <div className="px-6 pb-2 flex-shrink-0">
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons (only shown when not in chat tab) */}
          {activeTab !== 'chat' && (
            <div className="p-6 border-t border-gray-700 flex-shrink-0">
              {hasEnded ? (
                <div className="text-center text-gray-400 py-2">
                  This event has ended
                </div>
              ) : isMyEvent ? (
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors border border-gray-600"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Cancelling...' : 'Cancel Event'}
                  </button>
                </div>
              ) : isAttending ? (
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors border border-gray-600"
                  >
                    Close
                  </button>
                  {!hasStarted && (
                    <button
                      onClick={handleLeave}
                      disabled={isLoading}
                      className="py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Leaving...' : 'Leave Event'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors border border-gray-600"
                  >
                    Close
                  </button>
                  {!hasStarted && (
                    <button
                      onClick={handleJoin}
                      disabled={isLoading || (event.max_attendees && (event.attendees || []).length >= event.max_attendees)}
                      className="py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Joining...</span>
                        </>
                      ) : (
                        <>
                          <span>Join Event</span>
                          {event.max_attendees && (
                            <span className="text-xs opacity-75">
                              ({(event.attendees || []).length}/{event.max_attendees})
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Profile Modal for Chat */}
          <UserProfileModal
            isOpen={showUserProfile}
            onClose={() => {
              setShowUserProfile(false);
              setSelectedUser(null);
            }}
            messageUser={selectedUser}
            currentUser={user}
            event={event}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default EventDetailsModal