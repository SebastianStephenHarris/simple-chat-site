/* Chatroom service worker (GitHub Pages subpath: /simple-chat-site/)
   Strategy: network-first for same-origin static files, cache as offline fallback.
   WebSocket traffic, cross-origin API calls, and user content are never touched. */

const CACHE = "chatroom-shell-v6";

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css?v=9",
  "./script.js?v=11",
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

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const focused = clientList.some(c =>
        c.visibilityState === "visible" && c.focused
      );
      if (focused) return; // user is actively looking at the chat — no popup

      return self.registration.showNotification(
        typeof data.title === "string" ? data.title : "Chatroom",
        {
          body: typeof data.body === "string" ? data.body : "",
          tag: typeof data.tag === "string" ? data.tag : "chatroom",
          icon: "./icons/icon-192.png",
          badge: "./icons/icon-192.png",
          vibrate: [200, 100, 200],
          data: { clickUrl: new URL("./", self.location).href }
        }
      );
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client && new URL(client.url).origin === self.location.origin) {
          return client.focus();
        }
      }
      const clickUrl = event.notification.data && event.notification.data.clickUrl;
      if (self.clients.openWindow) return self.clients.openWindow(clickUrl || new URL("./", self.location).href);
    })
  );
});