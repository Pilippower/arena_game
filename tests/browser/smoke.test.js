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
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => ({
      env: ENV.ok,
      kits: state.units.filter(u => HF.records.get(u.id)?.kit).length,
      advanced: state.prep < GATE_TIME || state.elapsed > 0.5, // préparation dans les salles de départ, puis combat
      mapOk: ArenaEnv.mapId === MAP_ID && MAP_ID === 'bridge' && arena.pillars.length === MAPS.bridge.pillars.length
    }));
    assert.equal(r.mapOk, true, 'décor et obstacles de la même carte');
    assert.equal(r.env, true, 'décor 3D chargé');
    assert.equal(r.kits, 6, '6 personnages assemblés');
    assert.ok(r.advanced, 'la simulation avance');
    assert.deepEqual(errors, [], 'erreurs JS');
    console.log('OK - partie lancée, décor + 6 personnages, aucune erreur');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
