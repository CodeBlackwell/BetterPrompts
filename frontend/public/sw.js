// Service Worker for BetterPrompts
const CACHE_NAME = 'betterprompts-v1';
const API_CACHE_NAME = 'betterprompts-api-v1';

// URLs to cache for offline support
const urlsToCache = [
  '/',
  '/login',
  '/register',
  '/dashboard',
  '/manifest.json',
  // Add static assets as needed
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(request).then((fetchResponse) => {
        // Don't cache non-successful responses
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }

        // Clone the response
        const responseToCache = fetchResponse.clone();

        // Cache the fetched response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return fetchResponse;
      });
    }).catch(() => {
      // Return offline page if available
      return caches.match('/offline.html');
    })
  );
});

// Handle API requests with stale-while-revalidate strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // If we have a cached response, return it immediately
  if (cachedResponse) {
    // Fetch fresh data in the background
    fetch(request).then((freshResponse) => {
      if (freshResponse && freshResponse.status === 200) {
        cache.put(request, freshResponse.clone());
      }
    }).catch(() => {
      // Silently fail background update
    });

    return cachedResponse;
  }

  // No cache, try network
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      // Only cache specific endpoints
      const url = new URL(request.url);
      const cacheableEndpoints = ['/techniques', '/history', '/profile'];
      
      if (cacheableEndpoints.some(endpoint => url.pathname.includes(endpoint))) {
        const responseToCache = networkResponse.clone();
        cache.put(request, responseToCache);
      }
    }

    return networkResponse;
  } catch (error) {
    // Network failed, return offline response
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(API_CACHE_NAME).then(() => {
      console.log('API cache cleared');
    });
  }
});