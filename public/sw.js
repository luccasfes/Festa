// ======================================================
// SERVICE WORKER FLOWLINK (PRODUÇÃO)
// Estratégia: NETWORK FIRST (Prioriza a internet, usa cache se cair)
// ======================================================

const CACHE_NAME = 'flowlink-cache-v6'; 

// Arquivos essenciais para o App funcionar offline
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/create.html',
  '/admin.html',
  '/style.css',
  '/assets/favicon.png',
  '/js/utils.js',
  '/js/player.js',
  '/js/theme.js',
  '/js/search.js', 
  '/js/queue.js',
  '/js/chat.js',
  '/js/session.js',
  '/js/presence.js',
  '/js/config.js'
];

// ======================================================
// 1. INSTALAÇÃO (Cache inicial)
// ======================================================
self.addEventListener('install', (event) => {
  // Força o SW a ativar imediatamente, sem esperar fechar a aba
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('💾 [SW] Instalando e cacheando arquivos estáticos...');
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch(err => {
        console.error('❌ [SW] Erro ao instalar cache:', err);
      })
  );
});

// ======================================================
// 2. ATIVAÇÃO (Limpeza de caches antigos)
// ======================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('🧹 [SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => {
      console.log('✅ [SW] Ativo e pronto.');
      return self.clients.claim();
    })
  );
});

// ======================================================
// 3. FETCH (Interceptação de rede)
// ======================================================
self.addEventListener('fetch', (event) => {
  
  // 🔒 Apenas requisições GET
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  if (!url.startsWith('http')) {
      return; 
  }

  // 🚫 LISTA NEGRA: Nunca cachear estas URLs (APIs, Firebase, Auth)
  if (
    url.includes('/api/') ||                   // Nossas APIs do backend
    url.includes('socket.io') ||               // Conexões realtime (se houver)
    url.includes('googleapis.com') ||          // APIs do Google
    url.includes('firebaseio.com') ||          // Realtime Database
    url.includes('firebasedatabase.app') ||    // Realtime Database
    url.includes('identitytoolkit') ||         // Auth
    url.includes('securetoken') ||             // Auth
    url.includes('browser-sync')               // Ferramentas de dev locais
  ) {
    return;
  }

  // ESTRATÉGIA: NETWORK FIRST
  // 1. Tenta buscar na internet (para ter sempre a versão mais nova)
  // 2. Se conseguir, salva uma cópia no cache e entrega ao usuário.
  // 3. Se falhar (offline), entrega o que tiver no cache.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Verifica se a resposta é válida antes de cachear
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
            try {
                cache.put(event.request, responseToCache);
            } catch (err) {
            }
        });

        return response;
      })
      .catch(() => {
        // 📴 MODO OFFLINE
        // Se a internet falhar, tentamos encontrar no cache
        return caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
      })
  );
});