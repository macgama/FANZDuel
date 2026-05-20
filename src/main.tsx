import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AlertProvider } from './context/AlertContext';
import { RewardProvider } from './context/RewardContext';
import { SocketProvider } from './context/SocketContext';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
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
