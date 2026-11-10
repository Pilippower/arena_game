'use strict';
// Mesure des performances et qualité adaptative (docs/SPEC.md).
// ?fps=1 affiche un compteur : images/s, temps CPU de chaque couche de rendu, pas de simulation par image.
// PERF.scale réduit la résolution des canevas si le jeu passe sous PERF_RULES.low images/s ; si la baisse n'aide pas
// (limite CPU, pas carte graphique), la résolution d'avant est rendue et ne bouge plus. 10/11/2026 (« les graphismes
// ont chuté ») : la résolution ne remontait jamais et survivait d'une partie à l'autre ; or juste après le chargement
// du monde PVE le jeu passe quelques secondes à ~50 images/s, et l'aventure laissait l'image floue jusqu'à F5, arène
// comprise. Désormais : 100 % au début de chaque partie (perfReset, appelé par prepareMatch), rien de mesuré pendant
// le chargement ni les PERF_RULES.warmup s qui suivent, et un palier regagné au-dessus de PERF_RULES.high images/s
// (jamais au-dessus d'une résolution qui a déjà fait tomber sous low : pas de va-et-vient).
const PERF_RULES = { low: 50, high: 70, step: 0.15, min: 0.55, warmup: 4, settle: 4 };
const PERF = {
  scale: 1,
  cap: 1, // résolution la plus haute permise (abaissée quand une remontée a fait ramer)
  raised: false, // dernier changement = une remontée
  warmUntil: 0,
  locked: false,
  show: new URLSearchParams(location.search).get('fps') === '1',
  t: {},
  acc: { n: 0, time: 0, steps: 0, t: {} },
  fps: 0,
  lastChange: 0,
  tried: null,
  el: null
};
function perfTime(label, fn) {
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    PERF.acc.t[label] = (PERF.acc.t[label] || 0) + performance.now() - t0;
  }
}
// Début d'une partie (prepareMatch, core/loading.js) : pleine résolution, mesures reprises après le chargement.
function perfReset() {
  Object.assign(PERF, { scale: 1, cap: 1, raised: false, locked: false, tried: null, lastChange: now() });
  PERF.acc = { n: 0, time: 0, steps: 0, t: {} };
}
function perfFrame(dt, steps) {
  const A = PERF.acc,
    playing = !!state?.units && !state.ended && $('overlay').style.display === 'none';
  if (state?.loading) PERF.warmUntil = now() + PERF_RULES.warmup; // shaders, textures : images lentes sans signification
  // onglet en arrière-plan, lobby, chargement : on ne mesure pas
  if (dt > 0.25 || !playing || now() < PERF.warmUntil) {
    PERF.acc = { n: 0, time: 0, steps: 0, t: {} };
    return;
  }
  A.n++;
  A.time += dt;
  A.steps += steps;
  if (A.time < 2) return;
  PERF.fps = A.n / A.time;
  PERF.t = Object.fromEntries(Object.entries(A.t).map(([k, v]) => [k, v / A.n]));
  PERF.steps = A.steps / A.n;
  PERF.acc = { n: 0, time: 0, steps: 0, t: {} };
  perfAdapt();
  if (PERF.show) perfShow();
}
function perfAdapt() {
  const t = now(),
    R = PERF_RULES;
  if (PERF.locked || t - PERF.lastChange < R.settle) return;
  if (PERF.tried) {
    // la baisse précédente n'a pas fait gagner au moins 8 % : on revient en arrière et on arrête
    if (PERF.fps < PERF.tried.fps * 1.08) {
      PERF.scale = PERF.tried.scale;
      PERF.locked = true;
    }
    PERF.tried = null;
    PERF.lastChange = t;
    return;
  }
  if (PERF.fps < R.low && PERF.scale > R.min + 0.01) {
    PERF.tried = { scale: PERF.scale, fps: PERF.fps };
    PERF.scale = Math.max(R.min, PERF.scale - R.step);
    if (PERF.raised) PERF.cap = PERF.scale; // la remontée faisait ramer : on n'y retourne plus
    PERF.raised = false;
    PERF.lastChange = t;
  } else if (PERF.fps > R.high && PERF.scale < PERF.cap - 0.01) {
    PERF.scale = Math.min(PERF.cap, PERF.scale + R.step);
    PERF.raised = true;
    PERF.lastChange = t;
  }
}
function perfShow() {
  if (!PERF.el) {
    PERF.el = document.createElement('div');
    PERF.el.id = 'perfMeter';
    PERF.el.style.cssText =
      'position:fixed;left:8px;top:64px;z-index:50;font:12px/1.35 monospace;color:#cfe;background:#000a;padding:4px 7px;border-radius:4px;pointer-events:none;white-space:pre';
    document.body.appendChild(PERF.el);
  }
  const ms = k => (PERF.t[k] || 0).toFixed(1);
  PERF.el.textContent =
    `FPS ${PERF.fps.toFixed(0)}  sim ${PERF.steps.toFixed(1)} steps/frame\n` +
    `CPU ms  env ${ms('env')}  world ${ms('world')}  heroes ${ms('heroes')}\n` +
    `resolution ${Math.round(PERF.scale * 100)}%${PERF.locked ? ' (locked)' : ''}`;
}
