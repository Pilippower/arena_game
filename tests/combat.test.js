'use strict';
// Tests unitaires des règles de combat (docs/SPEC.md, priorité P0) : le vrai code (données, formes, combat, sorts,
// règles, carte) est chargé dans un contexte vm, sur une arène vide ; on vérifie le résultat, pas le texte du code.
const assert = require('node:assert/strict');
const { combatWorld, spell, run } = require('./combat_world.js');

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
  // durée totale notée pour l'horloge des portraits ; un contrôle plus court ne la remplace pas
  assert.equal(t.ccTotal.stun, 6, 'contrôle : durée totale notée');
  t.stun = 5;
  t.dr.stun = 1;
  ctx.control(t, 'stun', 2);
  assert.ok(t.ccTotal.stun === 6 && t.stun === 5, 'contrôle plus court : durée totale gardée');
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
// ---------- Incantations (pas de simulation réel : update de sim.js) ----------
{
  // ressource prise à la fin de l'incantation, dégâts à l'impact ; portée 30 m
  const { ctx, unit } = combatWorld();
  const mage = unit('arcanist', 0, 0, 0),
    foe = unit('sentinel', 0, 20, 1);
  ctx.state.player = mage;
  mage.target = foe;
  assert.equal(ctx.SPELL_RANGE, 30, 'portée des sorts : 30 m');
  const FB = spell(ctx, 'arcanist', 'Frost Bolt');
  assert.ok(ctx.useSkill(mage, FB) && mage.cast, 'Frost Bolt : incantation lancée');
  assert.equal(mage.res, 100, 'incantation en cours : ressource pas encore prise');
  assert.equal(
    ctx.skillFailReason(mage, spell(ctx, 'arcanist', 'Polymorph')),
    'Not ready yet',
    'autre sort pendant l’incantation : message'
  );
  run(ctx, mage.cast.end - ctx.clock + 0.02);
  assert.ok(!mage.cast && mage.res < 100, 'fin de l’incantation : ressource prise');
  assert.ok(foe.hp < foe.maxHp && foe.slow > 0, 'Frost Bolt : dégâts et ralentissement à l’impact');
  // le projectile suit la cible qui se déplace et frappe son torse (rendu : fxAim à chaque image, aussi en ligne :
  // la cible est désignée par sa place dans state.units)
  const bolt = ctx.state.fx.find(f => /Projectile$/.test(f.type));
  assert.ok(bolt && bolt.extra?.follow === ctx.state.units.indexOf(foe), 'projectile lié à sa cible');
  Object.assign(foe, { rx: 4, ry: 0, rz: 17 }); // position affichée de la cible qui s'écarte pendant le vol
  assert.deepEqual([...ctx.fxAim(bolt)], [4, ctx.FX_TORSO, 17], 'le projectile vise le torse de la cible déplacée');
  assert.ok(ctx.FX_TORSO > 0.9 && ctx.FX_TORSO < 1.5, 'point d’impact : le torse');
  assert.ok(JSON.parse(JSON.stringify(bolt.extra)).follow >= 0, 'lien transmissible à l’ami en ligne (JSON)');
}
{
  // Death Coil (instantané) : le projectile suit aussi sa cible
  const { ctx, unit } = combatWorld();
  const dk = unit('reaver', 0, 0, 0),
    foe = unit('arcanist', 0, 10, 1);
  dk.target = foe;
  ctx.state.player = dk;
  assert.ok(ctx.useSkill(dk, spell(ctx, 'reaver', 'Death Coil')), 'Death Coil lancé');
  const coil = ctx.state.fx.find(f => f.type === 'shadowProjectile');
  assert.equal(coil?.extra?.follow, ctx.state.units.indexOf(foe), 'Death Coil : projectile lié à sa cible');
}
{
  // interruption : l'incantation s'arrête, rien n'est dépensé, l'école est verrouillée 4 s
  const { ctx, unit } = combatWorld();
  const mage = unit('arcanist', 0, 0, 0),
    war = unit('sentinel', 0, 1.5, 1);
  ctx.state.player = mage;
  mage.target = war;
  const FB = spell(ctx, 'arcanist', 'Frost Bolt');
  ctx.useSkill(mage, FB);
  assert.ok(ctx.interrupt(war, mage), 'interruption');
  assert.ok(!mage.cast && mage.res === 100, 'interrompu : rien dépensé');
  assert.ok(mage.cd[FB] >= 4 && mage.lockout.school === ctx.CLASS.arcanist.skills[FB].s, 'école verrouillée 4 s');
  assert.equal(ctx.skillFailReason(mage, FB), 'That school is locked', 'école verrouillée : message');
}
{
  // cible perdue de vue à la fin : sort annulé, recharge rendue, rien dépensé
  const { ctx, unit } = combatWorld();
  const mage = unit('arcanist', 0, 0, 0),
    foe = unit('sentinel', 0, 20, 1);
  ctx.state.player = mage;
  mage.target = foe;
  const FB = spell(ctx, 'arcanist', 'Frost Bolt');
  ctx.useSkill(mage, FB);
  assert.ok(mage.cd[FB] > 0, 'Frost Bolt : recharge lancée');
  ctx.arena.pillars.push({ x: 0, z: 10, r: 2, h: 8 });
  run(ctx, mage.cast.end - ctx.clock + 0.02);
  assert.ok(foe.hp === foe.maxHp && mage.res === 100 && mage.cd[FB] === 0, 'hors de vue : annulé et remboursé');
}
{
  // effets dans la durée : tic chaque seconde, total sur la durée, puis l'aura disparaît
  const { ctx, unit } = combatWorld();
  const priest = unit('oracle', 0, 0, 0),
    foe = unit('arcanist', 0, 8, 1),
    ally = unit('sentinel', 1, 0, 0);
  ctx.addAura(foe, priest, 'Pain', 'dot', 120, 6, 'shadow');
  ally.hp = 1000;
  ctx.addAura(ally, priest, 'Rejuvenation', 'hot', 120, 6);
  const hp0 = foe.hp;
  for (let k = 0; k < 720; k++) {
    ctx.updateAuras(foe, 1 / 120);
    ctx.updateAuras(ally, 1 / 120);
  }
  const expected = 120 * (1 - ctx.armorReduction(foe, 'shadow'));
  assert.ok(Math.abs(hp0 - foe.hp - expected) <= 6, 'dot : total sur 6 s');
  assert.equal(ally.hp, 1120, 'hot : total sur 6 s');
  assert.ok(!foe.auras.length && !ally.auras.length, 'auras terminées');
  ctx.addAura(foe, priest, 'Pain', 'dot', 120, 6, 'shadow');
  ctx.addAura(foe, priest, 'Pain', 'dot', 120, 6, 'shadow');
  assert.equal(foe.auras.length, 1, 'réappliquer rafraîchit (pas de cumul)');
}
{
  // dégâts colorés par école, critiques en gros
  const { ctx, unit } = combatWorld();
  const lock = unit('warlock', 0, 5, 0),
    t = unit('sentinel', 0, 0, 1);
  ctx.damage(lock, t, 50, true, 'shadow');
  const f = ctx.state.floaters.find(x => x.text.startsWith('-'));
  assert.ok(f.color === ctx.SCHOOL_COLOR.shadow && f.big, 'chiffre de dégâts : couleur de l’école, critique en gros');
}
{
  // sort de zone sans ennemi à portée : se lance quand même
  const { ctx, unit } = combatWorld();
  const mage = unit('arcanist', 0, 0, 0);
  unit('sentinel', 0, 25, 1);
  const FN = spell(ctx, 'arcanist', 'Frost Nova');
  assert.ok(ctx.useSkill(mage, FN) && mage.cd[FN] > 0, 'Frost Nova sans cible proche');
}
{
  // Demonic Gate : vers l'avant (pas vers la cible), racines gardées
  const { ctx, unit } = combatWorld();
  const lock = unit('warlock', 0, 0, 0, { yaw: -Math.PI / 2, root: 3 }),
    foe = unit('sentinel', 0, 10, 1);
  lock.target = foe;
  assert.ok(ctx.useSkill(lock, spell(ctx, 'warlock', 'Demonic Gate')), 'Demonic Gate lancé');
  assert.ok(lock.x < -3 && Math.abs(lock.z) < 0.01, 'Demonic Gate : vers l’avant du personnage');
  assert.equal(lock.root, 3, 'Demonic Gate : racines gardées');
}
{
  // formes : chaque barre garde ses recharges (la recharge du sort lancé va dans sa barre, pas dans celle d'arrivée) ;
  // Cheap Shot a ses propres DR (opener)
  const { ctx, unit } = combatWorld();
  const druid = unit('warden', 0, 0, 0);
  const CAT = ctx.CLASS.warden.skills.findIndex(s => s.k === 'cat');
  const catBar = ctx.CLASS.warden.bars.cat.map(() => 0);
  catBar[CAT] = 9; // recharge en cours sur la barre du félin, à la même place que Cat Form
  druid.cdSets = { '': druid.cd, cat: catBar };
  assert.ok(ctx.useSkill(druid, CAT) && druid.form === 'cat', 'forme de félin');
  assert.equal(druid.cd, catBar, 'barre du félin active');
  assert.equal(catBar[CAT], 9, 'changer de forme garde les recharges de la barre d’arrivée');
  const rogue = unit('shade', 0, 0, 0),
    t = unit('sentinel', 0, 1.5, 1);
  rogue.target = t;
  ctx.setStealth(rogue, true);
  const CS = ctx.skillsOf(rogue).findIndex(s => s.k === 'cheapshot');
  assert.ok(ctx.useSkill(rogue, CS) && t.stun > 0, 'Cheap Shot étourdit');
  assert.ok(t.dr.opener < 1 && t.dr.stun === 1, 'Cheap Shot : DR à part (opener)');
}

// ---------- Auto-attaque et IA ----------
{
  // auto-attaque au contact, avec cri d'effort (tirage fixé)
  const { ctx, unit, sounds } = combatWorld();
  ctx.Math.random = () => 0;
  const war = unit('sentinel', 0, 0, 0),
    foe = unit('arcanist', 0, 1.5, 1);
  ctx.setTarget(war, foe);
  ctx.autoAttack(war, 1 / 120);
  assert.ok(foe.hp < foe.maxHp, 'auto-attaque au contact');
  assert.ok(
    sounds.some(s => s.name === 'effort' && s.unit === war),
    'cri sur les auto-attaques'
  );
}
{
  // IA blessée : va chercher le soin de la carte s'il est actif à moins de 22 m
  const { ctx, unit } = combatWorld();
  const player = unit('sentinel', -20, -20, 0),
    me = unit('sentinel', 5, 5, 1, { ai: true, hp: 300 });
  ctx.state.player = player;
  ctx.state.shrines = [{ x: 10, z: 10, active: true }];
  ctx.applyDifficulty();
  const d0 = Math.hypot(me.x - 10, me.z - 10);
  for (let k = 0; k < 120; k++) {
    ctx.clock += 1 / 120;
    ctx.ai(me, 1 / 120);
  }
  assert.ok(me.aiShrine && Math.hypot(me.x - 10, me.z - 10) < d0 - 1, 'IA blessée : va chercher le soin de la carte');
}

{
  // équilibrage validé : guerrier Mortal Strike 210 / 5 s, démoniste Shadow Bolt 215
  const { ctx } = combatWorld();
  const S = (cls, n) => ctx.CLASS[cls].skills.find(s => s.n === n);
  assert.ok(
    S('sentinel', 'Mortal Strike').dmg === 210 && S('sentinel', 'Mortal Strike').cd === 5,
    'Mortal Strike 210 / 5 s'
  );
  assert.equal(S('warlock', 'Shadow Bolt').dmg, 215, 'Shadow Bolt 215');
}
{
  // IA du démoniste : Drain Life seulement sous 45 % de PV (au-dessus, elle lance ses autres sorts)
  const drains = hp => {
    const { ctx, unit } = combatWorld();
    const lock = unit('warlock', 0, 0, 1, { ai: true }),
      foe = unit('sentinel', 0, 12, 0);
    lock.hp = Math.round(lock.maxHp * hp);
    ctx.state.player = foe;
    ctx.applyDifficulty();
    let n = 0;
    const use = ctx.useSkill;
    ctx.useSkill = (u, i) => {
      const ok = use(u, i);
      if (ok && u === lock && ctx.skillsOf(u)[i].n === 'Drain Life') n++;
      return ok;
    };
    run(ctx, 6);
    return n;
  };
  assert.equal(drains(0.6), 0, 'IA démoniste à 60 % de PV : pas de Drain Life');
  assert.ok(drains(0.3) > 0, 'IA démoniste à 30 % de PV : Drain Life');
}
// ---------- Mort et fin de manche ----------
{
  const { ctx, unit } = combatWorld();
  const war = unit('sentinel', 0, 0, 0),
    foe = unit('arcanist', 0, 1.5, 1);
  ctx.state.player = war;
  foe.cast = { i: 0, end: ctx.clock + 2 };
  ctx.damage(war, foe, foe.maxHp * 10);
  assert.ok(!foe.alive && foe.hp === 0 && !foe.cast, 'mort : plus de PV, incantation coupée');
  assert.equal(ctx.state.stats[war.slotIndex].kills, 1, 'élimination comptée');
  ctx.update(1 / 120);
  assert.ok(
    ctx.state.ended && ctx.state.winTeam === 0 && ctx.state.scoreA === 1,
    'équipe adverse éliminée : manche gagnée'
  );
  // fin de manche : plus de mouvement ni de tremblement
  Object.assign(war, { x: 3, prevX: 0, moving: true });
  ctx.update(1 / 120);
  assert.ok(war.prevX === war.x && !war.moving, 'fin de manche : personnage immobile');
}
{
  // écran de chargement : la simulation est arrêtée
  const { ctx, unit } = combatWorld();
  unit('sentinel', 0, 0, 0);
  ctx.state.loading = true;
  ctx.update(1);
  assert.equal(ctx.state.elapsed, 0, 'chargement : chrono arrêté');
}
// ---------- Son dédié de chaque sort (src/audio/spell_sounds.js) ----------
{
  const { sandbox } = require('./sources.js');
  const calls = [];
  const S = sandbox({
    sfxSpatial: () => ({ level: 1, pan: 0 }),
    sfxTone: (f, d, type, v, slide) => calls.push({ kind: 'tone', freqs: [f, slide || f], v }),
    sfxSweep: (d, v, f0, f1) => calls.push({ kind: 'sweep', freqs: [f0, f1], v }),
    sfxNoise: (d, v, f) => calls.push({ kind: 'noise', freqs: [f], v }),
    sfxMetal: (v, p, delay, base = 420) => calls.push({ kind: 'metal', freqs: [base, base * 8.93], v })
  });
  S.load('src/audio/spell_sounds.js');
  const { ctx } = combatWorld();
  const spells = new Map();
  for (const C of Object.values(ctx.CLASS))
    for (const bar of [C.skills, ...Object.values(C.bars || {})]) for (const sp of bar) spells.set(sp.n, sp);
  const signatures = new Set();
  for (const [n, sp] of spells) {
    calls.length = 0;
    assert.ok(S.ctx.playSpellSound(S.ctx.SPELL_SOUND, {}, n), `son dédié : ${n}`);
    assert.ok(calls.length > 0, `son audible : ${n}`);
    signatures.add(JSON.stringify(calls));
    if (sp.cast) assert.ok(S.ctx.SPELL_IMPACT[n], `son d'impact : ${n}`);
    // pas d'aigu strident : fréquences dominantes sous 3,3 kHz (sauf partiels brefs du métal), volumes modérés
    for (const c of calls) {
      if (c.kind !== 'metal') assert.ok(Math.max(...c.freqs) <= 3300, `${n} : pas d'aigu strident (${c.freqs})`);
      assert.ok(c.v <= 0.17, `${n} : volume modéré`);
    }
  }
  assert.equal(signatures.size, spells.size, 'chaque sort a un son différent');
  assert.ok(S.ctx.SPELL_SOUND.Trinket, 'trinket : son dédié');
}
// ---------- Salles de départ : 20 s de préparation, portes fermées, puis ouverture (data/maps.js, sim.js) ----------
for (const map of ['castle', 'bridge']) {
  const { ctx, unit, sounds } = combatWorld();
  ctx.applyMap(map);
  ctx.arena.pillars = [];
  const A = ctx.arena,
    hx = A.halfX,
    W = ctx.roomOf(-1),
    E = ctx.roomOf(1);
  assert.ok(ctx.GATE_TIME === 20, 'préparation : 20 s');
  // chaque équipe apparaît dans sa salle, face à la porte
  const p0 = ctx.spawnPoint(0, 0, 3),
    p1 = ctx.spawnPoint(1, 2, 3);
  assert.ok(ctx.zoneOf(p0.x) === -1 && ctx.zoneOf(p1.x) === 1, `${map} : équipes dans leur salle`);
  assert.ok(Math.abs(Math.sin(p0.yaw) - 1) < 1e-9, `${map} : face à la porte`);
  const me = unit('sentinel', p0.x, W.z, 0),
    foe = unit('arcanist', p1.x, E.z, 1),
    guard = unit('sentinel', -hx + 0.72, W.z + W.door + 2, 1); // dans l'arène, collé au rempart, à côté de la porte
  ctx.state.player = me;
  ctx.state.prep = ctx.GATE_TIME;
  const t0 = ctx.state.t;
  // porte fermée : on bute contre elle ; pas de ligne de vue entre les salles et l'arène
  const walk = (u, x, z, sec) => {
    for (let k = 0; k < sec * 120; k++) {
      u.prevX = u.x;
      u.prevZ = u.z;
      const d = Math.hypot(x - u.x, z - u.z) || 1;
      u.x += ((x - u.x) / d) * Math.min(d, 0.06);
      u.z += ((z - u.z) / d) * Math.min(d, 0.06);
      ctx.resolveWalls(u);
    }
  };
  walk(me, -hx + 5, W.z, 3);
  assert.equal(ctx.zoneOf(me.x), -1, `${map} : porte fermée, on reste dans la salle`);
  assert.ok(me.x <= -(hx + W.wall + 0.7), `${map} : arrêté devant la porte`);
  assert.ok(!ctx.los(me, guard) && !ctx.los(me, foe), `${map} : porte fermée, aucune ligne de vue`);
  // contre le rempart, à 2 m d'un adversaire de l'autre côté : pas de coup à travers le mur
  const wallFoe = unit('arcanist', -(hx + W.wall + 0.72), W.z + W.door + 2, 0),
    h0 = wallFoe.hp;
  guard.target = wallFoe;
  guard.swing = 0;
  guard.yaw = -Math.PI / 2; // face au mur (et à l'adversaire derrière)
  ctx.autoAttack(guard, 0.1);
  assert.equal(wallFoe.hp, h0, `${map} : pas d'auto-attaque à travers le rempart`);
  // l'IA attend ; chrono de manche et dampening arrêtés pendant la préparation
  // l'IA (salle est, au nord de la porte) vise une cible de l'arène plus au nord : tout droit, elle buterait dans le
  // rempart
  const bot = unit('sentinel', p1.x, E.z + 3, 1, { ai: true }),
    prey = unit('arcanist', hx - 8, E.z + 15, 0);
  bot.target = prey;
  const bx = bot.x;
  run(ctx, 5);
  assert.equal(bot.x, bx, `${map} : l'IA attend dans sa salle`);
  assert.ok(ctx.state.t === t0 && !ctx.state.elapsed && !ctx.state.dampening, `${map} : chrono arrêté`);
  assert.ok(ctx.state.prep > 14 && ctx.state.prep < 16, `${map} : compte à rebours`);
  assert.ok(!sounds.some(s => s.name === 'gates'), `${map} : portes encore fermées`);
  // à 0 : les portes s'ouvrent avec leur son, le chrono démarre
  run(ctx, 15.05);
  assert.ok(!ctx.state.prep && ctx.gatesOpen(), `${map} : portes ouvertes`);
  assert.equal(sounds.filter(s => s.name === 'gates').length, 1, `${map} : son d'ouverture, une fois`);
  run(ctx, 1);
  assert.ok(
    ctx.state.t < t0 && ctx.state.elapsed > 0.9 && ctx.state.elapsed < 1.1,
    `${map} : chrono lancé à l'ouverture`
  );
  // porte ouverte : ligne de vue par la porte seulement, passage vers l'arène
  const inDoor = unit('arcanist', -hx + 6, W.z, 1);
  assert.ok(ctx.los(me, inDoor), `${map} : on voit l'arène par la porte`);
  assert.ok(!ctx.los(me, guard), `${map} : le rempart cache toujours ce qui est à côté de la porte`);
  walk(me, -hx + 5, W.z, 4);
  assert.equal(ctx.zoneOf(me.x), 0, `${map} : on entre dans l'arène par la porte`);
  // l'IA sort de sa salle par la porte pour rejoindre sa cible
  run(ctx, 6);
  assert.equal(ctx.zoneOf(bot.x), 0, `${map} : l'IA passe la porte`);
  ctx.state.units.length = 0;
}
console.log(
  'OK - règles de combat (tests unitaires : DR, contrôles, dégâts, soins, sorts, incantations, auras, fin de manche, sons des sorts, salles de départ)'
);
