'use strict';
// Tests unitaires du mode PVE (src/pve/world.js, src/pve/pve.js) : le vrai code du jeu (combat, IA, sim) + le monde
// PVE, sans DOM ni rendu. On vérifie le résultat : relief suivi, monstres au repos puis en alerte par camp, retour au
// camp, mort et retour au feu de camp, régénération, victoire ; et que l'arène PvP ne change pas (terrain plat).
const assert = require('node:assert/strict');
const { combatWorld, run } = require('./combat_world.js');

// Monde PVE chargé dans le monde de combat, partie lancée avec un héros de la classe donnée.
function pveWorld(cls = 'sentinel') {
  const w = combatWorld();
  const { ctx } = w;
  Object.assign(ctx, {
    camera: { yaw: 0, pitch: 0 },
    HF: { enabled: false },
    prepareMatch() {},
    pveUiStart() {},
    pveUiStop() {},
    hideResults() {},
    playGameMusic() {},
    pveShowEnd: () => (ctx.endShown = true)
  });
  w.load('src/pve/world.js');
  w.load('src/pve/pve.js');
  ctx.Math.random = () => 0.5;
  ctx.pveStart(cls, 'human');
  const p = ctx.state.player,
    W = ctx.PVE_WORLD,
    camp = id => ctx.state.units.filter(u => u.monster?.camp === id);
  return { ...w, p, W, camp };
}
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} (${a} ≠ ${b})`);

// ---------- Monde : route dégagée, colline du château, obstacles posés sur le relief ----------
{
  const { ctx, W } = pveWorld();
  near(W.heightAt(W.start.x, W.start.z), 0, 0.5, 'départ dans la vallée');
  assert.ok(W.heightAt(W.gate.x, W.gate.z) > 12, 'porte du château en haut de la colline');
  for (let z = W.start.z; z < W.gate.z; z += 1) {
    const x = W.roadX(z);
    assert.ok(ctx.pointWalkable(x, z), `route praticable en z = ${z}`);
  }
  assert.ok(W.obstacles.length > 80, 'arbres et rochers dans la vallée');
  assert.ok(
    W.obstacles.every(o => o.h > o.base && Math.abs(o.base - W.heightAt(o.x, o.z)) < 1e-6),
    'obstacles posés sur le relief (hauteur absolue au-dessus de leur pied)'
  );
  for (const c of [...W.camps, ...W.checkpoints])
    assert.ok(ctx.pointWalkable(c.x, c.z, 0.3), `camp / feu libre d'obstacle (${c.x.toFixed(1)}, ${c.z})`);
  assert.equal(W.camps.filter(c => c.boss).length, 1, 'un gardien à la porte');
  assert.equal(ctx.arena.heightAt, W.heightAt, 'le monde PVE remplace la carte d’arène');
}

// ---------- Relief : on marche sur le terrain (montée de la colline) ----------
{
  const { ctx, p, W } = pveWorld();
  const z0 = 100;
  ctx.pvePlace(p, W.roadX(z0), z0, 0);
  p.moving = true;
  ctx.playerMove = dt => {
    p.z += 7 * dt;
    p.x = W.roadX(p.z);
  };
  for (const u of ctx.state.units) if (u.monster && !u.monster.boss) u.alive = false; // route libre
  run(ctx, 2);
  near(p.y, W.heightAt(p.x, p.z), 0.06, 'pieds sur le relief en montée');
  assert.ok(p.grounded, 'toujours au sol en montant');
  assert.ok(p.y > W.heightAt(W.roadX(z0), z0) + 2, 'on a bien monté la colline');
}

// ---------- Monstres : repos, alerte de tout le camp, les autres camps ne bougent pas ----------
{
  const { ctx, p, camp, W } = pveWorld();
  const c1 = camp(1),
    c2 = camp(2),
    home = c1.map(u => [u.x, u.z]);
  run(ctx, 2);
  assert.ok(
    c1.every((u, i) => u.monster.mode === 'idle' && u.x === home[i][0] && u.z === home[i][1]),
    'joueur loin : camp au repos, immobile'
  );
  const C = W.camps[1];
  ctx.pvePlace(p, C.x, C.z - 9, 0);
  run(ctx, 0.5);
  assert.ok(
    c1.every(u => u.monster.mode === 'fight' && u.target === p),
    'joueur repéré : tout le camp attaque'
  );
  assert.ok(
    c2.every(u => u.monster.mode === 'idle'),
    'le camp suivant reste au repos'
  );
  const hp0 = p.hp;
  run(ctx, 6);
  assert.ok(p.hp < hp0, 'les monstres frappent le joueur');
}

// ---------- Monstre attaqué de loin : il réagit avec son camp ----------
{
  const { ctx, p, camp, W } = pveWorld('arcanist');
  const [m, other] = camp(1),
    C = W.camps[1];
  ctx.pvePlace(p, C.x, C.z - 28, 0);
  ctx.damage(p, m, 10, false, 'frost');
  run(ctx, 0.2);
  assert.equal(m.monster.mode, 'fight', 'blessé : il attaque');
  assert.equal(other.monster.mode, 'fight', 'son camp aussi');
}

// ---------- Retour au camp : trop loin de chez lui, le monstre rentre et se soigne ----------
{
  const { ctx, p, camp } = pveWorld();
  const [m] = camp(0),
    H = m.monster.home;
  ctx.pveEngage(0);
  ctx.pvePlace(m, H.x, H.z + 45, 0);
  m.hp = m.maxHp * 0.4;
  ctx.pvePlace(p, H.x, H.z + 47, 0);
  run(ctx, 0.1);
  assert.equal(m.monster.mode, 'reset', 'entraîné trop loin : retour au camp');
  run(ctx, 12);
  assert.equal(m.monster.mode, 'idle', 'rentré au camp');
  near(m.x, H.x, 0.7, 'à sa place (x)');
  near(m.z, H.z, 0.7, 'à sa place (z)');
  assert.equal(m.hp, m.maxHp, 'PV restaurés au retour');
}

// ---------- Mort du joueur : retour au dernier feu de camp, camps qui rentrent ----------
{
  const { ctx, p, camp, W } = pveWorld();
  const F = W.checkpoints[1];
  ctx.pvePlace(p, F.spawn.x, F.spawn.z, 0);
  run(ctx, 0.1);
  assert.equal(ctx.state.pve.checkpoint, 1, 'feu de camp atteint : nouveau point de reprise');
  const C = W.camps[2];
  ctx.pvePlace(p, C.x, C.z - 6, 0);
  run(ctx, 0.5);
  const foes = camp(2);
  assert.ok(
    foes.every(u => u.monster.mode === 'fight'),
    'camp en combat'
  );
  ctx.damage(foes[0], p, 1e6);
  assert.equal(p.alive, false, 'joueur mort');
  run(ctx, 1);
  assert.ok(
    foes.every(u => u.monster.mode !== 'fight'),
    'joueur mort : le camp rentre'
  );
  assert.equal(ctx.state.pve.deaths, 1, 'une chute comptée');
  run(ctx, 3.5);
  assert.ok(p.alive && p.hp === p.maxHp, 'de retour, en pleine forme');
  near(p.x, F.spawn.x, 0.01, 'au dernier feu de camp (x)');
  near(p.z, F.spawn.z, 0.01, 'au dernier feu de camp (z)');
  near(p.y, W.heightAt(p.x, p.z), 0.01, 'posé sur le sol');
  assert.equal(ctx.state.ended, false, 'la partie continue (pas de défaite en PVE)');
}

// ---------- Régénération hors combat, pas de dampening ----------
{
  const { ctx, p } = pveWorld();
  ctx.state.elapsed = 300;
  run(ctx, 0.1);
  assert.equal(ctx.state.dampening, 0, 'PVE : pas de dampening (soins pleins)');
  p.hp = p.maxHp * 0.3;
  p.lastCombat = ctx.clock;
  run(ctx, 4);
  near(p.hp, p.maxHp * 0.3, 1, 'en combat (moins de 5 s) : pas de régénération');
  run(ctx, 6);
  assert.ok(p.hp > p.maxHp * 0.5, 'hors combat : les PV remontent vite');
}

// ---------- Victoire : le gardien de la porte vaincu ----------
{
  const { ctx, p } = pveWorld();
  const boss = ctx.state.units.find(u => u.monster?.boss);
  assert.ok(boss.maxHp > ctx.CLASS[boss.cls].hp, 'gardien plus résistant qu’un héros');
  assert.ok(boss.scale > 1, 'gardien plus grand');
  ctx.damage(p, boss, 1e7);
  run(ctx, 0.1);
  assert.equal(ctx.state.pve.won, true, 'victoire');
  assert.equal(ctx.state.ended, true, 'aventure terminée');
  assert.equal(ctx.statOf(p).kills, 1, 'élimination comptée');
}

// ---------- Monstres : forme de bête gardée, dégâts réduits ----------
{
  const { ctx, camp, p } = pveWorld();
  const [cat] = camp(0);
  assert.equal(cat.form, 'cat', 'Mistfang Prowler : forme de félin');
  ctx.pveEngage(0);
  ctx.pvePlace(p, cat.x, cat.z + 2, 0);
  ctx.Math.random = () => 0.1; // un druide d'arène blessé passerait en ours
  cat.hp = cat.maxHp * 0.3;
  run(ctx, 1);
  assert.equal(cat.form, 'cat', 'jamais de changement de forme (aiSpecial)');
  assert.ok(cat.aiDmg < 1, 'monstre moins dangereux qu’un héros d’arène');
  assert.ok(cat.aiP.trinket === 0, 'monstre sans bijou');
}

// ---------- TAB : monstres proches et visibles, du plus proche au plus loin ----------
{
  const { ctx, p, camp, W } = pveWorld();
  const C = W.camps[0];
  ctx.pvePlace(p, C.x, C.z - 8, 0);
  const tab = ctx.tabTargets(p);
  assert.deepEqual(
    tab.map(u => u.monster.camp),
    camp(0).map(() => 0),
    'seulement le camp proche'
  );
  assert.ok(ctx.d2(p, tab[0]) <= ctx.d2(p, tab[1]), 'le plus proche d’abord');
}

// ---------- Arène PvP inchangée : sol plat, pas de relief, TAB sur tous les ennemis, dampening ----------
{
  const { ctx, p } = pveWorld();
  ctx.applyMap('castle'); // retour au lobby (pveLeave)
  assert.equal(ctx.arena.heightAt, null, 'carte d’arène : plus de relief');
  assert.equal(ctx.arena.world, null, 'carte d’arène : plus de monde PVE');
  assert.equal(ctx.terrainY(10, 10), 0, 'arène : sol à 0');
  ctx.state.fx = [];
  ctx.fx('ring', 3, 0.04, 3, [1, 1, 1]);
  assert.equal(ctx.state.fx[0].y, 0.04, 'arène : effets au sol inchangés');
  const w = combatWorld(),
    a = w.unit('sentinel', 0, 0, 0),
    e1 = w.unit('arcanist', 5, 0, 1),
    e2 = w.unit('oracle', 60, 0, 1);
  w.ctx.state.player = a;
  w.ctx.state.elapsed = 100;
  assert.deepEqual(w.ctx.tabTargets(a), [e1, e2], 'arène : TAB sur tous les ennemis, sans limite');
  run(w.ctx, 0.1);
  assert.ok(w.ctx.state.dampening > 0, 'arène : dampening actif');
  assert.equal(w.ctx.groundAt(a), 0, 'arène : sol plat');
  void p;
}
console.log('pve.test.js OK');
