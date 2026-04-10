const CACHE_NAME = 'ar-animaplanos-v9';

// Recursos esenciales pre-cacheados (App Shell)
const INITIAL_CACHED_RESOURCES = [
    './',
    './index.html',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: Pre-cacheando App Shell inicial');
                return cache.addAll(INITIAL_CACHED_RESOURCES);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW: Limpiando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Intercepción Cache-First
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 1. Si está en la caché, se devuelve (Offline mode asegurado)
            if (cachedResponse) {
                return cachedResponse;
            }

            // 2. Si NO está en caché, se descarga de la red
            return fetch(event.request).then(networkResponse => {
                
                // Evitamos guardar respuestas parciales o erróneas en caché
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    return networkResponse;
                }

                // Lista de dominios de CDNs permitidos para cachear (librerías pesadas)
                const cdnDomains = [
                    'cdn.jsdelivr.net',     // jsQR
                    'docs.opencv.org',      // OpenCV.js
                    'cdnjs.cloudflare.com', // qrcodejs
                    'fonts.gstatic.com',    // Inter Font files
                    'aframe.io'             // A-Frame AR Engine
                ];

                const isCdnRequest = cdnDomains.some(domain => event.request.url.includes(domain));
                
                // 3. Cacheado dinámico: Si fue una petición al CDN o un asset local, se clona a la caché
                if (isCdnRequest || event.request.url.startsWith(self.location.origin)) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        console.log('SW: Cacheando recurso dinámicamente ->', event.request.url);
                        cache.put(event.request, responseClone);
                    });
                }

                return networkResponse;
            }).catch(error => {
                console.error('SW: Error de Fetch (Offline Total):', event.request.url, error);
                
                // Opción Fallback (Solo para navegación de páginas HTML)
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
