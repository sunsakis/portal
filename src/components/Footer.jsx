// src/components/Footer.jsx - Separated footer component
import React from 'react';

const Footer = ({ events = [], onEventCountClick }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm text-white py-2 px-4 z-[1500]">
      <div className="flex items-center justify-center gap-4 text-sm">
        {/* <a 
          href="https://github.com/sunsakis/portal" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:text-blue-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          GitHub
        </a>
        
        <div className="w-1 h-1 bg-gray-400 rounded-full"></div> */}
        
        <a 
          href="mailto:dev@portal.live"
          className="flex items-center gap-1 hover:text-blue-400 transition-colors font-thin"
        >

        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
            dev@portal.live
        </a>

        {/* Clickable Event count indicator that centers on closest event */}
        {events.length > 0 && (
          <>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <button
              onClick={onEventCountClick}
              className="text-purple-400 hover:text-purple-300 transition-colors cursor-pointer flex items-center gap-1"
              title="Click to find closest event"
            >
              📅 {events.length} events
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Footer;