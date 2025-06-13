import React from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// User location marker
export const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div class="user-location-wrapper">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot">🟢</div>
      </div>
    `,
    className: 'user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

// Portal marker icon with better click target
export const createPortalIcon = (isUserPortal = false) => {
  const emoji = isUserPortal ? '🟢' : '🌀'
  const color = isUserPortal ? '#10b981' : '#3b82f6'
  
  return L.divIcon({
    html: `
      <div class="portal-wrapper">
        <div class="portal-pulse"></div>
        <div class="portal-icon" style="border-color: ${color}; background: white;">
          <span style="font-size: 16px;">${emoji}</span>
        </div>
      </div>
    `,
    className: 'portal-marker',
    iconSize: [44, 44], // Larger for better mobile touch
    iconAnchor: [22, 22]
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
              className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600"
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
                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
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