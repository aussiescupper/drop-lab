/* Drop Lab service worker — same strategy as the other ScupperLab apps:
   network-first app shell (a plain deploy reaches installed iPads on their
   next online launch), cache-first icons, prefix-guarded cleanup because the
   GitHub Pages origin is shared with Hoop Maths, Rail Runner and Trawley Coin. */
importScripts("version.js");                 // single source of truth for the version
const CACHE = "drop-lab-v" + self.APP_VERSION;

const SCOPE = self.registration ? self.registration.scope : "./";
const ASSETS = [
  "",
  "index.html",
  "styles.css",
  "app.js",
  "problems.js",
  "version.js",
  "print.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
  "icons/icon-maskable-512.png",
].map((p) => new URL(p, SCOPE).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("drop-lab-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // never intercept siblings' files (the ../trawley-coin bridge) — they'd freeze here
  if (!url.pathname.startsWith(new URL(SCOPE).pathname)) return;

  const isShell =
    req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    /(?:^|\/)(index\.html|app\.js|problems\.js|styles\.css|print\.html|manifest\.webmanifest)$/.test(url.pathname);

  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((cached) => {   // print.html?tier=2 → the cached print.html
            if (cached) return cached;
            if (req.mode === "navigate") return caches.match(new URL("index.html", SCOPE).toString());
            return new Response("", { status: 504, statusText: "offline" });
          })
        )
    );
  } else {
    // cache-first for icons, audio and other static bits (audio is only listed in
    // ASSETS once the files actually exist — addAll fails atomically on a 404)
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => putInCache(req, res)).catch(() => new Response("", { status: 504 }))
      )
    );
  }
});
