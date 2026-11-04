'use strict';
// Sons des sorts (esprit des MMO fantasy sans rien copier) : bruitages enregistrés sous licences libres (eau, glace,
// bol chantant, cloches… : s.sample, pack assets/audio/sfx_pack.js, licences LICENSES.md) et synthèse originale. Un
// sort = une entrée par table :
//   SPELL_SOUND  : son au lancement (instantanés : tout le sort ; incantations : l'appel de l'énergie) ;
//   SPELL_LOOP   : nappe tenue pendant l'incantation / la canalisation (SFX.castStart → SFX.castEnd) ;
//   SPELL_IMPACT : libération à la fin d'une incantation réussie (pas pour les canalisations) ;
//   SPELL_FIZZLE : échec (interrompu, annulé en bougeant / sautant, ligne de vue perdue), commun à tous les sorts.
// Recette ponctuelle : s = { tone, sweep, noise, metal } déjà réglés sur la position du lanceur (volume, panoramique) :
//   s.tone(fréq, durée, forme, volume, glissé vers, délai, filtre passe-bas, réverb, attaque)
//   s.sweep(durée, volume, fréq départ, fréq arrivée, délai, type de filtre, Q)
//   s.noise(durée, volume, fréq du filtre, délai, type de filtre)
//   s.metal(volume, délai, fréquence de base)
//   s.sample(sorte du pack, volume, { rate, delay, lowpass }) : bruitage enregistré, hauteur variée à chaque lancer
// Nappe : (l, durée) avec l = { voice, air, sample } (voir sfxBed, sfx.js).
// Les sorts de corps à corps gardent en plus le cri, le souffle de l'arme et l'impact enregistrés (sfx.js).
// Règle d'écoute : pas d'aigu strident (fréquences dominantes sous ~3 kHz, aigus brefs et doux).
// Couches communes : signature par école = accords (arcane / givre cristallins, sacré lumineux), souffles, sub grave.
const chord = (
  s,
  fs,
  d,
  v,
  { type = 'sine', delay = 0, spread = 0.03, glide = 0, lp = 0, rev = 0.45, attack = 0.04 } = {}
) =>
  fs.forEach((f, i) =>
    s.tone(f, d, type, v / (1 + i * 0.25), glide ? f * glide : null, delay + i * spread, lp, rev, attack)
  );
// scintillement : petites notes brèves et douces, de f0 à f1 (montantes ou descendantes)
const sparkle = (s, f0, f1, n, v, delay = 0, gap = 0.04) => {
  for (let i = 0; i < n; i++)
    s.tone(
      f0 * Math.pow(f1 / f0, i / Math.max(1, n - 1)),
      0.2,
      'sine',
      v * (1 - i / (n * 1.8)),
      null,
      delay + i * gap,
      0,
      0.55,
      0.005
    );
};
// poids : sinus grave qui tombe
const sub = (s, f, d, v, delay = 0) => s.tone(f, d, 'sine', v, f * 0.55, delay, 0, 0.1, 0.006);
// note qui s'épanouit lentement (attaque longue), réverbérée
const swell = (s, f, d, v, { type = 'sine', to = null, delay = 0, lp = 0, rev = 0.5 } = {}) =>
  s.tone(f, d, type, v, to, delay, lp, rev, d * 0.45);
// crépitement : petits éclats de bruit (glace qui craque, bois qui grince, os)
const crackle = (s, n, v, f, delay = 0, gap = 0.045) => {
  for (let i = 0; i < n; i++)
    s.noise(0.05, v * (1 - i / (n * 1.6)), f * (1 + (i % 3) * 0.18), delay + i * gap, 'bandpass');
};
const SPELL_SOUND = {
  // ---------- Guerrier : coups lourds, métal, cor de guerre grave ----------
  'Mortal Strike': s => {
    sub(s, 62, 0.5, 0.16, 0.06);
    s.metal(0.07, 0.07, 300);
    s.sweep(0.25, 0.08, 1800, 300, 0.05, 'lowpass', 1);
    s.tone(98, 0.45, 'sawtooth', 0.04, 73, 0.07, 500, 0.3);
  },
  Hamstring: s => {
    s.sweep(0.18, 0.1, 2600, 700, 0.05, 'bandpass', 2.5);
    s.tone(180, 0.18, 'triangle', 0.06, 110, 0.07);
    crackle(s, 2, 0.05, 900, 0.09);
  },
  Pummel: s => {
    s.tone(110, 0.16, 'square', 0.07, 60, 0, 900, 0.1);
    s.noise(0.08, 0.1, 1400, 0.01, 'lowpass');
    sub(s, 70, 0.25, 0.12, 0.01);
  },
  'Shield Wall': s => {
    s.metal(0.08, 0, 220);
    swell(s, 98, 1.1, 0.06, { type: 'sawtooth', to: 131, lp: 700 });
    swell(s, 147, 1.1, 0.04, { type: 'sawtooth', to: 196, lp: 900, delay: 0.05 });
    s.sweep(0.7, 0.06, 300, 1400, 0.05, 'bandpass', 4);
    sub(s, 55, 0.6, 0.12, 0.02);
  },
  Charge: s => {
    s.sweep(0.55, 0.15, 200, 1500, 0, 'lowpass', 0.8);
    s.tone(70, 0.55, 'sawtooth', 0.08, 45, 0, 400, 0.3);
    swell(s, 147, 0.45, 0.05, { type: 'sawtooth', to: 220, lp: 1100, delay: 0.05 });
    sub(s, 55, 0.4, 0.1, 0.1);
  },
  // ---------- Mage (04/11/2026, « réaliste » : le givre sonne comme de l'eau et de la glace) ----------
  'Frost Bolt': s => {
    // l'eau se rassemble (la nappe d'eau qui tourne prend le relais)
    s.sample('splash', 0.2, { rate: 1.1 });
    s.sweep(0.45, 0.04, 600, 1800, 0, 'bandpass', 3);
    sub(s, 98, 0.35, 0.05);
  },
  'Frost Nova': s => {
    s.sample('freeze', 0.4);
    s.sample('ice_snap', 0.3, { rate: 0.85 });
    s.sample('ice_shatter', 0.25, { rate: 0.8, delay: 0.15 });
    sub(s, 80, 0.45, 0.14);
  },
  Counterspell: s => {
    s.sample('thud', 0.35, { rate: 1.25 });
    s.sample('shimmer', 0.2, { rate: 1.6 });
    s.noise(0.07, 0.06, 2200, 0);
    sub(s, 90, 0.25, 0.1, 0.02);
  },
  'Arcane Barrier': s => {
    // cristal qui chante : bol chantant frappé, plus aigu
    s.sample('bowl_strike', 0.3, { rate: 1.5 });
    s.sample('shimmer', 0.25);
    sub(s, 98, 0.5, 0.08);
  },
  Blink: s => {
    s.sample('teleport', 0.4);
    s.sample('shimmer', 0.12, { rate: 1.4 });
    s.sweep(0.22, 0.06, 400, 2400, 0, 'bandpass', 2);
  },
  Polymorph: s => {
    // énergie espiègle (la nappe prend le relais)
    s.sample('arcane', 0.25);
    s.sweep(0.4, 0.04, 600, 1800, 0, 'bandpass', 3);
    s.tone(494, 0.3, 'triangle', 0.025, 587, 0.05, 0, 0.4);
  },
  // ---------- Prêtre : lumière douce et brève (souffles, harpe discrète), ombre pour Pain / Holy Terror ----------
  // 04/11/2026, « trop gênant, surtout les cloches ; c'est un jeu d'arène » : rien qui résonne (ni cloche, ni bol
  // chantant), sons courts et bas (tests/combat.test.js).
  'Flash Heal': s => {
    s.sweep(0.4, 0.035, 500, 1800, 0, 'bandpass', 2);
    s.sample('shimmer', 0.12, { rate: 0.9 });
    sub(s, 131, 0.3, 0.04);
  },
  'Power Shield': s => {
    s.sample('shimmer', 0.2, { rate: 0.8 });
    s.sweep(0.5, 0.05, 300, 1600, 0, 'bandpass', 2);
    sub(s, 110, 0.4, 0.08);
  },
  'Holy Terror': s => {
    s.tone(196, 1.0, 'sawtooth', 0.06, 147, 0, 900, 0.45);
    s.tone(208, 1.0, 'sawtooth', 0.04, 139, 0.02, 800, 0.45);
    sub(s, 82, 0.9, 0.14);
    s.sweep(0.9, 0.08, 1800, 250, 0.1, 'bandpass', 2);
    s.sweep(0.6, 0.06, 300, 1200, 0, 'lowpass', 1);
  },
  Dispel: s => {
    s.sample('chime', 0.15);
    s.sweep(0.4, 0.04, 800, 2200, 0, 'bandpass', 2);
    s.noise(0.15, 0.03, 1400, 0.05);
  },
  Smite: s => {
    s.sweep(0.45, 0.035, 500, 1600, 0, 'bandpass', 2);
    s.sample('shimmer', 0.1, { rate: 1.1 });
    sub(s, 98, 0.3, 0.04);
  },
  Pain: s => {
    s.tone(140, 0.6, 'sawtooth', 0.06, 90, 0, 700, 0.35);
    s.tone(148, 0.6, 'sawtooth', 0.04, 95, 0.03, 600, 0.35);
    s.sweep(0.55, 0.07, 1300, 250, 0, 'lowpass', 1);
    sub(s, 65, 0.5, 0.1);
  },
  // ---------- Chevalier de la mort : givre lourd, impie (ombre verdâtre, os, chaînes) ----------
  Obliterate: s => {
    s.sweep(0.3, 0.12, 2800, 600, 0.05, 'bandpass', 1.5);
    sub(s, 55, 0.5, 0.16, 0.06);
    sub(s, 50, 0.45, 0.13, 0.22);
    s.metal(0.05, 0.22, 260);
    crackle(s, 3, 0.05, 1500, 0.08);
  },
  'Death Grip': s => {
    s.sweep(0.5, 0.1, 300, 1500, 0, 'lowpass', 1);
    s.tone(82, 0.6, 'sawtooth', 0.07, 165, 0, 600, 0.35);
    for (let i = 0; i < 4; i++) s.metal(0.03, 0.05 + i * 0.07, 520 + i * 40); // chaîne qui file
    s.noise(0.15, 0.06, 900, 0.38, 'lowpass');
    sub(s, 62, 0.4, 0.1, 0.36);
  },
  Asphyxiate: s => {
    s.tone(110, 0.8, 'sawtooth', 0.06, 70, 0, 500, 0.35);
    s.sweep(0.8, 0.07, 900, 300, 0, 'bandpass', 6);
    for (let i = 0; i < 3; i++) s.noise(0.12, 0.05, 700 - i * 120, 0.15 + i * 0.18, 'bandpass');
    sub(s, 49, 0.6, 0.1);
  },
  'Pillar of Frost': s => {
    chord(s, [146.8, 220, 293.7], 1.1, 0.04, { type: 'sawtooth', lp: 1500, glide: 1.5, spread: 0.06 });
    s.sweep(0.9, 0.08, 2500, 600, 0, 'bandpass', 1.5);
    crackle(s, 6, 0.06, 1600, 0.1, 0.06);
    sub(s, 55, 0.8, 0.13);
  },
  'Death Coil': s => {
    s.tone(98, 0.8, 'sawtooth', 0.06, 196, 0, 800, 0.45);
    swell(s, 294, 0.7, 0.04, { to: 247, delay: 0.05 });
    s.sweep(0.7, 0.08, 400, 1600, 0, 'bandpass', 3);
    sub(s, 49, 0.7, 0.11, 0.1);
  },
  // ---------- Druide : nature (bois, vent, feuillages), lune, formes animales ----------
  Wrath: s => {
    swell(s, 220, 0.5, 0.05, { type: 'triangle', to: 294 });
    s.sweep(0.5, 0.05, 500, 1500, 0, 'bandpass', 3);
    crackle(s, 3, 0.04, 700, 0.1, 0.08);
  },
  'Entangling Roots': s => {
    s.noise(0.6, 0.08, 500, 0, 'lowpass');
    s.tone(73, 0.7, 'sawtooth', 0.06, 55, 0, 400, 0.35);
    crackle(s, 6, 0.06, 450, 0.08, 0.08); // bois qui grince
    sub(s, 55, 0.5, 0.1, 0.05);
    swell(s, 196, 0.7, 0.03, { type: 'triangle', to: 165, delay: 0.1 });
  },
  Rejuvenation: s => {
    sparkle(s, 523, 1568, 6, 0.04, 0, 0.07);
    s.sweep(0.8, 0.05, 600, 1800, 0, 'bandpass', 3);
    swell(s, 392, 0.9, 0.035, { to: 440 });
  },
  Moonfire: s => {
    s.tone(1175, 0.5, 'sine', 0.04, 587, 0, 0, 0.5);
    s.tone(587, 0.6, 'sine', 0.05, 294, 0.05, 0, 0.5);
    s.sweep(0.45, 0.08, 2600, 600, 0, 'bandpass', 2);
    sub(s, 73, 0.35, 0.11, 0.08);
    sparkle(s, 1319, 659, 4, 0.025, 0.08);
  },
  Regrowth: s => {
    chord(s, [262, 330, 392], 0.5, 0.045, { type: 'triangle', attack: 0.15, spread: 0.04 });
    s.sweep(0.5, 0.04, 500, 1400, 0, 'bandpass', 4);
  },
  'Cat Form': s => {
    s.sweep(0.35, 0.1, 300, 2000, 0, 'bandpass', 1.5);
    s.tone(330, 0.3, 'triangle', 0.045, 220, 0.05);
    s.tone(110, 0.4, 'sawtooth', 0.05, 82, 0.08, 600, 0.3);
  },
  'Bear Form': s => {
    s.sweep(0.45, 0.11, 200, 900, 0, 'lowpass', 1);
    s.tone(65, 0.55, 'sawtooth', 0.08, 49, 0, 350, 0.35);
    sub(s, 49, 0.5, 0.12, 0.05);
  },
  'Human Form': s => {
    s.sweep(0.4, 0.09, 1600, 400, 0, 'bandpass', 1.5);
    chord(s, [392, 523, 659], 0.5, 0.035, { delay: 0.05, spread: 0.05 });
  },
  Shred: s => {
    s.noise(0.12, 0.1, 1800, 0.05);
    s.noise(0.1, 0.08, 1200, 0.11);
    sub(s, 90, 0.2, 0.08, 0.06);
  },
  Rake: s => {
    for (let i = 0; i < 3; i++) s.sweep(0.1, 0.08, 2200, 900, 0.04 + i * 0.06, 'bandpass', 2);
    sub(s, 100, 0.2, 0.06, 0.08);
  },
  Maim: s => {
    sub(s, 80, 0.35, 0.14, 0.06);
    s.noise(0.15, 0.09, 900, 0.06, 'lowpass');
    s.tone(220, 0.3, 'triangle', 0.04, 150, 0.1, 0, 0.3);
  },
  'Wild Charge': s => {
    s.sweep(0.5, 0.13, 250, 1800, 0, 'lowpass', 0.8);
    s.tone(110, 0.4, 'triangle', 0.05, 165, 0.05);
    s.sweep(0.6, 0.05, 500, 1400, 0, 'bandpass', 2);
  },
  Maul: s => {
    sub(s, 58, 0.5, 0.16, 0.06);
    s.noise(0.2, 0.1, 700, 0.06, 'lowpass');
    s.tone(82, 0.4, 'sawtooth', 0.05, 62, 0.03, 400, 0.3); // grondement
  },
  Swipe: s => {
    s.sweep(0.4, 0.13, 400, 1600, 0, 'bandpass', 1);
    s.sweep(0.3, 0.07, 1400, 500, 0.15, 'bandpass', 1.5);
    sub(s, 70, 0.35, 0.1, 0.1);
  },
  'Demoralizing Roar': s => {
    s.tone(73, 1.0, 'sawtooth', 0.07, 55, 0, 450, 0.45);
    s.tone(110, 1.0, 'sawtooth', 0.045, 82, 0.03, 500, 0.45);
    s.sweep(1.0, 0.07, 300, 900, 0, 'lowpass', 1);
    sub(s, 49, 0.8, 0.12, 0.05);
  },
  // ---------- Voleur : lames vives, ombre feutrée (Cloak, Stealth, Shadowstep) ----------
  Backstab: s => {
    s.sweep(0.12, 0.1, 2000, 600, 0.04, 'bandpass', 2);
    s.tone(150, 0.18, 'triangle', 0.05, 90, 0.07);
    sub(s, 85, 0.2, 0.08, 0.07);
  },
  Cloak: s => {
    // voile d'ombre qui enveloppe : souffle large qui retombe, accord mineur sombre qui s'épanouit, sub
    s.sweep(0.8, 0.09, 1800, 250, 0, 'bandpass', 2);
    chord(s, [147, 175, 220], 1.1, 0.05, { type: 'triangle', attack: 0.18, spread: 0.04, rev: 0.6 });
    swell(s, 294, 0.9, 0.03, { to: 262, delay: 0.1 });
    sub(s, 55, 0.7, 0.11);
    s.noise(0.5, 0.04, 400, 0.1, 'lowpass');
  },
  'Kidney Shot': s => {
    sub(s, 90, 0.3, 0.14, 0.06);
    s.noise(0.1, 0.08, 800, 0.06, 'lowpass');
    s.tone(240, 0.35, 'triangle', 0.045, 160, 0.1, 0, 0.35);
  },
  Vendetta: s => {
    swell(s, 110, 0.9, 0.05, { type: 'sawtooth', to: 165, lp: 1200 });
    swell(s, 220, 0.9, 0.035, { type: 'sawtooth', to: 330, lp: 1200, delay: 0.05 });
    sub(s, 55, 0.2, 0.12, 0.05); // battements de cœur
    sub(s, 55, 0.2, 0.1, 0.35);
  },
  Shadowstep: s => {
    // aspiré dans l'ombre (souffle qui monte), réapparition (souffle qui retombe + sub)
    s.sweep(0.18, 0.09, 300, 1600, 0, 'bandpass', 2);
    s.sweep(0.35, 0.09, 1500, 250, 0.16, 'bandpass', 2);
    s.tone(196, 0.4, 'triangle', 0.035, 131, 0.16, 0, 0.5);
    sub(s, 82, 0.35, 0.1, 0.18);
  },
  Stealth: s => {
    // on se fond dans l'ombre : souffle feutré qui s'éteint, note grave qui glisse vers le bas, chuchotement
    s.sweep(0.8, 0.1, 1400, 180, 0, 'lowpass', 1);
    swell(s, 220, 0.9, 0.05, { type: 'triangle', to: 147, rev: 0.6 });
    swell(s, 330, 0.8, 0.03, { to: 220, delay: 0.08, rev: 0.6 });
    s.noise(0.6, 0.05, 900, 0.15, 'bandpass');
    sub(s, 62, 0.6, 0.09, 0.05);
  },
  Ambush: s => {
    sub(s, 65, 0.4, 0.15, 0.05);
    s.sweep(0.2, 0.1, 2400, 600, 0.04, 'bandpass', 2);
    s.metal(0.04, 0.06, 340);
  },
  Sap: s => {
    sub(s, 120, 0.2, 0.12, 0.04);
    s.noise(0.08, 0.06, 600, 0.04, 'lowpass');
    s.tone(196, 0.5, 'triangle', 0.03, 147, 0.08, 0, 0.5);
  },
  'Cheap Shot': s => {
    sub(s, 100, 0.25, 0.13, 0.04);
    s.tone(300, 0.25, 'triangle', 0.045, 200, 0.08);
    s.noise(0.08, 0.06, 1000, 0.05, 'lowpass');
  },
  // ---------- Démoniste : ombre (scies filtrées, dissonances, sub), feu gangrené ----------
  'Shadow Bolt': s => {
    swell(s, 98, 0.5, 0.06, { type: 'sawtooth', to: 131, lp: 700 });
    s.sweep(0.5, 0.06, 1200, 300, 0, 'lowpass', 1);
    sub(s, 55, 0.4, 0.08);
  },
  Fear: s => {
    swell(s, 220, 0.5, 0.04, { type: 'triangle', to: 208 });
    swell(s, 311, 0.5, 0.03, { type: 'triangle', to: 294, delay: 0.04 });
    s.sweep(0.5, 0.05, 1200, 400, 0, 'bandpass', 3);
  },
  'Spell Lock': s => {
    s.tone(196, 0.25, 'sawtooth', 0.07, 98, 0, 900, 0.25);
    s.tone(277, 0.2, 'sawtooth', 0.04, 139, 0.01, 900, 0.25);
    s.noise(0.1, 0.08, 900, 0.02, 'lowpass');
    sub(s, 65, 0.3, 0.1);
  },
  Corruption: s => {
    s.tone(82, 0.8, 'sawtooth', 0.06, 62, 0, 500, 0.4);
    s.tone(87, 0.8, 'sawtooth', 0.04, 65, 0.03, 450, 0.4);
    s.sweep(0.6, 0.06, 900, 300, 0.05, 'bandpass', 4);
    crackle(s, 4, 0.04, 500, 0.15, 0.09); // bouillonnement
  },
  'Demonic Gate': s => {
    s.sweep(0.6, 0.11, 200, 1400, 0, 'lowpass', 1);
    s.tone(55, 0.6, 'sawtooth', 0.07, 110, 0, 500, 0.4);
    s.sweep(0.5, 0.06, 1400, 300, 0.25, 'bandpass', 2);
    sub(s, 49, 0.6, 0.12, 0.25);
  },
  'Drain Life': s => {
    s.sweep(0.5, 0.07, 1500, 300, 0, 'bandpass', 2);
    swell(s, 147, 0.5, 0.04, { to: 123 });
    sub(s, 62, 0.4, 0.08);
  },
  // ---------- Commun ----------
  Trinket: s => {
    s.metal(0.06, 0, 520);
    chord(s, [523, 784, 1047], 0.6, 0.04, { spread: 0.05 });
    s.sweep(0.5, 0.06, 500, 2200, 0, 'bandpass', 3);
    sub(s, 82, 0.35, 0.09);
  }
};
// Nappes d'incantation / canalisation par école : durée de l'incantation d = montée jusqu'à la libération.
const BED = {
  // givre : eau qui tourne (enregistrée), souffle froid léger, sub
  frost: l => {
    l.sample('water_swirl', { vol: 0.3 });
    l.air(1600, { vol: 0.02, q: 2, sweep: 0.5, sweepDepth: 300 });
    l.voice(110, { vol: 0.03 });
  },
  // arcane (mouton) : énergie magique tenue (enregistrée), souffle, note qui ondule
  arcane: l => {
    l.sample('arcane', { vol: 0.28 });
    l.air(1300, { vol: 0.02, q: 2.5, sweep: 0.8, sweepDepth: 300 });
    l.voice(196, { type: 'triangle', vol: 0.02, vib: 5, vibDepth: 3 });
  },
  // sacré : lumière qui se rassemble (énergie enregistrée très basse, souffle doux, note grave), sans résonance
  holy: l => {
    l.sample('arcane', { vol: 0.12, rate: 0.85 });
    l.air(1200, { vol: 0.025, q: 1.2, sweep: 0.4, sweepDepth: 250 });
    l.voice(220, { vol: 0.012 });
  },
  // nature : bois qui chante (triangle au vibrato lent), vent dans les feuilles
  nature: (l, d) => {
    l.voice(220, { type: 'triangle', vol: 0.045, to: 330, rise: d, vib: 3, vibDepth: 3 });
    l.voice(330, { vol: 0.025, to: 440, rise: d, trem: 5, tremDepth: 0.4 });
    l.air(750, { vol: 0.05, q: 1.5, sweep: 0.5, sweepDepth: 300 });
  },
  // ombre : scies filtrées dissonantes qui montent, trémolo inquiétant, souffle sombre, sub
  shadow: (l, d) => {
    l.voice(110, { type: 'sawtooth', vol: 0.05, to: 165, rise: d, lp: 700, trem: 6, tremDepth: 0.5 });
    l.voice(116.5, { type: 'sawtooth', vol: 0.035, to: 155, rise: d, lp: 550 });
    l.voice(55, { vol: 0.07, trem: 3, tremDepth: 0.4 });
    l.air(450, { vol: 0.06, q: 0.8, kind: 'lowpass', sweep: 0.8, sweepDepth: 200 });
  },
  // vol de vie : souffle sombre qui aspire en une vague lente par tic (1 par seconde), note grave voilée, très bas.
  // 04/11/2026, « très gênant » : l'ancienne nappe (scie à 98 Hz, sub pulsé deux fois par seconde, souffle qui balayait
  // vite) bourdonnait et pompait pendant toute la canalisation de 5 s. Règle : pas de scie, rien de plus rapide que les
  // tics, volume total ≤ 0,1 (tests/combat.test.js).
  drain: l => {
    l.air(520, { vol: 0.04, q: 1, kind: 'lowpass', sweep: 1, sweepDepth: 180 });
    l.voice(147, { vol: 0.022, vib: 0.5, vibDepth: 3, trem: 1, tremDepth: 0.5 });
    l.voice(73.5, { type: 'triangle', vol: 0.025 });
  }
};
const SPELL_LOOP = {
  'Frost Bolt': BED.frost,
  Polymorph: BED.arcane,
  'Flash Heal': BED.holy,
  Smite: BED.holy,
  Wrath: BED.nature,
  Regrowth: BED.nature,
  'Shadow Bolt': BED.shadow,
  Fear: BED.shadow,
  'Drain Life': BED.drain
};
// Libération à la fin d'une incantation réussie : éclat (souffle bref), épanouissement harmonique, sub, longue réverb.
const SPELL_IMPACT = {
  'Frost Bolt': s => {
    s.sweep(0.25, 0.06, 600, 2000, 0, 'bandpass', 2); // départ du trait
    s.sample('ice_shatter', 0.4, { rate: 0.9, delay: 0.1 }); // glace qui se brise
    s.sample('splash', 0.25, { delay: 0.12 });
    sub(s, 70, 0.4, 0.12, 0.1);
  },
  Polymorph: s => {
    s.sample('shimmer', 0.25);
    s.sample('sheep', 0.35, { delay: 0.08 });
    s.noise(0.2, 0.04, 1500, 0); // petit « pouf »
  },
  'Flash Heal': s => {
    s.sample('harp', 0.2); // harpe brève et discrète
    s.sweep(0.35, 0.04, 600, 1800, 0, 'bandpass', 2);
    sub(s, 131, 0.35, 0.05);
  },
  Smite: s => {
    // éclat de lumière bref : souffle qui frappe, coup sourd, sub (rien qui résonne)
    s.sample('teleport', 0.25, { rate: 1.6 });
    s.sample('thud', 0.22, { rate: 1.4 });
    sub(s, 70, 0.35, 0.12);
  },
  Wrath: s => {
    s.sweep(0.4, 0.11, 700, 2400, 0, 'bandpass', 2);
    s.tone(300, 0.35, 'triangle', 0.07, 150, 0, 0, 0.35);
    s.noise(0.25, 0.07, 900, 0.03, 'lowpass');
    crackle(s, 4, 0.05, 650, 0.06, 0.05);
    sub(s, 65, 0.4, 0.12, 0.02);
  },
  Regrowth: s => {
    chord(s, [392, 523, 659, 784], 1.1, 0.065, { spread: 0.06, attack: 0.03, rev: 0.55 });
    sparkle(s, 784, 1760, 5, 0.035, 0.15, 0.06);
    s.sweep(0.7, 0.07, 500, 1600, 0, 'bandpass', 3);
    sub(s, 98, 0.5, 0.08);
  },
  'Shadow Bolt': s => {
    s.sweep(0.3, 0.09, 300, 1500, 0, 'lowpass', 1); // départ du trait
    s.tone(90, 0.55, 'sawtooth', 0.11, 40, 0.1, 600, 0.45);
    s.sweep(0.5, 0.1, 1800, 200, 0.1, 'lowpass', 0.8);
    sub(s, 55, 0.5, 0.15, 0.1);
    s.tone(156, 0.6, 'sawtooth', 0.04, 104, 0.12, 700, 0.5);
  },
  Fear: s => {
    s.tone(196, 0.9, 'sawtooth', 0.05, 98, 0, 700, 0.5);
    s.tone(277, 0.9, 'sawtooth', 0.035, 139, 0.02, 700, 0.5); // triton : malaise
    s.sweep(0.8, 0.07, 1500, 250, 0, 'bandpass', 3);
    sub(s, 62, 0.6, 0.1);
  }
};
// Échec : le souffle de l'énergie retombe, petit accord dissonant grave qui s'affaisse, pétillement étouffé.
const SPELL_FIZZLE = s => {
  s.sweep(0.5, 0.09, 1600, 200, 0, 'lowpass', 1.2);
  s.tone(233, 0.45, 'triangle', 0.06, 165, 0.02, 1200, 0.3);
  s.tone(247, 0.45, 'triangle', 0.05, 175, 0.02, 1200, 0.3);
  sub(s, 82, 0.3, 0.09);
  crackle(s, 3, 0.04, 800, 0.05, 0.06);
};
// Volume des sons de sorts (04/11/2026 : +70 % demandé, trop discrets face aux coups de mêlée enregistrés) ; le
// limiteur de sortie (music.js) évite la saturation quand plusieurs sorts se superposent.
const SPELL_GAIN = 1.7;
// bruitage enregistré : hauteur variée de ±4 % à chaque lancer (jamais deux fois exactement le même son)
const sfxVary = () => 0.96 + Math.random() * 0.08;
// Joue une recette ponctuelle à la position de l'unité.
function playRecipe(recipe, u) {
  const a = sfxSpatial(u),
    L = a.level * SPELL_GAIN,
    P = a.pan;
  recipe({
    tone: (f, d, type, v, slide = null, delay = 0, filter = 0, rev = 0.12, attack = 0.008) =>
      sfxTone(f, d, type, v * L, slide, delay, P, filter, rev, attack),
    sweep: (d, v, f0, f1, delay = 0, kind = 'bandpass', q = 1.2) => sfxSweep(d, v * L, f0, f1, delay, P, kind, q),
    noise: (d, v, f, delay = 0, kind = 'bandpass') => sfxNoise(d, v * L, f, delay, P, kind),
    metal: (v, delay = 0, base = 420) => sfxMetal(v * L, P, delay, base),
    sample: (kind, v, { rate = 1, delay = 0, lowpass = 0 } = {}) =>
      sfxSample(kind, v * L, P, { rate: rate * sfxVary(), delay, lowpass })
  });
}
// Son d'un sort dans une table ; false si le sort n'y a pas de son dédié.
function playSpellSound(table, u, name) {
  if (!table[name]) return false;
  playRecipe(table[name], u);
  return true;
}
// ---------- Nappe d'incantation : SFX.castStart / SFX.castEnd (appelés par le combat, relayés en ligne) ----------
const CAST_BEDS = new WeakMap(); // unité → { name, channel, bed }
// arrêt de la nappe : fondu court ; « done » laisse la libération prendre le relais
const CAST_FADE = { done: 0.1, stop: 0.2 },
  FAIL_FADE = 0.06;
function castStart(u, name, dur = 1.5, channel = false) {
  castEnd(u, 'stop'); // une nappe à la fois par unité
  const recipe = SPELL_LOOP[name],
    a = sfxSpatial(u),
    L = a.level * SPELL_GAIN,
    bed = recipe ? sfxBed(a.pan, dur + 0.6) : null;
  if (bed)
    recipe(
      {
        voice: (f, o = {}) => bed.voice(f, { ...o, vol: (o.vol ?? 0.05) * L }),
        air: (f, o = {}) => bed.air(f, { ...o, vol: (o.vol ?? 0.04) * L }),
        sample: (kind, o = {}) => bed.sample(kind, { ...o, vol: (o.vol ?? 0.3) * L, rate: (o.rate ?? 1) * sfxVary() })
      },
      dur
    );
  CAST_BEDS.set(u, { name, channel, bed });
}
// raison : 'done' (réussie : libération, sauf canalisation), 'interrupt' / 'cancel' / 'fail' (son d'échec),
// 'stop' (mort, fin de manche, cible disparue : fondu silencieux). Sans nappe en cours : rien (appel en double).
function castEnd(u, reason = 'stop') {
  const c = CAST_BEDS.get(u);
  if (!c) return;
  CAST_BEDS.delete(u);
  c.bed?.stop(CAST_FADE[reason] ?? FAIL_FADE);
  if (reason === 'done') {
    if (!c.channel) playSpellSound(SPELL_IMPACT, u, c.name);
  } else if (reason !== 'stop') playRecipe(SPELL_FIZZLE, u);
}
Object.assign(SFX, { castStart, castEnd });
