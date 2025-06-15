import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMap } from 'react-leaflet'
import { portalMessages } from '../waku/node'

const MessageFlowOverlay = ({ portals = [] }) => {
  const map = useMap()
  const [flowingMessages, setFlowingMessages] = useState([])
  const messageCountRef = useRef({})

  useEffect(() => {
    if (!map || !portals.length) return

    const checkForNewMessages = () => {
      Object.keys(portalMessages).forEach(portalId => {
        const messages = portalMessages[portalId] || []
        const currentCount = messages.length
        const lastCount = messageCountRef.current[portalId] || 0

        if (currentCount > lastCount) {
          const newMessages = messages.slice(lastCount)
          const portal = portals.find(p => p.id === portalId)
          
          if (portal) {
            newMessages.forEach((msg, index) => {
              setTimeout(() => {
                const point = map.latLngToContainerPoint([portal.latitude, portal.longitude])
                
                const flowMessage = {
                  id: `${portalId}_${msg.timestamp}_${index}`,
                  content: msg.message,
                  x: point.x,
                  y: point.y,
                  portal: portal
                }

                setFlowingMessages(prev => [...prev, flowMessage])

                // Remove after animation (increased to match longer duration)
                setTimeout(() => {
                  setFlowingMessages(prev => prev.filter(fm => fm.id !== flowMessage.id))
                }, 5000) // 5 seconds instead of 3
              }, index * 500) // Slower stagger - 500ms between messages
            })
          }
        }

        messageCountRef.current[portalId] = currentCount
      })
    }

    // Check for new messages every second
    const interval = setInterval(checkForNewMessages, 1000)
    
    // Update positions when map moves
    const updatePositions = () => {
      setFlowingMessages(prev => prev.map(msg => {
        if (!msg.portal) return msg
        const point = map.latLngToContainerPoint([msg.portal.latitude, msg.portal.longitude])
        return { ...msg, x: point.x, y: point.y }
      }))
    }

    map.on('move', updatePositions)
    map.on('zoom', updatePositions)

    return () => {
      clearInterval(interval)
      map.off('move', updatePositions)
      map.off('zoom', updatePositions)
    }
  }, [map, portals])

  return (
    <div className="fixed inset-0 pointer-events-none z-[1400]">
      <AnimatePresence>
        {flowingMessages.map((msg) => (
          <FlowingMessage key={msg.id} message={msg} />
        ))}
      </AnimatePresence>
    </div>
  )
}

const FlowingMessage = ({ message }) => {
  // Random flow direction
  const angle = Math.random() * 360
  const distance = 40 + Math.random() * 40 // 40-80px (shorter distance)
  
  const endX = message.x + Math.cos(angle * Math.PI / 180) * distance
  const endY = message.y + Math.sin(angle * Math.PI / 180) * distance

  // Truncate long messages
  const displayText = message.content.length > 25 
    ? `${message.content.substring(0, 25)}...` 
    : message.content

  return (
    <motion.div
      initial={{
        x: message.x,
        y: message.y,
        opacity: 0,
        scale: 1,
      }}
      animate={{
        x: endX,
        y: endY,
        opacity: [0, 0.2, 0.3, 0.6, 0.5, 0.3],
        scale: [0.6, 1, 1.05, 1, 0.8, 0.75],
      }}
      transition={{
        duration: 4.5, // Flowout duration
        ease: [0.1, 0.6, 0.2, 0.95], // Gentler easing curve
        opacity: {
          times: [0, 0.1, 0.8, 0.95, 1], // Slower fade in/out
        },
      }}
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: 0, top: 0 }}
    >
      <div className="bg-white/95 backdrop-blur-sm text-gray-800 px-3 py-2 rounded-full shadow-lg border border-gray-200 max-w-[200px]">
        <div className="text-xs font-medium text-center">
          {displayText}
        </div>
      </div>
    </motion.div>
  )
}

export default MessageFlowOverlay