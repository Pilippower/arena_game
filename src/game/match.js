'use strict';
// Match en 3 manches : score, statistiques par personnage (dégâts, soins, éliminations) cumulées sur les manches,
// écran de résultats final avec « Play again » / « Back to lobby ».
const MATCH_ROUNDS = 3;
// Statistiques indexées par la place de l'unité (0-2 votre équipe, 3-5 adversaires) : les unités sont recréées à chaque manche.
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
  setTimeout(() => {
    if (state.round >= MATCH_ROUNDS) showResults();
    else resetRound();
  }, 1500);
}
function showResults() {
  const win = state.scoreA > state.scoreB;
  const row = u => {
    const s = statOf(u) || { damage: 0, healing: 0, kills: 0 },
      C = CLASS[u.cls];
    return `<tr><td class="rName">${u === state.player ? 'You' : u.name}</td><td>${RACE[u.race]?.name || ''} ${C.name}</td><td>${Math.round(s.damage)}</td><td>${Math.round(s.healing)}</td><td>${s.kills}</td></tr>`;
  };
  const table = team =>
    `<table class="resTable"><thead><tr><th>Hero</th><th>Class</th><th>Damage</th><th>Healing</th><th>Kills</th></tr></thead><tbody>${state.units
      .filter(u => u.team === team)
      .map(row)
      .join('')}</tbody></table>`;
  $('resultsTitle').textContent = win ? 'Victory' : 'Defeat';
  $('resultsTitle').className = win ? 'win' : 'loss';
  $('resultsScore').textContent = `${state.scoreA} - ${state.scoreB}`;
  $('resultsTeams').innerHTML =
    `<h3 class="ally">Your team</h3>${table(0)}<h3 class="enemy">Enemy team</h3>${table(1)}`;
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
  hideResults();
  chooseClass();
}
$('resultsAgain').onclick = playAgain;
$('resultsLobby').onclick = backToLobby;
