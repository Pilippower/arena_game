'use strict';
// Tests unitaires de l'aventure PVE en groupe (src/pve/pve.js + src/net/online.js + src/net/pve_online.js) : le vrai
// code du jeu (combat, IA, sim, monde PVE, réseau) avec de fausses connexions (messages enregistrés). On vérifie le
// résultat : camps agrandis selon le groupe, héros des amis, réapparition de chacun, levier tiré par un ami, état
// limité aux unités proches, départ d'un ami, fin d'aventure envoyée à tous, partie reconstruite chez l'ami.
const assert = require('node:assert/strict');
const { combatWorld, run } = require('./combat_world.js');

const fakeConn = () => {
  const sent = [];
  return {
    open: true,
    sent,
    send: m => sent.push(JSON.parse(JSON.stringify(m))),
    last: t => sent.filter(m => m.t === t).at(-1)
  };
};
// monde PVE + réseau ; role 'host' : `friends` amis connectés ([classe, race]…), partie lancée avec eux
function pveNet({ role = 'host', friends = [] } = {}) {
  const w = combatWorld(),
    { ctx } = w,
    errors = [];
  Object.assign(ctx, {
    camera: { yaw: 0, pitch: 0 },
    HF: { enabled: false },
    prepareMatch() {},
    pveUiStart() {},
    pveUiStop() {},
    hideResults() {},
    playGameMusic() {},
    musicStart() {},
    partyRender() {},
    lobbyTab() {},
    $: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} } }),
    lobbyIsPve: () => true,
    showError: t => errors.push(t),
    pveShowEnd: sum => (ctx.endShown = sum)
  });
  for (const f of [
    'src/pve/castle.js',
    'src/pve/world.js',
    'src/pve/pve.js',
    'src/net/online.js',
    'src/net/pve_online.js'
  ])
    w.load(f);
  ctx.window.NET = ctx.NET;
  ctx.NET.role = role;
  ctx.Math.random = () => 0.5;
  const conns = friends.map(([cls, race], i) => {
    const conn = fakeConn();
    ctx.NET.guests.set(i + 1, { id: i + 1, conn, name: 'Friend ' + (i + 1), cls, race, team: 'ally' });
    return conn;
  });
  if (role === 'host') ctx.pveStart('sentinel', 'human', ctx.pveNetParty());
  const hero = i => ctx.state.units.find(u => u.remoteId === i);
  return { ...w, conns, errors, hero, W: ctx.PVE_WORLD };
}
const campSize = (ctx, id) => ctx.state.units.filter(u => u.monster?.camp === id).length;
const FOUR = [
  ['oracle', 'elf'],
  ['arcanist', 'human'],
  ['shade', 'orc'],
  ['warlock', 'undead']
];

// ---------- Camps agrandis selon la taille du groupe ----------
{
  const solo = pveNet(),
    trio = pveNet({ friends: FOUR.slice(0, 2) }),
    five = pveNet({ friends: FOUR }),
    W = solo.W,
    id = type => W.camps.findIndex(c => c.mobs.includes(type)),
    two = W.camps.findIndex(c => c.mobs.length === 2 && !c.boss),
    three = W.camps.findIndex(c => c.mobs.length === 3 && !c.boss),
    one = W.camps.findIndex(c => c.mobs.length === 1 && !c.boss);
  assert.equal(campSize(solo.ctx, two), 2, 'seul : le camp tel quel');
  assert.equal(campSize(trio.ctx, two), 4, '3 héros : camp de 2 → 4 monstres');
  assert.equal(campSize(five.ctx, two), 7, '5 héros : camp de 2 → 7 monstres');
  assert.equal(campSize(five.ctx, three), 8, '5 héros : jamais plus de 8 monstres par camp');
  assert.equal(campSize(five.ctx, one), 3, '5 héros : bête seule → 3');
  const types = (ctx, c) => new Set(ctx.state.units.filter(u => u.monster?.camp === c).map(u => u.monster.type));
  assert.deepEqual(
    [...types(five.ctx, two)].sort(),
    [...new Set(W.camps[two].mobs)].sort(),
    'même mélange de monstres'
  );
  const king = ctx => ctx.state.units.filter(u => u.monster?.camp === id('king'));
  assert.equal(king(solo.ctx).length, 1, 'seul : le roi sans escorte');
  assert.equal(king(five.ctx).filter(u => u.monster.type === 'king').length, 1, 'un seul roi');
  assert.equal(
    king(five.ctx).filter(u => u.monster.type === W.mobs.king.escort).length,
    4,
    'escorte : une par héros en plus'
  );
  const hp = (ctx, type) => ctx.state.units.find(u => u.monster?.type === type).maxHp;
  assert.ok(hp(five.ctx, 'king') > hp(solo.ctx, 'king') * 2.9, 'roi : +50 % de PV par héros en plus');
  assert.ok(hp(trio.ctx, 'thrall') > hp(solo.ctx, 'thrall') * 1.25, 'monstres : plus de PV en groupe');
  const dmg = (ctx, type) => ctx.state.units.find(u => u.monster?.type === type).aiDmg;
  assert.ok(dmg(trio.ctx, 'thrall') > dmg(solo.ctx, 'thrall') * 1.25, 'monstres : plus de dégâts en groupe');
}

// ---------- Héros des amis : pilotés par eux, côte à côte au départ, composition envoyée ----------
{
  const { ctx, conns, hero, W } = pveNet({ friends: FOUR.slice(0, 2) });
  const heroes = ctx.state.units.filter(u => u.team === 0);
  assert.equal(heroes.length, 3, 'l’hôte et ses deux amis');
  for (const i of [1, 2]) {
    assert.ok(hero(i).remote && !hero(i).ai, 'l’ami pilote son héros (pas d’IA)');
    assert.equal(hero(i).cls, FOUR[i - 1][0]);
  }
  assert.ok(
    new Set(heroes.map(h => h.x)).size === 3 && heroes.every(h => Math.abs(h.z - W.start.z) < 0.01),
    'côte à côte'
  );
  const roster = conns[0].last('roster');
  assert.ok(roster.pve && roster.units.length === ctx.state.units.length, 'composition PVE envoyée');
  assert.equal(roster.units[roster.me].name, 'You');
  const m = roster.units.find(r => r.mob === 'gatekeeper');
  assert.ok(m && m.sc > 1 && Number.isFinite(m.x), 'monstres : type, taille et position de départ');
}

// ---------- Monstres : le camp attaque l'ami qui approche, rentre seulement quand tout le groupe est tombé ----------
{
  const { ctx, hero, W } = pveNet({ friends: FOUR.slice(0, 1) });
  const host = ctx.state.player,
    friend = hero(1),
    c = W.camps[0];
  ctx.pvePlace(friend, c.x, c.z - 6, 0);
  run(ctx, 0.3);
  const camp = ctx.state.units.filter(u => u.monster?.camp === 0);
  assert.ok(
    camp.every(m => m.monster.mode === 'fight' && m.target === friend),
    'le camp attaque l’ami qui l’a alerté'
  );
  ctx.pvePlace(host, c.x + 2, c.z - 6, 0);
  ctx.damage(camp[0], host, 1e7); // l'hôte tombe le premier : l'ami tient encore
  run(ctx, 0.3);
  assert.ok(
    camp.every(m => m.monster.mode === 'fight'),
    'un héros debout : le combat continue'
  );
  ctx.damage(camp[0], friend, 1e7);
  run(ctx, 0.3);
  assert.ok(
    camp.every(m => m.monster.mode !== 'fight'),
    'tout le groupe tombé : le camp rentre'
  );
}

// ---------- Mort d'un ami : il réapparaît seul au dernier feu, prévenu chez lui ; chutes du groupe ----------
{
  const { ctx, conns, hero } = pveNet({ friends: FOUR.slice(0, 2) });
  const host = ctx.state.player,
    friend = hero(2),
    tp = friend.tpN || 0;
  ctx.damage(host, friend, 1e7);
  run(ctx, 0.2);
  assert.ok(
    conns[1].sent.some(m => m.t === 'say' && m.text === 'You have fallen'),
    'l’ami tombé est prévenu chez lui'
  );
  assert.ok(!conns[0].sent.some(m => m.t === 'say' && m.text === 'You have fallen'), 'pas les autres');
  assert.equal(ctx.state.pve.deaths, 1, 'chute comptée');
  run(ctx, 4.2);
  assert.ok(friend.alive && friend.hp === friend.maxHp, 'l’ami revient en pleine forme');
  assert.equal(friend.tpN, tp + 1, 'son navigateur se recale sur la nouvelle position');
  assert.ok(host.alive, 'l’hôte n’a rien vécu');
  assert.notEqual(friend.x, host.x, 'chacun à sa place au feu');
}

// ---------- Levier tiré par un ami (message de son navigateur) : la herse se lève pour tous ----------
{
  const { ctx, conns, hero, W } = pveNet({ friends: FOUR.slice(0, 1) });
  const friend = hero(1),
    g = ctx.NET.guests.get(1),
    L = W.lever;
  ctx.pvePlace(friend, L.x, L.z - L.reach - 3, 0);
  ctx.netOnData({ t: 'lever' }, g);
  assert.equal(ctx.state.pve.gateOpen, false, 'trop loin : rien');
  assert.ok(
    conns[0].sent.some(m => m.t === 'err' && m.text === 'Too far away'),
    'l’ami voit pourquoi'
  );
  ctx.pvePlace(friend, L.x, L.z - 1, 0);
  ctx.netOnData({ t: 'lever' }, g);
  assert.equal(ctx.state.pve.gateOpen, true, 'à portée : la herse se lève');
  assert.ok(
    conns[0].sent.some(m => m.t === 'say' && m.fanfare),
    'annoncé à tous'
  );
  run(ctx, 0.1);
  assert.equal(conns[0].last('s').pv.go, true, 'herse ouverte dans l’état envoyé');
}

// ---------- État envoyé : à chaque ami les unités proches de son héros (le monde a des dizaines de monstres) ----------
{
  const { ctx, conns, hero, W } = pveNet({ friends: FOUR.slice(0, 2) });
  const c = W.camps.at(-1);
  ctx.pvePlace(hero(2), c.x, c.z - 30, 0); // l'ami 2 au château, l'ami 1 au départ
  run(ctx, 0.1);
  const s1 = conns[0].last('s'),
    s2 = conns[1].last('s'),
    sent = (s, u) => !!s.u[ctx.state.units.indexOf(u)];
  const startMob = ctx.state.units.find(u => u.monster?.camp === 0),
    king = ctx.state.units.find(u => u.monster?.type === 'king');
  assert.ok(sent(s1, startMob) && !sent(s1, king), 'ami 1 : les monstres près de lui seulement');
  assert.ok(sent(s2, king) && !sent(s2, startMob), 'ami 2 : ceux du château');
  assert.ok(
    [0, 1, 2].every(i => sent(s1, ctx.state.units[i]) && sent(s2, ctx.state.units[i])),
    'les héros toujours'
  );
  assert.ok(s1.u.filter(Boolean).length < ctx.state.units.length / 2, 'bien moins que tout le monde');
}

// ---------- Ami parti en cours d'aventure : son héros la quitte (pas d'IA, pas de retour au feu) ----------
{
  const { ctx, errors, hero } = pveNet({ friends: FOUR.slice(0, 1) });
  const friend = hero(1),
    g = ctx.NET.guests.get(1);
  ctx.netGuestLeft(g);
  assert.ok(friend.gone && !friend.alive && !friend.ai, 'héros retiré');
  assert.ok(errors.includes('Friend 1 left the adventure'));
  run(ctx, 5);
  assert.ok(!friend.alive, 'jamais réapparu');
  assert.equal(ctx.state.pve.deaths, 0, 'pas compté comme une chute');
}

// ---------- Groupe trop grand ou ami sans héros : l'hôte ne lance pas ----------
{
  const big = pveNet({ role: 'none', friends: [...FOUR, ['reaver', 'orc']] });
  big.ctx.NET.role = 'host';
  assert.equal(big.ctx.pveNetParty(), null, '6 héros : refusé');
  const choosing = pveNet({ role: 'none', friends: [[null, null]] });
  choosing.ctx.NET.role = 'host';
  assert.equal(choosing.ctx.pveNetParty(), null, 'un ami sans classe : on attend');
}

// ---------- Victoire : résumé du groupe envoyé à tous ----------
{
  const { ctx, conns } = pveNet({ friends: FOUR.slice(0, 2) });
  ctx.setTimeout = f => f();
  const king = ctx.state.units.find(u => u.monster?.type === 'king');
  ctx.damage(ctx.state.player, king, 1e8);
  run(ctx, 0.1);
  const end = conns[1].last('pveEnd');
  assert.ok(end && end.sum.heroes.length === 3, 'chaque ami reçoit une ligne par héros');
  assert.deepEqual(
    end.sum.heroes.map(h => h.name),
    ['Host', 'Friend 1', 'Friend 2']
  );
  assert.equal(ctx.endShown.heroes.length, 3, 'l’hôte voit le même écran');
}

// ---------- Chez l'ami : partie construite d'après la composition, herse ouverte par l'état de l'hôte ----------
{
  const host = pveNet({ friends: FOUR.slice(0, 1) }),
    roster = host.conns[0].last('roster'),
    guest = pveNet({ role: 'guest' }),
    { ctx } = guest;
  ctx.netOnData(roster);
  assert.ok(ctx.state.pve && ctx.state.units.length === host.ctx.state.units.length, 'mêmes unités');
  assert.equal(ctx.state.player.cls, FOUR[0][0], 'son héros');
  const gk = ctx.state.units.find(u => u.monster?.type === 'gatekeeper'),
    hk = host.ctx.state.units.find(u => u.monster?.type === 'gatekeeper');
  assert.ok(gk.scale > 1 && Math.abs(gk.x - hk.x) < 0.01 && Math.abs(gk.z - hk.z) < 0.01, 'monstres au même endroit');
  assert.ok(ctx.arena.walls?.length && ctx.arena.heightAt, 'le monde PVE pour se déplacer en local');
  host.ctx.pveOpenGate();
  run(host.ctx, 0.1);
  ctx.netOnData(host.conns[0].last('s'));
  ctx.netGuestUpdate(0.01);
  assert.equal(ctx.state.pve.gateOpen, true);
  assert.ok(
    ctx.arena.walls.filter(w => w.gate).every(w => w.open),
    'herse ouverte pour sa collision aussi'
  );
  ctx.netOnData({ t: 'say', text: 'The castle gate is open!', fanfare: true });
}
console.log('pve_online.test.js OK');
