'use strict';
// Données de jeu : classes, sorts (portée, école, interruption), icônes, formes du druide / camouflage, races.
const CLASS = {
  sentinel: {
    name: 'Warrior',
    role: 'Tank / melee',
    color: [0.18, 0.46, 0.82],
    accent: [0.7, 0.86, 1],
    hp: 2400,
    speed: 6.0,
    res: 'Rage',
    regen: 9,
    skills: [
      { n: 'Mortal Strike', cd: 6, c: 0 },
      { n: 'Hamstring', cd: 0, c: 15 }, // pas de recharge propre : seulement le GCD
      { n: 'Pummel', cd: 12, c: 10 },
      { n: 'Shield Wall', cd: 22, c: 25 },
      { n: 'Charge', cd: 14, c: 18 }
    ],
    tags: ['melee', 'interrupt', 'peel']
  },
  arcanist: {
    name: 'Mage',
    role: 'Caster',
    color: [0.38, 0.28, 0.92],
    accent: [0.78, 0.68, 1],
    hp: 1470,
    speed: 5.5,
    res: 'Mana',
    regen: 12,
    skills: [
      { n: 'Frost Bolt', cd: 1.5, c: 12 },
      { n: 'Frost Nova', cd: 9, c: 18 },
      { n: 'Counterspell', cd: 14, c: 10 },
      { n: 'Arcane Barrier', cd: 15, c: 20 },
      { n: 'Blink', cd: 15, c: 10 },
      { n: 'Polymorph', cd: 0, c: 18 }
    ],
    tags: ['burst', 'cast', 'control']
  },
  oracle: {
    name: 'Priest',
    role: 'Healer',
    color: [0.92, 0.82, 0.58],
    accent: [1, 0.95, 0.76],
    hp: 1620,
    speed: 5.6,
    res: 'Mana',
    regen: 6,
    skills: [
      { n: 'Flash Heal', cd: 1.3, c: 28 },
      { n: 'Power Shield', cd: 8, c: 24 },
      { n: 'Holy Terror', cd: 24, c: 22 },
      { n: 'Dispel', cd: 8, c: 20 },
      { n: 'Smite', cd: 0, c: 10 },
      { n: 'Pain', cd: 0, c: 15 }
    ],
    tags: ['heals', 'shields', 'support']
  },
  reaver: {
    name: 'Death Knight',
    role: 'Bruiser',
    color: [0.28, 0.4, 0.52],
    accent: [0.52, 0.88, 1],
    hp: 2175,
    speed: 5.9,
    res: 'Runic Power',
    regen: 10,
    skills: [
      { n: 'Obliterate', cd: 5, c: 0 },
      { n: 'Death Grip', cd: 25, c: 15 },
      { n: 'Asphyxiate', cd: 12, c: 18 },
      { n: 'Pillar of Frost', cd: 24, c: 25 },
      { n: 'Death Coil', cd: 15, c: 20 }
    ],
    tags: ['pressure', 'grip', 'melee']
  },
  warden: {
    name: 'Druid',
    role: 'Hybrid',
    color: [0.92, 0.48, 0.12],
    accent: [0.72, 1, 0.42],
    hp: 1875,
    speed: 6.15,
    res: 'Nature',
    regen: 11,
    skills: [
      { n: 'Wrath', cd: 0, c: 12 },
      { n: 'Entangling Roots', cd: 10, c: 16 },
      { n: 'Rejuvenation', cd: 0, c: 18 },
      { n: 'Moonfire', cd: 0, c: 14 },
      { n: 'Regrowth', cd: 0, c: 22 },
      { k: 'cat', n: 'Cat Form', cd: 0, c: 0 },
      { k: 'bear', n: 'Bear Form', cd: 0, c: 0 }
    ],
    tags: ['hybrid', 'roots', 'shapeshift']
  },
  shade: {
    name: 'Rogue',
    role: 'Control',
    color: [0.34, 0.38, 0.46],
    accent: [1, 0.86, 0.38],
    hp: 1770,
    speed: 6.65,
    res: 'Energy',
    regen: 17,
    skills: [
      { n: 'Backstab', cd: 2.5, c: 15 },
      { n: 'Cloak', cd: 30, c: 20 },
      { n: 'Kidney Shot', cd: 30, c: 22 },
      { n: 'Vendetta', cd: 24, c: 25 },
      { n: 'Shadowstep', cd: 13, c: 18 },
      { k: 'stealth', n: 'Stealth', cd: 0, c: 0 }
    ],
    tags: ['mobility', 'stun', 'burst']
  },
  warlock: {
    name: 'Warlock',
    role: 'Caster / DoT',
    color: [0.32, 0.16, 0.42],
    accent: [0.48, 1, 0.24],
    hp: 1740,
    speed: 5.45,
    res: 'Soul Power',
    regen: 11,
    skills: [
      { n: 'Shadow Bolt', cd: 1.6, c: 12 },
      { n: 'Fear', cd: 0, c: 18 },
      { n: 'Spell Lock', cd: 15, c: 12 },
      { n: 'Corruption', cd: 0, c: 14 },
      { n: 'Demonic Gate', cd: 15, c: 12 },
      { n: 'Drain Life', cd: 0, c: 20 }
    ],
    tags: ['DoT', 'fear', 'caster']
  }
};

function rgbHex(c) {
  return (
    '#' +
    c
      .map(v =>
        Math.round(clamp(v, 0, 1) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
function skillMotif(name) {
  const n = name.toLowerCase();
  if (/heal|hymn/.test(n)) return 'heal';
  if (/shield|bark|cloak/.test(n)) return 'shield';
  if (/nova|frost|pillar/.test(n)) return 'frost';
  if (/root|hamstring/.test(n)) return 'root';
  if (/silence|counter|pummel|lock/.test(n)) return 'silence';
  if (/charge|blink|step|advance|gate/.test(n)) return 'move';
  if (/fear|dark soul|vendetta|arcane power/.test(n)) return 'power';
  if (/grip/.test(n)) return 'grip';
  if (/starfall/.test(n)) return 'star';
  if (/stun|kidney|asphyx/.test(n)) return 'stun';
  if (/bolt/.test(n)) return 'bolt';
  if (/poly|morph/.test(n)) return 'sheep';
  if (/cat form/.test(n)) return 'claws'; // félin = griffures (spec : docs/SPEC.md)
  if (/bear form/.test(n)) return 'paw'; // ours = empreinte de patte
  if (/human form/.test(n)) return 'leaf';
  if (/stealth/.test(n)) return 'stealth';
  if (/sap|maim/.test(n)) return 'stun';
  if (/wrath/.test(n)) return 'bolt';
  if (/frenzied/.test(n)) return 'heal';
  if (/wild charge/.test(n)) return 'move';
  return 'strike';
}
// Icônes dessinées par l'utilisateur (assets/ui/spells/<sort>.webp, découpées par tools/build_spell_icons.js) :
// elles remplacent entièrement l'ancienne icône vectorielle ; les sorts sans illustration gardent celle-ci.
const SPELL_ART = new Set(
  (
    'ambush angelic_step arcane_bolt arcane_power asphyxiate backstab barkskin bear_form blink cat_form ' +
    'charge cloak counterspell dark_soul death_advance death_grip demonic_gate divine_hymn ' +
    'entangling_roots fear flash_heal frenzied_regeneration frost_nova hamstring human_form kidney_shot ' +
    'rejuvenation regrowth cheap_shot drain_life demoralizing_roar pain ' +
    'maim maul mortal_strike obliterate pillar_of_frost polymorph power_shield pummel rake sap ' +
    'shadow_bolt shadowstep shield_wall shred silence spell_lock starfall stealth swipe vendetta ' +
    'wild_charge wrath'
  ).split(' ')
);
const spellArtKey = n => n.toLowerCase().replace(/\W+/g, '_');
// Image d'un sort : la sienne, ou celle d'un sort remplacé (champ art de SPELLS)
const spellArt = n => SPELLS[n]?.art || spellArtKey(n);
function skillIconSVG(cls, i, S) {
  const C = CLASS[cls];
  S = S || C.skills[i];
  const art = spellArt(S.n);
  if (SPELL_ART.has(art))
    return `<svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image href="assets/ui/spells/${art}.webp" width="48" height="48" preserveAspectRatio="xMidYMid slice"/></svg>`;
  const a = rgbHex(C.accent),
    b = rgbHex(C.color),
    id = `g_${cls}_${S.n.replace(/\W/g, '')}`,
    m = skillMotif(S.n);
  const motifs = {
    strike: `<path d="M13 35L34 12l3 3-21 23-7 2 4-5z" fill="#eef6ff"/><path d="M12 12l24 24" stroke="${a}" stroke-width="5" stroke-linecap="round"/><path d="M11 11l26 26" stroke="#fff" stroke-width="1.5" opacity=".7"/>`,
    heal: `<circle cx="24" cy="24" r="13" fill="#fff6b8" opacity=".22"/><path d="M20 10h8v10h10v8H28v10h-8V28H10v-8h10z" fill="#fff7cb"/><path d="M24 5v5M24 38v5M5 24h5M38 24h5" stroke="${a}" stroke-width="2"/>`,
    shield: `<path d="M24 7l14 6v10c0 9-5 15-14 19-9-4-14-10-14-19V13z" fill="#d8efff" stroke="${a}" stroke-width="2.5"/><path d="M24 12v24c6-3 9-7 9-13v-7z" fill="${a}" opacity=".45"/>`,
    frost: `<path d="M24 5v38M7 14l34 20M7 34l34-20M13 7l4 7-8 1M35 7l-4 7 8 1M13 41l4-7-8-1M35 41l-4-7 8-1" stroke="#dff8ff" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="24" r="6" fill="${a}"/>`,
    root: `<path d="M24 5c-5 10 4 12-1 20-3 5-10 4-12 14M25 22c6 2 10-2 13-8M21 28c5 1 10 6 12 12" fill="none" stroke="#bdf27c" stroke-width="4" stroke-linecap="round"/><path d="M15 16l-5-5M33 28l7-3" stroke="${a}" stroke-width="3"/>`,
    silence: `<circle cx="24" cy="24" r="15" fill="none" stroke="#f0e4ff" stroke-width="3"/><path d="M13 35L35 13" stroke="${a}" stroke-width="6"/><path d="M17 20c4-5 10-5 14 0v8c-4 5-10 5-14 0z" fill="#ddd2ff" opacity=".65"/>`,
    move: `<path d="M6 25h23l-7-8 5-5 15 12-15 13-5-5 7-7H6z" fill="#e9fbff"/><path d="M8 15h14M5 34h16" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`,
    power: `<path d="M25 4l-5 15 9-2-7 27 18-27-10 2 5-15z" fill="${a}" stroke="#fff0d0" stroke-width="1.5"/><circle cx="24" cy="24" r="17" fill="none" stroke="${a}" stroke-width="2" opacity=".55"/>`,
    grip: `<path d="M8 17c6-8 14-7 17-1s-2 10-7 9-6-7-2-10M40 31c-6 8-14 7-17 1s2-10 7-9 6 7 2 10" fill="none" stroke="#d5ecff" stroke-width="4"/><path d="M17 31l14-14" stroke="${a}" stroke-width="5"/>`,
    star: `<path d="M24 5l5 12 13 1-10 8 4 13-12-7-12 7 4-13-10-8 13-1z" fill="#fff2a8" stroke="${a}" stroke-width="2"/><circle cx="39" cy="8" r="3" fill="#fff"/>`,
    stun: `<path d="M9 26l8-8 5 6 7-12 10 8-7 8 7 6-11 8-5-8-8 7z" fill="#ffe27a" stroke="${a}" stroke-width="2"/><circle cx="15" cy="11" r="3" fill="#fff3a0"/>`,
    paw: `<path d="M24 28c-6 0-11 4-11 9 0 3 3 5 6 4 2-1 3-2 5-2s3 1 5 2c3 1 6-1 6-4 0-5-5-9-11-9z" fill="#fff3d6"/><ellipse cx="12" cy="20" rx="4" ry="5.5" fill="#fff3d6"/><ellipse cx="20" cy="13" rx="4" ry="5.5" fill="#fff3d6"/><ellipse cx="28" cy="13" rx="4" ry="5.5" fill="#fff3d6"/><ellipse cx="36" cy="20" rx="4" ry="5.5" fill="#fff3d6"/><circle cx="24" cy="24" r="20" fill="none" stroke="${a}" stroke-width="2" opacity=".7"/>`,
    claws: `<path d="M10 10c4 10 6 20 4 30M20 7c3 11 4 22 1 34M30 7c2 11 2 22-1 34M39 11c0 10-2 20-5 29" stroke="#ffd9a8" stroke-width="4.5" stroke-linecap="round" fill="none"/><path d="M10 10c4 10 6 20 4 30M20 7c3 11 4 22 1 34M30 7c2 11 2 22-1 34M39 11c0 10-2 20-5 29" stroke="${a}" stroke-width="1.5" fill="none"/>`,
    leaf: `<path d="M10 38C10 18 22 8 40 8c0 18-10 30-30 30z" fill="#c9f59a"/><path d="M12 36L36 12" stroke="${a}" stroke-width="2.5"/>`,
    stealth: `<path d="M5 24c6-9 13-13 19-13s13 4 19 13c-6 9-13 13-19 13S11 33 5 24z" fill="#2a2235" stroke="#d9c9ff" stroke-width="2"/><circle cx="24" cy="24" r="6" fill="${a}"/><path d="M8 40L40 8" stroke="#d9c9ff" stroke-width="3" opacity=".8"/>`,
    sheep: `<ellipse cx="25" cy="26" rx="14" ry="10" fill="#f4f0ff"/><circle cx="16" cy="20" r="6" fill="#fff"/><circle cx="28" cy="18" r="6" fill="#fff"/><ellipse cx="10" cy="27" rx="5" ry="6" fill="#3a3348"/><path d="M17 34v8M24 35v8M31 35v8M37 33v8" stroke="#3a3348" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="19" fill="none" stroke="${a}" stroke-width="2" opacity=".7"/>`,
    bolt: `<circle cx="14" cy="30" r="7" fill="${a}"/><path d="M16 29c10-13 15-16 27-20-6 9-11 17-19 28z" fill="#e8faff"/><path d="M19 30c8-8 13-12 20-15" stroke="${a}" stroke-width="4"/>`
  };
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="30%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="#09070d"/></radialGradient></defs><rect width="48" height="48" rx="7" fill="url(#${id})"/><path d="M2 40C13 30 11 15 29 3" stroke="#fff" stroke-opacity=".10" stroke-width="7" fill="none"/>${motifs[m] || motifs.strike}<rect x="1" y="1" width="46" height="46" rx="6" fill="none" stroke="#fff" stroke-opacity=".22"/></svg>`;
}
function trinketIconSVG() {
  return `<svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image href="assets/ui/spells/trinket.webp" width="48" height="48" preserveAspectRatio="xMidYMid slice"/></svg>`;
}

// Portée (t) et école de magie (s) de chaque sort. melee = 2,45 m, ranged = 30 m (SPELL_RANGE) + ligne de vue.
// kick = interruption : coupe l'incantation et verrouille son école 4 s.
const SKILL_META = {
  sentinel: [{ t: 'melee' }, { t: 'melee' }, { t: 'melee', kick: 1 }, { t: 'self' }, { t: 'charge' }],
  arcanist: [
    { t: 'ranged', s: 'frost' },
    { t: 'aoe', s: 'frost' },
    { t: 'ranged', s: 'arcane', kick: 1 },
    { t: 'self', s: 'arcane' },
    { t: 'self', s: 'arcane' },
    { t: 'ranged', s: 'arcane' }
  ],
  oracle: [
    { t: 'heal', s: 'holy' },
    { t: 'heal', s: 'holy' },
    { t: 'aoe', s: 'shadow' },
    { t: 'heal', s: 'holy' },
    { t: 'ranged', s: 'holy' },
    { t: 'ranged', s: 'shadow' }
  ],
  reaver: [
    { t: 'melee' },
    { t: 'ranged', s: 'unholy' },
    { t: 'ranged', s: 'unholy' },
    { t: 'self', s: 'frost' },
    { t: 'ranged', s: 'shadow' }
  ],
  warden: [
    { t: 'ranged', s: 'nature' },
    { t: 'ranged', s: 'nature' },
    { t: 'heal', s: 'nature' },
    { t: 'ranged', s: 'arcane' },
    { t: 'heal', s: 'nature' },
    { t: 'self' },
    { t: 'self' }
  ],
  shade: [{ t: 'melee' }, { t: 'self' }, { t: 'melee' }, { t: 'self' }, { t: 'ranged' }, { t: 'self' }],
  warlock: [
    { t: 'ranged', s: 'shadow' },
    { t: 'ranged', s: 'shadow' },
    { t: 'ranged', s: 'shadow', kick: 1 },
    { t: 'ranged', s: 'shadow' },
    { t: 'self', s: 'shadow' },
    { t: 'ranged', s: 'shadow' }
  ]
};
for (const k in SKILL_META) SKILL_META[k].forEach((m, i) => Object.assign(CLASS[k].skills[i], m));
// ---------- Formes du druide et camouflage du voleur ----------
// Chaque forme a sa propre barre de sorts (et ses propres recharges) ; la barre « de base » est CLASS[cls].skills.
CLASS.warden.bars = {
  cat: [
    { k: 'shred', n: 'Shred', cd: 2.5, c: 0, t: 'melee', dmg: 150 },
    { k: 'rake', n: 'Rake', cd: 6, c: 0, t: 'melee', dmg: 80 },
    { k: 'maim', n: 'Maim', cd: 18, c: 0, t: 'melee', stun: 4 },
    { k: 'wildcharge', n: 'Wild Charge', cd: 14, c: 0, t: 'charge' },
    { k: 'bear', n: 'Bear Form', cd: 0, c: 0, t: 'self' },
    { k: 'human', n: 'Human Form', cd: 0, c: 0, t: 'self' }
  ],
  bear: [
    { k: 'maul', n: 'Maul', cd: 3, c: 0, t: 'melee', dmg: 120 },
    { k: 'swipe', n: 'Swipe', cd: 6, c: 0, t: 'aoe', dmg: 85, r: 5 },
    { k: 'roar', n: 'Demoralizing Roar', cd: 20, c: 0, t: 'aoe' },
    { k: 'wildcharge', n: 'Wild Charge', cd: 14, c: 0, t: 'charge' },
    { k: 'cat', n: 'Cat Form', cd: 0, c: 0, t: 'self' },
    { k: 'human', n: 'Human Form', cd: 0, c: 0, t: 'self' }
  ]
};
CLASS.shade.bars = {
  stealth: [
    { k: 'ambush', n: 'Ambush', cd: 0, c: 30, t: 'melee', dmg: 330 },
    { k: 'sap', n: 'Sap', cd: 0, c: 25, t: 'ranged', range: 5, dur: 8 },
    { k: 'cheapshot', n: 'Cheap Shot', cd: 0, c: 30, t: 'melee' },
    { k: 'stealth', n: 'Stealth', cd: 0, c: 0, t: 'self' }
  ]
};
const FORM_INFO = { cat: { speed: 1.3, swing: [1.0, 42] }, bear: { speed: 1, hp: 1.4, armor: 0.7, swing: [2.0, 45] } };
const barKey = u => u.form || (u.stealth ? 'stealth' : '');
function skillsOf(u) {
  return (u && CLASS[u.cls].bars?.[barKey(u)]) || CLASS[u.cls].skills;
}
// Bascule de barre : chaque barre garde ses recharges.
function syncBar(u) {
  u.cdSets = u.cdSets || { '': u.cd };
  const k = barKey(u);
  u.cdSets[k] = u.cdSets[k] || skillsOf(u).map(() => 0);
  u.cd = u.cdSets[k];
  u.queuedSkill = null;
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
  u.rootBreakDamage = 0;
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
// Stratégie des formes (druide) et du camouflage (voleur) avant la logique générale.
function aiSpecial(u, P) {
  const ready = k => {
    const bar = skillsOf(u),
      i = bar.findIndex(s => s.k === k);
    return i >= 0 && aiCanUse(u, i) ? i : -1;
  };
  if (u.cls === 'warden') {
    if (!u.form) {
      const i = ready(hpPct(u) < 0.4 ? 'bear' : 'cat');
      if (aiCanUse(u, i) && useSkill(u, i)) return true;
      return false;
    }
    if (u.form === 'cat' && hpPct(u) < 0.35 && Math.random() < P.defensive) {
      const i = ready('bear');
      if (i >= 0 && useSkill(u, i)) return true;
    }
    if (u.form === 'bear' && hpPct(u) > 0.8) {
      const i = ready('cat');
      if (i >= 0 && useSkill(u, i)) return true;
    }
  }
  if (u.cls === 'shade') {
    const foes = enemies(u).filter(e => !e.stealth);
    if (!u.stealth) {
      const i = ready('stealth');
      if (!inCombat(u) && i >= 0 && foes.every(e => d2(u, e) > 9) && useSkill(u, i)) return true;
      return false;
    }
    const healer = foes.find(e => isHealer(e) && !ccd(e) && (e.dr.poly ?? 1) > 0),
      focus = teamFocus(u);
    if (healer && healer !== focus && Math.random() < P.cc && d2(u, healer) < 5) {
      const i = ready('sap');
      if (i >= 0 && aiCastOn(u, i, healer)) return true;
    }
    if (focus && d2(u, focus) < 2.45 && (focus.dr.opener ?? 1) > 0 && !ccd(focus)) {
      const i = ready('cheapshot');
      if (i >= 0 && aiCastOn(u, i, focus)) return true;
    }
    if (focus && d2(u, focus) < 2.45) {
      const i = ready('ambush');
      if (i >= 0 && aiCastOn(u, i, focus)) return true;
    }
  }
  return false;
}
const RACE = {
  human: {
    name: 'Human',
    glyph: '🛡️',
    skin: [0.78, 0.62, 0.48],
    ear: 1,
    shoulder: 1,
    height: 1.0,
    bulk: 1.0,
    beard: false,
    helmBias: 0,
    desc: 'Versatile and heroic'
  },
  dwarf: {
    name: 'Dwarf',
    glyph: '⛏️',
    skin: [0.82, 0.67, 0.52],
    ear: 0.82,
    shoulder: 1.15,
    height: 0.86,
    bulk: 1.18,
    beard: true,
    helmBias: 0,
    desc: 'Short, stout and bearded'
  },
  elf: {
    name: 'Elf',
    glyph: '🌙',
    skin: [0.73, 0.58, 0.46],
    ear: 1.55,
    shoulder: 0.96,
    height: 1.06,
    bulk: 0.92,
    beard: false,
    helmBias: 0,
    desc: 'Tall, slender, pointed ears'
  },
  orc: {
    name: 'Orc',
    glyph: '🪓',
    skin: [0.42, 0.62, 0.24],
    ear: 0.75,
    shoulder: 1.22,
    height: 1.03,
    bulk: 1.22,
    beard: false,
    helmBias: 0.15,
    desc: 'Huge, green skin and tusks'
  },
  undead: {
    name: 'Undead',
    glyph: '☠️',
    skin: [0.63, 0.72, 0.74],
    ear: 1.15,
    shoulder: 1.02,
    height: 1.0,
    bulk: 0.95,
    beard: false,
    helmBias: -0.08,
    desc: 'Pale frame and spectral eyes'
  }
};
function raceForClass(cls, team = 0, slot = 0) {
  const m = {
    sentinel: 'human',
    arcanist: 'elf',
    oracle: 'human',
    warden: 'elf',
    shade: 'elf',
    warlock: 'orc',
    reaver: 'undead'
  };
  let r = m[cls] || 'human';
  if (cls === 'sentinel' && slot === 2) r = 'dwarf';
  if (cls === 'oracle' && team === 1) r = 'dwarf';
  if (cls === 'arcanist' && team === 1) r = 'elf';
  if (cls === 'reaver' && team === 1) r = 'orc';
  return r;
}

// ---------- Valeurs et textes des sorts : SOURCE UNIQUE ----------
// Le combat (src/game/combat.js) et les infobulles (src/ui/skillbar.js) lisent ces champs.
// dmg/heal/shield : points ; crit : chance ; dur/stun/root : secondes ; cast : temps d'incantation ; dist/radius : mètres.
// text(S, D, H) : D(x) affiche des dégâts (Burst inclus), H(x) des soins (Dampening inclus).
const pct = x => `${Math.round(x * 100)} %`;
const sec = x => `${x} s`;
// Drain Life : soin = dégâts infligés × DRAIN_HEAL (doublé avec les PV +50 %)
const DRAIN_HEAL = 2;
const SPELLS = {
  'Mortal Strike': {
    dmg: 175,
    crit: 0.18,
    antiheal: 0.25,
    text: (S, D) =>
      `Brutal strike: ${D(S.dmg)} damage (${pct(S.crit)} crit chance). Reduces healing taken by ${pct(S.antiheal)} (stacks to 50%, fades slowly).`
  },
  Hamstring: {
    dmg: 10,
    slow: 0.5,
    dur: 15,
    text: (S, D) => `${D(S.dmg)} damage and slows the target by ${pct(S.slow)} for ${sec(S.dur)}.`
  },
  Pummel: { text: () => `Interrupts the target’s cast and locks that school of magic for 4 s.` },
  'Shield Wall': {
    shield: 390,
    text: S => `Grants a shield absorbing <b class="tHeal">${S.shield}</b> damage.`
  },
  Charge: {
    dmg: 55,
    stun: 2,
    text: (S, D) => `Rush an enemy 2.8–15 m away: ${D(S.dmg)} damage and stuns for ${sec(S.stun)}.`
  },
  'Frost Bolt': {
    cast: 1.35,
    dmg: 205,
    slow: 0.6,
    dur: 12,
    art: 'arcane_bolt', // l'illustration de l'utilisateur était déjà une flèche de givre
    text: (S, D) =>
      `${sec(S.cast)} cast: ${D(S.dmg)} frost damage and slows the target by ${pct(S.slow)} for ${sec(S.dur)} (no diminishing returns).`
  },
  'Frost Nova': {
    dmg: 90,
    dmg2: 60,
    root: 6,
    radius: 8,
    text: (S, D) =>
      `Freezes enemies within ${S.radius} m: ${D(S.dmg)} damage to the target, ${D(S.dmg2)} to others, frozen ${sec(S.root)}. Your spells always crit frozen targets.`
  },
  Counterspell: { text: () => `Interrupts the target’s cast and locks that school of magic for 4 s.` },
  'Arcane Barrier': {
    shield: 300,
    art: 'arcane_power',
    text: S => `Instant: an arcane barrier absorbs <b class="tHeal">${S.shield}</b> damage.`
  },
  Blink: { dist: 7, text: S => `Teleports ${S.dist} m forward; breaks roots.` },
  Polymorph: {
    cast: 1.5,
    dur: 8,
    text: S =>
      `${sec(S.cast)} cast: turns the target into a sheep for ${sec(S.dur)} (then 4 s, 2 s, immune; resets after 20 s). Any damage breaks it.`
  },
  'Flash Heal': {
    cast: 1.15,
    heal: 440, // doublé avec les PV (+50 %), demande de l'utilisateur
    text: (S, D, H) => `${sec(S.cast)} cast: heals your friendly target (or you) for ${H(S.heal)}.`
  },
  'Power Shield': {
    shield: 300,
    text: S => `Shields your friendly target, absorbing <b class="tHeal">${S.shield}</b> damage.`
  },
  // icônes : celles des sorts remplacés (Silence, Angelic Step)
  'Holy Terror': {
    radius: 10,
    dur: 6,
    art: 'silence',
    text: S => `Instant: every enemy within ${S.radius} m flees in terror for ${sec(S.dur)}.`
  },
  // remplace Divine Hymn (même icône)
  Dispel: {
    art: 'divine_hymn',
    text: () =>
      `Instant: removes all magic effects from your friendly target (or you): Polymorph, fears, magic roots and slows (Frost Nova, Entangling Roots, Frost Bolt) and damage over time. Melee slows and stuns stay.`
  },
  Smite: {
    cast: 1.5,
    dmg: 100,
    art: 'angelic_step',
    text: (S, D) => `${sec(S.cast)} cast: holy light dealing ${D(S.dmg)} damage.`
  },
  Obliterate: {
    dmg: 190,
    crit: 0.16,
    antiheal: 0.16,
    text: (S, D) =>
      `Runic strike: ${D(S.dmg)} damage (${pct(S.crit)} crit chance), reduces healing taken by ${pct(S.antiheal)} (max 50%).`
  },
  'Death Grip': {
    dmg: 50,
    text: (S, D) => `Grabs an enemy within 30 m and pulls them in front of you: ${D(S.dmg)} damage.`
  },
  Asphyxiate: { dmg: 65, stun: 2.5, text: (S, D) => `Ranged: ${D(S.dmg)} damage and stuns for ${sec(S.stun)}.` },
  Pain: {
    dot: Math.round(CLASS.oracle.hp * 0.15),
    dur: 15,
    text: (S, D) => `Instant: ${D(S.dot)} shadow damage over ${sec(S.dur)}.`
  },
  'Death Coil': {
    pct: 0.15,
    text: S => `Hurls a ball of shadow: steals ${pct(S.pct)} of the target's maximum health (damages it and heals you).`
  },
  'Pillar of Frost': { burst: 7, text: S => `+35% damage and +18% speed for ${sec(S.burst)}.` },
  Wrath: { cast: 1.5, dmg: 175, text: (S, D) => `${sec(S.cast)} cast: ${D(S.dmg)} nature damage.` },
  'Entangling Roots': { root: 5, text: S => `Roots grip the target: rooted for ${sec(S.root)}.` },
  // effets dans la durée en % des PV de base de la classe (demande de l'utilisateur)
  Rejuvenation: {
    hot: Math.round(CLASS.warden.hp * 0.4),
    dur: 15,
    text: (S, D, H) => `Instant: heals your friendly target for ${H(S.hot)} over ${sec(S.dur)}.`
  },
  Regrowth: {
    cast: 1.15,
    heal: Math.round(CLASS.warden.hp * 0.15),
    hot: Math.round(CLASS.warden.hp * 0.003 * 15),
    dur: 15,
    text: (S, D, H) =>
      `${sec(S.cast)} cast: heals your friendly target for ${H(S.heal)}, then ${H(S.hot)} over ${sec(S.dur)}.`
  },
  Moonfire: {
    dmg: 50,
    dot: 125,
    dur: 15,
    art: 'starfall',
    text: (S, D) => `Instant: ${D(S.dmg)} arcane damage, then ${D(S.dot)} over ${sec(S.dur)}.`
  },
  'Cat Form': {
    text: (S, D) => `Cat form: +30% speed, fast melee attacks (${D(42)} every 1 s).`
  },
  'Bear Form': {
    text: (S, D) => `Bear form: +40% health, -30% damage taken, heavy blows (${D(58)} every 2 s).`
  },
  'Human Form': { text: () => `Return to your normal form.` },
  Shred: { text: (S, D) => `Shreds the target: ${D(S.dmg)} damage (18% crit chance).` },
  Rake: { text: (S, D) => `Rake: ${D(S.dmg)} damage and slows by 30% for 6 s.` },
  Maim: { text: (S, D) => `${D(60)} damage and stuns the target for ${sec(S.stun)}.` },
  'Wild Charge': { text: (S, D) => `Pounce on an enemy 2.8–15 m away: ${D(55)} damage and roots for 2 s.` },
  Maul: { text: (S, D) => `Paw strike: ${D(S.dmg)} damage (18% crit chance).` },
  Swipe: { text: (S, D) => `Swipe: ${D(S.dmg)} damage to all enemies within ${S.r} m.` },
  'Demoralizing Roar': {
    radius: 8,
    per: 15,
    dur: 10,
    text: S => `Enemies within ${S.radius} m deal ${S.per} less physical damage per second for ${sec(S.dur)}.`
  },
  'Cheap Shot': {
    stun: 3,
    text: S =>
      `From stealth: stuns the target for ${sec(S.stun)}. Separate diminishing returns from Kidney Shot. Breaks stealth.`
  },
  Backstab: { dmg: 150, crit: 0.22, text: (S, D) => `${D(S.dmg)} damage (${pct(S.crit)} crit chance).` },
  Cloak: {
    dur: 5,
    text: S =>
      `Cloak of shadows: immune to spells (not to weapon attacks) for ${sec(S.dur)}. Removes magical roots and slows.`
  },
  'Kidney Shot': { dmg: 55, stun: 6, text: (S, D) => `${D(S.dmg)} damage and stuns for ${sec(S.stun)}.` },
  Vendetta: { burst: 6.5, text: S => `+35% damage for ${sec(S.burst)}.` },
  Shadowstep: {
    dmg: 55,
    text: (S, D) => `Dash up to 8 m to the target; ${D(S.dmg)} damage if you reach melee range.`
  },
  Stealth: {
    text: () => `Stealth (out of combat): nearly invisible and untargetable, -30% speed. Unlocks Ambush and Sap.`
  },
  Ambush: { text: (S, D) => `From stealth: ${D(S.dmg)} damage (30% crit chance). Breaks stealth.` },
  Sap: {
    text: S =>
      `From stealth, within ${S.range} m: incapacitates the target for ${sec(S.dur)} (shares diminishing returns with Polymorph). Any damage breaks it.`
  },
  'Shadow Bolt': { cast: 1.45, dmg: 195, text: (S, D) => `${sec(S.cast)} cast: ${D(S.dmg)} shadow damage.` },
  Fear: {
    cast: 1.35,
    dur: 3.6,
    text: S => `${sec(S.cast)} cast: the target flees in terror for ${sec(S.dur)} (a big hit breaks it).`
  },
  'Spell Lock': { text: () => `Interrupts the target’s cast and locks that school of magic for 4 s.` },
  Corruption: {
    dot: Math.round(CLASS.warlock.hp * 0.2),
    dur: 15,
    art: 'dark_soul',
    text: (S, D) => `Instant: ${D(S.dot)} shadow damage over ${sec(S.dur)}.`
  },
  'Drain Life': {
    dur: 6,
    dps: 50,
    text: (S, D, H) =>
      `Channeled ${sec(S.dur)}: a link drains ${D(S.dps)} health per second from the target and heals you for ${H(S.dps * DRAIN_HEAL)} per second. Once started, the link follows the target even behind pillars.`
  },
  'Demonic Gate': { dist: 5, text: S => `Teleports ${S.dist} m forward.` }
};
// Fusionne valeurs et texte dans chaque sort (barres de base et barres de forme / camouflage).
for (const C of Object.values(CLASS))
  for (const bar of [C.skills, ...Object.values(C.bars || {})])
    for (const S of bar) Object.assign(S, SPELLS[S.n] || {});
// Incantation décrite par les données du sort (temps, valeur).
function castOf(u, i, target, type, value) {
  const S = skillsOf(u)[i];
  return { i, name: S.n, target, end: now() + S.cast, dur: S.cast, type, value, cost: S.c || 0 };
}

// ---------- Armures : réduction des dégâts selon le type d'armure de la classe ----------
// physical = coups d'arme (sorts sans école + auto-attaques) ; magic = sorts avec école (arcane, ombre, nature…).
const ARMOR = {
  plate: { label: 'Plate', physical: 0.3, magic: 0.05 },
  leather: { label: 'Leather', physical: 0.15, magic: 0.08 },
  cloth: { label: 'Cloth', physical: 0, magic: 0.1 }
};
const CLASS_ARMOR = {
  sentinel: 'plate',
  reaver: 'plate',
  warden: 'leather',
  shade: 'leather',
  arcanist: 'cloth',
  oracle: 'cloth',
  warlock: 'cloth'
};
for (const k in CLASS_ARMOR) CLASS[k].armor = CLASS_ARMOR[k];
// Réduction appliquée à un coup de l'école donnée ('physical' ou nom d'école magique).
function armorReduction(t, school) {
  const A = ARMOR[CLASS[t.cls]?.armor];
  if (!A) return 0;
  return school && school !== 'physical' ? A.magic : A.physical;
}
