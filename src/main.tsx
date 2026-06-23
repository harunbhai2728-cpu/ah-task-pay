import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import toast from 'react-hot-toast';

// 1. Replace Native Alert with non-blocking UI Toast
const originalAlert = window.alert;
window.alert = (msg: any) => {
  if (!msg) return;
  const strMsg = String(msg);
  if (strMsg.toLowerCase().includes('fail') || strMsg.toLowerCase().includes('error') || strMsg.toLowerCase().includes('incorrect') || strMsg.toLowerCase().includes('ব্যর্থ')) {
    toast.error(strMsg, { duration: 4000 });
  } else if (strMsg.toLowerCase().includes('success') || strMsg.toLowerCase().includes('approved') || strMsg.toLowerCase().includes('সফল')) {
    toast.success(strMsg, { duration: 4000 });
  } else {
    toast(strMsg, { duration: 4000 });
  }
};

// 2. Fetch Wrapper with Auto-Retry for Render's cold starts
const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  configurable: true,
  writable: true,
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    let retries = 3;
    let retryDelay = 2000;
    let attempt = 0;

    while (attempt < retries) {
      try {
        const response = await originalFetch(input, init);
        // If it's a success or a client error (except 429), return immediately
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
          return response;
        }
        throw new Error(`Server returned ${response.status}`);
      } catch (error: any) {
        attempt++;
        const isNetworkError = error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.name === 'TypeError';
        
        if (attempt >= retries) {
          if (isNetworkError) {
            toast.error("Network connection error. Server might be waking up.");
          }
          throw error;
        }

        if (isNetworkError) {
          console.warn(`Fetch attempt ${attempt} failed. Retrying in ${retryDelay}ms... (Render server might be sleeping)`);
          toast.loading("Connection weak, retrying...", { id: 'retry-toast', duration: retryDelay });
        } else {
          // Not a network error (e.g. CORS or something else), do not retry
          throw error;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw new Error("Maximum retries reached");
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
