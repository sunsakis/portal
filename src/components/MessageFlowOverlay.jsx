import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMap } from 'react-leaflet'
import { portalMessages } from '../waku/node'

const MessageFlowOverlay = ({ portals = [] }) => {
  const map = useMap()
  const [flowingMessages, setFlowingMessages] = useState([])
  const messageCountRef = useRef({})
  const hasInitialized = useRef(false)
  const lastUpdateRef = useRef(0)

  // Memoized animation function to avoid recreating on every render
  const animateMessage = useCallback((msg, portalId, portal, isInitial = false, index = 0) => {
    const delay = isInitial ? index * 300 : index * 500;
    
    setTimeout(() => {
      if (!map || !portal) return;
      
      const point = map.latLngToContainerPoint([portal.latitude, portal.longitude])
      
      const flowMessage = {
        id: `${portalId}_${msg.timestamp}_${index}_${isInitial ? 'initial' : 'new'}`,
        content: msg.message,
        x: point.x,
        y: point.y,
        portal: portal
      }

      setFlowingMessages(prev => [...prev, flowMessage])

      // Remove after animation completes
      setTimeout(() => {
        setFlowingMessages(prev => prev.filter(fm => fm.id !== flowMessage.id))
      }, 6000)
    }, delay)
  }, [map])

  // Optimized message checking with debouncing
  const checkForNewMessages = useCallback(() => {
    const now = Date.now();
    
    // Debounce: don't check more than once per 500ms
    if (now - lastUpdateRef.current < 500) {
      return;
    }
    lastUpdateRef.current = now;

    portals.forEach(portal => {
      const portalId = portal.portalId;
      if (!portalId) return;

      const messages = portalMessages[portalId] || [];
      const currentCount = messages.length;
      const lastCount = messageCountRef.current[portalId] || 0;

      // On first load, animate all existing messages
      if (!hasInitialized.current && currentCount > 0) {
        messages.forEach((msg, index) => {
          animateMessage(msg, portalId, portal, true, index);
        });
      }
      // Handle new messages (after initial load)
      else if (hasInitialized.current && currentCount > lastCount) {
        const newMessages = messages.slice(lastCount);
        newMessages.forEach((msg, index) => {
          animateMessage(msg, portalId, portal, false, index);
        });
      }

      messageCountRef.current[portalId] = currentCount;
    });
    
    if (!hasInitialized.current) {
      hasInitialized.current = true;
    }
  }, [portals, animateMessage]);

  // Listen for changes in portalMessages (event-driven approach)
  useEffect(() => {
    checkForNewMessages();
  }, [portalMessages, checkForNewMessages]);

  // Initial load check with delay to ensure Waku messages are loaded
  useEffect(() => {
    if (portals.length > 0) {
      // Immediate check
      checkForNewMessages();
      
      // Also check after a short delay to catch messages that load after portals
      const timeouts = [
        setTimeout(checkForNewMessages, 500),
        setTimeout(checkForNewMessages, 1500),
        setTimeout(checkForNewMessages, 3000)
      ];
      
      return () => timeouts.forEach(clearTimeout);
    }
  }, [portals, checkForNewMessages]);

  // Fallback: periodic check for the first 10 seconds after mount
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!hasInitialized.current && portals.length > 0) {
        checkForNewMessages();
      }
    }, 2000);

    // Stop after 10 seconds
    const stopTimeout = setTimeout(() => {
      clearInterval(intervalId);
    }, 10000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(stopTimeout);
    };
  }, [checkForNewMessages, portals.length]);

  // Update positions when map moves (throttled)
  useEffect(() => {
    if (!map) return;

    let animationFrame;
    const updatePositions = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      
      animationFrame = requestAnimationFrame(() => {
        setFlowingMessages(prev => prev.map(msg => {
          if (!msg.portal) return msg;
          const point = map.latLngToContainerPoint([msg.portal.latitude, msg.portal.longitude]);
          return { ...msg, x: point.x, y: point.y };
        }));
      });
    };

    map.on('move', updatePositions);
    map.on('zoom', updatePositions);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      map.off('move', updatePositions);
      map.off('zoom', updatePositions);
    };
  }, [map]);

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
  const angle = Math.random() * 360
  const distance = 40 + Math.random() * 40
  
  const endX = message.x + Math.cos(angle * Math.PI / 180) * distance
  const endY = message.y + Math.sin(angle * Math.PI / 180) * distance

  const displayText = message.content.length > 25 
    ? `${message.content.substring(0, 25)}...` 
    : message.content

  return (
    <motion.div
      initial={{
        x: message.x,
        y: message.y,
        opacity: 0,
        scale: 0.6,
      }}
      animate={{
        x: endX,
        y: endY,
        opacity: [0, 0.3, 0.7, 0.8, 0.6, 0.3],
        scale: [0.6, 1, 1.05, 1, 0.9, 0.8],
      }}
      exit={{
        opacity: 0,
        scale: 0.5,
        transition: {
          duration: 0.8,
          ease: [0.25, 0.8, 0.5, 1]
        }
      }}
      transition={{
        duration: 4.5,
        ease: [0.1, 0.6, 0.2, 0.95],
        opacity: {
          times: [0, 0.15, 0.4, 0.6, 0.85, 1],
        },
        scale: {
          times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        }
      }}
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: 0, top: 0 }}
    >
      <div className="bg-gray-200/95 backdrop-blur-sm text-black px-3 py-2 rounded-full shadow-lg border border-green-500/50 max-w-[200px]">
        <div className="text-xs font-medium text-center">
          {displayText}
        </div>
      </div>
    </motion.div>
  )
}

export default MessageFlowOverlay