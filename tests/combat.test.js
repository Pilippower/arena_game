'use strict';
// Tests unitaires des règles de combat (docs/SPEC.md, priorité P0) : le vrai code (données, formes, combat, sorts,
// règles, carte) est chargé dans un contexte vm, sur une arène vide ; on vérifie le résultat, pas le texte du code.
const assert = require('node:assert/strict');
const { sandbox } = require('./sources.js');

function combatWorld() {
  const S = sandbox({
    window: {},
    document: { addEventListener() {} },
    location: { search: '' },
    URLSearchParams,
    $: () => ({}),
    now: () => S.ctx.clock,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    updateUI() {},
    spellSfx() {},
    SFX: { effort() {} }
  });
  S.ctx.clock = 100;
  S.load('src/data/classes.js');
  S.ctx.arena = {};
  S.ctx.HEALTH_SPOTS = [];
  for (const f of [
    'src/data/maps.js',
    'src/game/forms.js',
    'src/game/combat.js',
    'src/game/spells.js',
    'src/game/rules.js',
    'src/game/match.js'
  ])
    S.load(f);
  S.ctx.applyMap('castle');
  S.ctx.arena.pillars = []; // arène vide : les règles, pas la géométrie
  S.ctx.state = { units: [], floaters: [], fx: [], dampening: 0, elapsed: 0, stats: [] };
  const unit = (cls, x, z, team, extra = {}) => {
    const u = Object.assign(S.ctx.makeUnit(cls, x, z, team, cls), { slotIndex: S.ctx.state.units.length }, extra);
    S.ctx.state.units.push(u);
    return u;
  };
  return { ctx: S.ctx, unit };
}
const spell = (ctx, cls, n) => ctx.CLASS[cls].skills.findIndex(s => s.n === n);

// ---------- Contrôles et rendements décroissants ----------
{
  const { ctx, unit } = combatWorld();
  const t = unit('sentinel', 0, 0, 1);
  const durations = [1, 2, 3, 4].map(() => {
    t.stun = 0;
    return ctx.control(t, 'stun', 6) ? t.stun : 0;
  });
  assert.deepEqual(durations, [6, 3, 1.5, 0], 'DR : 100 %, 50 %, 25 % puis insensible');
  assert.ok(
    ctx.state.floaters.some(f => f.text === 'Immune'),
    'DR épuisés : « Immune » affiché'
  );
  t.stun = 0;
  assert.ok(ctx.control(t, 'stun', 6, null, 'opener') && t.stun === 6, 'Cheap Shot : DR à part (opener)');
  ctx.tickDR(t, 19.9); // 20 s : valeur validée (docs/SPEC.md)
  assert.equal(t.dr.stun, 0, 'DR : pas de remise à zéro avant 20 s');
  ctx.tickDR(t, 0.2);
  assert.equal(t.dr.stun, 1, 'DR : remis à 100 % 20 s après le dernier contrôle');
  t.stun = 0;
  ctx.control(t, 'stun', 6);
  assert.equal(t.stun, 6, 'DR remis : durée pleine');
}
{
  // le contrôle note le sort source (icônes de débuff au-dessus des personnages)
  const { ctx, unit } = combatWorld();
  const t = unit('sentinel', 0, 0, 1);
  ctx.SPELL_NOW = 'Kidney Shot';
  ctx.control(t, 'stun', 6);
  assert.equal(t.debuffSpell.stun, 'Kidney Shot', 'contrôle : sort noté');
}
{
  // formes du druide insensibles au mouton ; mouton brisé par les dégâts
  const { ctx, unit } = combatWorld();
  const mage = unit('arcanist', 0, 5, 0),
    druid = unit('warden', 0, 0, 1);
  druid.form = 'cat';
  assert.equal(ctx.control(druid, 'poly', 8, mage), false, 'félin : insensible au mouton');
  const war = unit('sentinel', 2, 0, 1);
  ctx.control(war, 'poly', 8, mage);
  assert.ok(war.poly > 0, 'mouton posé');
  ctx.damage(mage, war, 20);
  assert.equal(war.poly, 0, 'mouton brisé par les dégâts');
}
{
  // Fear : brisé par un gros coup (≥ 8 % des PV), pas par une égratignure
  const { ctx, unit } = combatWorld();
  const lock = unit('warlock', 0, 5, 0),
    t = unit('sentinel', 0, 0, 1);
  ctx.control(t, 'fear', 6, lock);
  ctx.damage(lock, t, 10);
  assert.ok(t.fear > 0, 'fear : tient sur une égratignure');
  ctx.damage(lock, t, t.maxHp * 0.2);
  assert.equal(t.fear, 0, 'fear : brisé par un gros coup');
}

// ---------- Dégâts ----------
{
  // mage : critique (x 1,5) sur une cible gelée par sa Frost Nova
  const { ctx, unit } = combatWorld();
  const mage = unit('arcanist', 0, 5, 0),
    a = unit('shade', 0, 0, 1),
    b = unit('shade', 3, 0, 1);
  Object.assign(b, { root: 4, rootKind: 'ice' });
  ctx.damage(mage, a, 100, false, 'magic');
  ctx.damage(mage, b, 100, false, 'magic');
  const hitA = a.maxHp - a.hp,
    hitB = b.maxHp - b.hp;
  assert.ok(Math.abs(hitB - hitA * 1.5) <= 1, 'mage : critique sur cible gelée');
}
{
  // bouclier : absorbe avant les PV, compté en soins pour son poseur
  const { ctx, unit } = combatWorld();
  const priest = unit('oracle', 0, 5, 1),
    foe = unit('sentinel', 0, 2, 0),
    t = unit('arcanist', 0, 0, 1);
  Object.assign(t, { shield: 1000, shieldSrc: priest });
  ctx.damage(foe, t, 100);
  assert.equal(t.hp, t.maxHp, 'bouclier : les PV ne bougent pas');
  assert.ok(ctx.state.stats[priest.slotIndex].healing > 0, 'bouclier compté en soins du poseur');
}
{
  // plaque > cuir > tissu contre les coups physiques
  const { ctx, unit } = combatWorld();
  const red = cls => ctx.armorReduction(unit(cls, 0, 0, 1), 'physical');
  assert.ok(red('sentinel') > red('shade') && red('shade') > red('arcanist'), 'armures : plaque > cuir > tissu');
}

// ---------- Soins : dampening ----------
{
  const { ctx, unit } = combatWorld();
  assert.equal(ctx.dampeningAt(30), 0, 'dampening : rien avant 35 s');
  assert.ok(ctx.dampeningAt(80) > 0 && ctx.dampeningAt(80) < 0.45, 'dampening : montée progressive');
  assert.equal(ctx.dampeningAt(600), 0.45, 'dampening : plafonné à 45 %');
  const priest = unit('oracle', 0, 0, 0),
    t = unit('sentinel', 1, 0, 0);
  t.hp = 100;
  ctx.state.dampening = 0.45;
  ctx.heal(priest, t, 200);
  assert.equal(t.hp, 100 + 110, 'dampening : soins réduits de 45 %');
}

// ---------- Sorts ----------
{
  // Hamstring : ralentit de 50 %, n'immobilise pas
  const { ctx, unit } = combatWorld();
  const war = unit('sentinel', 0, 0, 0),
    t = unit('arcanist', 0, 1.5, 1);
  war.target = t;
  assert.ok(ctx.useSkill(war, spell(ctx, 'sentinel', 'Hamstring')), 'Hamstring lancé');
  assert.equal(t.slowPct, 0.5, 'Hamstring : ralentissement de 50 %');
  assert.equal(t.root, 0, 'Hamstring : pas de racines');
  assert.ok(Math.abs(ctx.moveSpeed(t) - ctx.CLASS.arcanist.speed * 0.5) < 1e-9, 'Hamstring : vitesse divisée par 2');
}
{
  // Charge : vraie ruée (pas de téléportation), étourdit à l'arrivée
  const { ctx, unit } = combatWorld();
  const war = unit('sentinel', 0, 0, 0),
    t = unit('arcanist', 0, 10, 1);
  war.target = t;
  assert.ok(ctx.useSkill(war, spell(ctx, 'sentinel', 'Charge')), 'Charge lancée');
  assert.equal(war.z, 0, 'Charge : pas de téléportation au lancement');
  const path = [];
  for (let i = 0; i < 120 && war.mobility; i++) {
    ctx.updateMobility(war, 1 / 120);
    path.push(war.z);
  }
  assert.ok(path.length > 10 && path.every((z, i) => i === 0 || z >= path[i - 1]), 'Charge : avance image par image');
  assert.ok(Math.hypot(war.x - t.x, war.z - t.z) < 2.15, 'Charge : arrive au contact');
  assert.ok(t.stun > 0, 'Charge : étourdit à l’arrivée');
}
{
  // Blink : vers l'avant du personnage (pas vers la cible), utilisable étourdi, brise l'étourdissement et les racines
  const { ctx, unit } = combatWorld();
  const mage = unit('arcanist', 0, 0, 0, { yaw: Math.PI / 2 }),
    foe = unit('sentinel', 0, 10, 1);
  mage.target = foe;
  Object.assign(mage, { stun: 3, root: 4 });
  assert.ok(ctx.useSkill(mage, spell(ctx, 'arcanist', 'Blink')), 'Blink : utilisable étourdi');
  assert.ok(mage.x > 5 && Math.abs(mage.z) < 0.01, 'Blink : suit la direction du personnage, pas la cible');
  assert.ok(mage.stun === 0 && mage.root === 0, 'Blink : brise étourdissement et racines');
}
{
  // Dispel : effets magiques seulement ; joueur : uniquement sa cible actuelle amie (ou soi quand on se cible)
  const { ctx, unit } = combatWorld();
  const priest = unit('oracle', 0, 0, 0),
    ally = unit('sentinel', 2, 0, 0),
    foe = unit('shade', 0, 6, 1);
  Object.assign(ally, { slow: 5, slowPct: 0.5, slowMagic: true });
  const D = spell(ctx, 'oracle', 'Dispel');
  priest.target = foe;
  assert.equal(ctx.useSkill(priest, D), false, 'Dispel : cible ennemie = rien');
  ctx.setTarget(priest, ally);
  assert.ok(ctx.useSkill(priest, D) && ally.slow === 0, 'Dispel : ralentissement magique retiré');
  // racines magiques + ralentissement de mêlée (Hamstring) : seules les racines partent
  Object.assign(ally, { root: 4, rootSchool: 'magic', slow: 5, slowPct: 0.5, slowMagic: false });
  priest.gcd = 0;
  assert.ok(ctx.useSkill(priest, D), 'Dispel relancé');
  assert.equal(ally.root, 0, 'Dispel : racines magiques retirées');
  assert.equal(ally.slow, 5, 'Dispel : ralentissement de mêlée (Hamstring) gardé');
}
{
  // se cibler (ou un allié) arrête le combat ; camouflé = -30 % de vitesse
  const { ctx, unit } = combatWorld();
  const u = unit('shade', 0, 0, 0),
    foe = unit('sentinel', 0, 3, 1);
  ctx.setTarget(u, foe);
  assert.equal(u.lastEnemy, foe, 'cibler un ennemi : combat');
  ctx.setTarget(u, u);
  assert.equal(u.lastEnemy, null, 'se cibler arrête le combat');
  const base = ctx.moveSpeed(u);
  u.stealth = true;
  assert.ok(Math.abs(ctx.moveSpeed(u) - base * 0.7) < 1e-9, 'camouflé : -30 % de vitesse');
}
console.log(
  'OK - règles de combat (tests unitaires : DR, contrôles, dégâts, dampening, Hamstring, Charge, Blink, Dispel)'
);
