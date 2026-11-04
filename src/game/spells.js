'use strict';
// Mécanique de chaque sort de la barre de base, par NOM (les valeurs et textes sont dans SPELLS, data/classes.js).
// useSkill (combat.js) vérifie l'état du lanceur (étourdi, recharges, ressource…), choisit la cible, puis appelle :
//   run(c) : effet du sort ; renvoie false si impossible (hors de portée, pas de cible…) → rien n'est consommé ;
//   fx(c)  : effet visuel au lancement (facultatif).
// c = { u: lanceur, t: cible ennemie ou null, S: sort, i: emplacement, d: distance, melee, range (30 m + ligne de vue),
//       col: couleur de la classe, origin: position avant un déplacement }.
// Options : mobility (GCD court 0,35 s), noFace (ne se tourne pas vers la cible), usableStunned (brise l'étourdissement).
// Les sorts de forme / camouflage (champ k) passent par useSpecialSkill (game/forms.js).
// Ajouter un sort : valeurs + texte dans SPELLS, place dans CLASS[cls].skills et SKILL_META, puis une entrée ici.
const allyOf = u => (u.ai ? lowestAlly(u) : friendlyTarget(u));
const chest = (o, h = 1.1) => [o.x, (o.y || 0) + h, o.z];
// coup de mêlée avec chance de critique ; antiheal = réduction des soins reçus (max 50 %) ; slow = ralentissement de
// mêlée (non magique) pendant S.dur
function strike(c) {
  const { u, t, S } = c;
  if (!c.melee) return false;
  damage(u, t, S.dmg, Math.random() < S.crit);
  if (S.slow) applySlow(t, S.slow, S.dur);
  if (S.antiheal) {
    t.antiheal = Math.min(0.5, t.antiheal + S.antiheal);
    markDebuff(t, 'antiheal');
  }
  action(u, 'melee');
}
function selfShield(c) {
  const { u, S } = c;
  u.shield += S.shield;
  u.shieldName = S.n;
  u.shieldSrc = u;
}
function kick(c, kind = 'cast') {
  if (!c.range) return false;
  interrupt(c.u, c.t);
  action(c.u, kind);
}
// sort à incantation (dégâts, soin, mouton, peur) : l'effet arrive à la fin (sim.js)
function startCast(c, type, value, target = c.t) {
  if (!c.range || c.u.silence > 0) return false;
  c.u.cast = castOf(c.u, c.i, target, type, value);
  action(c.u, 'cast');
}
// après un déplacement instantané : hors des murs, anneau au point d'arrivée
function landed(c) {
  resolveWalls(c.u);
  fx('ring', c.u.x, 0.12, c.u.z, c.col, 0.5, 0.75);
}
const trailFx = c => fx('trail', c.origin.x, (c.u.y || 0) + 0.6, c.origin.z, c.col, 0.36, 0.24, chest(c.u, 0.6));

const SPELL_CAST = {
  // ---------- Guerrier (sentinel) ----------
  'Mortal Strike': { run: strike, fx: c => fx('slash', ...chest(c.t || c.u), c.col, 0.32, 0.62) },
  Hamstring: {
    run(c) {
      if (!c.melee) return false;
      applySlow(c.t, c.S.slow, c.S.dur);
      damage(c.u, c.t, c.S.dmg);
      action(c.u, 'melee');
    },
    fx: c => fx('snare', (c.t || c.u).x, 0.1, (c.t || c.u).z, c.col, 0.62, 0.75)
  },
  Pummel: {
    run(c) {
      if (!c.melee) return false;
      interrupt(c.u, c.t);
      action(c.u, 'melee');
    },
    fx: c => fx('silence', ...chest(c.t || c.u, 1.2), c.col, 0.38, 0.6)
  },
  'Shield Wall': {
    run(c) {
      selfShield(c);
      fx('ring', c.u.x, 0.5, c.u.z, c.col, 0.8, 1);
      action(c.u, 'cast');
    },
    fx: c => fx('shield', ...chest(c.u, 1.05), c.col, 0.9, 0.86)
  },
  // vraie ruée (pas de téléportation) : la traînée est créée pendant la course
  Charge: { mobility: true, run: c => beginCharge(c.u, c.t) || false },

  // ---------- Mage (arcanist) ----------
  'Frost Bolt': {
    run(c) {
      if (startCast(c, 'damage', c.S.dmg) === false) return false;
      c.u.cast.slow = { pct: c.S.slow, dur: c.S.dur }; // ralentit à l'impact (sim.js)
    },
    fx: c => fx('castArcane', ...chest(c.u, 1.25), c.col, 0.8, 0.55)
  },
  'Frost Nova': {
    noFace: true,
    run(c) {
      const { u, t, S } = c;
      // sort de zone : se lance même sans ennemi à portée (recharge et ressource consommées)
      enemies(u)
        .filter(e => d2(u, e) < S.radius && los(u, e))
        .forEach(e => {
          damage(u, e, e === t ? S.dmg : S.dmg2);
          // gel de 6 s qui ne casse pas sous les coups (demande de l'utilisateur)
          if (control(e, 'root', S.root, u)) e.rootKind = 'ice';
          fx('nova', e.x, 0.1, e.z, c.col, 0.72, 0.75);
        });
      fx('nova', u.x, 0.1, u.z, c.col, 1.15, 1.8);
      action(u, 'cast');
    },
    fx: c => fx('nova', c.u.x, 0.1, c.u.z, c.col, 0.82, 1.65)
  },
  Counterspell: { run: kick, fx: c => fx('silence', ...chest(c.t || c.u, 1.25), c.col, 0.52, 0.72) },
  'Arcane Barrier': {
    run(c) {
      selfShield(c);
      fx('shield', ...chest(c.u), [0.7, 0.55, 1], 0.9, 0.85);
      action(c.u, 'cast');
    },
    fx: c => fx('aura', c.u.x, 0.08, c.u.z, c.col, 1.0, 1.1)
  },
  // vers l'avant (pas vers la cible), utilisable étourdi
  Blink: {
    mobility: true,
    noFace: true,
    usableStunned: true,
    run(c) {
      blinkForward(c.u, c.S.dist);
      action(c.u, 'dash');
      landed(c);
    },
    fx(c) {
      const { u, origin: o, col } = c,
        y = u.y || 0;
      fx('blinkBurst', o.x, y + 0.9, o.z, col, 0.5, 0.72);
      fx('blinkBurst', u.x, y + 0.9, u.z, col, 0.6, 0.82);
      fx('blinkRibbon', o.x, y + 0.8, o.z, col, 0.42, 0.18, [u.x, y + 0.8, u.z]);
    }
  },
  Polymorph: {
    run: c => startCast(c, 'poly', c.S.dur),
    fx: c => fx('castArcane', ...chest(c.u, 1.25), [0.95, 0.8, 1], 0.8, 0.55)
  },

  // ---------- Prêtre (oracle) : soins sur la cible amie (IA : l'allié le plus blessé) ----------
  'Flash Heal': {
    run(c) {
      const a = allyOf(c.u);
      if (!a || !los(c.u, a) || c.u.silence > 0) return false;
      c.u.cast = castOf(c.u, c.i, a, 'heal', c.S.heal);
      action(c.u, 'cast');
    },
    fx: c => fx('healCast', ...chest(c.u, 1.35), c.col, 0.85, 0.5, chest(c.t || c.u, 1.3))
  },
  'Power Shield': {
    run(c) {
      const a = allyOf(c.u);
      if (!a) return false;
      a.shield += c.S.shield;
      a.shieldName = c.S.n;
      a.shieldSrc = c.u; // l'absorption est comptée en soins pour le prêtre (récap)
      fx('ring', a.x, 0.2, a.z, c.col, 0.8, 0.8);
      action(c.u, 'cast');
    },
    fx: c => fx('shield', ...chest(c.t || c.u), c.col, 0.85, 0.78)
  },
  // fear instantané de tous les ennemis à portée (rendements décroissants habituels)
  'Holy Terror': {
    run(c) {
      const { u, S } = c;
      // sort de zone : se lance même sans ennemi à portée (recharge et ressource consommées)
      enemies(u)
        .filter(e => d2(u, e) < S.radius && los(u, e) && !e.stealth)
        .forEach(e => {
          if (control(e, 'fear', S.dur, u)) fx('fear', ...chest(e, 1.15), c.col, 1.0, 1.05);
        });
      action(u, 'cast');
    },
    fx: c => fx('nova', c.u.x, 0.1, c.u.z, [0.7, 0.45, 1], 1.4, 1.2)
  },
  // retire les effets magiques de la cible amie (IA : l'allié choisi par ai.js, sinon le plus blessé)
  Dispel: {
    run(c) {
      // joueur : uniquement la cible actuelle si elle est amie (soi-même compris quand on se cible), jamais par défaut
      const a = c.u.ai ? c.u.aiDispel || lowestAlly(c.u) : c.u.target?.team === c.u.team ? c.u.target : null;
      if (!a?.alive || (a !== c.u && (!los(c.u, a) || d2(c.u, a) > SPELL_RANGE))) return false;
      dispel(a);
      c.dispelled = a;
      action(c.u, 'cast');
    },
    fx(c) {
      const a = c.dispelled || c.u;
      fx('holyBurst', a.x, 0.12, a.z, c.col, 0.9, 1.2);
      fx('ring', a.x, 0.1, a.z, [1, 0.95, 0.7], 0.8, 1.1);
    }
  },
  Smite: { run: c => startCast(c, 'damage', c.S.dmg) },
  // dégâts dans la durée, sans dégât initial
  Pain: {
    run(c) {
      if (!c.range || c.u.silence > 0) return false;
      addAura(c.t, c.u, c.S.n, 'dot', c.S.dot, c.S.dur, 'shadow');
      fx('silence', ...chest(c.t, 1.25), [0.6, 0.35, 0.9], 0.55, 0.7);
      action(c.u, 'cast');
    }
  },

  // ---------- Chevalier de la mort (reaver) ----------
  Obliterate: { run: strike, fx: c => fx('slash', ...chest(c.t || c.u), c.col, 0.34, 0.65) },
  'Death Grip': {
    run(c) {
      if (!c.range) return false;
      damage(c.u, c.t, c.S.dmg);
      startGrip(c.u, c.t);
      action(c.u, 'cast');
    },
    fx: c => fx('chain', ...chest(c.u, 1.2), c.col, 0.42, 0.18, chest(c.t || c.u, 1.2))
  },
  Asphyxiate: {
    run(c) {
      if (!c.range) return false;
      damage(c.u, c.t, c.S.dmg);
      control(c.t, 'stun', c.S.stun);
      action(c.u, 'cast');
    },
    fx: c => fx('stun', ...chest(c.t || c.u, 1.45), c.col, 0.55, 0.7)
  },
  'Pillar of Frost': {
    run(c) {
      c.u.burst = c.S.burst;
      c.u.speedBuff = c.S.burst;
      fx('ring', c.u.x, 0.1, c.u.z, [1, 0.25, 0.05], 1, 1.15);
      action(c.u, 'cast');
    },
    fx: c => fx('frostAura', c.u.x, 0.1, c.u.z, c.col, 1.1, 1.2)
  },
  // vole 15 % des PV max de la cible (soin compté dans le récap)
  'Death Coil': {
    run(c) {
      const { u, t, S } = c;
      if (!c.range) return false;
      fx('shadowProjectile', ...chest(u, 1.5), [0.55, 1, 0.45], 0.45, 0.3, chest(t, 1.2));
      const h0 = t.hp;
      damage(u, t, t.maxHp * S.pct);
      if (h0 > t.hp) heal(u, u, h0 - t.hp);
      action(u, 'cast');
    }
  },

  // ---------- Druide (warden), forme humaine ----------
  Wrath: {
    run: c => startCast(c, 'damage', c.S.dmg),
    fx: c => fx('slash', ...chest(c.t || c.u), c.col, 0.32, 0.55)
  },
  'Entangling Roots': {
    run(c) {
      if (!c.range) return false;
      if (control(c.t, 'root', c.S.root, c.u)) c.t.rootKind = 'vines';
      fx('roots', c.t.x, 0.1, c.t.z, c.col, 0.8, 0.7);
      action(c.u, 'cast');
    },
    fx: c => fx('roots', (c.t || c.u).x, 0.08, (c.t || c.u).z, c.col, 0.9, 0.85)
  },
  // instantané, soin dans la durée
  Rejuvenation: {
    run(c) {
      const a = allyOf(c.u);
      if (!a || !los(c.u, a) || d2(c.u, a) > SPELL_RANGE) return false;
      addAura(a, c.u, c.S.n, 'hot', c.S.hot, c.S.dur, 'nature');
      action(c.u, 'cast');
    },
    fx: c => fx('holyBurst', (c.t || c.u).x, 0.1, (c.t || c.u).z, [0.35, 1, 0.45], 0.9, 1)
  },
  // dégâts directs puis dans la durée
  Moonfire: {
    run(c) {
      if (!c.range) return false;
      damage(c.u, c.t, c.S.dmg);
      addAura(c.t, c.u, c.S.n, 'dot', c.S.dot, c.S.dur, 'arcane');
      action(c.u, 'cast');
    },
    fx: c => fx('arcaneImpact', ...chest(c.t || c.u, 1.2), [0.7, 0.75, 1], 0.6, 0.7)
  },
  // incantation : soin direct puis dans la durée
  Regrowth: {
    run(c) {
      const a = allyOf(c.u);
      if (!a || !los(c.u, a) || d2(c.u, a) > SPELL_RANGE || c.u.silence > 0) return false;
      c.u.cast = castOf(c.u, c.i, a, 'heal', c.S.heal);
      c.u.cast.hot = { total: c.S.hot, dur: c.S.dur };
      action(c.u, 'cast');
    }
  },

  // ---------- Voleur (shade), hors camouflage ----------
  Backstab: { run: strike, fx: c => fx('slash', ...chest(c.t || c.u, 1.0), c.col, 0.28, 0.55) },
  // immunité aux sorts, libère des racines et ralentissements magiques
  Cloak: {
    run(c) {
      const u = c.u;
      u.spellImmune = c.S.dur;
      if (u.root > 0 && u.rootSchool !== 'physical') {
        u.root = 0;
        u.rootBreakDamage = 0;
      }
      if (u.slow > 0 && u.slowMagic) u.slow = 0;
      u.cast = null;
      fx('cloak', ...chest(u, 1), [0.6, 0.4, 0.9], 0.9, 0.7);
      fx('ring', u.x, 0.1, u.z, c.col, 0.7, 0.9);
      action(u, 'cast');
    },
    fx: c => fx('cloak', ...chest(c.u, 1.0), c.col, 0.8, 0.9)
  },
  'Kidney Shot': {
    run(c) {
      if (!c.melee) return false;
      damage(c.u, c.t, c.S.dmg);
      control(c.t, 'stun', c.S.stun);
      action(c.u, 'melee');
    },
    fx: c => fx('stun', ...chest(c.t || c.u, 1.45), c.col, 0.52, 0.65)
  },
  Vendetta: {
    run(c) {
      c.u.burst = c.S.burst;
      action(c.u, 'cast');
    },
    fx: c => fx('darkAura', c.u.x, 0.1, c.u.z, c.col, 0.9, 1.0)
  },
  Shadowstep: {
    mobility: true,
    run(c) {
      const { u, t, S } = c;
      if (!t || !c.range) return false;
      dashToward(u, t, 8);
      if (d2(u, t) < 2.7) damage(u, t, S.dmg);
      action(u, 'dash');
      landed(c);
    },
    fx: trailFx
  },

  // ---------- Démoniste (warlock) ----------
  'Shadow Bolt': {
    run: c => startCast(c, 'damage', c.S.dmg),
    fx: c => fx('castShadow', ...chest(c.u, 1.25), c.col, 0.9, 0.55)
  },
  Fear: {
    run: c => startCast(c, 'fear', c.S.dur),
    fx: c => fx('fear', ...chest(c.t || c.u), c.col, 0.85, 0.85)
  },
  'Spell Lock': { run: kick, fx: c => fx('silence', ...chest(c.t || c.u, 1.25), c.col, 0.55, 0.72) },
  // dégâts dans la durée
  Corruption: {
    run(c) {
      if (!c.range) return false;
      addAura(c.t, c.u, c.S.n, 'dot', c.S.dot, c.S.dur, 'shadow');
      action(c.u, 'cast');
    },
    fx: c => fx('silence', ...chest(c.t || c.u, 1.25), [0.6, 0.35, 0.9], 0.6, 0.7)
  },
  // ne libère ni des étourdissements ni des racines (utilisable immobilisé : on le reste)
  'Demonic Gate': {
    mobility: true,
    noFace: true, // vers l'avant du personnage, comme Blink (bug : il se tournait vers la cible et ramenait en arrière)
    run(c) {
      blinkForward(c.u, c.S.dist, true);
      action(c.u, 'dash');
      landed(c);
    },
    fx: trailFx
  },
  // canalisé 6 s, lien qui suit la cible même derrière un pilier (sim.js)
  'Drain Life': {
    run(c) {
      const { u, t, S } = c;
      if (!c.range || u.silence > 0) return false;
      u.cast = { ...castOf(u, c.i, t, 'channel', S.dps), end: now() + S.dur, dur: S.dur, channel: true, tick: 0 };
      action(u, 'cast');
    }
  }
};
