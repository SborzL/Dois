const CACHE_NAME = 'dois-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.js',
  '/agenda.html',
  '/agenda.css',
  '/agenda.js',
  '/checklist.html',
  '/checklist.css',
  '/checklist.js',
  '/diario.html',
  '/diario.css',
  '/diario.js',
  '/lugares.html',
  '/lugares.css',
  '/lugares.js',
  '/metas.html',
  '/metas.css',
  '/metas.js',
  '/perfil.html',
  '/perfil.css',
  '/perfil.js',
  '/conectar.html',
  '/conectar.css',
  '/conectar.js',
  '/login.html',
  '/login.css',
  '/login.js',
  '/modal.css',
  '/supabase-client.js',
  '/manifest.json',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
