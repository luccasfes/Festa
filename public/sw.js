// ======================================================
// FLOWLINK SERVICE WORKER (PRODUÇÃO)
// Estratégia: NETWORK FIRST (seguro para apps dinâmicos)
// ======================================================

const CACHE_NAME = 'flowlink-cache-v5'; 

const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/create.html',
  '/admin.html',
  '/style.css',
  '/assets/favicon.png',
  '/js/utils.js',
  '/js/player.js',
  '/js/theme.js'
];

// ======================================================
// INSTALL
// ======================================================
self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .catch(err => {
        console.error('❌ Erro ao instalar cache:', err);
      })
  );
});

// ======================================================
// ACTIVATE
// Remove caches antigos
// ======================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('🧹 Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ======================================================
// FETCH
// Estratégia: NETWORK FIRST
// ======================================================
self.addEventListener('fetch', (event) => {

  // 🔒 Apenas GET
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // 🚫 Nunca cachear API / Firebase / Auth
  if (
    url.includes('/api/') ||
    url.includes('googleapis.com') ||
    url.includes('firebaseio.com') ||
    url.includes('firebasedatabase.app') ||
    url.includes('identitytoolkit') ||
    url.includes('securetoken')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se resposta inválida, só retorna
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clona e atualiza o cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // 📴 Offline → tenta cache
        return caches.match(event.request);
      })
  );
});
