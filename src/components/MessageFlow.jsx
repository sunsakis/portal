import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMap } from 'react-leaflet'

// Message flow animation component
const MessageFlow = ({ messages = [], portals = [] }) => {
  const map = useMap()
  const [flowingMessages, setFlowingMessages] = useState([])
  const lastMessageCount = useRef({}) // Track message counts per portal

  useEffect(() => {
    if (!messages || !map) return

    // Group messages by portal
    const messagesByPortal = messages.reduce((acc, msg) => {
      if (!acc[msg.portal_id]) acc[msg.portal_id] = []
      acc[msg.portal_id].push(msg)
      return acc
    }, {})

    // Check for new messages in each portal
    Object.keys(messagesByPortal).forEach(portalId => {
      const portalMessages = messagesByPortal[portalId]
      const currentCount = portalMessages.length
      const lastCount = lastMessageCount.current[portalId] || 0

      // If there are new messages, animate them
      if (currentCount > lastCount) {
        const newMessages = portalMessages.slice(lastCount)
        
        newMessages.forEach((msg, index) => {
          const portal = portals.find(p => p.id === portalId)
          if (!portal) return

          // Convert lat/lng to screen coordinates
          const point = map.latLngToContainerPoint([portal.latitude, portal.longitude])
          
          // Create flowing message
          const flowingMessage = {
            id: `${msg.id}_${Date.now()}_${index}`,
            content: msg.content,
            x: point.x,
            y: point.y,
            timestamp: Date.now() + (index * 200) // Stagger multiple messages
          }

          setFlowingMessages(prev => [...prev, flowingMessage])

          // Remove after animation completes
          setTimeout(() => {
            setFlowingMessages(prev => prev.filter(fm => fm.id !== flowingMessage.id))
          }, 3000)
        })
      }

      lastMessageCount.current[portalId] = currentCount
    })
  }, [messages, portals, map])

  // Update positions when map moves
  useEffect(() => {
    if (!map) return

    const updatePositions = () => {
      setFlowingMessages(prev => prev.map(msg => {
        const portal = portals.find(p => p.id === msg.portalId)
        if (!portal) return msg

        const point = map.latLngToContainerPoint([portal.latitude, portal.longitude])
        return { ...msg, x: point.x, y: point.y }
      }))
    }

    map.on('move', updatePositions)
    map.on('zoom', updatePositions)

    return () => {
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

// Individual flowing message component
const FlowingMessage = ({ message }) => {
  // Generate random flow direction
  const randomAngle = Math.random() * 360
  const flowDistance = 80 + Math.random() * 40 // 80-120px
  
  const endX = message.x + Math.cos(randomAngle * Math.PI / 180) * flowDistance
  const endY = message.y + Math.sin(randomAngle * Math.PI / 180) * flowDistance

  return (
    <motion.div
      initial={{
        x: message.x,
        y: message.y,
        opacity: 0,
        scale: 0.8,
      }}
      animate={{
        x: endX,
        y: endY,
        opacity: [0, 1, 1, 0],
        scale: [0.8, 1, 1.1, 0.9],
      }}
      exit={{
        opacity: 0,
        scale: 0.5,
      }}
      transition={{
        duration: 2.5,
        ease: [0.25, 0.8, 0.25, 1],
        opacity: {
          times: [0, 0.2, 0.8, 1],
        },
      }}
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{
        left: 0,
        top: 0,
      }}
    >
      <div className="bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-2 rounded-full shadow-lg border max-w-xs">
        <div className="text-xs font-medium truncate">
          {message.content.length > 30 
            ? `${message.content.substring(0, 30)}...` 
            : message.content
          }
        </div>
      </div>
    </motion.div>
  )
}

export default MessageFlow