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
    duration: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sliderTouched, setSliderTouched] = useState(false)

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
        duration: ''
      }))
      setSliderTouched(false)
    }
  }, [isOpen])

  const validateAndCreateEvent = async () => {
    setError(null)

    if (!eventData.title.trim()) {
      setError('Please enter a title for your event')
      setTimeout(() => setError(null), 5000)
      return
    }

    if (!eventData.emoji) {
      setError('Please select an emoji for your event - click the emoji button to choose one')
      setTimeout(() => setError(null), 5000)
      return
    }

    if (!eventData.startDate || !eventData.startTime) {
      setError('Please select a start date and time for your event')
      setTimeout(() => setError(null), 5000)
      return
    }

    if (!eventData.duration) {
      setError('Please select a duration for your event')
      setTimeout(() => setError(null), 5000)
      return
    }

    const startDateTime = new Date(`${eventData.startDate}T${eventData.startTime}`)
    const endDateTime = new Date(startDateTime.getTime() + (eventData.duration * 60 * 60 * 1000))

    if (startDateTime < new Date()) {
      setError('Event cannot be scheduled in the past - please choose a future date and time')
      setTimeout(() => setError(null), 5000)
      return
    }

    if (eventData.duration > 6) {
      setError('Event duration cannot exceed 6 hours')
      setTimeout(() => setError(null), 5000)
      return
    }

    if (!eventData.description.trim()) {
      setError('Please enter the description for your event')
      setTimeout(() => setError(null), 5000)
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
        duration: ''
      })
      setSliderTouched(false)
      
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create event')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      validateAndCreateEvent()
    }
  }

  // NEW: Handle slider interactions properly
  const handleSliderChange = (e) => {
    setSliderTouched(true)
    setEventData(prev => ({ ...prev, duration: parseFloat(e.target.value) }))
  }

  // NEW: Prevent modal close when interacting with slider
  const handleSliderMouseDown = (e) => {
    e.stopPropagation()
  }

  const handleSliderTouchStart = (e) => {
    e.stopPropagation()
  }

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
          className="bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] border border-gray-700 shadow-2xl flex flex-col"
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

          {/* FIXED: Separate scrollable content from slider */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-2">
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
                  placeholder="Tell people about your event..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={eventData.startDate}
                      onChange={(e) => setEventData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:bg-gray-600 transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                      📅
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Time
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={eventData.startTime}
                      onChange={(e) => setEventData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:bg-gray-600 transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                      🕐
                    </div>
                  </div>
                </div>
              </div>

              {/* End time display */}
              {eventData.startDate && eventData.startTime && eventData.duration && (
                <div className="text-sm text-gray-400 bg-gray-700/50 p-3 rounded-lg">
                  <span className="font-medium">Event ends at:</span> {
                    (() => {
                      const start = new Date(`${eventData.startDate}T${eventData.startTime}`)
                      const end = new Date(start.getTime() + (eventData.duration * 60 * 60 * 1000))
                      return end.toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    })()
                  }
                </div>
              )}

              {/* Duration info */}
              <div className="text-xs text-gray-400 bg-gray-700/50 p-2 rounded-lg">
                <span className="font-medium">Maximum duration is</span> 6 hours to keep the fun concentrado
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-900/50 border border-red-700 rounded-lg"
                >
                  <p className="text-red-300 text-sm">{error}</p>
                </motion.div>
              )}
            </div>

            {/* FIXED: Slider outside scrollable area */}
            <div className="flex-shrink-0 mt-4 pt-4 border-t border-gray-700">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Event Duration: {eventData.duration || 1} hour{(eventData.duration || 1) === 1 ? '' : 's'}
              </label>
              <div 
                className="relative"
                onMouseDown={handleSliderMouseDown}
                onTouchStart={handleSliderTouchStart}
              >
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="0.5"
                  value={eventData.duration || 1}
                  onChange={handleSliderChange}
                  onMouseDown={handleSliderMouseDown}
                  onTouchStart={handleSliderTouchStart}
                  className="w-full h-3 bg-gray-600 rounded-lg appearance-none cursor-pointer touch-manipulation
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br 
                            [&::-webkit-slider-thumb]:from-blue-500 [&::-webkit-slider-thumb]:to-purple-600 
                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 
                            [&::-webkit-slider-thumb]:border-gray-800 [&::-webkit-slider-thumb]:shadow-lg 
                            [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                            [&::-webkit-slider-thumb]:active:scale-125
                            [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full 
                            [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-blue-500 
                            [&::-moz-range-thumb]:to-purple-600 [&::-moz-range-thumb]:cursor-pointer 
                            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-800 
                            [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-none
                            [&::-moz-range-track]:bg-gray-600 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:h-3"
                  style={{
                    background: sliderTouched 
                      ? `linear-gradient(to right, 
                          #3b82f6 0%, 
                          #3b82f6 ${((eventData.duration || 1) - 1) / 5 * 100}%, 
                          #4b5563 ${((eventData.duration || 1) - 1) / 5 * 100}%, 
                          #4b5563 100%)`
                      : '#4b5563',
                    touchAction: 'manipulation' // KEY FIX: Enable proper touch handling
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                  <span>1h</span>
                  <span>2h</span>
                  <span>3h</span>
                  <span>4h</span>
                  <span>5h</span>
                  <span>6h</span>
                </div>
                
                {/* Fun emoji indicators */}
                <div className="flex justify-between absolute -top-8 w-full text-lg pointer-events-none px-1">
                  <span className={`transition-all duration-200 ${(eventData.duration || 1) >= 6 ? 'opacity-100 scale-110' : 'opacity-50'}`}>⚡</span>
                  <span className={`transition-all duration-200 opacity-50`}>☕</span>
                  <span className={`transition-all duration-200 opacity-50`}>🍕</span>
                  <span className={`transition-all duration-200 opacity-50`}>🎬</span>
                  <span className={`transition-all duration-200 opacity-50`}>🎉</span>
                  <span className={`transition-all duration-200 ${(eventData.duration || 1) >= 6 ? 'opacity-100 scale-110' : 'opacity-50'}`}>⚡</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-medium transition-colors border border-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={validateAndCreateEvent}
                disabled={isLoading}
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