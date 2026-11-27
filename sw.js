/* Auto-Vigia — service worker (escopo: /AUTO-VIGIA-/).
 * Navegação: network-first (pega a versão nova quando há rede, cai no cache offline).
 * Demais arquivos: cache-first, pré-carregados na instalação.
 * A CADA atualização: suba VERSAO aqui E AV_VERSAO em version.js (devem ser iguais).
 *
 * IMPORTANTE: o Vigia Energy e o Vigia Financeiro vivem na MESMA origem
 * (mpteixeirarj-glit.github.io). Só mexemos em caches com prefixo "av-". */
var VERSAO = 'av-1.2.0';
var ARQUIVOS = [
  './', 'index.html', 'styles.css', 'app.js', 'version.js', 'manifest.json', 'nuvem.js',
  'vendor/jspdf.umd.min.js', 'fonts/vigia-pixel.woff2',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'img/gv-34.webp', 'img/gv-frontal.webp', 'img/gv-lateral.webp', 'img/gv-motor.webp',
  'img/gv-traseira-estepe.webp', 'img/gv-traseira-pixel.webp'
];

function precache(c) {
  return c.addAll(ARQUIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(precache).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('av-') === 0 && k !== VERSAO; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Se outro app da mesma origem apagar nosso cache, recria na próxima navegação online. */
function garantirPrecache() {
  return caches.open(VERSAO).then(function (c) {
    return c.match('app.js').then(function (r) { return r || precache(c); });
  }).catch(function () {});
}

function guardar(req, res) {
  if (res && res.ok && res.type === 'basic') {
    var copia = res.clone();
    caches.open(VERSAO).then(function (c) { c.put(req, copia); });
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (r) { e.waitUntil(garantirPrecache()); return guardar(req, r); }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || fetch(req).then(function (res) { return guardar(req, res); });
  }));
});
