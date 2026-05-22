import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AlertProvider } from './context/AlertContext';
import { RewardProvider } from './context/RewardContext';
import { SocketProvider } from './context/SocketContext';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker with manual refreshing to prevent automatic, unexpected reloads
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log('[PWA] Update is available. It will load on the next startup to avoid interrupting the current game session.');
    },
    onOfflineReady() {
      console.log('[PWA] App is ready to work offline.');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SocketProvider>
      <AlertProvider>
        <RewardProvider>
          <App />
        </RewardProvider>
      </AlertProvider>
    </SocketProvider>
  </StrictMode>,
);
