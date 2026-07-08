const CACHE_NAME = 'dois-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './conectar.html',
  './lugares.html',
  './checklist.html',
  './agenda.html',
  './perfil.html',
  './index.css',
  './login.css',
  './conectar.css',
  './lugares.css',
  './checklist.css',
  './agenda.css',
  './perfil.css',
  './modal.css',
  './index.js',
  './login.js',
  './conectar.js',
  './lugares.js',
  './checklist.js',
  './agenda.js',
  './perfil.js',
  './supabase-client.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instala e faz cache dos assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Limpa caches antigos ao ativar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Network First para requests ao Supabase, Cache First para assets estáticos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Deixa requests ao Supabase passarem direto (sempre precisa de rede para dados)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Para assets estáticos: tenta cache primeiro, depois rede
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Só faz cache de respostas válidas
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});
