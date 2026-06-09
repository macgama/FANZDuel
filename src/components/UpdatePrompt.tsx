import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  React.useEffect(() => {
    try {
      const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
      const lastReload = localStorage.getItem('fanz_last_daily_reload');
      
      if (lastReload !== today) {
        localStorage.setItem('fanz_last_daily_reload', today);
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to perform silent daily refresh check:', e);
    }
  }, []);

  return null;
}

