const CACHE_NAME = 'flowlink-cache-v4'; // Subi para v4 para limpar o cache bugado

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

// INSTALA
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
        // Tenta adicionar arquivos. Se um falhar, loga o erro mas não quebra tudo imediatamente,
        // porém o addAll exige que TODOS funcionem.
        // Removi os ícones faltantes acima para garantir que funcione.
        return cache.addAll(FILES_TO_CACHE);
    }).catch(err => {
        console.error("Erro crítico ao instalar cache:", err);
    })
  );
});

// ATIVA (Limpa caches antigos)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Removendo cache antigo:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// FETCH
self.addEventListener('fetch', (event) => {
  
  // 1. REGRA DE OURO: Ignorar chamadas de API
  if (event.request.url.includes('/api/')) {
    return;
  }

  // 2. Para HTML (Navegação)
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

  // 3. Para arquivos estáticos
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});