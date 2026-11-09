'use strict';
// Interface du mode PVE (src/pve/pve.js) : onglets PvP / PvE du lobby (lobbyMode), carte de l'aventure, objectif dans le
// cadre du bas en jeu (pveCenterHUD, appelé par updateUI de ui/hud.js), barres de nom limitées aux monstres proches
// (pvePlateHidden, render/overlay.js), écran de victoire (pveShowEnd, même panneau que la fin de match d'arène).
// Styles : src/pve/pve.css. body.pve pendant une aventure.
// ---------- Lobby : onglets PvP / PvE ----------
let LOBBY_MODE = (() => {
  try {
    return localStorage.getItem('arenaLobbyMode') === 'pve' ? 'pve' : 'pvp';
  } catch (_) {
    return 'pvp';
  }
})();
const lobbyIsPve = () => LOBBY_MODE === 'pve';
const PVE_LOBBY_SUB = 'Choose your race and class, then follow the misty road to the castle on the hill';
let PVP_LOBBY_SUB = null; // texte d'origine du sous-titre (index.html)
function lobbyMode(mode) {
  LOBBY_MODE = mode === 'pve' ? 'pve' : 'pvp';
  try {
    localStorage.setItem('arenaLobbyMode', LOBBY_MODE);
  } catch (_) {}
  const pve = lobbyIsPve(),
    sub = document.querySelector('#overlay .lobbyHead p');
  if (pve) lobbyTab('solo'); // la vue du groupe en ligne n'existe qu'en PvP
  document.querySelector('#overlay .modal')?.classList.toggle('pveMode', pve);
  $('tabPvp').classList.toggle('selected', !pve);
  $('tabPve').classList.toggle('selected', pve);
  if (sub) {
    PVP_LOBBY_SUB ??= sub.textContent;
    sub.textContent = pve ? PVE_LOBBY_SUB : PVP_LOBBY_SUB;
  }
  pveRenderCard();
  if (typeof LOBBY_CHIPS === 'function') LOBBY_CHIPS();
}
// Carte de l'aventure (même cadre que les cartes d'arène) et ce qui attend le joueur.
function pveRenderCard() {
  const box = $('pveChoices'),
    W = PVE_WORLD;
  if (!box) return;
  const camps = W.camps.filter(c => !c.boss).length,
    boss = W.mobs.boss.name;
  box.innerHTML =
    `<button class="mapCard selected painted" data-pve="${W.id}" aria-label="${W.name}"><span class="mapArt"><img src="assets/ui/lobby2/mapcard_pve.webp" alt=""></span><div class="mapLabel"><b>${W.name}</b><span>${W.desc}</span></div></button>` +
    `<div class="pveInfo"><b>Along the road</b><ul><li>${camps} monster camps in the haunted vale</li><li>Campfires: rest and return after a fall</li><li>Out of combat, you recover quickly</li><li>Gate guardian: <em>${boss}</em></li></ul></div>`;
}
// Play dans l'onglet PvE (ui/settings.js) : aventure solo.
function pveLaunch(cls, race) {
  if (window.NET?.role) {
    $('selectedClass').textContent = 'Leave your online party to play PvE';
    return;
  }
  $('overlay').style.display = 'none';
  pveStart(cls, race);
  musicStart();
  canvas.focus();
  requestAnimationFrame(mobileViewportSync);
}
$('tabPvp').onclick = () => lobbyMode('pvp');
$('tabPve').onclick = () => lobbyMode('pve');
lobbyMode(LOBBY_MODE);
// ---------- En jeu ----------
function pveUiStart() {
  document.body.classList.add('pve');
}
function pveUiStop() {
  document.body.classList.remove('pve');
}
// Cadre du bas (à la place de manche / chrono / score) : prochain but, distance et direction, monstres vaincus.
function pveCenterHUD(p) {
  const W = PVE_WORLD,
    ahead = W.checkpoints.find(c => c.z > p.z + 2), // prochain feu sur la route, devant soi
    next = ahead || W.gate,
    toGate = !ahead,
    d = Math.hypot(next.x - p.x, next.z - p.z),
    rel = Math.atan2(next.x - p.x, next.z - p.z) - camera.yaw,
    kills = statOf(p)?.kills || 0;
  $('round').textContent = toGate ? 'Castle gate' : next.name;
  $('timer').innerHTML =
    `<i class="pveArrow" style="transform:rotate(${((-rel * 180) / Math.PI).toFixed(0)}deg)">▲</i>${Math.round(d)} m`;
  $('score').textContent = `${kills} foe${kills === 1 ? '' : 's'} slain`;
}
// Barres de nom : seulement les monstres proches (le monde est grand, les camps lointains encombraient l'écran).
function pvePlateHidden(u) {
  return !!state.pve && u !== state.player && Math.hypot(u.x - state.player.x, u.z - state.player.z) > PVE.plateRange;
}
// Monstre trop loin pour être vu (brume) : ni animé ni dessiné. Jamais en arène.
function pveOutOfSight(u) {
  return !!u.monster && Math.hypot(u.x - state.player.x, u.z - state.player.z) > PVE.drawRange;
}
const pveClock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// Écran de victoire : panneau de fin de match (ui/results.css), récapitulatif du héros.
function pveShowEnd() {
  const R = state.pve,
    p = state.player,
    s = statOf(p) || { damage: 0, healing: 0, kills: 0 },
    cell = v => `<td class="rNum"><span>${Math.round(v)}</span><i style="width:${v > 0 ? 100 : 0}%"></i></td>`;
  $('resultsAgain').style.display = '';
  $('results').className = 'win';
  $('resultsTitle').textContent = 'Victory';
  $('resultsTitle').className = 'win';
  $('resultsScore').textContent = 'The castle is reached';
  $('resultsTeams').innerHTML =
    `<h3 class="ally">Your journey · ${pveClock((R.endT || now()) - R.t0)} · ${R.deaths} fall${R.deaths === 1 ? '' : 's'}</h3>` +
    `<table class="resTable"><thead><tr><th>Hero</th><th>Class</th><th>Damage</th><th>Healing</th><th>Kills</th></tr></thead><tbody><tr><td class="rName">${resultsPortrait(p)}You</td><td>${RACE[p.race]?.name || ''} ${CLASS[p.cls].name}</td>${cell(s.damage)}${cell(s.healing)}${cell(s.kills)}</tr></tbody></table>`;
  $('results').style.setProperty('--rows', 1);
  $('results').style.display = 'flex';
  resultsFxStart(true);
  setTimeout(() => SFX.victory(true), 300);
}
