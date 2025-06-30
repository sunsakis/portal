import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

const EventCreationModal = ({ isOpen, onClose, onCreateEvent, location }) => {
  const [eventData, setEventData] = useState({
    title: '',
    emoji: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    category: 'social'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const onEmojiSelect = (emoji) => {
    setEventData(prev => ({ ...prev, emoji: emoji.native }))
    setShowEmojiPicker(false)
  }

  useEffect(() => {
    if (isOpen) {
      const now = new Date()
      const formatDate = (date) => date.toISOString().split('T')[0]
      const formatTime = (date) => date.toTimeString().slice(0, 5)
      
      setEventData(prev => ({
        ...prev,
        startDate: formatDate(now),
        startTime: formatTime(now),
        endDate: formatDate(now),
        endTime: formatTime(new Date(now.getTime() + 2 * 60 * 60 * 1000))
      }))
    }
  }, [isOpen])

  const handleSubmit = async () => {
    setError(null)

    if (!eventData.title.trim()) {
      setError('Event title is required')
      return
    }

    if (!eventData.emoji) {
      setError('Please select an emoji for your event')
      return
    }

    const startDateTime = new Date(`${eventData.startDate}T${eventData.startTime}`)
    const endDateTime = new Date(`${eventData.endDate}T${eventData.endTime}`)

    if (startDateTime >= endDateTime) {
      setError('End time must be after start time')
      return
    }

    if (startDateTime < new Date()) {
      setError('Event cannot be in the past')
      return
    }

    setIsLoading(true)

    try {
      const eventPayload = {
        ...eventData,
        latitude: location.lat,
        longitude: location.lng,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        createdAt: new Date().toISOString()
      }

      await onCreateEvent(eventPayload)
      
      setEventData({
        title: '',
        emoji: '',
        description: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        category: 'social'
      })
      
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create event')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
  }

  const categories = [
    { value: 'social', label: '🎉 Social', color: 'bg-blue-500' },
    { value: 'sports', label: '⚽ Sports', color: 'bg-green-500' },
    { value: 'food', label: '🍕 Food & Drink', color: 'bg-orange-500' },
    { value: 'culture', label: '🎭 Culture', color: 'bg-purple-500' },
    { value: 'business', label: '💼 Business', color: 'bg-gray-500' },
    { value: 'education', label: '📚 Education', color: 'bg-indigo-500' },
    { value: 'other', label: '✨ Other', color: 'bg-pink-500' }
  ]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyPress}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                Create Event
                {eventData.emoji && <span className="text-2xl">{eventData.emoji}</span>}
              </h2>
              <p className="text-sm text-gray-400">
                Location: {location?.lat.toFixed(4)}, {location?.lng.toFixed(4)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event Emoji & Title *
              </label>
              <div className="flex gap-2 relative">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="h-[42px] w-12 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors hover:bg-gray-600 flex items-center justify-center"
                  >
                    {eventData.emoji ? (
                      <span className="text-xl">{eventData.emoji}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">👽</span>
                    )}
                  </button>

                  <AnimatePresence>
                    {showEmojiPicker && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowEmojiPicker(false)}
                        />
                        
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-0 mt-1 z-50"
                        >
                          <Picker
                            data={data}
                            onEmojiSelect={onEmojiSelect}
                            theme="dark"
                            set="native"
                            showPreview={false}
                            showSkinTones={true}
                            emojiSize={24}
                            perLine={8}
                            maxFrequentRows={2}
                            searchPosition="sticky"
                            navPosition="top"
                            previewPosition="none"
                          />
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <input
                  type="text"
                  value={eventData.title}
                  onChange={(e) => setEventData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="What's happening?"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                  autoFocus
                />
              </div>
              {!eventData.emoji && (
                <p className="text-xs text-gray-400 mt-1">Click the emoji button to select an emoji</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={eventData.description}
                onChange={(e) => setEventData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tell people more about your event..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                maxLength={500}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setEventData(prev => ({ ...prev, category: category.value }))}
                    className={`p-2 rounded-lg text-sm font-medium transition-all border ${
                      eventData.category === category.value
                        ? `${category.color} text-white border-transparent`
                        : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={eventData.startDate}
                  onChange={(e) => setEventData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={eventData.startTime}
                  onChange={(e) => setEventData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={eventData.endDate}
                  onChange={(e) => setEventData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={eventData.endTime}
                  onChange={(e) => setEventData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors border border-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !eventData.title.trim() || !eventData.emoji}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">{eventData.emoji || '📅'}</span>
                    <span>Create Event</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default EventCreationModal