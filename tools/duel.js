'use strict';
// Simulation de combats IA contre IA avec le vrai code du jeu (tests/combat_world.js), pour mesurer l'équilibre.
// Usage : node tools/duel.js <équipe A> <équipe B> [combats=20] [durée max s=180]
//   équipe = classes séparées par des virgules, ex. node tools/duel.js shade oracle
//                                                 node tools/duel.js sentinel,oracle arcanist,warlock 30
// Les deux équipes jouent au niveau Medium, sur l'arène vide, à 14 m l'une de l'autre. Résultat : victoires,
// durée moyenne, dégâts et soins moyens par classe.
const path = require('node:path');
const { combatWorld, run } = require(path.join(__dirname, '..', 'tests', 'combat_world.js'));

// tweak(ctx) : réglages essayés dans la simulation seulement (valeurs de SPELLS, CLASS, SWING…), sans toucher au jeu.
function duel(teamA, teamB, maxSec = 180, tweak = null) {
  const { ctx, unit } = combatWorld();
  if (tweak) tweak(ctx);
  const place = (list, team) =>
    list.map((cls, k) => unit(cls, (k - (list.length - 1) / 2) * 3, team ? 7 : -7, team, { ai: true }));
  const A = place(teamA, 0),
    B = place(teamB, 1);
  ctx.state.player = A[0];
  ctx.applyDifficulty();
  ctx.state.t = maxSec;
  const t0 = ctx.state.elapsed;
  // la manche s'arrête d'elle-même (équipe éliminée ou chrono à 0 : victoire aux PV restants)
  run(ctx, maxSec + 1);
  const stat = u => ctx.state.stats[u.slotIndex] || { damage: 0, healing: 0 };
  return {
    winA: ctx.state.winTeam === 0,
    timeout: A.some(u => u.alive) && B.some(u => u.alive),
    sec: ctx.state.elapsed - t0,
    units: [...A, ...B].map(u => ({ cls: u.cls, team: u.team, ...stat(u), alive: u.alive }))
  };
}

if (require.main === module) {
  const [a, b, n = '20', max = '180'] = process.argv.slice(2);
  if (!a || !b) {
    console.error('Usage : node tools/duel.js <équipe A> <équipe B> [combats=20] [durée max s=180]');
    process.exit(2);
  }
  const teamA = a.split(','),
    teamB = b.split(',');
  const res = Array.from({ length: +n }, () => duel(teamA, teamB, +max));
  const wins = res.filter(r => r.winA).length,
    timeouts = res.filter(r => r.timeout).length,
    avg = f => res.reduce((s, r) => s + f(r), 0) / res.length;
  console.log(`${a}  contre  ${b}  (${n} combats, max ${max} s)`);
  console.log(
    `  victoires ${a} : ${wins}/${n}   victoires ${b} : ${+n - wins}/${n}   au chrono : ${timeouts}   durée moyenne : ${avg(r => r.sec).toFixed(0)} s`
  );
  const slots = res[0].units.length;
  for (let i = 0; i < slots; i++) {
    const u = res[0].units[i];
    console.log(
      `  ${(u.team ? 'B ' : 'A ') + u.cls.padEnd(9)} dégâts ${avg(r => r.units[i].damage)
        .toFixed(0)
        .padStart(6)}   soins ${avg(r => r.units[i].healing)
        .toFixed(0)
        .padStart(6)}   DPS ${avg(r => r.units[i].damage / r.sec)
        .toFixed(0)
        .padStart(4)}`
    );
  }
}
module.exports = { duel };
