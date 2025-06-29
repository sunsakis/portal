import React, { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import Map from './components/Map';
import { useLocalAuth } from './hooks/supaHooks';
import './App.css';

function App() {
  const { user, loading, error, authenticateWithCode, isAuthenticated } = useLocalAuth();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);

  useEffect(() => {
    // Register service worker with full PWA functionality
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('PWA update available');
        setUpdateAvailable(true);
      },
      onOfflineReady() {
        console.log('PWA ready to work offline');
      },
      onRegistered(r) {
        console.log('SW Registered: ' + r);
        setSwRegistration(r);
      },
      onRegisterError(error) {
        console.log('SW registration error', error);
      },
    });

    // Force update if available
    if (updateAvailable && updateSW) {
      setTimeout(() => {
        updateSW(true);
      }, 60000);
    }
  }, [updateAvailable]);

  const handleUpdate = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    } else {
      window.location.reload();
    }
  };

  const handleAuth = async (email, action, code) => {
    return await authenticateWithCode(email, action, code);
  };

  // Show loading screen
  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4'>
          </div>
          <p className='text-gray-600'>Loading Portal...</p>
        </div>
      </div>
    );
  }

  // Show main app (user is auto-created anonymously)
  return (
    <div className='App'>
      <Map />

      {/* <InstallPrompt /> */}

      {updateAvailable && (
        <div className='fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'>
          <div className='flex items-center justify-between'>
            <span className='text-sm'>New version available!</span>
            <button
              onClick={handleUpdate}
              className='text-xs bg-white text-blue-500 px-2 py-1 rounded ml-3'
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
