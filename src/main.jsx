import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { createWakuNode } from './waku/node';

// Initialize Waku node for P2P communication
console.log('🚀 Initializing Portal with Waku P2P networking...');

// Start Waku node initialization (async - app continues loading)
createWakuNode().catch(error => {
  console.error('⚠️ Waku initialization failed, falling back to local mode:', error);
  // App will continue to work in local mode even if Waku fails
});

// Render the React app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);