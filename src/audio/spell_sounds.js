'use strict';
// Son dédié de chaque sort (synthèse originale, aucun fichier audio) : SPELL_SOUND = son au lancement, SPELL_IMPACT =
// son à l'impact des sorts à incantation (fin de l'incantation, sim.js). Ajouter un sort = une entrée ici.
// Chaque recette reçoit s = { tone, sweep, noise, metal } déjà réglés sur la position du lanceur (volume, panoramique) :
//   s.tone(fréq, durée, forme, volume, glissé vers, délai, filtre passe-bas, réverb)
//   s.sweep(durée, volume, fréq départ, fréq arrivée, délai, type de filtre, Q)
//   s.noise(durée, volume, fréq du filtre, délai, type de filtre)
//   s.metal(volume, délai, fréquence de base)
// Les sorts de corps à corps gardent en plus le cri, le souffle de l'arme et l'impact enregistrés (sfx.js).
// Règle d'écoute : pas d'aigu strident (fréquences dominantes sous ~3 kHz, aigus brefs et doux).
const SPELL_SOUND = {
  // ---------- Guerrier ----------
  'Mortal Strike': s => {
    s.tone(62, 0.4, 'sine', 0.16, 34, 0.06);
    s.metal(0.06, 0.07, 300);
  },
  Hamstring: s => {
    s.sweep(0.18, 0.1, 2600, 700, 0.05, 'bandpass', 2.5);
    s.tone(180, 0.15, 'triangle', 0.05, 110, 0.07);
  },
  Pummel: s => {
    s.tone(110, 0.14, 'square', 0.07, 60, 0, 900, 0.1);
    s.noise(0.08, 0.1, 1400, 0.01, 'lowpass');
  },
  'Shield Wall': s => {
    s.metal(0.07, 0, 220);
    s.tone(98, 0.8, 'sawtooth', 0.04, 131, 0.05, 700, 0.35);
    s.sweep(0.6, 0.05, 300, 1200, 0.05, 'bandpass', 4);
  },
  Charge: s => {
    s.sweep(0.5, 0.15, 200, 1500, 0, 'lowpass', 0.8);
    s.tone(70, 0.5, 'sawtooth', 0.08, 45, 0, 400, 0.3);
    s.tone(140, 0.3, 'triangle', 0.05, 220, 0.1, 0, 0.2);
  },
  // ---------- Mage ----------
  'Frost Bolt': s => {
    s.tone(330, 1.0, 'sine', 0.035, 660, 0, 0, 0.3);
    s.sweep(1.0, 0.04, 2500, 900, 0, 'bandpass', 5);
  },
  'Frost Nova': s => {
    s.sweep(0.6, 0.12, 3200, 900, 0, 'bandpass', 1.2);
    for (let i = 0; i < 6; i++) s.tone(1100 + i * 210, 0.2, 'sine', 0.025, null, 0.05 + i * 0.04, 0, 0.3);
    s.tone(80, 0.35, 'sine', 0.12, 40, 0);
  },
  Counterspell: s => {
    s.tone(900, 0.12, 'triangle', 0.06, 300, 0, 2500, 0.15);
    s.tone(450, 0.25, 'sine', 0.05, 150, 0.04, 0, 0.3);
    s.noise(0.06, 0.08, 2200, 0);
  },
  'Arcane Barrier': s => {
    s.sweep(0.6, 0.06, 500, 2200, 0, 'bandpass', 5);
    [523, 784, 1047].forEach((f, i) => s.tone(f, 0.6, 'sine', 0.03, f * 1.01, i * 0.05, 0, 0.45));
  },
  Blink: s => {
    s.sweep(0.25, 0.1, 2400, 400, 0, 'bandpass', 2);
    s.tone(700, 0.18, 'sine', 0.05, 1400, 0, 0, 0.3);
  },
  Polymorph: s => {
    [392, 494, 587].forEach((f, i) => s.tone(f, 0.9, 'triangle', 0.025, f * 1.12, i * 0.12, 0, 0.35));
  },
  // ---------- Prêtre ----------
  'Flash Heal': s => {
    [659, 831, 988].forEach((f, i) => s.tone(f, 0.9, 'sine', 0.03, null, i * 0.08, 0, 0.4));
  },
  'Power Shield': s => {
    s.sweep(0.5, 0.07, 400, 2400, 0, 'bandpass', 4);
    [880, 1320, 1760].forEach((f, i) => s.tone(f, 0.5, 'triangle', 0.03, f * 1.5, i * 0.05, 0, 0.4));
  },
  'Holy Terror': s => {
    s.tone(196, 0.9, 'sawtooth', 0.05, 147, 0, 900, 0.4);
    s.tone(98, 0.9, 'sine', 0.1, 73, 0, 0, 0.3);
    s.sweep(0.8, 0.07, 1800, 300, 0.1, 'bandpass', 2);
  },
  Dispel: s => {
    [1047, 784, 1319].forEach((f, i) => s.tone(f, 0.35, 'sine', 0.035, null, i * 0.06, 0, 0.4));
    s.sweep(0.4, 0.05, 900, 2600, 0, 'bandpass', 3);
  },
  Smite: s => {
    s.tone(440, 1.0, 'triangle', 0.03, 660, 0, 0, 0.35);
    s.tone(660, 1.0, 'sine', 0.025, 990, 0.1, 0, 0.35);
  },
  Pain: s => {
    s.tone(140, 0.5, 'sawtooth', 0.05, 90, 0, 700, 0.3);
    s.sweep(0.45, 0.06, 1200, 250, 0, 'lowpass', 1);
  },
  // ---------- Chevalier de la mort ----------
  Obliterate: s => {
    s.sweep(0.3, 0.12, 2800, 600, 0.05, 'bandpass', 1.5);
    s.tone(55, 0.45, 'sine', 0.15, 30, 0.06);
  },
  'Death Grip': s => {
    s.sweep(0.5, 0.1, 300, 1500, 0, 'lowpass', 1);
    s.tone(82, 0.55, 'sawtooth', 0.07, 165, 0, 600, 0.3);
    s.noise(0.15, 0.06, 900, 0.35, 'lowpass');
  },
  Asphyxiate: s => {
    s.tone(110, 0.6, 'sawtooth', 0.06, 70, 0, 500, 0.3);
    s.sweep(0.6, 0.06, 900, 300, 0, 'bandpass', 6);
  },
  'Pillar of Frost': s => {
    [146.8, 220, 293.7].forEach((f, i) => s.tone(f, 0.9, 'sawtooth', 0.03, f * 1.5, i * 0.06, 1500, 0.4));
    s.sweep(0.8, 0.07, 2500, 600, 0, 'bandpass', 1.5);
  },
  'Death Coil': s => {
    s.tone(98, 0.7, 'sawtooth', 0.06, 196, 0, 800, 0.4);
    s.sweep(0.6, 0.08, 400, 1600, 0, 'bandpass', 3);
    s.tone(49, 0.6, 'sine', 0.1, 41, 0.1);
  },
  // ---------- Druide ----------
  Wrath: s => {
    s.tone(220, 1.0, 'triangle', 0.035, 330, 0, 0, 0.3);
    s.sweep(1.0, 0.04, 600, 1800, 0, 'bandpass', 4);
  },
  'Entangling Roots': s => {
    s.noise(0.5, 0.08, 500, 0, 'lowpass');
    s.tone(73, 0.6, 'sawtooth', 0.06, 55, 0, 400, 0.3);
    for (let i = 0; i < 4; i++) s.noise(0.05, 0.05, 1600, 0.1 + i * 0.09);
  },
  Rejuvenation: s => {
    [523, 659, 784].forEach((f, i) => s.tone(f, 0.7, 'sine', 0.03, f * 1.03, i * 0.1, 0, 0.45));
    s.sweep(0.6, 0.04, 800, 2000, 0, 'bandpass', 4);
  },
  Moonfire: s => {
    s.tone(587, 0.5, 'sine', 0.05, 294, 0, 0, 0.45);
    s.sweep(0.4, 0.07, 2600, 800, 0, 'bandpass', 2);
  },
  Regrowth: s => {
    s.tone(262, 1.0, 'triangle', 0.035, 392, 0, 0, 0.35);
    s.sweep(1.0, 0.04, 700, 1600, 0, 'bandpass', 4);
  },
  'Cat Form': s => {
    s.sweep(0.3, 0.1, 300, 2000, 0, 'bandpass', 1.5);
    s.tone(330, 0.25, 'triangle', 0.04, 220, 0.05);
  },
  'Bear Form': s => {
    s.sweep(0.4, 0.11, 200, 900, 0, 'lowpass', 1);
    s.tone(65, 0.45, 'sawtooth', 0.07, 49, 0, 350, 0.3);
  },
  'Human Form': s => {
    s.sweep(0.35, 0.09, 1600, 400, 0, 'bandpass', 1.5);
    s.tone(392, 0.3, 'sine', 0.04, 523, 0.05, 0, 0.3);
  },
  Shred: s => {
    s.noise(0.12, 0.1, 1800, 0.05);
    s.noise(0.1, 0.08, 1200, 0.11);
  },
  Rake: s => {
    for (let i = 0; i < 3; i++) s.sweep(0.1, 0.08, 2200, 900, 0.04 + i * 0.06, 'bandpass', 2);
  },
  Maim: s => {
    s.tone(80, 0.3, 'sine', 0.13, 45, 0.06);
    s.noise(0.15, 0.09, 900, 0.06, 'lowpass');
  },
  'Wild Charge': s => {
    s.sweep(0.45, 0.13, 250, 1800, 0, 'lowpass', 0.8);
    s.tone(110, 0.35, 'triangle', 0.05, 165, 0.05);
  },
  Maul: s => {
    s.tone(58, 0.45, 'sine', 0.16, 35, 0.06);
    s.noise(0.2, 0.1, 700, 0.06, 'lowpass');
  },
  Swipe: s => {
    s.sweep(0.35, 0.13, 400, 1600, 0, 'bandpass', 1);
    s.tone(70, 0.3, 'sine', 0.1, 45, 0.1);
  },
  'Demoralizing Roar': s => {
    s.tone(73, 0.9, 'sawtooth', 0.07, 55, 0, 450, 0.4);
    s.tone(110, 0.9, 'sawtooth', 0.04, 82, 0.03, 500, 0.4);
    s.sweep(0.9, 0.07, 300, 900, 0, 'lowpass', 1);
  },
  // ---------- Voleur ----------
  Backstab: s => {
    s.sweep(0.12, 0.1, 2000, 600, 0.04, 'bandpass', 2);
    s.tone(150, 0.15, 'triangle', 0.05, 90, 0.07);
  },
  Cloak: s => {
    s.sweep(0.6, 0.07, 1800, 300, 0, 'bandpass', 3);
    s.tone(147, 0.6, 'sine', 0.06, 110, 0, 0, 0.4);
  },
  'Kidney Shot': s => {
    s.tone(90, 0.25, 'sine', 0.14, 50, 0.06);
    s.noise(0.1, 0.08, 800, 0.06, 'lowpass');
    s.tone(240, 0.3, 'triangle', 0.04, 160, 0.1, 0, 0.3);
  },
  Vendetta: s => {
    s.tone(110, 0.7, 'sawtooth', 0.04, 165, 0, 1200, 0.35);
    s.tone(220, 0.7, 'sawtooth', 0.03, 330, 0.05, 1200, 0.35);
  },
  Shadowstep: s => {
    s.sweep(0.3, 0.1, 1500, 250, 0, 'bandpass', 2);
    s.tone(98, 0.3, 'sine', 0.07, 65, 0.05);
  },
  Stealth: s => {
    s.sweep(0.5, 0.06, 1200, 200, 0, 'lowpass', 1);
  },
  Ambush: s => {
    s.tone(65, 0.35, 'sine', 0.14, 38, 0.05);
    s.sweep(0.18, 0.1, 2400, 600, 0.04, 'bandpass', 2);
  },
  Sap: s => {
    s.tone(120, 0.18, 'sine', 0.12, 70, 0.04);
    s.noise(0.08, 0.06, 600, 0.04, 'lowpass');
  },
  'Cheap Shot': s => {
    s.tone(100, 0.2, 'sine', 0.13, 55, 0.04);
    s.tone(300, 0.2, 'triangle', 0.04, 200, 0.08);
  },
  // ---------- Démoniste ----------
  'Shadow Bolt': s => {
    s.tone(110, 1.0, 'sawtooth', 0.035, 220, 0, 900, 0.3);
    s.sweep(1.0, 0.04, 300, 1200, 0, 'bandpass', 3);
  },
  Fear: s => {
    s.tone(220, 0.9, 'triangle', 0.035, 207, 0, 0, 0.45);
    s.tone(233, 0.9, 'triangle', 0.03, 220, 0.05, 0, 0.45);
  },
  'Spell Lock': s => {
    s.tone(196, 0.2, 'sawtooth', 0.06, 98, 0, 900, 0.2);
    s.noise(0.1, 0.08, 900, 0.02, 'lowpass');
  },
  Corruption: s => {
    s.tone(82, 0.6, 'sawtooth', 0.06, 62, 0, 500, 0.35);
    s.sweep(0.5, 0.05, 900, 300, 0.05, 'bandpass', 4);
  },
  'Demonic Gate': s => {
    s.sweep(0.5, 0.11, 200, 1400, 0, 'lowpass', 1);
    s.tone(55, 0.5, 'sawtooth', 0.07, 110, 0, 500, 0.35);
  },
  'Drain Life': s => {
    s.tone(98, 1.2, 'sawtooth', 0.04, 82, 0, 600, 0.4);
    s.tone(147, 1.2, 'sine', 0.035, 123, 0.1, 0, 0.4);
  },
  // ---------- Commun ----------
  Trinket: s => {
    s.metal(0.05, 0, 520);
    [523, 784].forEach((f, i) => s.tone(f, 0.4, 'sine', 0.035, null, i * 0.05, 0, 0.35));
  }
};
// Impact des sorts à incantation (à la fin de l'incantation, sur la cible).
const SPELL_IMPACT = {
  'Frost Bolt': s => {
    s.sweep(0.35, 0.12, 2800, 700, 0, 'bandpass', 1.5);
    s.tone(70, 0.3, 'sine', 0.13, 35, 0);
    s.noise(0.08, 0.06, 2600, 0.02);
  },
  Polymorph: s => {
    [784, 988, 1175].forEach((f, i) => s.tone(f, 0.35, 'sine', 0.035, null, i * 0.05, 0, 0.4));
    s.noise(0.2, 0.05, 1500, 0.05);
  },
  'Flash Heal': s => {
    [659, 831, 988, 1319].forEach((f, i) => s.tone(f, 1.0, 'sine', 0.04 / (1 + i * 0.3), null, i * 0.045, 0, 0.4));
  },
  Smite: s => {
    s.tone(880, 0.3, 'triangle', 0.05, 440, 0, 0, 0.35);
    s.tone(70, 0.3, 'sine', 0.12, 35, 0);
    s.sweep(0.3, 0.08, 2400, 800, 0, 'bandpass', 1.5);
  },
  Wrath: s => {
    s.sweep(0.35, 0.11, 800, 2600, 0, 'bandpass', 2);
    s.tone(300, 0.3, 'triangle', 0.07, 150, 0, 0, 0.3);
    s.noise(0.2, 0.07, 900, 0.03, 'lowpass');
  },
  Regrowth: s => {
    [392, 523, 659, 784].forEach((f, i) => s.tone(f, 0.9, 'sine', 0.035, null, i * 0.06, 0, 0.45));
  },
  'Shadow Bolt': s => {
    s.tone(90, 0.45, 'sawtooth', 0.11, 40, 0, 600, 0.35);
    s.sweep(0.4, 0.1, 1800, 200, 0, 'lowpass', 0.8);
    s.tone(55, 0.4, 'sine', 0.14, 30, 0);
  },
  Fear: s => {
    s.tone(196, 0.8, 'sawtooth', 0.05, 98, 0, 700, 0.45);
    s.sweep(0.7, 0.07, 1500, 250, 0, 'bandpass', 3);
  }
};
// Joue la recette d'un sort à la position de l'unité ; false si le sort n'a pas de son dédié.
function playSpellSound(table, u, name) {
  const recipe = table[name];
  if (!recipe) return false;
  const a = sfxSpatial(u),
    L = a.level,
    P = a.pan;
  recipe({
    tone: (f, d, type, v, slide = null, delay = 0, filter = 0, rev = 0.12) =>
      sfxTone(f, d, type, v * L, slide, delay, P, filter, rev),
    sweep: (d, v, f0, f1, delay = 0, kind = 'bandpass', q = 1.2) => sfxSweep(d, v * L, f0, f1, delay, P, kind, q),
    noise: (d, v, f, delay = 0, kind = 'bandpass') => sfxNoise(d, v * L, f, delay, P, kind),
    metal: (v, delay = 0, base = 420) => sfxMetal(v * L, P, delay, base)
  });
  return true;
}
