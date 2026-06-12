import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AlertProvider } from './context/AlertContext';
import { RewardProvider } from './context/RewardContext';
import { SocketProvider } from './context/SocketContext';
import { APP_VERSION } from './version';

const cachedVersion = localStorage.getItem('fanz_app_version');
if (cachedVersion !== APP_VERSION) {
  localStorage.setItem('fanz_app_version', APP_VERSION);
  window.location.reload();
} else {
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
}
