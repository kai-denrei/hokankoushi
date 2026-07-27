// hokankoushi service worker — installable + offline, without fighting cache-busting.
//
//   Navigations (the HTML): NetworkFirst → falls back to the cached shell offline.
//     Fresh deploys always win online, so this stays compatible with scripts/bust.sh
//     and the no-cache HTML meta tags.
//   unpkg CDN (THREE + addons): CacheFirst — the URLs are version-pinned/immutable.
//   Same-origin static (icons, manifest): CacheFirst.
//
// We deliberately do NOT call skipWaiting(): a new SW activates on the next load,
// and online users get fresh HTML via NetworkFirst regardless, so an in-flight
// session is never yanked out from under the user.
//
// NOTE: THREE_CORE below is pinned to the version in index.html's importmap. If you
// bump three@x.y.z there, bump it here too (and bump VERSION) so offline stays warm.

const VERSION = 'ns-v1';
const SHELL = VERSION + '-shell';
const STATIC = VERSION + '-static';
const CDN = VERSION + '-cdn';

const SHELL_URLS = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon-180.png',
];
const THREE_CORE = 'https://unpkg.com/three@0.169.0/build/three.module.js';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).catch(() => {});
    // Warm the THREE core so the base experience works offline right after first visit.
    await caches.open(CDN).then((c) => c.add(THREE_CORE)).catch(() => {});
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch {} }
    const keep = new Set([SHELL, STATIC, CDN]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;               // never touch POST/PUT/etc.
  const url = new URL(req.url);

  if (req.mode === 'navigate') {                  // HTML: NetworkFirst, cache-fallback
    e.respondWith((async () => {
      try {
        const preload = await e.preloadResponse;
        const net = preload || await fetch(req);
        caches.open(SHELL).then((c) => c.put('./index.html', net.clone())).catch(() => {});
        return net;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (url.hostname === 'unpkg.com') { e.respondWith(cacheFirst(req, CDN)); return; }
  if (url.origin === location.origin) { e.respondWith(cacheFirst(req, STATIC)); return; }
  // other cross-origin (e.g. Tweakpane CDN): pass through, opportunistically cache
  e.respondWith(cacheFirst(req, CDN));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const net = await fetch(req);
    if (net && (net.ok || net.type === 'opaque')) {
      caches.open(cacheName).then((c) => c.put(req, net.clone())).catch(() => {});
    }
    return net;
  } catch {
    return cached || Response.error();
  }
}
