// Define el nombre de la caché y los archivos que se almacenarán.
const CACHE_NAME = 'vitreum-hub-cache-v3'; // Se incrementó la versión para forzar la actualización
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './img/wall.gif',
  './img/wall2.gif',
  './img/inicio2.gif',
  './img/terminos.gif',
  './img/icons/icon-192x192.png', // Ícono añadido para caché
  './img/icons/icon-512x512.png'  // Ícono añadido para caché
];

// Evento 'install': Se dispara cuando el Service Worker se instala.
// Aquí abrimos la caché y agregamos los archivos del app shell.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache abierta.');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Archivos principales cacheados con éxito.');
        return self.skipWaiting(); // Fuerza al SW a activarse inmediatamente.
      })
      .catch(err => {
        console.error('Service Worker: Falló el cacheo de archivos durante la instalación.', err);
      })
  );
});

// Evento 'activate': Se dispara cuando el Service Worker se activa.
// Aquí se limpia cualquier caché antigua que ya no se necesite.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('Service Worker: Reclamando clientes...');
        return self.clients.claim(); // Toma control de las páginas abiertas.
    })
  );
});

// Evento 'fetch': Se dispara cada vez que la aplicación solicita un recurso (p. ej., una imagen, un script).
// Implementa una estrategia "Cache First": primero busca en la caché y, si no lo encuentra, va a la red.
self.addEventListener('fetch', event => {
  // Ignoramos las peticiones que no son GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en la caché, lo devuelve desde ahí.
        if (response) {
          return response;
        }
        
        // Si no, lo busca en la red.
        return fetch(event.request);
      })
  );
});
