import L from 'leaflet';
import React, { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';

// Create event marker icon
export const createEventIcon = (category = 'social', isMyEvent = false, attendeeCount = 1) => {
  const categoryEmojis = {
    social: '🎉',
    sports: '⚽',
    food: '🍕',
    culture: '🎭',
    business: '💼',
    education: '📚',
    other: '✨'
  };

  const categoryColors = {
    social: '#3B82F6',    // blue
    sports: '#10B981',    // green
    food: '#F59E0B',      // orange
    culture: '#8B5CF6',   // purple
    business: '#6B7280',  // gray
    education: '#6366F1', // indigo
    other: '#EC4899'      // pink
  };

  const emoji = categoryEmojis[category] || categoryEmojis.other;
  const color = categoryColors[category] || categoryColors.other;
  const borderColor = isMyEvent ? '#F59E0B' : color; // Orange border for user's events

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
          background: ${color}40;
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
          background: ${color};
          border: 3px solid ${borderColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
          cursor: pointer;
        ">
          <!-- Event emoji -->
          <span style="
            font-size: 18px;
            line-height: 1;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
          ">${emoji}</span>
        </div>
        
        <!-- Attendee count badge -->
        ${attendeeCount > 1 ? `
        <div style="
          position: absolute;
          top: -2px;
          right: -2px;
          background: #EF4444;
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          border: 2px solid white;
          z-index: 3;
        ">${attendeeCount}</div>
        ` : ''}
        
        ${isMyEvent ? `
        <!-- My event indicator -->
        <div style="
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: #F59E0B;
          color: white;
          border-radius: 8px;
          padding: 2px 6px;
          font-size: 8px;
          font-weight: bold;
          white-space: nowrap;
          z-index: 3;
          border: 1px solid white;
        ">MY EVENT</div>
        ` : ''}
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

// Event popup component
const EventPopup = ({ event, onJoin, onLeave, onCancel, onViewDetails, user }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const userPubkey = user?.wakuIdent?.publicKey;
  const isMyEvent = event.creatorPubkey === userPubkey;
  const isAttending = event.attendees.includes(userPubkey);
  
  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const startTime = formatDateTime(event.startDateTime);
  const endTime = formatDateTime(event.endDateTime);
  const now = new Date();
  const eventStart = new Date(event.startDateTime);
  const hasStarted = eventStart <= now;

  const categoryIcons = {
    social: '🎉',
    sports: '⚽',
    food: '🍕',
    culture: '🎭',
    business: '💼',
    education: '📚',
    other: '✨'
  };

  const handleJoin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onJoin(event.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onLeave(event.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this event?')) {
      setIsLoading(true);
      setError(null);
      try {
        await onCancel(event.id);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-w-[280px] max-w-[320px]">
      {/* Event Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 text-2xl">
          {categoryIcons[event.category] || categoryIcons.other}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1">
            {event.title}
          </h3>
          {isMyEvent && (
            <span className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
              Your Event
            </span>
          )}
        </div>
      </div>

      {/* Event Details */}
      <div className="space-y-2 mb-3">
        {/* Date and Time */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>🕐</span>
          <div>
            <div>{startTime.date} at {startTime.time}</div>
            {startTime.date !== endTime.date || startTime.time !== endTime.time ? (
              <div className="text-xs text-gray-500">
                Until {endTime.date === startTime.date ? endTime.time : `${endTime.date} ${endTime.time}`}
              </div>
            ) : null}
          </div>
        </div>

        {/* Attendees */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>👥</span>
          <span>
            {event.attendees.length} attending
            {event.maxAttendees && ` (max ${event.maxAttendees})`}
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {hasStarted ? (
            <span className="text-green-600 font-medium">🟢 In Progress</span>
          ) : (
            <span className="text-blue-600 font-medium">🔵 Upcoming</span>
          )}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="mb-3">
          <p className="text-sm text-gray-700 line-clamp-3">
            {event.description}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isMyEvent ? (
          <>
            <button
              onClick={() => onViewDetails(event)}
              className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              Manage
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? '...' : 'Cancel'}
            </button>
          </>
        ) : isAttending ? (
          <>
            <button
              onClick={() => onViewDetails(event)}
              className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              View Details
            </button>
            {!hasStarted && (
              <button
                onClick={handleLeave}
                disabled={isLoading}
                className="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : 'Leave'}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => onViewDetails(event)}
              className="flex-1 px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
            >
              Details
            </button>
            {!hasStarted && (
              <button
                onClick={handleJoin}
                disabled={isLoading || (event.maxAttendees && event.attendees.length >= event.maxAttendees)}
                className="px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : 'Join'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Main EventMarkers component
export const EventMarkers = ({ events, user, onJoin, onLeave, onCancel, onViewDetails }) => {
  return (
    <>
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.latitude, event.longitude]}
          icon={createEventIcon(
            event.category, 
            event.creatorPubkey === user?.wakuIdent?.publicKey,
            event.attendees.length
          )}
        >
          <Popup
            maxWidth={350}
            className="event-popup"
          >
            <EventPopup
              event={event}
              user={user}
              onJoin={onJoin}
              onLeave={onLeave}
              onCancel={onCancel}
              onViewDetails={onViewDetails}
            />
          </Popup>
        </Marker>
      ))}
    </>
  );
};