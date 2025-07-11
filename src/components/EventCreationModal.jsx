import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

// Custom calendar picker that slides up from bottom like iOS
const MobileCalendarPicker = ({ isOpen, onClose, value, onChange }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(value || '')

  useEffect(() => {
    if (value) {
      setSelectedDate(value)
      setCurrentDate(new Date(value))
    }
  }, [value])

  const handleConfirm = () => {
    onChange(selectedDate)
    onClose()
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      const isToday = dateStr === new Date().toISOString().split('T')[0]
      const isSelected = dateStr === selectedDate
      const isPast = new Date(dateStr) < new Date().setHours(0, 0, 0, 0)
      
      days.push({
        day,
        dateStr,
        isToday,
        isSelected,
        isPast
      })
    }
    
    return days
  }

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const monthYear = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = getDaysInMonth(currentDate)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-end justify-center z-[2100]"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 400 }}
          animate={{ y: 0 }}
          exit={{ y: 400 }}
          className="bg-gray-800 rounded-t-2xl w-full max-w-md border-t border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <button onClick={onClose} className="text-blue-400 font-medium">Cancel</button>
            <h3 className="text-lg font-medium text-white">Select Date</h3>
            <button onClick={handleConfirm} className="text-blue-400 font-medium">Done</button>
          </div>

          {/* Month Navigation */}
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="text-white text-lg">‹</span>
            </button>
            <h4 className="text-white font-medium text-lg">{monthYear}</h4>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="text-white text-lg">›</span>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-gray-400 text-sm font-medium py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <div key={index} className="aspect-square">
                  {day ? (
                    <button
                      onClick={() => setSelectedDate(day.dateStr)}
                      disabled={day.isPast}
                      className={`w-full h-full rounded-lg text-sm font-medium transition-all ${
                        day.isSelected
                          ? 'bg-blue-600 text-white'
                          : day.isToday
                          ? 'bg-gray-700 text-blue-400 border border-blue-400'
                          : day.isPast
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-white hover:bg-gray-700'
                      }`}
                    >
                      {day.day}
                    </button>
                  ) : (
                    <div className="w-full h-full"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Date Buttons */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: 'Next Week', days: 7 }
              ].map(({ label, days }) => {
                const date = new Date()
                date.setDate(date.getDate() + days)
                const dateStr = date.toISOString().split('T')[0]
                
                return (
                  <button
                    key={label}
                    onClick={() => setSelectedDate(dateStr)}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-lg text-sm transition-colors"
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Mobile-friendly time picker with 24-hour format
const MobileTimePicker = ({ isOpen, onClose, value, onChange }) => {
  const [selectedHour, setSelectedHour] = useState('12')
  const [selectedMinute, setSelectedMinute] = useState('00')

  useEffect(() => {
    if (value) {
      const [hour, minute] = value.split(':')
      setSelectedHour(hour)
      setSelectedMinute(minute)
    }
  }, [value])

  const handleConfirm = () => {
    const timeString = `${selectedHour.padStart(2, '0')}:${selectedMinute}`
    onChange(timeString)
    onClose()
  }

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).filter((_, i) => i % 15 === 0)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-end justify-center z-[2100]"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 300 }}
          animate={{ y: 0 }}
          exit={{ y: 300 }}
          className="bg-gray-800 rounded-t-2xl w-full max-w-md border-t border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <button onClick={onClose} className="text-blue-400 font-medium">Cancel</button>
            <h3 className="text-lg font-medium text-white">Select Time</h3>
            <button onClick={handleConfirm} className="text-blue-400 font-medium">Done</button>
          </div>

          {/* Time Picker Wheels */}
          <div className="flex justify-center items-center py-6">
            <div className="flex items-center space-x-4">
              {/* Hour Wheel (24-hour format) */}
              <div className="flex flex-col items-center">
                <select
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(e.target.value)}
                  className="bg-gray-700 text-white text-xl font-medium rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {hours.map(hour => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
              </div>

              <span className="text-white text-xl font-bold">:</span>

              {/* Minute Wheel */}
              <div className="flex flex-col items-center">
                <select
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(e.target.value)}
                  className="bg-gray-700 text-white text-xl font-medium rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {minutes.map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

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
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
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

  // Handle slider interactions
  const handleSliderChange = (e) => {
    setSliderTouched(true)
    setEventData(prev => ({ ...prev, duration: parseFloat(e.target.value) }))
  }

  // Prevent modal close when interacting with slider
  const handleSliderMouseDown = (e) => {
    e.stopPropagation()
  }

  const handleSliderTouchStart = (e) => {
    e.stopPropagation()
  }

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDisplayTime = (timeString) => {
    if (!timeString) return 'Select time'
    return timeString // Simply return the 24-hour format as-is (e.g., "09:30", "15:45")
  }

  if (!isOpen) return null

  return (
    <>
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

            {/* Separate scrollable content from slider */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Scrollable content */}
              <div className="flex-1 space-y-4 pr-2">
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
                      Start Day
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(true)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left hover:bg-gray-600 transition-colors flex items-center justify-between"
                    >
                      <span className={eventData.startDate ? 'text-gray-100' : 'text-gray-400'}>
                        {formatDisplayDate(eventData.startDate)}
                      </span>
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start Time
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowTimePicker(true)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left hover:bg-gray-600 transition-colors flex items-center justify-between"
                    >
                      <span className={eventData.startTime ? 'text-gray-100' : 'text-gray-400'}>
                        {formatDisplayTime(eventData.startTime)}
                      </span>
                    </button>
                  </div>
                </div>

              {/* Slider outside scrollable area */}
              <div className="flex-shrink-0 mt-4 pt-4 border-t border-gray-700">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Event Duration: {eventData.duration || 1} hour{(eventData.duration || 1) === 1 ? '' : 's'}
                </label>
                <div 
                  className="relative px-1"
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
                      touchAction: 'manipulation',
                      padding: '0 3px'
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
                  
                  <div className="absolute -top-8 right-1 text-lg pointer-events-none">
                    <span className={`transition-all duration-200 ${(eventData.duration || 1) >= 6 ? 'opacity-100 scale-110' : 'opacity-50'}`}>⚡</span>
                  </div>
                </div>
              </div>
            </div>
           <div className="mt-2">
            {/* Show error if exists, otherwise show end time */}
            {error ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-900/50 border border-red-700 rounded-lg"
              >
                <p className="text-red-300 text-sm">{error}</p>
              </motion.div>
            ) : (
              eventData.startDate && eventData.startTime && eventData.duration && (
                <div className="text-sm text-gray-400 bg-gray-700/50 p-3 rounded-lg">
                  <span className="font-medium">Event ends at: </span> 
                  <span className="text-gray-300">
                  {
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
                  </span>
                </div>
              )
            )}
          </div>
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

      {/* Custom Date Picker */}
      <MobileCalendarPicker
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={eventData.startDate}
        onChange={(date) => setEventData(prev => ({ ...prev, startDate: date }))}
      />

      {/* Mobile-friendly Time Picker */}
      <MobileTimePicker
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        value={eventData.startTime}
        onChange={(time) => setEventData(prev => ({ ...prev, startTime: time }))}
      />
    </>
  )
}

export default EventCreationModal