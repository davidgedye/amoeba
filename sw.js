const CACHE_NAME = 'amoeba-v22';
const ASSETS = [
  './index.html', './manifest.json', './icon.svg',
  // Audio must be cached too: uncached, the first play() waits on ~2.8 MB of
  // network, which is why sound used to arrive many seconds after the animation.
  './bloop.wav', './pop.mp3', './brook.mp3', './fumarole.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Two strategies, because the page and its assets want opposite things.
//
// The HTML is network-first: always try the server, fall back to cache only when
// offline or the request fails. Serving it cache-first meant an edit needed two
// reloads to appear — the first reload was answered from the old cache and merely
// installed the new worker — which is a poor way to ship changes to anyone.
//
// Everything else is cache-first, which is the whole point: the 2.8 MB of audio
// should never be re-fetched, and those files only change when their names do.
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          // Keep the offline copy current while we have a good response.
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
