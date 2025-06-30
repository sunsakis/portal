import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const EventDetailsModal = ({ isOpen, onClose, event, user, onJoin, onLeave, onCancel }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('details')

  if (!isOpen || !event) return null

  const userPubkey = user?.wakuIdent?.publicKey
  const isMyEvent = event.creatorPubkey === userPubkey
  const isAttending = event.attendees.includes(userPubkey)
  
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

  const startTime = formatDateTime(event.startDateTime)
  const endTime = formatDateTime(event.endDateTime)
  const now = new Date()
  const eventStart = new Date(event.startDateTime)
  const eventEnd = new Date(event.endDateTime)
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
          className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{category.icon}</div>
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
          <div className="flex border-b border-gray-700">
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
              Attendees ({event.attendees.length})
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            {activeTab === 'details' && (
              <div className="space-y-4">
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
                {event.maxAttendees && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Capacity</h4>
                    <div className="flex items-center gap-2 text-gray-100">
                      <span>👥</span>
                      <span>{event.attendees.length} / {event.maxAttendees} people</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(event.attendees.length / event.maxAttendees) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Created */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Created</h4>
                  <div className="text-gray-100 text-sm">
                    {new Date(event.createdAt).toLocaleDateString('en-US', {
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
              <div className="space-y-3">
                {event.attendees.map((attendeePubkey, index) => (
                  <div key={attendeePubkey} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {attendeePubkey === event.creatorPubkey ? '👑' : index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-100 font-medium">
                        {attendeePubkey === userPubkey 
                          ? 'You' 
                          : attendeePubkey === event.creatorPubkey 
                            ? 'Event Creator' 
                            : `Attendee ${index + 1}`}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {attendeePubkey.slice(0, 8)}...{attendeePubkey.slice(-8)}
                      </div>
                    </div>
                    {attendeePubkey === event.creatorPubkey && (
                      <span className="text-yellow-400 text-sm">Creator</span>
                    )}
                  </div>
                ))}

                {event.attendees.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No attendees yet
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 pb-2">
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-6 border-t border-gray-700">
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
                    disabled={isLoading || (event.maxAttendees && event.attendees.length >= event.maxAttendees)}
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
                        {event.maxAttendees && (
                          <span className="text-xs opacity-75">
                            ({event.attendees.length}/{event.maxAttendees})
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default EventDetailsModal