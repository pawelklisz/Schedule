/* Service worker: makes the app open with no network at all.
 *
 * The point is not speed, it is that a tablet on a shop floor has no
 * usable wifi and the schedule still has to come up. The project data
 * itself is NOT here -- that lives in IndexedDB (see gantt.html). This
 * only caches the app shell.
 */
/* Bump this to ship an update to an installed copy served from static/.
   The Android/ build replaces it with a hash of the files, so that copy
   never needs bumping by hand -- see make_single.py. */
const CACHE = "pmcore-3fbe8ccf01";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", e => {
  // cache:"reload" goes past the browser's HTTP cache. Without it a host
  // that sends max-age (GitHub Pages sends ten minutes) can hand a NEW
  // worker the OLD page, which it would then serve until the next release.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: "reload"}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  // Never serve /api/ from cache. If a server is put in front of this
  // later, a stale schedule read from cache is worse than a failed one:
  // the user cannot tell the difference and plans around old dates.
  if (new URL(e.request.url).pathname.includes("/api/")) return;

  // Cache-first, then refresh the entry in the background. The shell is
  // versioned by CACHE, so a bumped version is what ships an update.
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request)
        .then(res => {
          if (res && res.ok && res.type === "basic")
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => hit);        // offline: whatever we already have
      return hit || net;
    })
  );
});
