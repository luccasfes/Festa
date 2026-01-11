const CACHE_NAME = 'flowlink-cache-v2'; // 👈 troque a versão sempre que mudar algo grande

const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/create.html',
  '/admin.html',
  '/style.css',
  '/assets/favicon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// INSTALA
self.addEventListener('install', (event) => {
  self.skipWaiting(); // força atualizar
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// ATIVA
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // apaga cache antigo
          }
        })
      )
    )
  );
});

// FETCH
self.addEventListener('fetch', (event) => {

  // 👉 Para HTML: sempre tenta a rede primeiro
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 👉 Para os outros arquivos: cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
