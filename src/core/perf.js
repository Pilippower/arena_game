'use strict';
// Mesure des performances et qualité adaptative (docs/SPEC.md).
// ?fps=1 affiche un compteur : images/s, temps CPU de chaque couche de rendu, pas de simulation par image.
// PERF.scale réduit la résolution des trois canevas (décor, effets, personnages) si le jeu passe sous 50 images/s ;
// si la baisse n'aide pas (limite CPU, pas carte graphique), la résolution d'avant est rendue et ne bouge plus.
const PERF = {
  scale: 1,
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
function perfFrame(dt, steps) {
  const A = PERF.acc,
    playing = !!state?.units && !state.ended && $('overlay').style.display === 'none';
  // onglet en arrière-plan ou lobby : on ne mesure pas
  if (dt > 0.25 || !playing) {
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
  const t = now();
  if (PERF.locked || t - PERF.lastChange < 4) return;
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
  if (PERF.fps < 50 && PERF.scale > 0.56) {
    PERF.tried = { scale: PERF.scale, fps: PERF.fps };
    PERF.scale = Math.max(0.55, PERF.scale - 0.15);
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
