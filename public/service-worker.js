/* Fireowl Guardian PWA — cache somente para shell e assets públicos same-origin. */
// v3 (3B.1): ícones oficiais Fireowl Controls substituíram o "F" antigo — o bump
// da versão força o activate a limpar o cache velho e reprecachear os novos.
const CACHE = 'fireowl-shell-v3';
const SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  // Em atualizações, permanece waiting até o usuário escolher atualizar no app.
  // Cache resiliente: uma falha isolada (404/rede) não bloqueia a instalação do worker.
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((asset) => cache.add(asset)))));
});
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('fireowl-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

// Navegação: network-first; offline serve o HTML cacheado da rota, ou o fallback offline.html.
async function handleNavigate(request) {
  try {
    const response = await fetch(request);
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match(request, { ignoreSearch: true }))
      || (await cache.match('/offline.html'))
      || (await cache.match('/'))
      || new Response('<!doctype html><meta charset=utf-8><title>Offline</title><h1>Sem conexão</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

// Assets versionados/estáticos same-origin: cache-first.
async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Supabase, URLs assinadas, requests autenticados e qualquer origem externa nunca entram no cache.
  if (url.origin !== self.location.origin || request.headers.has('authorization') || /\/(rest|auth|storage)\/v1\//.test(url.pathname)) return;
  if (request.mode === 'navigate') { event.respondWith(handleNavigate(request)); return; }
  if (['script', 'style', 'font', 'image'].includes(request.destination) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleAsset(request));
  }
});
