import React from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Create perfectly centered portal icon
export const createPortalIcon = (isUserPortal = false) => {
  const emoji = isUserPortal ? '🟢' : '🌀'
  const color = isUserPortal ? '#10b981' : '#3b82f6'
  const pulseColor = isUserPortal ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'
  
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulse ring -->
        <div style="
          position: absolute;
          width: 50px;
          height: 50px;
          background: ${pulseColor};
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse-animation 2s infinite;
        "></div>
        
        <!-- Main marker -->
        <div style="
          width: 30px;
          height: 30px;
          background: white;
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
          cursor: pointer;
        ">${emoji}</div>
      </div>
      
      <style>
        @keyframes pulse-animation {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.6);
            opacity: 0;
          }
        }
      </style>
    `,
    className: '',
    iconSize: [30, 30],  // Match the actual marker size
    iconAnchor: [15, 15] // Center it perfectly
  })
}

// Create perfectly centered user location icon
export const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulse ring -->
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          background: rgba(34, 197, 94, 0.3);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: user-pulse-animation 2s infinite;
        "></div>
        
        <!-- Location dot -->
        <div style="
          width: 20px;
          height: 20px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 2;
        "></div>
      </div>
      
      <style>
        @keyframes user-pulse-animation {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
      </style>
    `,
    className: '',
    iconSize: [20, 20],  // Match the actual dot size
    iconAnchor: [10, 10] // Center it perfectly
  })
}

// User Portal Marker Component
export const UserPortalMarker = ({ portal, onPortalClick }) => {
  console.log('UserPortalMarker render:', portal)
  
  if (!portal) return null

  const handleClick = (e) => {
    console.log('User portal marker clicked', e)
    e.originalEvent?.preventDefault()
    e.originalEvent?.stopPropagation()
    onPortalClick(portal)
  }

  return (
    <Marker 
      position={[portal.latitude, portal.longitude]}
      icon={createPortalIcon(true)}
      eventHandlers={{
        click: handleClick
      }}
    >
      <Popup>
        <div className="p-2">
          <strong className="block text-sm text-green-600 mb-1">Your Chat Portal</strong>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Accuracy: ±{Math.round(portal.accuracy || 0)}m</div>
            <div>Active since: {new Date(portal.created_at).toLocaleTimeString()}</div>
            <button 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onPortalClick(portal)
              }}
              className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition-colors"
            >
              Open Chat
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

// Other Portals Markers Component  
export const OtherPortalsMarkers = ({ portals, userId, onPortalClick }) => {
  console.log('OtherPortalsMarkers render:', portals?.length, 'portals')
  
  return (
    <>
      {portals.map((portal) => {
        if (portal.user_id === userId) return null
        
        const handleClick = (e) => {
          console.log('Other portal marker clicked', portal.id, e)
          e.originalEvent?.preventDefault()
          e.originalEvent?.stopPropagation()
          onPortalClick(portal)
        }

        return (
          <Marker
            key={portal.id}
            position={[portal.latitude, portal.longitude]}
            icon={createPortalIcon(false)}
            eventHandlers={{
              click: handleClick
            }}
          >
            <Popup>
              <div className="p-2">
                <strong className="block text-sm mb-1">{portal.title}</strong>
                <span className="text-xs text-gray-600 block mb-2">{portal.description}</span>
                <button 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onPortalClick(portal)
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
                >
                  Join Chat
                </button>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}