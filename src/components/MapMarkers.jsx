import React from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// User location marker
export const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div class="user-location-wrapper">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
    className: 'user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

// Portal marker icon
export const createPortalIcon = () => {
  return L.divIcon({
    html: `
      <div class="portal-wrapper">
        <div class="portal-pulse"></div>
        <div class="portal-icon">🧌</div>
      </div>
    `,
    className: 'portal-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })
}

// User Portal Marker Component
export const UserPortalMarker = ({ portal, onPortalClick }) => {
  if (!portal) return null

  return (
    <Marker 
      position={[portal.latitude, portal.longitude]}
      icon={createPortalIcon()}
      eventHandlers={{
        click: () => onPortalClick(portal)
      }}
    >
      <Popup>
        <div className="p-2">
          <strong className="block text-sm text-green-600 mb-1">Your Chat Portal</strong>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Accuracy: ±{Math.round(portal.accuracy || 0)}m</div>
            <div>Active since: {new Date(portal.created_at).toLocaleTimeString()}</div>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

// Other Portals Markers Component
export const OtherPortalsMarkers = ({ portals, userId, onPortalClick }) => {
  return (
    <>
      {portals.map((portal) => 
        portal.user_id !== userId && (
          <Marker
            key={portal.id}
            position={[portal.latitude, portal.longitude]}
            icon={createPortalIcon()}
            eventHandlers={{
              click: () => onPortalClick(portal)
            }}
          >
            <Popup>
              <div className="p-2">
                <strong className="block text-sm mb-1">{portal.title}</strong>
                <span className="text-xs text-gray-600">{portal.description}</span>
              </div>
            </Popup>
          </Marker>
        )
      )}
    </>
  )
}