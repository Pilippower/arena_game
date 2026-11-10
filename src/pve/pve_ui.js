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
  document.querySelector('#overlay .modal')?.classList.toggle('pveMode', pve);
  $('tabPvp').classList.toggle('selected', !pve);
  $('tabPve').classList.toggle('selected', pve);
  if (sub) {
    PVP_LOBBY_SUB ??= sub.textContent;
    sub.textContent = pve ? PVE_LOBBY_SUB : PVP_LOBBY_SUB;
  }
  pveRenderCard();
  if (typeof LOBBY_CHIPS === 'function') LOBBY_CHIPS();
  if (window.NET?.role === 'host')
    netPartySync(); // le groupe en ligne suit l'onglet de l'hôte (aventure ou arène)
  else partyRender();
}
// Carte de l'aventure (même cadre que les cartes d'arène) et ce qui attend le joueur.
function pveRenderCard() {
  const box = $('pveChoices'),
    W = PVE_WORLD;
  if (!box) return;
  const camps = W.camps.filter(c => !c.boss).length;
  box.innerHTML =
    `<button class="mapCard selected painted" data-pve="${W.id}" aria-label="${W.name}"><span class="mapArt pveArt"><img src="assets/ui/lobby2/mapcard_pve.webp" alt=""></span><div class="mapLabel"><b>${W.name}</b><span>${W.desc}</span></div></button>` +
    `<div class="pveInfo"><b>Along the road</b><ul><li>${camps} monster camps, bigger with each friend (${PVE.maxHeroes} max)</li><li>Campfires: rest and return after a fall</li><li>Out of combat, you recover quickly</li><li>Gate guardian: <em>${W.mobs.gatekeeper.name}</em></li><li>At the top of the keep: <em>${W.mobs.king.name}</em></li></ul></div>`;
}
// Play dans l'onglet PvE (ui/settings.js) : aventure seul, ou avec son groupe en ligne quand on l'a créé (hôte).
function pveLaunch(cls, race) {
  const party = window.NET?.role ? pveNetParty() : []; // net/pve_online.js : null = pas encore prêt (message affiché)
  if (!party) return;
  $('overlay').style.display = 'none';
  pveStart(cls, race, party);
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
// Cadre du bas (à la place de manche / chrono / score) : prochain but, distance et direction, monstres vaincus. Buts :
// le prochain feu devant soi (le chemin monte toujours vers le nord), le levier de la porte tant qu'elle est fermée,
// puis le sommet.
function pveCenterHUD(p) {
  const W = PVE_WORLD,
    ahead = W.checkpoints.find(c => c.z > p.z + 2),
    toGate = !state.pve.gateOpen && p.z < W.gate.z && !(ahead?.z < W.gate.z),
    next = toGate ? W.lever : ahead || W.top,
    d = Math.hypot(next.x - p.x, next.z - p.z),
    rel = Math.atan2(next.x - p.x, next.z - p.z) - camera.yaw,
    kills = statOf(p)?.kills || 0;
  $('round').textContent = next.name;
  $('timer').innerHTML =
    `<i class="pveArrow" style="transform:rotate(${((-rel * 180) / Math.PI).toFixed(0)}deg)">▲</i>${Math.round(d)} m`;
  $('score').textContent = `${kills} foe${kills === 1 ? '' : 's'} slain`;
}
// Levier de la porte sous le curseur (ou le doigt) : clic = le tirer (pickTargetAt, input/controls.js) ; main au
// survol (ui/cursor.js). Rien en arène, ni une fois la herse levée.
const LEVER_PICK_PX = 46; // rayon à l'écran autour de la poignée
function pveLeverAtScreen(sx, sy) {
  if (!state?.pve || state.pve.gateOpen) return false;
  const L = PVE_WORLD.lever,
    s = projectScreen(L.x, terrainY(L.x, L.z) + 1.1, L.z);
  return !!s && Math.hypot(s.x - sx, s.y - sy) < LEVER_PICK_PX;
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
// Tableau des héros de l'écran de fin (tri au clic : resultsTableHTML / bindResultsSort, game/match.js).
function pveEndTable(sum) {
  const rows = sum.heroes.map(h => ({
    u: state.units[h.slot],
    s: h,
    name: h.slot === state.player.slotIndex ? 'You' : partyEsc(h.name)
  }));
  $('resultsTeams').innerHTML =
    `<h3 class="ally">Your journey · ${pveClock(sum.time)} · ${sum.deaths} fall${sum.deaths === 1 ? '' : 's'}</h3>` +
    resultsTableHTML(rows, resultsMax(sum.heroes));
  bindResultsSort(() => pveEndTable(sum));
}
// Écran de victoire : panneau de fin de match (ui/results.css), une ligne par héros du groupe (sum : pveSummary de
// l'hôte, reçu aussi par les amis en ligne), triable par dégâts, soins ou éliminations comme en arène (game/match.js).
// L'ami attend que l'hôte relance.
function pveShowEnd(sum) {
  $('resultsAgain').style.display = window.NET?.role === 'guest' ? 'none' : '';
  $('results').className = 'win';
  $('resultsTitle').textContent = 'Victory';
  $('resultsTitle').className = 'win';
  $('resultsScore').textContent = 'The Ashen King is vanquished';
  pveEndTable(sum);
  $('results').style.setProperty('--rows', sum.heroes.length);
  $('results').style.display = 'flex';
  resultsFxStart(true);
  setTimeout(() => SFX.victory(true), 300);
}
