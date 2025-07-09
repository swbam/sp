// MySetlist Service Worker - PWA Offline Support
// Version 1.0.0

const CACHE_NAME = 'mysetlist-v1';
const OFFLINE_URL = '/offline';

// Assets to cache for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/search',
  '/trending',
  '/offline',
  '/manifest.json',
  
  // Static assets
  '/images/music-placeholder.png',
  '/images/apple-touch-icon.png',
  '/images/favicon-16x16.png',
  '/images/favicon-32x32.png',
  
  // Font files (Figtree)
  'https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700&display=swap',
];

// API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /^\/api\/artists\/.+$/,
  /^\/api\/shows\/.+$/,
  /^\/api\/search\?/,
  /^\/api\/trending$/,
  /^\/api\/featured$/,
];

// Dynamic content to cache with stale-while-revalidate
const DYNAMIC_CACHE_PATTERNS = [
  /^\/artists\/.+$/,
  /^\/shows\/.+$/,
];

// Resources that should always be fetched from network
const NETWORK_ONLY_PATTERNS = [
  /^\/api\/votes$/,
  /^\/api\/realtime\/.+$/,
  /^\/api\/auth\/.+$/,
  /^\/api\/user\/.+$/,
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Caching static resources');
        
        // Cache static resources with error handling
        const cachePromises = STATIC_CACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
            console.log(`[SW] Cached: ${url}`);
          } catch (error) {
            console.warn(`[SW] Failed to cache: ${url}`, error);
          }
        });
        
        await Promise.allSettled(cachePromises);
        
        // Force activation of new service worker
        await self.skipWaiting();
      } catch (error) {
        console.error('[SW] Install failed:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          });
        
        await Promise.all(deletePromises);
        
        // Take control of all pages
        await self.clients.claim();
        
        console.log('[SW] Service worker activated and controlling all pages');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - handle different caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different URL patterns with appropriate strategies
  if (NETWORK_ONLY_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // Network only for real-time and auth endpoints
    event.respondWith(networkOnly(request));
  } else if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // Network first for API endpoints
    event.respondWith(networkFirst(request));
  } else if (DYNAMIC_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // Stale while revalidate for dynamic pages
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.origin === self.location.origin) {
    // Cache first for static assets
    event.respondWith(cacheFirst(request));
  }
});

// Network-only strategy
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.warn('[SW] Network-only fetch failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
    }
    
    // Return error response for other requests
    return new Response('Network error', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] Network-first fetch failed, trying cache:', error);
    
    // Fall back to cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response if no cache
    if (request.mode === 'navigate') {
      return await cache.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
    }
    
    return new Response('Not found', { status: 404 });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Fetch fresh data in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(error => {
    console.warn('[SW] Background fetch failed:', error);
    return null;
  });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    // Trigger background update
    fetchPromise;
    return cachedResponse;
  }
  
  // Wait for network if no cache
  try {
    const response = await fetchPromise;
    if (response) return response;
  } catch (error) {
    console.warn('[SW] Stale-while-revalidate network failed:', error);
  }
  
  // Fall back to offline page for navigation
  if (request.mode === 'navigate') {
    return await cache.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
  }
  
  return new Response('Not found', { status: 404 });
}

// Cache-first strategy
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] Cache-first fetch failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return await cache.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
    }
    
    return new Response('Not found', { status: 404 });
  }
}

// Handle background sync for vote submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'vote-sync') {
    console.log('[SW] Background sync: vote-sync');
    event.waitUntil(syncVotes());
  }
});

// Sync pending votes when online
async function syncVotes() {
  try {
    // Get pending votes from IndexedDB
    const pendingVotes = await getPendingVotes();
    
    for (const vote of pendingVotes) {
      try {
        const response = await fetch('/api/votes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(vote.data),
        });
        
        if (response.ok) {
          await removePendingVote(vote.id);
          console.log('[SW] Synced vote:', vote.id);
        }
      } catch (error) {
        console.warn('[SW] Failed to sync vote:', vote.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Vote sync failed:', error);
  }
}

// IndexedDB helpers for offline vote storage
async function getPendingVotes() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MySetlistDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingVotes'], 'readonly');
      const store = transaction.objectStore('pendingVotes');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pendingVotes')) {
        db.createObjectStore('pendingVotes', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function removePendingVote(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MySetlistDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingVotes'], 'readwrite');
      const store = transaction.objectStore('pendingVotes');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const { title, body, icon, badge, tag, data: notificationData } = data;
    
    const options = {
      body,
      icon: icon || '/images/icon-192x192.png',
      badge: badge || '/images/icon-96x96.png',
      tag: tag || 'mysetlist-notification',
      data: notificationData,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/images/icon-view-24x24.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/images/icon-dismiss-24x24.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const { action, data } = event;
  
  if (action === 'dismiss') {
    return;
  }
  
  // Default action or 'view' action
  const urlToOpen = data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Periodic background sync for cache updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-update') {
    console.log('[SW] Periodic sync: cache-update');
    event.waitUntil(updateCriticalResources());
  }
});

// Update critical resources in background
async function updateCriticalResources() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Update critical API endpoints
    const criticalEndpoints = [
      '/api/featured',
      '/api/trending',
    ];
    
    const updatePromises = criticalEndpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          await cache.put(endpoint, response.clone());
          console.log(`[SW] Updated cache for: ${endpoint}`);
        }
      } catch (error) {
        console.warn(`[SW] Failed to update cache for: ${endpoint}`, error);
      }
    });
    
    await Promise.allSettled(updatePromises);
  } catch (error) {
    console.error('[SW] Cache update failed:', error);
  }
}

console.log('[SW] Service worker script loaded');