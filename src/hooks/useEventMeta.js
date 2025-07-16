import { useEffect } from 'react';

export const useEventMeta = (event) => {
  useEffect(() => {
    if (!event) {
      // Reset to default meta tags
      document.title = 'Local Events';
      updateMetaTag('og:title', 'Create & Discover Events');
      updateMetaTag('og:description', 'Find and host local events, chats.');
      updateMetaTag('og:image', '/og-image.png');
      updateMetaTag('twitter:title', 'Create & Discover Events');
      updateMetaTag('twitter:description', 'Find and host local events, chats.');
      updateMetaTag('twitter:image', '/twitter-image.png');
      return;
    }

    // Update meta tags for specific event
    const eventTitle = `${event.emoji} ${event.title}`;
    const eventDescription = event.description || 'Join this event on Portal!';
    const eventDate = new Date(event.start_datetime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    document.title = `${eventTitle} - Portal`;
    
    updateMetaTag('og:title', eventTitle);
    updateMetaTag('og:description', `${eventDescription} • ${eventDate}`);
    updateMetaTag('og:url', `${window.location.origin}/event/${event.id}`);
    
    // Use event image if available, otherwise default
    const eventImage = event.image_url || event.imageUrl || '/og-image.png';
    updateMetaTag('og:image', eventImage);
    
    updateMetaTag('twitter:title', eventTitle);
    updateMetaTag('twitter:description', `${eventDescription} • ${eventDate}`);
    updateMetaTag('twitter:image', eventImage);
    
    // Add structured data for rich snippets
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title,
      "description": event.description,
      "startDate": event.start_datetime,
      "endDate": event.end_datetime,
      "location": {
        "@type": "Place",
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": event.latitude,
          "longitude": event.longitude
        }
      },
      "organizer": {
        "@type": "Organization",
        "name": "Portal"
      },
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode"
    };

    if (event.image_url || event.imageUrl) {
      structuredData.image = event.image_url || event.imageUrl;
    }

    updateStructuredData(structuredData);
  }, [event]);
};

const updateMetaTag = (property, content) => {
  // Handle both property and name attributes
  let meta = document.querySelector(`meta[property="${property}"]`) || 
             document.querySelector(`meta[name="${property}"]`);
  
  if (meta) {
    meta.setAttribute('content', content);
  } else {
    // Create new meta tag
    meta = document.createElement('meta');
    if (property.startsWith('og:') || property.startsWith('twitter:')) {
      meta.setAttribute('property', property);
    } else {
      meta.setAttribute('name', property);
    }
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  }
};

const updateStructuredData = (data) => {
  // Remove existing structured data
  const existing = document.querySelector('script[type="application/ld+json"]');
  if (existing) {
    existing.remove();
  }

  // Add new structured data
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
};
  
