'use strict';
// Formes du druide et camouflage : changement de barre (recharges gardées par barre), forme d'ours / de chat, Stealth, sorts spéciaux (champ k) lancés par useSkill (usage par l'IA : aiSpecial, ai.js).
// Bascule de barre : chaque barre garde ses recharges.
function syncBar(u) {
  u.cdSets = u.cdSets || { '': u.cd };
  const k = barKey(u);
  u.cdSets[k] = u.cdSets[k] || skillsOf(u).map(S => sharedCooldown(u, S.n));
  u.cd = u.cdSets[k];
  u.queuedSkill = null;
}
// Un sort présent dans plusieurs barres (Shadowstep : base et camouflage) n'a qu'une recharge : sinon on le relançait
// aussitôt en changeant de barre. Les autres sorts gardent la recharge de leur propre barre.
const barOf = (u, k) => (k && CLASS[u.cls].bars?.[k]) || CLASS[u.cls].skills;
function sharedCooldown(u, name) {
  let cd = 0;
  for (const [k, cs] of Object.entries(u.cdSets || {}))
    barOf(u, k).forEach((S, j) => {
      if (S.n === name) cd = Math.max(cd, cs[j] || 0);
    });
  return cd;
}
function shareCooldown(u, name, value) {
  for (const [k, cs] of Object.entries(u.cdSets || {}))
    barOf(u, k).forEach((S, j) => {
      if (S.n === name) cs[j] = value;
    });
}
function setForm(u, form) {
  const was = u.form,
    bear = FORM_INFO.bear;
  if (was === 'bear') {
    const k = u.hp / u.maxHp;
    u.maxHp = CLASS[u.cls].hp;
    u.hp = Math.max(1, Math.round(u.maxHp * k));
  }
  u.form = form || null;
  if (u.form === 'bear') {
    const k = u.hp / u.maxHp;
    u.maxHp = Math.round(CLASS[u.cls].hp * bear.hp);
    u.hp = Math.round(u.maxHp * k);
  }
  // changer de forme libère des entraves (racines, ralentissements) et de la Métamorphose
  u.root = 0;
  u.rootKind = null;
  u.slow = 0;
  if (u.poly > 0 && u.polyKind !== 'sap') endPoly(u, false);
  syncBar(u);
  fx(
    'blinkBurst',
    u.x,
    (u.y || 0) + 0.9,
    u.z,
    u.form === 'bear' ? [1, 0.6, 0.25] : u.form === 'cat' ? [1, 0.85, 0.35] : [0.6, 1, 0.45],
    0.6,
    0.9
  );
}
function setStealth(u, on) {
  if (!!u.stealth === on) return;
  u.stealth = on;
  syncBar(u);
  if (on) {
    for (const v of state.units)
      if (v.team !== u.team && v.target === u) {
        v.target = null;
        if (v.lastEnemy === u) v.lastEnemy = null;
      }
    fx('cloak', u.x, (u.y || 0) + 1, u.z, [0.35, 0.3, 0.45], 0.5, 0.6);
  } else {
    const base = u.cdSets[''];
    base[5] = Math.max(base[5], 6);
  }
}
const inCombat = u => now() - (u.lastCombat || -99) < 3;
function useSpecialSkill(u, i) {
  const S = skillsOf(u)[i];
  if (!S || !u.alive || u.stun > 0 || u.fear > 0 || u.poly > 0 || u.mobility || u.cast || u.cd[i] > 0 || !canPay(u, i))
    return false;
  u.curSchool = S.s || 'physical';
  SPELL_NOW = S.n;
  // recharges de la barre du sort lancé : le sort peut changer de barre (sortie de camouflage, de forme) ; sans ça,
  // la recharge tombait dans l'autre barre (Cheap Shot remettait Kidney Shot à zéro)
  const cds = u.cd;
  const shift = ['cat', 'bear', 'human'].includes(S.k) || S.k === 'stealth';
  if (u.gcd > 0 && !(S.k === 'stealth' && u.stealth)) return false;
  let t = hostileTarget(u);
  if (u.ai && t) u.target = t;
  const d = t ? d2(u, t) : 999,
    melee = !!t && d < 2.45,
    c = CLASS[u.cls];
  const k = S.k;
  let ok = true,
    paid = false;
  if (k === 'cat' || k === 'bear') setForm(u, k);
  else if (k === 'human') setForm(u, null);
  else if (k === 'stealth') {
    if (u.stealth) setStealth(u, false);
    else if (inCombat(u)) {
      unitError(u, "I can't do that while in combat");
      return false;
    } else setStealth(u, true);
  } else if (k === 'shred' || k === 'maul') {
    if (!melee) return false;
    face(u, t);
    damage(u, t, S.dmg, Math.random() < 0.18);
    action(u, 'melee');
  } else if (k === 'rake') {
    if (!melee) return false;
    face(u, t);
    damage(u, t, S.dmg);
    applySlow(t, 0.3, 6);
    action(u, 'melee');
  } else if (k === 'maim') {
    if (!melee) return false;
    face(u, t);
    damage(u, t, 60);
    control(t, 'stun', S.stun, u);
    action(u, 'melee');
  } else if (k === 'swipe') {
    const hit = enemies(u).filter(e => d2(u, e) < S.r && !e.stealth);
    hit.forEach(e => damage(u, e, S.dmg));
    fx('slash', u.x, (u.y || 0) + 0.9, u.z, c.accent, 0.9, 0.5);
    action(u, 'melee');
  } else if (k === 'roar') {
    // cri démoralisant : les ennemis à 8 m infligent 15 dégâts physiques de moins par seconde (aura « weaken »)
    for (const e of enemies(u)) if (d2(u, e) < S.radius) addAura(e, u, S.n, 'weaken', S.per, S.dur);
    fx('ring', u.x, 0.1, u.z, [1, 0.55, 0.2], 0.9, S.radius / 4);
    action(u, 'cast');
  } else if (k === 'cheapshot') {
    // depuis le camouflage : étourdit 3 s ; rendements décroissants à part (pas partagés avec Kidney Shot)
    if (!melee) return false;
    face(u, t);
    u.res = Math.max(0, u.res - (S.c || 0));
    paid = true;
    setStealth(u, false);
    control(t, 'stun', S.stun, u, 'opener');
    fx('stun', t.x, (t.y || 0) + 1.45, t.z, c.accent, 0.55, 0.7);
    action(u, 'melee');
  } else if (k === 'wildcharge') {
    ok = beginCharge(u, t, { cc: 'root', dur: 2 });
    if (!ok) return false;
  } else if (k === 'ambush') {
    if (!melee) return false;
    face(u, t);
    setStealth(u, false);
    damage(u, t, S.dmg, Math.random() < 0.3);
    action(u, 'melee');
  } else if (k === 'sap') {
    if (!t || d > S.range || !los(u, t) || t.poly > 0) return false;
    face(u, t);
    if (control(t, 'poly', S.dur, u)) t.polyKind = 'sap';
    t.cast = null;
    action(u, 'melee');
  } else return false;
  if (!ok) return false;
  if (!['cat', 'bear', 'human'].includes(k)) fx('ring', u.x, 0.12, u.z, c.accent, 0.4, 0.6);
  spellSfxKind(u, S);
  if (!paid) u.res = Math.max(0, u.res - (S.c || 0)); // coût du sort lancé (la barre a pu changer : camouflage)
  cds[i] = S.cd;
  if (!(k === 'stealth' && !u.stealth)) u.gcd = u.gcdMax = 1;
  updateUI();
  return true;
}
