import L from 'leaflet';
import React, { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';

// Updated createEventIcon to use custom emoji and event title
export const createEventIcon = (category = 'social', isMyEvent = false, attendeeCount = 1, customEmoji = null, eventTitle = '') => {

  // Use custom emoji if provided, otherwise fall back to category emoji
  const emoji = customEmoji;
  const pulseColor = '#10B981'
  
  // Truncate title if too long for the marker
  const truncatedTitle = eventTitle.length > 10 ? eventTitle.substring(0, 10) + '...' : eventTitle.toUpperCase();

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform-origin: center center;
        transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      ">
        <!-- Pulse animation -->
        <div style="
          position: absolute;
          width: 60px;
          height: 60px;
          background: ${pulseColor}40;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: event-pulse 2s ease-in-out infinite;
        "></div>
        
        <!-- Main marker circle -->
        <div style="
          width: 40px;
          height: 40px;
          background: ${'transparent'};
          border: 3px solid transparent;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
          cursor: pointer;
        ">
          <!-- Event emoji (now uses custom emoji) -->
          <span style="
            font-size: 18px;
            line-height: 1;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
          ">${emoji}</span>
        </div>
        
        <!-- Event title label (shows for all events) -->
        <div style="
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: ${'black'};
          color: white;
          border-radius: 8px;
          padding: 2px 6px;
          font-size: 8px;
          font-weight: bold;
          white-space: nowrap;
          z-index: 3;
          border: 1px solid white;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">${truncatedTitle}</div>
      </div>
      
      <style>
        @keyframes event-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.6);
            opacity: 0;
          }
        }
      </style>
    `,
    className: 'event-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

export const EventMarkers = ({ events, user, onViewDetails }) => {
  return (
    <>
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.latitude, event.longitude]}
          icon={createEventIcon(
            event.category, 
            event.creatorPubkey === user?.wakuIdent?.publicKey,
            event.attendees.length,
            event.emoji, 
            event.title  
          )}
          eventHandlers={{
            click: () => {
              onViewDetails(event);
            }
          }}
        >
        </Marker>
      ))}
    </>
  );
};