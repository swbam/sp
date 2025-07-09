import type { Metadata } from 'next';
import { OfflineContent } from './components/OfflineContent';

export const metadata: Metadata = {
  title: 'Offline - MySetlist',
  description: 'You are currently offline. MySetlist will reconnect automatically when your internet connection is restored.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflinePage() {
  return <OfflineContent />;
}

// Client-side connection monitoring script
export function OfflineConnectionMonitor() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          // Monitor connection status
          function updateConnectionStatus() {
            const status = navigator.onLine ? 'online' : 'offline';
            const statusElement = document.querySelector('[data-connection-status]');
            if (statusElement) {
              statusElement.textContent = status;
              statusElement.className = status === 'online' ? 'text-green-400 font-medium' : 'text-red-400 font-medium';
            }
            
            // Auto-redirect when online
            if (navigator.onLine && window.location.pathname === '/offline') {
              setTimeout(() => {
                window.location.href = document.referrer || '/';
              }, 1000);
            }
          }
          
          // Listen for connection changes
          window.addEventListener('online', updateConnectionStatus);
          window.addEventListener('offline', updateConnectionStatus);
          
          // Initial check
          updateConnectionStatus();
          
          // Periodic connectivity check
          setInterval(() => {
            if (navigator.onLine) {
              fetch('/api/health', { 
                method: 'HEAD',
                cache: 'no-cache'
              })
              .then(() => {
                if (window.location.pathname === '/offline') {
                  window.location.href = document.referrer || '/';
                }
              })
              .catch(() => {
                // Still offline or server unreachable
              });
            }
          }, 5000);
        `
      }}
    />
  );
}
