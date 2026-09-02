/* Chatroom service worker (GitHub Pages subpath: /simple-chat-site/)
   Strategy: network-first for same-origin static files, cache as offline fallback.
   WebSocket traffic, cross-origin API calls, and user content are never touched. */

const CACHE = "chatroom-shell-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css?v=5",
  "./script.js?v=7",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then(match => match || caches.match("./index.html"))
          .then(fallback => fallback || Response.error())
      )
  );
});