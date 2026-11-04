'use strict';
// Rapport d'équilibrage (IA Medium des deux côtés, vrai code du jeu via tools/duel.js, quelques minutes) :
//  1. matrice 1v1 : victoires de chaque classe contre chaque autre (côtés alternés), DPS / HPS moyens ;
//  2. 3v3 : chaque classe X jouée dans [X, DPS au hasard, prêtre] contre [DPS, DPS, prêtre] au hasard.
// Usage : node tools/balance.js [duels par paire=12] [matchs 3v3 par classe=20]
// Marge d'erreur : environ ±10 % avec ces nombres (l'IA tire au hasard) ; augmenter pour trancher un écart serré.
const { duel } = require('./duel.js');

const CL = ['sentinel', 'reaver', 'shade', 'warden', 'arcanist', 'warlock', 'oracle'];
const DPS = CL.filter(c => c !== 'oracle');
const NAME = {
  sentinel: 'Guerrier',
  reaver: 'DK',
  shade: 'Voleur',
  warden: 'Druide',
  arcanist: 'Mage',
  warlock: 'Démo',
  oracle: 'Prêtre'
};
const avg = l => l.reduce((s, v) => s + v, 0) / (l.length || 1);
const pct = v => Math.round(v * 100) + '%';

function matrix(n, tweak) {
  const win = Object.fromEntries(CL.map(c => [c, {}])),
    dps = Object.fromEntries(CL.map(c => [c, []])),
    hps = Object.fromEntries(CL.map(c => [c, []]));
  for (let i = 0; i < CL.length; i++)
    for (let j = i + 1; j < CL.length; j++) {
      const [a, b] = [CL[i], CL[j]];
      let w = 0;
      for (let k = 0; k < n; k++) {
        const flip = k % 2 === 1,
          r = flip ? duel([b], [a], 180, tweak) : duel([a], [b], 180, tweak);
        if (flip ? !r.winA : r.winA) w++;
        for (const u of r.units) {
          dps[u.cls].push(u.damage / r.sec);
          hps[u.cls].push(u.healing / r.sec);
        }
      }
      win[a][b] = w / n;
      win[b][a] = 1 - w / n;
    }
  return { win, dps, hps };
}

function teams(n, tweak) {
  const pick = () => DPS[Math.floor(Math.random() * DPS.length)];
  return DPS.map(x => {
    const runs = Array.from({ length: n }, () => duel([x, pick(), 'oracle'], [pick(), pick(), 'oracle'], 180, tweak));
    return {
      cls: x,
      win: avg(runs.map(r => (r.winA ? 1 : 0))),
      dps: avg(runs.map(r => r.units[0].damage / r.sec)),
      deaths: avg(runs.map(r => (r.units[0].alive ? 0 : 1)))
    };
  });
}

if (require.main === module) {
  const [n1 = '12', n3 = '20'] = process.argv.slice(2);
  const M = matrix(+n1);
  console.log(`1v1 — victoires (ligne contre colonne), ${n1} duels par paire :`);
  console.log(''.padEnd(9) + CL.map(c => NAME[c].padStart(9)).join('') + 'Moyenne'.padStart(9));
  for (const a of CL)
    console.log(
      NAME[a].padEnd(9) +
        CL.map(b => (a === b ? '-' : pct(M.win[a][b])).padStart(9)).join('') +
        pct(avg(CL.filter(b => b !== a).map(b => M.win[a][b]))).padStart(9)
    );
  console.log('\n1v1 — DPS / HPS moyens :');
  for (const c of CL)
    console.log(
      `  ${NAME[c].padEnd(9)} DPS ${avg(M.dps[c]).toFixed(0).padStart(4)}   HPS ${avg(M.hps[c]).toFixed(0).padStart(4)}`
    );
  console.log(`\n3v3 — [classe, DPS au hasard, prêtre] contre [DPS, DPS, prêtre], ${n3} matchs par classe :`);
  for (const t of teams(+n3))
    console.log(
      `  ${NAME[t.cls].padEnd(9)} victoires ${pct(t.win).padStart(4)}   DPS ${t.dps.toFixed(0).padStart(4)}   meurt ${pct(t.deaths).padStart(4)}`
    );
}
module.exports = { matrix, teams };
