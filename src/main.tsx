import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Clean up any legacy caches from previous versions
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((ks) => {
    ks.filter((k) => k.startsWith('carnav-')).forEach((k) => caches.delete(k));
  }).catch(() => {});
}

// Offline support (production builds only). Add ?nosw=1 to the link to run without it (speed test).
const noSw = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('nosw') === '1';
if ('serviceWorker' in navigator) {
  if (noSw) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else if ((import.meta as any).env?.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update().catch(() => {});
      }).catch(() => {});
    });
  }
}

