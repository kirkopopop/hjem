// Minimal service worker: makes the app installable. Data always comes live
// from the network so both phones and the wall tablet stay in sync.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
