'use strict';
// Test rapide (~15 s) : une partie démarre, le décor et les 6 personnages se chargent, la simulation avance, aucune erreur JS.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launch } = require('./browser.js');
const ROOT = path.join(__dirname, '..', '..');
const isNoise = t => /Failed to load resource|net::ERR_|Failed to fetch|CORS/i.test(t);
(async () => {
  let browser;
  try {
    browser = await launch();
  } catch {
    browser = null;
  }
  if (!browser) return console.log('SKIP - navigateur ou playwright-core absent');
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && !isNoise(m.text()) && errors.push(m.text()));
    // carte mémorisée « bridge » : le décor doit suivre la carte de gameplay (bug : décor castle + obstacles bridge)
    await page.addInitScript(() => localStorage.setItem('arenaMap', 'bridge'));
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '?autoplay=warden&race=orc');
    await page.waitForFunction(() => state?.units?.every(u => HF.records.get(u.id)?.loaded), null, { timeout: 90000 });
    // la simulation avance (fin de l'écran de chargement : sa durée dépend de la charge de la machine)
    await page
      .waitForFunction(() => state.prep < GATE_TIME || state.elapsed > 0.5, null, { timeout: 30000 })
      .catch(() => {});
    const r = await page.evaluate(() => ({
      env: ENV.ok,
      post: ArenaEnv.postFx, // bloom + étalonnage du décor (PC)
      kits: state.units.filter(u => HF.records.get(u.id)?.kit).length,
      advanced: state.prep < GATE_TIME || state.elapsed > 0.5, // préparation dans les salles de départ, puis combat
      countdown: !(state.prep > 0) || $('gateCountdown').classList.contains('on'), // compte à rebours affiché
      inRooms: !(state.prep > 0) || state.units.every(u => zoneOf(u.x, u.z) === (u.team ? 1 : -1)),
      mapOk:
        ArenaEnv.mapId === MAP_ID &&
        MAP_ID === 'bridge' &&
        arena.pillars.filter(p => p.kind !== 'rampPost').length === MAPS.bridge.pillars.length
    }));
    assert.equal(r.mapOk, true, 'décor et obstacles de la même carte');
    assert.equal(r.env, true, 'décor 3D chargé');
    assert.equal(r.post, true, 'bloom et étalonnage du décor actifs sur PC');
    assert.equal(r.kits, 6, '6 personnages assemblés');
    assert.ok(r.advanced, 'la simulation avance');
    assert.ok(r.countdown && r.inRooms, 'préparation : équipes dans leurs salles, compte à rebours affiché');
    // réglage Graphics quality (core/perf.js, QUALITY) : High par défaut = rendu validé ; Ultra / Low appliqués au décor
    // en pleine partie (carte d'ombres recréée, halo coupé), boutons de Settings
    const q = await page.evaluate(async () => {
      const shot = () => ({
        name: quality().name,
        shadow: ArenaEnv.shadowSize,
        post: ArenaEnv.postFx,
        ratio: ArenaEnv.renderer.getPixelRatio()
      });
      const out = { start: shot() };
      for (const k of ['ultra', 'low', 'high']) {
        document.querySelector(`#qualityOpts [data-quality="${k}"]`).click();
        await new Promise(r => setTimeout(r, 300));
        out[k] = { ...shot(), selected: document.querySelector('#qualityOpts .selected')?.dataset.quality };
      }
      out.saved = JSON.parse(localStorage.getItem(PREF_KEY)).quality;
      return out;
    });
    assert.deepEqual(q.start, { name: 'High', shadow: 2048, post: true, ratio: 1 }, 'High par défaut : rendu validé');
    assert.equal(q.ultra.shadow, 4096, 'Ultra : ombres plus fines');
    assert.equal(q.ultra.ratio, 1.5, 'Ultra : image plus fine que l’écran');
    assert.equal(q.ultra.selected, 'ultra', 'bouton Ultra sélectionné');
    assert.deepEqual([q.low.shadow, q.low.post, q.low.ratio], [1024, false, 0.75], 'Low : ombres, halo, résolution');
    assert.equal(q.saved, 'high', 'choix gardé');
    assert.deepEqual(errors, [], 'erreurs JS');
    console.log('OK - partie lancée, décor + 6 personnages, aucune erreur');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
