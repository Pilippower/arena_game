'use strict';
// Mode PVE dans le navigateur (~20 s) : onglet PvE du lobby, aventure lancée (monde, relief, monstres chargés), puis
// retour au lobby et partie d'arène : la carte PvP, son décor et son sol plat reviennent tels quels (aucune régression).
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
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '?gates=0');
    await page.waitForFunction(() => typeof lobbyMode === 'function' && $('playBtn'));
    // lobby : onglet PvE, réglages d'arène masqués, Play lance l'aventure
    const lobby = await page.evaluate(() => {
      $('tabPve').click();
      document.querySelector('.racePick[data-r="dwarf"]').click();
      document.querySelector('.classPick[data-c="oracle"]').click();
      const shown = id => getComputedStyle($(id)).display !== 'none';
      const r = {
        pve: lobbyIsPve(),
        sizes: shown('sizeChoices'),
        maps: shown('mapChoices'),
        card: shown('pveChoices'),
        multi: shown('tabMulti'),
        chips: $('lobbyChips').textContent
      };
      $('playBtn').click();
      return r;
    });
    assert.deepEqual(
      { ...lobby, chips: undefined },
      { pve: true, sizes: false, maps: false, card: true, multi: true, chips: undefined },
      'onglet PvE : carte de l’aventure, sans format ni arènes, avec le multijoueur (groupe de 5)'
    );
    assert.match(lobby.chips, /PvE[\s\S]*The Mistvale Road/, 'récapitulatif de l’aventure');
    await page.waitForFunction(
      () => state?.pve && state.units.every(u => HF.records.get(u.id)?.loaded) && !state.loading,
      null,
      {
        timeout: 120000
      }
    );
    await page.waitForTimeout(800);
    const pve = await page.evaluate(() => {
      const p = state.player,
        W = PVE_WORLD;
      pvePlace(p, W.roadX(110), 110, 0); // sur la colline
      return {
        map: ArenaEnv.mapId,
        monsters: state.units.filter(u => u.monster).length,
        cls: p.cls,
        relief: arena.heightAt === W.heightAt,
        walls: arena.walls.length === W.walls.length,
        bodyPve: document.body.classList.contains('pve'),
        hud: $('round').textContent
      };
    });
    await page.waitForTimeout(400);
    const onHill = await page.evaluate(() =>
      Math.abs(state.player.y - PVE_WORLD.heightAt(state.player.x, state.player.z))
    );
    assert.equal(pve.map, 'pve', 'décor du monde PVE');
    assert.ok(pve.monsters >= 15, 'camps de monstres');
    assert.equal(pve.cls, 'oracle', 'héros choisi au lobby');
    assert.ok(pve.relief && pve.bodyPve, 'relief et interface PVE');
    assert.ok(pve.walls, 'murs du château');
    assert.ok(onHill < 0.05, 'héros posé sur le relief');
    assert.notEqual(pve.hud, 'Round 1 / 3', 'cadre du bas : objectif de l’aventure');
    // écran de fin : tableau des héros triable comme en arène (clic sur Healing, puis second clic = ordre inverse)
    const sorted = await page.evaluate(() => {
      const hero = (slot, name, damage, healing, kills) => ({ slot, name, damage, healing, kills });
      pveShowEnd({
        time: 75,
        deaths: 1,
        heroes: [hero(0, 'Host', 900, 100, 3), hero(1, 'Ann', 300, 2500, 0), hero(2, 'Bob', 1500, 0, 5)]
      });
      const names = () => [...document.querySelectorAll('#resultsTeams tbody .rName')].map(td => td.textContent);
      const order = [names()];
      document.querySelector('#resultsTeams [data-sort="healing"]').click();
      order.push(names());
      document.querySelector('#resultsTeams [data-sort="healing"]').click();
      order.push(names());
      hideResults();
      return order;
    });
    assert.deepEqual(
      sorted,
      [
        ['Bob', 'You', 'Ann'],
        ['Ann', 'You', 'Bob'],
        ['Bob', 'You', 'Ann']
      ],
      'fin d’aventure : tri par dégâts, puis soins, puis soins inversés'
    );
    // retour au lobby puis arène : tout redevient comme avant
    const back = await page.evaluate(() => {
      leaveMatch();
      $('tabPvp').click();
      const r = {
        heightAt: arena.heightAt,
        world: arena.world,
        walls: arena.walls,
        bodyPve: document.body.classList.contains('pve'),
        pillars: arena.pillars.filter(p => p.kind !== 'rampPost').length === MAPS[MAP_ID].pillars.length,
        maps: getComputedStyle($('mapChoices')).display !== 'none'
      };
      $('playBtn').click();
      return r;
    });
    assert.deepEqual(
      back,
      { heightAt: null, world: null, walls: null, bodyPve: false, pillars: true, maps: true },
      'lobby : carte d’arène et interface PvP rétablies'
    );
    await page.waitForFunction(() => state?.units?.length === 6 && !state.loading, null, { timeout: 120000 });
    const arenaRun = await page.evaluate(() => ({
      map: ArenaEnv.mapId === MAP_ID,
      pve: !!state.pve,
      flat: state.units.every(u => (u.y || 0) === 0),
      monsters: state.units.some(u => u.monster)
    }));
    assert.deepEqual(
      arenaRun,
      { map: true, pve: false, flat: true, monsters: false },
      'partie d’arène normale après le PVE'
    );
    assert.deepEqual(errors, [], 'erreurs JS');
    console.log('OK - PVE : lobby, monde, monstres, retour à l’arène sans régression');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
