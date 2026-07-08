const CACHE_NAME = 'dois-v3';

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

// Instala e faz cache dos assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Limpa TODOS os caches antigos ao ativar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase: sempre direto pela rede
  if (url.hostname.includes('supabase.co')) return;

  const isNavigationOrScript =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html');

  if (isNavigationOrScript) {
    // Network First: busca na rede, atualiza cache, cai no cache só se offline
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache First para CSS, imagens e fontes
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
