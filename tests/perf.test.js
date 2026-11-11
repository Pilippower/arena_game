'use strict';
// Tests unitaires de la qualité adaptative (src/core/perf.js) : le vrai code, horloge et images/s simulées. On vérifie
// la résolution obtenue : baisse sous PERF_RULES.low, rien pendant le chargement ni juste après, 100 % au début de
// chaque partie, palier regagné quand le jeu est fluide, pas de va-et-vient, arrêt si la baisse n'aide pas.
const assert = require('node:assert/strict');
const { sandbox } = require('./sources.js');

function perfWorld() {
  const S = sandbox({
    location: { search: '' },
    URLSearchParams,
    $: () => ({ style: { display: 'none' } }), // lobby fermé : on joue
    now: () => S.ctx.clock,
    PREFS: { quality: 'high' },
    devicePixelRatio: 1
  });
  S.ctx.clock = 100;
  S.ctx.state = { units: [], ended: false, loading: false };
  S.load('src/core/perf.js');
  const { ctx } = S;
  // `sec` secondes de jeu à `fps` images/s
  ctx.play = (fps, sec) => {
    for (let k = 0; k < fps * sec; k++) {
      ctx.clock += 1 / fps;
      ctx.perfFrame(1 / fps, 1);
    }
  };
  return ctx;
}

// Chargement puis quelques secondes lentes (shaders, textures) : la résolution ne bouge pas.
{
  const c = perfWorld();
  c.state.loading = true;
  c.play(20, 5);
  c.state.loading = false;
  c.play(45, c.PERF_RULES.warmup - 0.5);
  assert.equal(c.PERF.scale, 1, 'chargement et ses suites : pas de baisse');
  c.play(45, 6);
  assert.ok(c.PERF.scale < 1, 'vraie lenteur ensuite : la résolution baisse');
}
// Baisse, puis jeu fluide : la résolution remonte jusqu'à 100 %.
{
  const c = perfWorld();
  c.play(40, 3);
  assert.equal(c.PERF.scale, 0.85, 'sous 50 images/s : un palier de moins');
  c.play(60, 5); // la baisse a aidé : gardée
  c.play(80, 10);
  assert.equal(c.PERF.scale, 1, 'au-dessus de 70 images/s : retour à 100 %');
}
// Remontée qui fait ramer : retour au palier d'avant, plus de nouvelle remontée (pas de va-et-vient).
{
  const c = perfWorld();
  c.play(40, 3); // 85 %
  c.play(80, 5); // la baisse a aidé ; puis remontée à 100 %
  c.play(80, 5);
  assert.equal(c.PERF.scale, 1, 'remonté');
  c.play(45, 5); // à 100 % ça rame
  assert.equal(c.PERF.scale, 0.85, 'redescendu');
  c.play(80, 30);
  assert.equal(c.PERF.scale, 0.85, 'ne remonte plus à une résolution qui ramait');
}
// Nouvelle partie : pleine résolution, quelle que soit la précédente.
{
  const c = perfWorld();
  c.play(30, 3);
  c.play(40, 5); // la baisse a aidé : gardée
  assert.ok(c.PERF.scale < 1, 'partie lente : résolution basse');
  c.perfReset();
  assert.equal(c.PERF.scale, 1, 'nouvelle partie : 100 %');
  assert.equal(c.PERF.locked, false, 'et de nouveau adaptable');
}
// Baisse sans effet (limite du processeur) : résolution d'avant rendue, puis plus rien ne bouge.
{
  const c = perfWorld();
  c.play(40, 3);
  c.play(40, 5);
  assert.equal(c.PERF.scale, 1, 'baisse inutile : annulée');
  assert.ok(c.PERF.locked, 'et figée');
  c.play(30, 10);
  assert.equal(c.PERF.scale, 1, 'plus de baisse');
}
// Réglage Graphics quality : pixels calculés par point d'écran (renderRatio), High = rendu validé jusqu'ici.
{
  const c = perfWorld(),
    at = (q, dpr, cap, adaptive) => ((c.PREFS.quality = q), (c.devicePixelRatio = dpr), c.renderRatio(cap, adaptive));
  for (const dpr of [1, 1.25, 2, 3])
    for (const cap of [1.5, 1.8, 2])
      assert.equal(at('high', dpr, cap), Math.min(cap, dpr), `High = rendu d'avant (écran ×${dpr}, plafond ${cap})`);
  assert.equal(at('ultra', 1, 1.8), 1.5, 'Ultra : image 1,5 fois plus fine que l’écran');
  assert.equal(at('ultra', 3, 2), 3, 'Ultra : 3 pixels par point au plus');
  assert.equal(at('low', 1, 1.8), 0.75, 'Low : image plus légère');
  assert.equal(at('medium', 2, 1.8), 1.8, 'Medium : pleine résolution');
  assert.equal(at('inconnu', 1, 1.8), 1, 'niveau inconnu (réglage abîmé) : High');
  c.PERF.scale = 0.7;
  assert.equal(at('high', 1, 1.8), 0.7, 'qualité adaptative appliquée');
  assert.equal(at('high', 1, 1.5, false), 1, 'décor : pas de qualité adaptative');
  assert.deepEqual(
    Object.keys(c.QUALITY),
    ['low', 'medium', 'high', 'ultra'],
    'quatre niveaux, du plus léger au plus beau'
  );
}
console.log(
  'OK - qualité adaptative (tests unitaires : chargement ignoré, baisse, remontée, pas de va-et-vient, nouvelle partie, réglage Qualité)'
);
