'use strict';
// Lobby (design de l'utilisateur, docs/SPEC.md) : images découpées de sa maquette par tools/build_lobby_assets.js.
// body.lobby suit la visibilité de #overlay : les barres du haut et du bas prennent alors le décor du lobby.
function lobbyCardArt(kind, key) {
  return `<img class="cardArt" src="assets/ui/lobby/${kind}_${key}.webp" alt="">`;
}
(() => {
  const ov = document.getElementById('overlay');
  if (!ov) return;
  const sync = () => document.body.classList.toggle('lobby', ov.style.display !== 'none');
  new MutationObserver(sync).observe(ov, { attributes: true, attributeFilter: ['style'] });
  sync();
})();
