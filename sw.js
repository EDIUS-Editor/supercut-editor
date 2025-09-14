const CACHE_NAME = 'supercut-editor-cache-v1';
const FILES_TO_CACHE = [
  '/',
  'index.html',
  'app.min.js',
  'styles.min.css',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
];

// Install the service worker and cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
});

// Activate the service worker and take control of clients
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch event: serve files from cache first, then fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // If the file is in the cache, return it.
        if (response) {
          return response;
        }
        // Otherwise, fetch the file from the network.
        return fetch(event.request);
      })
  );
});
