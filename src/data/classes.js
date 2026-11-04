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
      { n: 'Mortal Strike', cd: 5, c: 0 },
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
      { n: 'Dispel', cd: 0, c: 20 },
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
    { k: 'ambush', n: 'Ambush', cd: 0, c: 30, t: 'melee', dmg: 465 },
    { k: 'sap', n: 'Sap', cd: 0, c: 25, t: 'ranged', range: 5, dur: 8 },
    { k: 'cheapshot', n: 'Cheap Shot', cd: 0, c: 30, t: 'melee' },
    { k: 'stealth', n: 'Stealth', cd: 0, c: 0, t: 'self' },
    // même sort que dans la barre de base (même touche, une seule recharge : shareCooldown, forms.js)
    { ...CLASS.shade.skills.find(s => s.n === 'Shadowstep') }
  ]
};
const FORM_INFO = { cat: { speed: 1.3, swing: [1.0, 42] }, bear: { speed: 1, hp: 1.4, armor: 0.7, swing: [2.0, 45] } };
const barKey = u => u.form || (u.stealth ? 'stealth' : '');
function skillsOf(u) {
  return (u && CLASS[u.cls].bars?.[barKey(u)]) || CLASS[u.cls].skills;
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
    dmg: 210,
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
  // remplace Divine Hymn ; icône de l'utilisateur
  Dispel: {
    text: () =>
      `Instant, no cooldown: removes all magic effects from your current friendly target (target yourself to dispel you): Polymorph, fears, magic roots and slows (Frost Nova, Entangling Roots, Frost Bolt) and damage over time. Melee slows and stuns stay.`
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
  Backstab: {
    dmg: 215,
    crit: 0.22,
    slow: 0.6,
    dur: 6,
    text: (S, D) =>
      `${D(S.dmg)} damage (${pct(S.crit)} crit chance) and slows the target by ${pct(S.slow)} for ${sec(S.dur)}.`
  },
  Cloak: {
    dur: 5,
    text: S =>
      `Cloak of shadows: immune to spells (not to weapon attacks) for ${sec(S.dur)}. Removes magical roots and slows.`
  },
  'Kidney Shot': { dmg: 80, stun: 6, text: (S, D) => `${D(S.dmg)} damage and stuns for ${sec(S.stun)}.` },
  Vendetta: { burst: 6.5, text: S => `+35% damage for ${sec(S.burst)}.` },
  Shadowstep: {
    dmg: 80,
    range: 20,
    text: (S, D) =>
      `Teleports behind the target (up to ${S.range} m), facing its back; ${D(S.dmg)} damage on arrival. Usable in stealth without breaking it (no damage then).`
  },
  Stealth: {
    text: () => `Stealth (out of combat): nearly invisible and untargetable, -30% speed. Unlocks Ambush and Sap.`
  },
  Ambush: { text: (S, D) => `From stealth: ${D(S.dmg)} damage (30% crit chance). Breaks stealth.` },
  Sap: {
    text: S =>
      `From stealth, within ${S.range} m: incapacitates the target for ${sec(S.dur)} (shares diminishing returns with Polymorph). Any damage breaks it.`
  },
  'Shadow Bolt': { cast: 1.45, dmg: 215, text: (S, D) => `${sec(S.cast)} cast: ${D(S.dmg)} shadow damage.` },
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
// Trinket PvP (touche R) : brise tous les contrôles et donne un bouclier ; recharge en secondes.
const TRINKET = { cd: 90, shield: 80 };
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
