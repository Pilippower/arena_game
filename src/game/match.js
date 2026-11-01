'use strict';
// Match en 3 manches : score, statistiques par personnage (dégâts, soins, éliminations) cumulées sur les manches,
// écran de résultats final avec « Play again » / « Back to lobby ».
const MATCH_ROUNDS = 3;
// Statistiques indexées par la place de l'unité (votre équipe puis les adversaires) : les unités sont recréées à chaque manche.
function statOf(u) {
  if (!state?.stats || u?.slotIndex == null) return null;
  return (state.stats[u.slotIndex] ||= { damage: 0, healing: 0, kills: 0 });
}
function recordDamage(src, t, v) {
  if (src && src.team !== t.team) {
    const s = statOf(src);
    if (s) s.damage += v;
  }
}
function recordHeal(src, v) {
  const s = statOf(src);
  if (s) s.healing += v;
}
function recordKill(src, t) {
  if (src && src.team !== t.team) {
    const s = statOf(src);
    if (s) s.kills++;
  }
}
// Fin de manche : point au vainqueur, puis manche suivante ou résultats après la 3e.
function endRound(win) {
  state.ended = true;
  if (win) state.scoreA++;
  else state.scoreB++;
  showSplash(win ? 'Round won!' : 'Round lost');
  if (win) SFX.victory(false);
  else SFX.defeat();
  const match = state;
  setTimeout(() => {
    if (state !== match) return; // match quitté entre-temps (Change class)
    if (state.round >= MATCH_ROUNDS) showResults();
    else resetRound();
  }, 1500);
}
// Tri du récapitulatif : clic sur une colonne (Damage / Healing / Kills), second clic = ordre inverse.
const RESULTS_SORT = { key: 'damage', dir: -1 };
function renderResultsTables() {
  const K = RESULTS_SORT.key,
    all = state.units.map(u => ({ u, s: statOf(u) || { damage: 0, healing: 0, kills: 0 } })),
    max = { damage: 1, healing: 1, kills: 1 };
  for (const { s } of all) for (const k in max) max[k] = Math.max(max[k], s[k]);
  const cell = (s, k) =>
    `<td class="rNum${k === K ? ' sorted' : ''}${s[k] > 0 && s[k] === max[k] ? ' best' : ''}"><span>${Math.round(s[k])}</span><i style="width:${((100 * s[k]) / max[k]).toFixed(0)}%"></i></td>`;
  const head = (k, label) =>
    `<th class="sortable${k === K ? ' sorted' : ''}" data-sort="${k}">${label}${k === K ? (RESULTS_SORT.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`;
  const table = team =>
    `<table class="resTable"><thead><tr><th>Hero</th><th>Class</th>${head('damage', 'Damage')}${head('healing', 'Healing')}${head('kills', 'Kills')}</tr></thead><tbody>${all
      .filter(x => x.u.team === team)
      .sort((x, y) => (x.s[K] - y.s[K]) * RESULTS_SORT.dir)
      .map(
        ({ u, s }) =>
          `<tr><td class="rName">${u === state.player ? 'You' : u.name}</td><td>${RACE[u.race]?.name || ''} ${CLASS[u.cls].name}</td>${cell(s, 'damage')}${cell(s, 'healing')}${cell(s, 'kills')}</tr>`
      )
      .join('')}</tbody></table>`;
  $('resultsTeams').innerHTML =
    `<h3 class="ally">Your team</h3>${table(0)}<h3 class="enemy">Enemy team</h3>${table(1)}`;
  $('resultsTeams')
    .querySelectorAll('[data-sort]')
    .forEach(
      th =>
        (th.onclick = () => {
          RESULTS_SORT.dir = RESULTS_SORT.key === th.dataset.sort ? -RESULTS_SORT.dir : -1;
          RESULTS_SORT.key = th.dataset.sort;
          renderResultsTables();
        })
    );
}
function showResults() {
  const win = state.scoreA > state.scoreB;
  $('resultsTitle').textContent = win ? 'Victory' : 'Defeat';
  $('resultsTitle').className = win ? 'win' : 'loss';
  $('resultsScore').textContent = `${state.scoreA} - ${state.scoreB}`;
  renderResultsTables();
  $('results').style.display = 'flex';
  if (win) setTimeout(() => SFX.victory(true), 300);
}
function hideResults() {
  $('results').style.display = 'none';
}
// Nouveau match avec la même composition.
function playAgain() {
  hideResults();
  state = { pcls: state.pcls, prace: state.prace, scoreA: 0, scoreB: 0, round: 0, map: state.map };
  resetRound();
  playGameMusic();
}
function backToLobby() {
  leaveMatch();
}
// Sortie du match : retour au lobby (sa musique) et partie réellement arrêtée (plus de simulation ni de sons).
function leaveMatch() {
  hideResults();
  $('leaveConfirm').style.display = 'none';
  chooseClass(); // relit la race et la classe de la partie pour les présélectionner
  state = null;
}
// « Change class » pendant un match : on demande d'abord si l'on veut vraiment le quitter.
function requestChangeClass() {
  if (!state?.units || $('overlay').style.display !== 'none') chooseClass();
  else $('leaveConfirm').style.display = 'flex';
}
$('leaveYes').onclick = leaveMatch;
$('leaveNo').onclick = () => ($('leaveConfirm').style.display = 'none');
$('resultsAgain').onclick = playAgain;
$('resultsLobby').onclick = backToLobby;
