'use strict';
// Tests unitaires du mode PVE (src/pve/world.js, src/pve/pve.js) : le vrai code du jeu (combat, IA, sim) + le monde
// PVE, sans DOM ni rendu. On vérifie le résultat : relief suivi, monstres au repos puis en alerte par camp, retour au
// camp, mort et retour au feu de camp, régénération, château (herse, murs, montée jusqu'au sommet), victoire sur le
// roi ; et que l'arène PvP ne change pas (terrain plat, pas de murs).
const assert = require('node:assert/strict');
const { combatWorld, pveCombatWorld, run } = require('./combat_world.js');

// Monde PVE chargé dans le monde de combat, partie lancée avec un héros de la classe donnée.
function pveWorld(cls = 'sentinel') {
  const w = pveCombatWorld(),
    { ctx } = w;
  ctx.pveStart(cls, 'human');
  const p = ctx.state.player,
    W = ctx.PVE_WORLD,
    camp = id => ctx.state.units.filter(u => u.monster?.camp === id);
  return { ...w, p, W, camp };
}
const AI_MELEE = (ctx, u) => !!ctx.AI_ROLE[u.cls]?.melee;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} (${a} ≠ ${b})`);

// ---------- Monde : route dégagée, colline du château, obstacles posés sur le relief ----------
{
  const { ctx, W } = pveWorld();
  near(W.heightAt(W.start.x, W.start.z), 0, 0.5, 'départ dans la vallée');
  assert.ok(W.heightAt(W.gate.x, W.gate.z) > 12, 'porte du château en haut de la colline');
  for (let z = W.start.z; z < W.gate.z - 2; z += 1) {
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
  assert.equal(
    JSON.stringify(W.camps.filter(c => c.boss).map(c => c.mobs)),
    JSON.stringify([['gatekeeper'], ['king']]),
    'un gardien à la porte, le roi au sommet'
  );
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
  for (const u of ctx.state.units) if (u.monster && u.monster.camp < 7) u.alive = false; // route libre
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

// ---------- Levier de la porte : tiré à portée, la herse se lève (le gardien ne l'ouvre plus en mourant) ----------
{
  const { ctx, p, W } = pveWorld();
  const keeper = ctx.state.units.find(u => u.monster?.type === 'gatekeeper'),
    L = W.lever,
    errors = [];
  ctx.showError = t => errors.push(t);
  assert.ok(keeper.maxHp > ctx.CLASS[keeper.cls].hp, 'gardien plus résistant qu’un héros');
  assert.ok(keeper.scale > 1, 'gardien plus grand');
  assert.ok(L.z < W.gate.z && Math.abs(L.x - W.gate.x) < 6, 'levier dehors, à côté de la porte');
  const walkNorth = () => {
    for (let k = 0; k < 60; k++) {
      p.z += 0.1;
      ctx.resolveWalls(p);
    }
  };
  ctx.pvePlace(p, 0, W.gate.z - 3, 0);
  walkNorth();
  assert.ok(p.z < W.gate.z, 'herse fermée : on ne passe pas');
  ctx.damage(p, keeper, 1e7);
  run(ctx, 0.1);
  assert.equal(ctx.state.pve.gateOpen, false, 'gardien vaincu : la herse reste fermée');
  ctx.pvePlace(p, L.x, L.z - L.reach - 3, 0);
  assert.equal(ctx.pveUseLever(p), false, 'trop loin du levier : rien');
  assert.deepEqual(errors, ['Too far away']);
  assert.equal(ctx.state.pve.gateOpen, false);
  ctx.pvePlace(p, L.x, L.z - L.reach + 1, 0);
  assert.equal(ctx.pveUseLever(p), true, 'à portée : le levier est tiré');
  assert.equal(ctx.state.pve.gateOpen, true, 'herse levée');
  assert.equal(ctx.pveUseLever(p), false, 'déjà levée : plus rien');
  assert.equal(ctx.state.pve.won, false, 'pas encore la victoire');
  assert.equal(ctx.state.ended, false, 'l’aventure continue');
  ctx.pvePlace(p, 0, W.gate.z - 3, 0);
  walkNorth();
  assert.ok(p.z > W.gate.z + 2, 'herse levée : on entre dans la cour');
}

// ---------- Régression : le décor lisait window.state (toujours vide : state est un let de core/webgl.js), la herse ne
// se levait jamais à l'écran et l'ombre de la lune ne suivait pas le joueur ----------
{
  const { code } = require('./sources.js');
  assert.ok(!/window\.state\b/.test(code('src/')), 'lire state directement, jamais window.state');
}

// ---------- Musique : celle du monde PVE dans le monde PVE, celle de l'arène ailleurs (src/audio/tracks.js) ----------
{
  const { sandbox } = require('./sources.js');
  const played = [];
  class FakeAudio {
    constructor(src) {
      Object.assign(this, { src, paused: true, volume: 0, readyState: 1, duration: 600, currentTime: 0 });
    }
    addEventListener() {}
    play() {
      this.paused = false;
      played.push(this.src.split('?')[0]);
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  const S = sandbox({
    Audio: FakeAudio,
    document: { readyState: 'complete', addEventListener() {} },
    window: { addEventListener() {} },
    performance: { now: () => 0 },
    setInterval: () => 0,
    clearInterval() {},
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    PREFS: { volume: 1, musicOn: true },
    musicStopProcedural() {},
    musicStartProcedural() {}
  });
  S.load('src/audio/tracks.js');
  S.ctx.state = { pve: {} };
  S.ctx.playGameMusic();
  S.ctx.state = { pve: null };
  S.ctx.playGameMusic();
  assert.deepEqual(played.slice(-2), ['assets/audio/pve.mp3', 'assets/audio/game.mp3'], 'musique selon le mode');
}

// ---------- Château : murs pleins, portes à leur largeur, ligne de vue coupée, parapets plus hauts qu'un saut ----------
{
  const { ctx, W } = pveWorld();
  const C = W.castle,
    u = { x: 12, z: 191.2, y: C.base };
  ctx.resolveWalls(u);
  assert.ok(u.z < 190 - 0.5, 'poussé hors du mur de la grande salle, côté cour');
  assert.ok(ctx.pointWalkable(2.3, 191.5, 0.6, C.base), 'porte de la salle : toute sa largeur');
  assert.ok(!ctx.pointWalkable(3.5, 191.5, 0.6, C.base), 'montant de la porte : plein');
  const yard = { x: 10, z: 185, y: C.base },
    hall = { x: 10, z: 197, y: C.base },
    door = { x: 0, z: 197, y: C.base };
  assert.equal(ctx.los(yard, hall), false, 'le mur coupe la vue entre la cour et la salle');
  assert.equal(ctx.los({ ...yard, x: 0 }, door), true, 'vue par la porte ouverte');
  const jump = C.gallery + 1.5; // au plus haut d'un saut sur la galerie
  assert.ok(ctx.wallAt(-24.5, 255, 0.6, jump), 'parapet de la galerie : on ne saute pas par-dessus');
  assert.ok(ctx.wallAt(0, 304, 0.6, C.summit + 1.5), 'parapet du sommet : on ne saute pas par-dessus');
}

// ---------- Montée : de la porte au sommet du donjon, par la cour, la salle et les deux escaliers ----------
{
  const { ctx, p, W } = pveWorld();
  const C = W.castle,
    path = [
      [0, 160],
      [0, 205],
      [0, 220],
      [0, 249],
      [0, 263.5],
      [0, 286],
      [0, 292]
    ];
  ctx.state.pve.gateOpen = true;
  for (const w of ctx.arena.walls) if (w.gate) w.open = true;
  for (const u of ctx.state.units) if (u.monster && !W.mobs[u.monster.type].boss) u.alive = false;
  for (let i = 1; i < path.length; i++)
    for (let t = 0; t <= 1; t += 0.02) {
      const x = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        z = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t;
      assert.ok(ctx.pointWalkable(x, z, 0.68, W.heightAt(x, z)), `chemin praticable en (${x}, ${z.toFixed(1)})`);
    }
  ctx.pvePlace(p, 0, 160, 0);
  let k = 1;
  ctx.playerMove = dt => {
    const [tx, tz] = path[Math.min(k, path.length - 1)],
      d = Math.hypot(tx - p.x, tz - p.z);
    if (d < 0.3) return void k++;
    p.x += ((tx - p.x) / d) * Math.min(d, 7 * dt);
    p.z += ((tz - p.z) / d) * Math.min(d, 7 * dt);
    ctx.resolveWalls(p);
  };
  run(ctx, 30);
  near(p.z, 292, 0.5, 'arrivé au sommet du donjon');
  near(p.y, C.summit, 0.06, 'monté jusqu’en haut');
  assert.ok(p.grounded, 'au sol');
}

// ---------- Joueur hors de vue et hors d'atteinte (de l'autre côté de la herse fermée) : le camp rentre ----------
// (derrière un mur qui a une porte, le camp fait le tour : test « Murs » plus bas)
{
  const { ctx, p, camp, W } = pveWorld();
  const id = W.camps.findIndex(c => c.indoor),
    foes = camp(id);
  ctx.pvePlace(p, 0, W.gate.z - 6, 0); // dehors, herse fermée
  ctx.pveEngage(id);
  run(ctx, 3);
  assert.ok(
    foes.every(m => m.monster.mode === 'fight'),
    'encore en combat'
  );
  run(ctx, 4);
  assert.ok(
    foes.every(m => m.monster.mode !== 'fight'),
    'joueur hors de vue et hors d’atteinte : le camp rentre'
  );
}

// ---------- Victoire : le roi vaincu au sommet ----------
{
  const { ctx, p } = pveWorld();
  const king = ctx.state.units.find(u => u.monster?.type === 'king');
  assert.ok(king.maxHp > ctx.CLASS[king.cls].hp, 'roi plus résistant qu’un héros');
  assert.ok(king.scale > 1, 'roi plus grand');
  ctx.damage(p, king, 1e7);
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
  const { ctx } = pveWorld();
  ctx.applyMap('castle'); // retour au lobby (pveLeave)
  assert.equal(ctx.arena.heightAt, null, 'carte d’arène : plus de relief');
  assert.equal(ctx.arena.world, null, 'carte d’arène : plus de monde PVE');
  assert.equal(ctx.arena.walls, null, 'carte d’arène : pas de murs du château');
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
}
// ---------- Murs : les monstres en font le tour (poursuite et retour au camp passent par la porte) ----------
{
  const { ctx, p, W } = pveWorld();
  const id = W.camps.findIndex(c => c.indoor && c.z < 190 && c.x > 0), // camp de la cour, côté est
    door = W.castle.walls.find(w => w.az === 191.5 && w.ax === 3), // mur cour → grande salle, porte de 6 m au centre
    camp = ctx.state.units.filter(u => u.monster?.camp === id);
  for (const u of ctx.state.units) if (u.monster && u.monster.camp !== id && !u.monster.boss) u.alive = false;
  ctx.pveSetGate(true);
  const m = camp.find(u => AI_MELEE(ctx, u)); // mêlée : il doit venir au contact (un lanceur tire dès qu'il voit)
  ctx.pvePlace(m, 15, 188, 0); // contre le mur, côté cour
  ctx.pvePlace(p, 15, 197, Math.PI); // de l'autre côté du mur, dans la grande salle
  p.maxHp = p.hp = 1e8;
  ctx.pveEngage(id, p);
  let viaDoor = false,
    t = 0;
  for (; t < 14 && Math.hypot(m.x - p.x, m.z - p.z) > 3; t += 0.1) {
    run(ctx, 0.1);
    if (Math.abs(m.z - door.az) < 2 && Math.abs(m.x) < door.ax) viaDoor = true;
  }
  assert.ok(Math.hypot(m.x - p.x, m.z - p.z) <= 3, `le monstre rejoint le héros derrière le mur (${t.toFixed(1)} s)`);
  assert.ok(viaDoor, 'en passant par la porte');
  // retour au camp depuis la grande salle
  ctx.pveReset(id);
  ctx.pvePlace(p, 0, W.start.z, 0); // le héros loin (plus d'alerte)
  viaDoor = false;
  for (t = 0; t < 20 && m.monster.mode !== 'idle'; t += 0.1) {
    run(ctx, 0.1);
    if (Math.abs(m.z - door.az) < 2 && Math.abs(m.x) < door.ax) viaDoor = true;
    assert.ok(!m.visualSnap || m.monster.mode === 'idle', 'jamais replacé d’un coup chez lui (il était coincé)');
  }
  assert.equal(m.monster.mode, 'idle', `rentré au camp (${t.toFixed(1)} s)`);
  assert.ok(viaDoor, 'retour par la porte');
  // chemin de la cour à la grande salle : jamais en diagonale à travers un angle de mur
  const G = ctx.pveNavGrid(),
    path = ctx.pveNavPath(G, ctx.navCell(G, 15, 188), ctx.navCell(G, 15, 197));
  assert.ok(path?.length > 10, 'un chemin par la porte');
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1],
      b = path[k],
      dx = (b % G.nx) - (a % G.nx),
      dz = Math.floor(b / G.nx) - Math.floor(a / G.nx);
    if (dx && dz) assert.ok(ctx.navOpen(G, a + dx) && ctx.navOpen(G, a + dz * G.nx), 'diagonale sans couper un coin');
  }
}

// ---------- Héros derrière un mur mais joignable par une porte : le camp ne rentre pas, il fait le tour ----------
{
  const { ctx, p, camp, W } = pveWorld();
  const id = W.camps.findIndex(c => c.indoor),
    foes = camp(id);
  ctx.pvePlace(p, 15, 205, 0); // grande salle, derrière le mur de la cour (porte au centre)
  ctx.pveEngage(id);
  for (const m of foes) m.root = 99; // immobiles : ils ne le verront pas de 8 s
  run(ctx, 8);
  assert.ok(
    foes.every(m => m.monster.mode === 'fight'),
    'chemin jusqu’au héros : toujours en combat après 8 s'
  );
}
console.log('pve.test.js OK');
