const CACHE_NAME = 'dois-v13';
const ASSETS = [
  '/Dois/',
  '/Dois/index.html',
  '/Dois/index.css',
  '/Dois/index.js',
  '/Dois/roleta.html',
  '/Dois/roleta.css',
  '/Dois/roleta.js',
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
  '/Dois/capsula.html',
  '/Dois/capsula.css',
  '/Dois/capsula.js',
  '/Dois/desejos.html',
  '/Dois/desejos.css',
  '/Dois/desejos.js',
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

// Instala e faz cache inicial
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Limpa caches antigos e assume controle imediatamente
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first: sempre tenta buscar do servidor.
// Se offline, cai no cache como fallback.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(networkRes => {
        // Atualiza o cache com a versao mais recente do servidor
        const resClone = networkRes.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, resClone));
        return networkRes;
      })
      .catch(() => caches.match(e.request))
  );
});
