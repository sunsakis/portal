import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const AuthScreen = ({ onAuth, loading, error }) => {
  const [step, setStep] = useState('email') // 'email' or 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const codeRefs = useRef([])

  // Countdown timer for resend
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft])

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    
    try {
      const success = await onAuth(email.trim().toLowerCase(), 'send')
      if (success) {
        setStep('code')
        setTimeLeft(60) // 60 second cooldown
      }
    } catch (err) {
      console.error('Send code error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (index, value) => {
    if (value.length > 1) return // Prevent multiple characters
    
    const newCode = [...code]
    newCode[index] = value.toUpperCase()
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every(digit => digit !== '') && value) {
      handleCodeSubmit(newCode.join(''))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  const handleCodeSubmit = async (codeString = null) => {
    const finalCode = codeString || code.join('')
    if (finalCode.length !== 6) return

    setIsLoading(true)
    
    try {
      await onAuth(email, 'verify', finalCode)
    } catch (err) {
      // Reset code on error
      setCode(['', '', '', '', '', ''])
      codeRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (timeLeft > 0) return
    
    setIsLoading(true)
    try {
      await onAuth(email, 'send')
      setTimeLeft(60)
      setCode(['', '', '', '', '', ''])
      codeRefs.current[0]?.focus()
    } catch (err) {
      console.error('Resend error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  if (step === 'code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter your code</h2>
            <p className="text-gray-600 mb-2">
              We sent a 6-digit code to
            </p>
            <p className="font-semibold text-gray-800">{email}</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleCodeSubmit(); }} className="space-y-6">
            <div className="flex justify-center gap-3">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => codeRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9A-Z]"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center space-y-4">
              <button
                type="button"
                onClick={handleResend}
                disabled={timeLeft > 0 || isLoading}
                className={`text-sm font-medium transition-colors ${
                  timeLeft > 0 || isLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-800'
                }`}
              >
                {timeLeft > 0 ? `Resend code in ${timeLeft}s` : 'Resend code'}
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setCode(['', '', '', '', '', ''])
                    setEmail('')
                  }}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  Use different email
                </button>
              </div>
            </div>
          </form>

          {isLoading && (
            <div className="mt-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-sm text-gray-600">Verifying...</span>
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🌀</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Pinhopper</h1>
          <p className="text-gray-600">Share your location and chat with people nearby</p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={!isValidEmail(email) || isLoading}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-colors ${
              isValidEmail(email) && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Sending code...</span>
              </div>
            ) : (
              'Send verification code'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            We'll send you a 6-digit code to verify your email address.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default AuthScreen