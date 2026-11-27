/* Endereço antigo: o app mudou para o repositório mpteixeirarj-glit.github.io.
 * Este service worker existe só para substituir o antigo e sair de cena:
 * não guarda nada, NÃO apaga caches (os prefixos são os mesmos do app novo),
 * se remove e recarrega as janelas abertas, que caem na página de redirecionamento. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(self.registration.unregister().then(function () {
    return self.clients.matchAll({ type: "window" });
  }).then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); }));
});
