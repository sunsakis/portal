import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

// Render the React app FIRST
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Initialize Waku node AFTER React has rendered
// This prevents blocking the initial render
setTimeout(async () => {
  console.log('🚀 Initializing Portal with Waku P2P networking...');
  
  try {
    const { createWakuNode } = await import('./waku/node');
    await createWakuNode();
    console.log('✅ Waku node initialized successfully');
  } catch (error) {
    console.error('⚠️ Waku initialization failed, falling back to local mode:', error);
    // App will continue to work in local mode even if Waku fails
  }
}, 100); // Small delay to ensure React is fully rendered