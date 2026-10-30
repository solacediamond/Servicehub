/* ServiceHub service worker
 *
 * - Pages and app files: network first, saved copy when offline or very slow.
 * - Images / CDN scripts: saved copy first, refreshed in the background.
 * - Public listing data (Apps Script getListings / getListing) is saved so
 *   listings the user already loaded still show offline.
 * - Payments, login, chat, POST requests and anything private are NEVER cached.
 *
 * Bump VERSION whenever you want every phone to drop its old saved files.
 */
const VERSION = "v15";
const SHELL = "sh-shell-" + VERSION;
const RUNTIME = "sh-runtime-" + VERSION;
const STATE = "sh-state";
const MARKER = "/__sh_offline_mode";
const MARKER_TTL = 20 * 60 * 1000; // offline mode stays "on" for 20 min of inactivity
const MAX_RUNTIME_ENTRIES = 120;

const PRECACHE = [
  "/index.html", "/explore.html", "/search.html", "/how-it-works.html", "/jobs.html", "/settings.html",
  "/list-service.html", "/login.html", "/manage.html", "/service.html",
  "/provider.html", "/chat.html", "/conversation.html",
  "/payment.html", "/payment-naira.html", "/payment-usd.html",
  "/payment-crypto.html", "/payment-crypto-return.html", "/payment-crypto-status.html",
  "/style.css", "/script.js", "/link-guard.js", "/nav-guard.js", "/welcome-exit.js", "/welcome-exit.css", "/servicehub-mascot.webp", "/backend-config.js", "/manage-link-modal.js",
  "/offline.html", "/manifest.webmanifest", "/pwa.js", "/page-intro.js", "/i18n.js", "/social-fab.js", "/solaceproeditz-logo.png",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png"
];

const PUBLIC_ACTIONS = ["getListings", "getListing"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // One missing file must not break the whole install.
    await Promise.allSettled(PRECACHE.map((u) => cache.add(new Request(u, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL, RUNTIME, STATE];
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("sh-") && !keep.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* ---------- offline-mode marker (set by the "Continue in offline mode" button) ---------- */
async function markerActive() {
  try {
    const c = await caches.open(STATE);
    const r = await c.match(MARKER);
    if (!r) return false;
    const ts = parseInt(await r.text(), 10);
    return Date.now() - ts < MARKER_TTL;
  } catch (_) { return false; }
}
async function touchMarker() {
  try { const c = await caches.open(STATE); await c.put(MARKER, new Response(String(Date.now()))); } catch (_) {}
}
async function clearMarker() {
  try { const c = await caches.open(STATE); await c.delete(MARKER); } catch (_) {}
}

/* ---------- helpers ---------- */
function pageKey(url) {
  let p = url.pathname;
  if (p === "/" || p === "") p = "/index.html";
  return url.origin + p;
}

function timeoutPromise(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new DOMException("slow", "TimeoutError")), ms));
}

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => c.delete(k)));
}

async function offlineResponse() {
  const c = await caches.open(SHELL);
  return (await c.match("/offline.html")) ||
    new Response("<h1>You're offline</h1>", { status: 503, headers: { "Content-Type": "text/html" } });
}

/* ---------- page navigations ---------- */
async function handleNavigation(req) {
  const url = new URL(req.url);
  const shell = await caches.open(SHELL);
  const cached = await shell.match(pageKey(url));

  // no-cache = always ask the server (or fail when offline), never reuse a stale browser copy.
  const net = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res && res.ok && res.type === "basic") {
      shell.put(pageKey(url), res.clone()).catch(() => {});
      clearMarker();
    }
    return res;
  });

  try {
    // On a very slow connection fall back to the saved page after 7 seconds.
    return cached ? await Promise.race([net, timeoutPromise(7000)]) : await net;
  } catch (err) {
    net.catch(() => {}); // avoid unhandled rejection from the background request
    if (err && err.name === "TimeoutError" && cached) return cached;
    // Offline.
    if (await markerActive()) {
      await touchMarker();
      return cached || (await offlineResponse());
    }
    return offlineResponse();
  }
}

/* ---------- strategies ---------- */
async function networkFirst(req, cacheName, ms, keyReq, init) {
  const cache = await caches.open(cacheName);
  const key = keyReq || req;
  const net = fetch(req, init).then((res) => {
    if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  });
  try {
    const cachedNow = await cache.match(key);
    return cachedNow ? await Promise.race([net, timeoutPromise(ms)]) : await net;
  } catch (err) {
    net.catch(() => {});
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  // Look in every saved area: icons and other files saved at install time live
  // in the SHELL cache, not RUNTIME.
  const hit = (await cache.match(req)) || (await caches.match(req));
  const net = fetch(req).then((res) => {
    if (res && (res.ok || res.type === "opaque")) {
      cache.put(req, res.clone()).then(() => trim(RUNTIME, MAX_RUNTIME_ENTRIES)).catch(() => {});
    }
    return res;
  }).catch((err) => { if (hit) return hit; throw err; });
  return hit || net;
}

function isAppsScript(url) {
  return (url.hostname === "script.google.com" || url.hostname === "script.googleusercontent.com") &&
    url.pathname.indexOf("/macros/") === 0;
}

/* Cache key without the "&_=timestamp" cache-buster. */
function listingKey(url) {
  const u = new URL(url.href);
  u.searchParams.delete("_");
  return new Request(u.href);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin
  if (url.origin === self.location.origin) {
    if (url.pathname === "/sw.js") return;
    if (req.mode === "navigate") { event.respondWith(handleNavigation(req)); return; }
    if (/\.(?:css|js|html|webmanifest|json)$/i.test(url.pathname)) {
      event.respondWith(networkFirst(req, SHELL, 4000, new Request(pageKey(url)), { cache: "no-cache" }));
    } else {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  // Public listing data from Apps Script (never manage / payment pages)
  if (isAppsScript(url)) {
    const action = url.searchParams.get("action");
    const from = req.referrer || "";
    if (PUBLIC_ACTIONS.includes(action) && !/manage|payment/i.test(from)) {
      event.respondWith(networkFirst(req, RUNTIME, 8000, listingKey(url)));
    }
    return;
  }

  // Listing photos (Google Drive) and the Supabase script from the CDN
  if (req.destination === "image" && /(^|\.)(drive\.google\.com|googleusercontent\.com)$/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.hostname === "cdn.jsdelivr.net" && req.destination === "script") {
    event.respondWith(staleWhileRevalidate(req));
  }
});
