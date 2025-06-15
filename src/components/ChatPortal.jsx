import { useDrag } from '@use-gesture/react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import { useLocalMessages } from '../hooks/useLocalHooks';
import {
  frenRequests,
  getPetName, // Import getPetName function
  idStore,
  waku_acceptFriendRequest,
  waku_SendFrenMessage,
} from '../waku/node';

// Enhanced Message Component with pet names and friend recognition
const MessageBubble = ({ msg, user, onUserClick }) => {
  const isOwnMessage = msg.isMyMessage;

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDisplayName = (msg) => {
    console.log(
      msg,
    );
    // If it's my own message
    if (isOwnMessage) return 'You';

    // If sender is a friend, show their username
    if (msg.fren && msg.fren.nik) {
      return msg.fren.nik;
    }

    // Otherwise show pet name based on their portal public key
    return getPetName(msg.portalPubkey);
  };

  const getAvatarText = (displayName) => {
    return displayName.charAt(0).toUpperCase();
  };

  const handleUserClick = () => {
    if (!isOwnMessage) {
      const displayName = getDisplayName(msg);
      onUserClick({
        user_id: msg.portalPubkey, // Use public key as unique ID
        username: displayName,
        messageCount: 1,
        joinedAt: msg.timestamp,
        portalId: msg.portalId,
        isFriend: !!msg.fren, // Flag to indicate if this is a friend
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
                ? 'bg-gradient-to-br from-blue-500 to-purple-600' // Friend avatar
                : 'bg-gradient-to-br from-green-500 to-emerald-600' // Anonymous avatar
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

// Enhanced User Profile Modal with friend status
const UserProfileModal = ({ isOpen, onClose, messageUser, currentUser, portal }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !messageUser) return null;

  const handleSendFriendRequest = async () => {
    if (!portal?.id || !messageUser.username) {
      setError('Missing portal or username information');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Sending friend request via Waku...', {
        username: messageUser.username,
        portalId: portal.id,
        targetPubkey: messageUser.portalPubkey,
      });

      // Get the portal identity for this specific portal
      const portalIdent = idStore.getPortalIdent(portal.id);

      // Create friend request using the target user's public key
      const friendRequest = await idStore.lesBeFrens(
        messageUser.username, // Use the display name
        messageUser.portalPubkey, // Target user's public key
        portal.id,
      );

      // Send the friend request via Waku
      await waku_SendFrenMessage(friendRequest);

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

  const isOwnProfile =
    messageUser.portalPubkey === idStore.getPortalIdent(portal?.id).publicKey;
  const isFriend = messageUser.isFriend;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]'
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
          {/* Profile Header */}
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
                {isFriend ? 'Friend in portal' : 'Active in portal'}
              </span>
            </div>
          </div>

          {/* Profile Stats */}
          <div className='grid grid-cols-2 gap-4 mb-6'>
            <div className='text-center p-3 bg-gray-700/50 rounded-lg border border-gray-600'>
              <div className='text-lg font-bold text-green-400'>
                {messageUser.messageCount || 1}
              </div>
              <div className='text-xs text-gray-400'>Messages</div>
            </div>
            <div className='text-center p-3 bg-gray-700/50 rounded-lg border border-gray-600'>
              <div
                className={`text-lg font-bold ${
                  isFriend ? 'text-blue-400' : 'text-orange-400'
                }`}
              >
                {isFriend ? 'Friend' : 'Anonymous'}
              </div>
              <div className='text-xs text-gray-400'>Status</div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className='mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg'>
              <p className='text-red-300 text-sm text-center'>{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='space-y-3'>
            {!isOwnProfile && !isFriend && (
              <>
                {!requestSent
                  ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSendFriendRequest}
                      disabled={isLoading}
                      className='w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                    >
                      {isLoading
                        ? (
                          <>
                            <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'>
                            </div>
                            <span>Sending via Waku...</span>
                          </>
                        )
                        : (
                          <>
                            <span className='text-lg'>👋</span>
                            <span>Send Friend Request</span>
                          </>
                        )}
                    </motion.button>
                  )
                  : (
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

// Friend Request Notifications Component
const FriendRequestNotifications = ({ user }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [processedRequestIds, setProcessedRequestIds] = useState(new Set());

  useEffect(() => {
    // Load processed requests from localStorage on mount
    const storedProcessed = localStorage.getItem('portal_processed_requests');
    if (storedProcessed) {
      try {
        setProcessedRequestIds(new Set(JSON.parse(storedProcessed)));
      } catch (err) {
        console.error('Error loading processed requests:', err);
      }
    }
  }, []);

  useEffect(() => {
    // Monitor incoming friend requests, filtering out already processed ones
    const checkFriendRequests = () => {
      if (frenRequests.length > 0) {
        const unprocessedRequests = frenRequests.filter(fren => {
          const requestId = `${fren.nik}_${fren.publicKey}_${fren.address}`;
          return !processedRequestIds.has(requestId);
        });

        if (unprocessedRequests.length !== notifications.length) {
          setNotifications(unprocessedRequests);
          setShowNotifications(unprocessedRequests.length > 0);
        }
      } else if (notifications.length > 0) {
        setNotifications([]);
        setShowNotifications(false);
      }
    };

    const interval = setInterval(checkFriendRequests, 1000);
    return () => clearInterval(interval);
  }, [notifications.length, processedRequestIds]);

  const markAsProcessed = (fren) => {
    const requestId = `${fren.nik}_${fren.publicKey}_${fren.address}`;
    const updatedProcessed = new Set([...processedRequestIds, requestId]);
    setProcessedRequestIds(updatedProcessed);
    localStorage.setItem(
      'portal_processed_requests',
      JSON.stringify([...updatedProcessed]),
    );
  };

  const handleAcceptRequest = async (fren, index) => {
    try {
      await waku_acceptFriendRequest(fren);
      console.log('Friend request accepted:', fren.nik);

      // Mark as processed
      markAsProcessed(fren);

      // Remove from notifications
      setNotifications(prev => prev.filter((_, i) => i !== index));

      if (notifications.length <= 1) {
        setShowNotifications(false);
      }
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const handleDeclineRequest = (fren, index) => {
    // Mark as processed so it doesn't reappear
    markAsProcessed(fren);

    // Remove from notifications
    setNotifications(prev => prev.filter((_, i) => i !== index));

    if (notifications.length <= 1) {
      setShowNotifications(false);
    }

    console.log('Friend request declined:', fren.nik);
  };

  if (!showNotifications || notifications.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        className='fixed top-16 left-4 right-4 z-[2100] max-w-sm mx-auto'
      >
        <div className='bg-gray-800 border border-gray-600 rounded-xl shadow-xl overflow-hidden'>
          <div className='p-3 bg-gray-700 border-b border-gray-600'>
            <div className='flex items-center justify-between'>
              <h3 className='text-white font-medium text-sm'>Friend Requests</h3>
              <button
                onClick={() => setShowNotifications(false)}
                className='text-gray-400 hover:text-white'
              >
                ✕
              </button>
            </div>
          </div>

          <div className='max-h-64 overflow-y-auto'>
            {notifications.map((fren, index) => (
              <div
                key={`${fren.nik}_${index}`}
                className='p-4 border-b border-gray-700 last:border-b-0'
              >
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center'>
                    <span className='text-white font-bold text-sm'>
                      {fren.nik.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-white text-sm font-medium truncate'>
                      {fren.nik}
                    </p>
                    <p className='text-gray-400 text-xs'>
                      Wants to be friends
                    </p>
                  </div>
                </div>

                <div className='flex gap-2 mt-3'>
                  <button
                    onClick={() => handleAcceptRequest(fren, index)}
                    className='flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors'
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDeclineRequest(fren, index)}
                    className='flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors'
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Main Chat Portal Component
const ChatPortal = ({ isOpen, onClose, portal, user }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { messages, loading, sendMessage } = useLocalMessages(portal?.id, user);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!message.trim() || !portal?.id || !user) return;

    const messageContent = message.trim();
    setMessage('');
    setError(null);

    try {
      const success = await sendMessage(messageContent);
      if (!success) {
        setMessage(messageContent);
        setError('Failed to send message');
      }
    } catch (err) {
      console.error('Message send error:', err);
      setMessage(messageContent);
      setError('Failed to send message');
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

  const bind = useDrag(
    ({ last, velocity: [, vy], direction: [, dy], movement: [, my] }) => {
      if (last && (my > 100 || (vy > 0.5 && dy > 0))) {
        onClose();
      }
    },
    { from: () => [0, 0], filterTaps: true, bounds: { top: 0 }, rubberband: true },
  );

  if (!portal) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black'
            style={{ zIndex: 1800 }}
            onClick={onClose}
          />

          <motion.div
            {...bind()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className='fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl touch-none flex flex-col'
            role='dialog'
            aria-modal='true'
            style={{
              maxHeight: '70vh',
              zIndex: 1900,
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            }}
          >
            <div className='flex justify-center pt-3 pb-2'>
              <div className='w-10 h-1 bg-gray-600 rounded-full'></div>
            </div>

            <div className='flex items-center justify-between px-4 py-2 border-b border-gray-700'>
              <div className='flex items-center gap-3'>
                <div className='w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center'>
                  <span className='text-lg'>💬</span>
                </div>
                <div>
                  <h3 className='text-gray-100 font-medium'>Portal Chat</h3>
                  <p className='text-xs text-gray-400'>{messages.length} messages</p>
                </div>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
                <span className='text-xs text-gray-400'>p2p</span>
              </div>
            </div>

            <div className='flex-1 overflow-y-auto p-4 space-y-3 min-h-0'>
              {loading
                ? (
                  <div className='text-center py-8'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto'>
                    </div>
                    <p className='text-gray-400 mt-2'>Loading messages...</p>
                  </div>
                )
                : error
                ? (
                  <div className='text-center py-8'>
                    <div className='text-4xl mb-2'>⚠️</div>
                    <p className='text-red-400 text-sm'>{error}</p>
                  </div>
                )
                : messages.length === 0
                ? (
                  <div className='text-center py-8'>
                    <div className='text-xl mb-2'>💬</div>
                    <p className='text-gray-300'>
                      Start a conversation with people at this location!
                    </p>
                    <p className='text-xs text-gray-500 mt-2'>
                      Tap messages to send friend requests
                    </p>
                  </div>
                )
                : (
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

            <div className='flex-shrink-0 p-4 border-t border-gray-700'>
              {error && (
                <div className='mb-2 text-center'>
                  <p className='text-red-400 text-xs'>{error}</p>
                </div>
              )}
              <div className='flex items-end gap-2'>
                <div className='flex-1 relative'>
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder='Type a message...'
                    className='w-full px-4 py-3 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors'
                    rows='1'
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
                  <span className='text-lg'>➤</span>
                </button>
              </div>
            </div>
          </motion.div>

          <UserProfileModal
            isOpen={showUserProfile}
            onClose={() => {
              setShowUserProfile(false);
              setSelectedUser(null);
            }}
            messageUser={selectedUser}
            currentUser={user}
            portal={portal}
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatPortal;
