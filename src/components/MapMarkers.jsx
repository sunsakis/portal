import L from 'leaflet';
import React, { useState, useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';

// Enhanced portal icon with message activity indicator
export const createPortalIcon = (isUserPortal = false, zoom = 13, hasRecentActivity = false) => {
  const emoji = '🟢';
  const pulseColor = hasRecentActivity 
    ? 'rgba(59, 130, 246, 0.6)' // Blue pulse for activity
    : 'rgba(34, 197, 94, 0.4)'; // Green pulse for normal

  const markerSize = getMarkerSizeForZoom(zoom);
  const pulseSize = getPulseSizeForZoom(zoom);
  const fontSize = getFontSizeForZoom(zoom);
  const scale = markerSize / 30;

  // Enhanced animation for message activity
  const animationName = hasRecentActivity 
    ? `message-pulse-${Math.round(zoom * 10)}`
    : `smooth-pulse-${Math.round(zoom * 10)}`;
  
  const animationDuration = hasRecentActivity ? '0.8s' : '2s';

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: scale(${scale});
        transform-origin: center center;
        transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      ">
        <!-- Activity pulse ring -->
        <div style="
          position: absolute;
          width: ${pulseSize / scale}px;
          height: ${pulseSize / scale}px;
          background: ${pulseColor};
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: ${animationName} ${animationDuration} ease-in-out infinite;
        "></div>
        
        <!-- Message burst effect (only when active) -->
        ${hasRecentActivity ? `
        <div style="
          position: absolute;
          width: ${(pulseSize * 1.5) / scale}px;
          height: ${(pulseSize * 1.5) / scale}px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: message-burst-${Math.round(zoom * 10)} 1s ease-out;
        "></div>
        ` : ''}
        
        <!-- Portal emoji -->
        <div style="
          font-size: ${fontSize / scale}px;
          position: relative;
          z-index: 2;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          line-height: 1;
          ${hasRecentActivity ? 'transform: scale(1.1);' : ''}
        ">${emoji}</div>
      </div>
      
      <style>
        @keyframes ${animationName} {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: ${hasRecentActivity ? '1' : '0.8'};
          }
          50% {
            transform: translate(-50%, -50%) scale(${hasRecentActivity ? '1.4' : '1.2'});
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(${hasRecentActivity ? '2' : '1.6'});
            opacity: 0;
          }
        }
        
        ${hasRecentActivity ? `
        @keyframes message-burst-${Math.round(zoom * 10)} {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
        ` : ''}
      </style>
    `,
    className: `smooth-portal-marker ${hasRecentActivity ? 'active' : ''}`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Activity tracking hook
const usePortalActivity = (portalId, messages) => {
  const [hasRecentActivity, setHasRecentActivity] = useState(false)
  const lastMessageTime = useRef(0)

  useEffect(() => {
    if (!portalId || !messages) return

    const portalMessages = messages.filter(msg => msg.portal_id === portalId)
    if (portalMessages.length === 0) return

    const latestMessage = portalMessages[portalMessages.length - 1]
    const messageTime = new Date(latestMessage.created_at).getTime()

    // Check if this is a new message (within last 5 seconds)
    const now = Date.now()
    const isRecent = now - messageTime < 5000

    if (messageTime > lastMessageTime.current && isRecent) {
      setHasRecentActivity(true)
      
      // Clear activity after 3 seconds
      setTimeout(() => {
        setHasRecentActivity(false)
      }, 3000)
    }

    lastMessageTime.current = Math.max(lastMessageTime.current, messageTime)
  }, [portalId, messages])

  return hasRecentActivity
}

// Smooth scaling functions (unchanged)
const getMarkerSizeForZoom = (zoom) => {
  const baseZoom = 13;
  const baseSize = 30;
  const scaleFactor = 1.15;
  const size = baseSize * Math.pow(scaleFactor, zoom - baseZoom);
  return Math.max(20, Math.min(50, size));
};

const getPulseSizeForZoom = (zoom) => {
  const baseZoom = 13;
  const baseSize = 50;
  const scaleFactor = 1.2;
  const size = baseSize * Math.pow(scaleFactor, zoom - baseZoom);
  return Math.max(35, Math.min(80, size));
};

const getFontSizeForZoom = (zoom) => {
  const markerSize = getMarkerSizeForZoom(zoom);
  return Math.max(14, Math.min(22, markerSize * 0.6));
};

// Enhanced zoom hook
const useMapZoom = () => {
  const map = useMap();
  const [zoom, setZoom] = React.useState(map.getZoom());

  React.useEffect(() => {
    let animationFrame = null;

    const updateZoom = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      animationFrame = requestAnimationFrame(() => {
        const currentZoom = map.getZoom();
        setZoom(currentZoom);
      });
    };

    map.on('zoom', updateZoom);
    map.on('zoomend', updateZoom);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      map.off('zoom', updateZoom);
      map.off('zoomend', updateZoom);
    };
  }, [map]);

  return zoom;
};

// Enhanced User Portal Marker with activity
export const UserPortalMarker = ({ portal, onPortalClick, messages = [] }) => {
  const zoom = useMapZoom();
  const hasRecentActivity = usePortalActivity(portal?.id, messages);
  const [currentIcon, setCurrentIcon] = React.useState(null);

  React.useEffect(() => {
    if (!portal) return;
    const newIcon = createPortalIcon(true, zoom, hasRecentActivity);
    setCurrentIcon(newIcon);
  }, [zoom, hasRecentActivity, portal]);

  if (!portal || !currentIcon) return null;

  const handleClick = (e) => {
    e.originalEvent?.preventDefault();
    e.originalEvent?.stopPropagation();
    onPortalClick(portal);
  };

  return (
    <Marker
      position={[portal.latitude, portal.longitude]}
      icon={currentIcon}
      eventHandlers={{
        click: handleClick,
      }}
    />
  );
};

// Enhanced Other Portals with activity
export const OtherPortalsMarkers = ({ portals, userId, onPortalClick, allMessages = [] }) => {
  const zoom = useMapZoom();

  return (
    <>
      {portals.map((portal) => {
        if (portal.user_id === userId) return null;

        const handleClick = (e) => {
          e.originalEvent?.preventDefault();
          e.originalEvent?.stopPropagation();
          onPortalClick(portal);
        };

        return (
          <EnhancedPortalMarkerItem
            key={portal.id}
            portal={portal}
            zoom={zoom}
            onClick={handleClick}
            messages={allMessages}
          />
        );
      })}
    </>
  );
};

// Enhanced individual portal marker with activity
const EnhancedPortalMarkerItem = React.memo(({ portal, zoom, onClick, messages }) => {
  const hasRecentActivity = usePortalActivity(portal.id, messages);
  const [currentIcon, setCurrentIcon] = React.useState(null);

  React.useEffect(() => {
    const newIcon = createPortalIcon(false, zoom, hasRecentActivity);
    setCurrentIcon(newIcon);
  }, [zoom, hasRecentActivity]);

  if (!currentIcon) return null;

  return (
    <Marker
      position={[portal.latitude, portal.longitude]}
      icon={currentIcon}
      eventHandlers={{
        click: onClick,
      }}
    />
  );
});

// User location icon (unchanged)
export const createUserLocationIcon = (zoom = 13) => {
  const baseSize = 20;
  const scale = getMarkerSizeForZoom(zoom) / 30;
  const pulseSize = getPulseSizeForZoom(zoom);

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${baseSize}px;
        height: ${baseSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: scale(${scale});
        transform-origin: center center;
        transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      ">
        <div style="
          position: absolute;
          width: ${pulseSize / scale}px;
          height: ${pulseSize / scale}px;
          background: rgba(34, 197, 94, 0.3);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: smooth-user-pulse-${Math.round(zoom * 10)} 2s ease-in-out infinite;
        "></div>
        
        <div style="
          width: ${baseSize}px;
          height: ${baseSize}px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
          transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        "></div>
      </div>
      
      <style>
        @keyframes smooth-user-pulse-${Math.round(zoom * 10)} {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
      </style>
    `,
    className: 'smooth-user-marker',
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize / 2, baseSize / 2],
  });
};