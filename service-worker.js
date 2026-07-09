const CACHE_NAME = 'dois-v4';
const ASSETS = [
  '/Dois/',
  '/Dois/index.html',
  '/Dois/index.css',
  '/Dois/index.js',
  '/Dois/agenda.html',
  '/Dois/agenda.css',
  '/Dois/agenda.js',
  '/Dois/checklist.html',
  '/Dois/checklist.css',
  '/Dois/checklist.js',
  '/Dois/diario.html',
  '/Dois/diario.css',
  '/Dois/diario.js',
  '/Dois/lugares.html',
  '/Dois/lugares.css',
  '/Dois/lugares.js',
  '/Dois/metas.html',
  '/Dois/metas.css',
  '/Dois/metas.js',
  '/Dois/perfil.html',
  '/Dois/perfil.css',
  '/Dois/perfil.js',
  '/Dois/conectar.html',
  '/Dois/conectar.css',
  '/Dois/conectar.js',
  '/Dois/login.html',
  '/Dois/login.css',
  '/Dois/login.js',
  '/Dois/modal.css',
  '/Dois/supabase-client.js',
  '/Dois/manifest.json',
  '/Dois/icons/icon-180.png',
  '/Dois/icons/icon-192.png',
  '/Dois/icons/icon-512.png'
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
