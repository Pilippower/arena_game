'use strict';
// Boucle principale (simulation fixe + rendu) et démarrage.
const SIM_DT = 1 / 120,
  MAX_SIM_STEPS = 6;
let last = now(),
  simAccumulator = 0,
  fatal = false;
function loop() {
  if (fatal) return;
  try {
    const n = now(),
      frameDt = Math.min(0.05, n - last);
    last = n;
    simAccumulator += frameDt;
    let steps = 0;
    while (state && simAccumulator >= SIM_DT && steps < MAX_SIM_STEPS) {
      update(SIM_DT);
      simAccumulator -= SIM_DT;
      steps++;
    }
    if (steps === MAX_SIM_STEPS) simAccumulator = 0;
    renderAlpha = clamp(simAccumulator / SIM_DT, 0, 1);
    render();
    requestAnimationFrame(loop);
  } catch (err) {
    fatal = true;
    console.error(err);
    $('bootError').style.display = 'block';
    $('bootError').textContent = 'WebGL error: ' + (err?.message || String(err));
    $('overlay').style.display = 'flex';
  }
}
try {
  GameLogic.selfCheck();
  chooseClass();
  if (gl) {
    gl.enable(gl.DEPTH_TEST);
    loop();
  }
  const auto = new URLSearchParams(location.search).get('autoplay');
  const qd = new URLSearchParams(location.search).get('diff');
  const qm = new URLSearchParams(location.search).get('map');
  if (qm && MAPS[qm]) applyMap(qm);
  if (qd && AI_PROFILES[qd]) DIFFICULTY = qd;
  if (auto && CLASS[auto]) {
    const ar = new URLSearchParams(location.search).get('race');
    state = { pcls: auto, prace: RACE[ar] ? ar : raceForClass(auto), scoreA: 0, scoreB: 0, round: 0 };
    $('overlay').style.display = 'none';
    resetRound();
  }
} catch (err) {
  console.error(err);
  $('bootError').style.display = 'block';
  $('bootError').textContent = 'Startup error: ' + (err?.message || String(err));
  $('overlay').style.display = 'flex';
}
