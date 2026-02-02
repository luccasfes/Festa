const CACHE_NAME = 'flowlink-cache-v3'; // Mudei para v3 para forçar atualização

const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/create.html',
  '/admin.html',
  '/style.css',
  '/assets/favicon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/js/utils.js', 
  '/js/player.js',
  '/js/theme.js'
];

// INSTALA
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// ATIVA (Limpa caches antigos)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// FETCH
self.addEventListener('fetch', (event) => {
  
  // 1. REGRA DE OURO: Ignorar chamadas de API (Resolve o erro "Failed to fetch")
  if (event.request.url.includes('/api/')) {
    return; // Deixa a internet cuidar disso, não o cache
  }

  // 2. Para HTML (Navegação): Tenta Rede -> Falha -> Cache
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

  // 3. Para arquivos estáticos: Cache First -> Rede
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});