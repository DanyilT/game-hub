/**
 * GameHub's service worker: the site keeps working offline.
 *
 * Not imported by the app: vite.config.js (gamehub-service-worker) builds it into /sw.js, filling in
 * the app's files (APP_FILES), the other sites its pictures and fonts come from (OTHER_SITES), and a
 * version that changes with every build. src/lib/offline.js registers it, in production builds only.
 * - Pages: from the network when there is one, else the saved app (the site's root, index.html: the app shows any
 *   page). It's saved as the root because Cloudflare redirects /index.html there, and a page can't be answered with
 *   a redirect.
 * - The app's built files (/assets/…): saved when the worker installs; they never change (their
 *   names have a hash)
 * - The site's other files (icons, the manifest, catalog.json…): from the network, else the saved copy
 * - Pictures and fonts from OTHER_SITES: the saved copy straight away, refreshed in the background
 * The games aren't here. Each game's own worker keeps its files (sw.js in DanyilT/dt-games): a page's
 * worker can't answer for a frame from another site. Supabase is never cached.
 */
const VERSION = '__VERSION__';
const BASE = '__BASE__'; // Vite's base: '/' on Cloudflare
const APP_FILES = __APP_FILES__;
const OTHER_SITES = __OTHER_SITES__; // origins, some with a wildcard: 'https://*.googleusercontent.com'
const APP_CACHE = `gamehub-app-${VERSION}`;
const PICTURES_CACHE = 'gamehub-pictures';
const PICTURES_KEPT = 40; // pictures and fonts from other sites (the oldest go first)

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(APP_FILES);
    await self.skipWaiting();
  })());
});

// The new version takes over at once, and the old version's app files go
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('gamehub-app-') && name !== APP_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

const fromOtherSite = (url) => OTHER_SITES.some((site) => {
  if (!site.includes('://*.')) return url.origin === site;
  const [scheme, host] = site.split('://*.');
  return url.protocol === `${scheme}:` && url.hostname.endsWith(`.${host}`);
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') event.respondWith(page(request));
    else if (url.pathname.startsWith(`${BASE}assets/`)) event.respondWith(builtFile(request));
    else if (url.pathname !== `${BASE}sw.js`) event.respondWith(siteFile(request));
  } else if (['image', 'font', 'style'].includes(request.destination) && fromOtherSite(url)) {
    event.respondWith(picture(event, request));
  }
});

// A page: the network's answer (a real 404 included), or the saved app when there's no network
async function page(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const app = await caches.match(BASE);
    if (app) return app.redirected ? unredirected(app) : app;
    throw error;
  }
}

// The same answer, without the "redirected" mark that keeps a page from using it
async function unredirected(response) {
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

// The app's built files: the saved copy, or the network (and saved) for one that isn't yet
async function builtFile(request) {
  const saved = await caches.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(APP_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

// The site's other files: the network, or the saved copy when there's no network
async function siteFile(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const saved = await caches.match(request);
    if (saved) return saved;
    throw error;
  }
}

// Pictures and fonts from other sites: the saved copy at once (refreshed in the background), or the
// network the first time. Pictures come without CORS, so their answers are opaque: kept all the same.
async function picture(event, request) {
  const cache = await caches.open(PICTURES_CACHE);
  const saved = await cache.match(request);
  const fresh = fetch(request).then(async (response) => {
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      await trim(cache);
    }
    return response;
  });
  if (saved) {
    event.waitUntil(fresh.catch(() => {}));
    return saved;
  }
  return fresh;
}

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - PICTURES_KEPT)).map((key) => cache.delete(key)));
}
