'use strict';
// Bruitages procéduraux (sorts, coups, pas).
// ---------- Original fantasy spell SFX (procedural; no Blizzard/WoW audio files) ----------
function sfxCtx() {
  const ctx = musicEnsure();
  if (ctx?.state === 'suspended') ctx.resume();
  if (ctx) sfxSamplesLoad(ctx);
  return ctx;
}
// ---------- Bruitages enregistrés : assets/audio/sfx_pack.js (tools/build_sfx_pack.js, licences LICENSES.md) ----------
// Cris d'effort, lame qui fend l'air, impacts d'épée / de masse / de hache. Décodés une fois ; tant qu'ils ne sont
// pas prêts (ou si le pack manque), les sons procéduraux d'origine prennent le relais.
const SAMPLES = { buf: null, last: {} };
// décodés dès la première interaction (clic ou touche dans le lobby) : prêts avant le premier coup de la partie
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => sfxCtx(), { once: true, capture: true });
function sfxSamplesLoad(ctx) {
  if (SAMPLES.buf || !window.SFX_PACK) return;
  SAMPLES.buf = {};
  for (const [k, list] of Object.entries(window.SFX_PACK)) {
    SAMPLES.buf[k] = [];
    for (const u of list) {
      const bin = Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), c => c.charCodeAt(0));
      ctx
        .decodeAudioData(bin.buffer)
        .then(b => SAMPLES.buf[k].push(b))
        .catch(() => {});
    }
  }
}
// Une variante au hasard (jamais deux fois la même d'affilée) ; rate = hauteur / vitesse, lowpass = voix étouffée.
function sfxSample(kind, vol, pan = 0, { rate = 1, delay = 0, lowpass = 0 } = {}) {
  const ctx = sfxCtx(),
    list = SAMPLES.buf?.[kind];
  if (!ctx || !list?.length) return false;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === SAMPLES.last[kind]) i = (i + 1) % list.length;
  SAMPLES.last[kind] = i;
  const src = ctx.createBufferSource(),
    g = ctx.createGain();
  src.buffer = list[i];
  src.playbackRate.value = rate;
  g.gain.value = vol;
  let node = src;
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    src.connect(f);
    node = f;
  }
  node.connect(g);
  audioPan(g, pan).connect(MUSIC.sfxMaster);
  src.start(ctx.currentTime + delay);
  return true;
}
// Arme et voix d'une unité, d'après son kit (race + classe) : 'sword' | 'hammer' | 'axe' | 'daggers' | 'claw'.
const SFX_WHO = new Map();
function sfxWho(u) {
  const key = u.race + '_' + u.cls;
  if (!SFX_WHO.has(key)) {
    const K = window.CharacterKits,
      id = K?.kitFor(u.race, u.cls),
      kit = id ? K.resolveKit(id) : null,
      w = kit?.weapon || '';
    SFX_WHO.set(key, {
      weapon: /hammer/.test(w) ? 'hammer' : /axe/.test(w) ? 'axe' : /dagger/.test(w) ? 'daggers' : 'sword',
      sex: kit?.sex || (u.cls === 'shade' || u.cls === 'warden' ? 'F' : 'M')
    });
  }
  const who = SFX_WHO.get(key);
  return u.form ? { ...who, weapon: 'claw' } : who;
}
// ---------- Sons de combat par catégorie ----------
// Bruit filtré qui balaie une plage de fréquences (souffle d'une lame, d'un sort).
function sfxSweep(dur, vol, f0, f1, delay = 0, pan = 0, kind = 'bandpass', q = 1.2) {
  const ctx = sfxCtx();
  if (!ctx || !MUSIC.noise) return;
  const t = ctx.currentTime + delay,
    n = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  n.buffer = MUSIC.noise;
  n.loop = true;
  f.type = kind;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f);
  f.connect(g);
  audioPan(g, pan).connect(MUSIC.sfxMaster);
  n.start(t);
  n.stop(t + dur + 0.05);
}
// Partiels inharmoniques qui décroissent vite : impact métallique.
function sfxMetal(vol, pan, delay = 0, base = 420) {
  [1, 2.76, 5.4, 8.93].forEach((k, i) =>
    sfxTone(
      base * k * (0.97 + Math.random() * 0.06),
      0.22 - i * 0.035,
      'sine',
      vol / (1 + i * 0.6),
      null,
      delay,
      pan,
      0,
      0.22
    )
  );
}
const SFX = {
  // Cri d'effort du personnage qui frappe (voix d'homme ou de femme selon le personnage, plus grave pour un orc ou
  // un mort-vivant, plus claire pour un elfe ; jamais étouffée : un filtre rendait le cri du mort-vivant
  // méconnaissable). Pas deux cris en moins de 1,2 s.
  // Formes du druide : feulement de félin (chat) ou grognement d'ours (ours) à la place du cri.
  effort(u) {
    if (!u || u.stealth) return;
    const t = performance.now();
    if (u.effortAt && t - u.effortAt < 1200) return;
    u.effortAt = t;
    if (u.form === 'cat' || u.form === 'bear') {
      const a = sfxSpatial(u),
        cat = u.form === 'cat';
      sfxSample(cat ? 'snarl_cat' : 'roar_bear', (cat ? 0.5 : 0.65) * a.level, a.pan, {
        rate: (cat ? 1.35 : 0.95) * (0.94 + Math.random() * 0.12)
      });
      return;
    }
    if (u.form) return;
    const a = sfxSpatial(u),
      who = sfxWho(u),
      rate = { orc: 0.86, undead: 0.88, dwarf: 0.9, elf: 1.08 }[u.race] || 1;
    sfxSample(who.sex === 'F' ? 'effort_f' : 'effort_m', 0.55 * a.level, a.pan, {
      rate: rate * (0.96 + Math.random() * 0.08)
    });
  },
  // Jingle de victoire original, bref (~1,4 s) : arpège majeur montant + accord tenu, volume modéré.
  victory(big = false) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => sfxTone(f, 0.22, 'triangle', 0.07, null, i * 0.09, 0, 0, 0.3));
    [523.25, 659.25, 783.99, big ? 1318.5 : 1046.5].forEach(f =>
      sfxTone(f, big ? 1.1 : 0.8, 'sine', 0.045, null, 0.38, 0, 0, 0.45)
    );
  },
  defeat() {
    [392, 349.23, 311.13].forEach((f, i) => sfxTone(f, 0.35, 'triangle', 0.05, f * 0.97, i * 0.16, 0, 1800, 0.35));
  },
  // lame qui fend l'air : plus grave et plus lente pour une masse ou une hache, plus vive pour des glaives
  swing(u, heavy) {
    const a = sfxSpatial(u),
      w = sfxWho(u).weapon,
      rate = { hammer: 0.78, axe: 0.86, daggers: 1.25, claw: 0.9 }[w] || 1;
    if (sfxSample('whoosh', (heavy ? 0.42 : 0.32) * a.level, a.pan, { rate: rate * (0.94 + Math.random() * 0.12) }))
      return;
    sfxSweep(heavy ? 0.2 : 0.15, (heavy ? 0.16 : 0.12) * a.level, 600, 3200, 0, a.pan, 'bandpass', 1.5);
  },
  // impact selon l'arme : épée = choc métallique, masse = coup sourd + résonance grave, hache = coup sourd tranchant,
  // glaives = tintement vif, griffes (formes du druide) = coup sourd
  meleeHit(u, heavy) {
    const a = sfxSpatial(u),
      L = a.level * (heavy ? 1.15 : 1),
      P = a.pan,
      r = 0.94 + Math.random() * 0.12,
      d = 0.07,
      w = sfxWho(u).weapon;
    let ok;
    if (w === 'hammer') {
      ok = sfxSample('thud', 0.7 * L, P, { rate: 0.82 * r, delay: d });
      sfxSample('bong', 0.22 * L, P, { rate: 0.7 * r, delay: d, lowpass: 2600 });
    } else if (w === 'axe') {
      ok = sfxSample('thud', 0.6 * L, P, { rate: r, delay: d });
      sfxSample('clash', 0.3 * L, P, { rate: 0.75 * r, delay: d });
    } else if (w === 'daggers') {
      ok = sfxSample('clash', 0.34 * L, P, { rate: 1.3 * r, delay: d * 0.6 });
      sfxSample('clink', 0.22 * L, P, { rate: 1.1 * r, delay: d * 0.6 });
    } else if (w === 'claw') ok = sfxSample('thud', 0.55 * L, P, { rate: 1.2 * r, delay: d });
    else {
      ok = sfxSample('clash', 0.45 * L, P, { rate: r, delay: d });
      sfxSample('thud', 0.25 * L, P, { rate: 1.1 * r, delay: d });
    }
    if (ok) return;
    sfxMetal((heavy ? 0.09 : 0.065) * L, P, 0.06, heavy ? 360 : 470);
    sfxTone(heavy ? 95 : 120, 0.16, 'sine', (heavy ? 0.2 : 0.14) * L, 45, 0.06, P);
    sfxNoise(0.07, 0.16 * L, 2600, 0.06, P);
  },
  holy(u, big) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    const ch = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [659.25, 830.6, 987.77, 1318.5];
    ch.forEach((f, i) => {
      sfxTone(f, big ? 1.4 : 1.0, 'sine', (0.06 * L) / (1 + i * 0.3), null, i * 0.045, P + (i - 2) * 0.08, 0, 0.4);
      sfxTone(f * 2.01, 0.6, 'sine', 0.018 * L, null, i * 0.045 + 0.01, P, 0, 0.4);
    });
    sfxSweep(big ? 1.2 : 0.8, 0.05 * L, 2500, 9000, 0, P, 'highpass', 0.7);
  },
  shield(u) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    sfxSweep(0.5, 0.07 * L, 400, 2400, 0, P, 'bandpass', 4);
    [880, 1320, 1760].forEach((f, i) => sfxTone(f, 0.5, 'triangle', 0.035 * L, f * 1.5, i * 0.05, P, 0, 0.4));
  },
  castStart(u, school) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    const base =
      school === 'shadow' ? 110 : school === 'holy' ? 440 : school === 'nature' ? 220 : school === 'frost' ? 330 : 260;
    sfxTone(base, 1.0, 'sawtooth', 0.03 * L, base * 2, 0, P, 900, 0.3);
    sfxTone(base * 1.5, 1.0, 'sine', 0.035 * L, base * 3, 0, P, 0, 0.3);
    sfxSweep(1.0, 0.035 * L, 300, 2000, 0, P, 'bandpass', 3);
  },
  spellHit(u, school) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    if (school === 'shadow') {
      sfxTone(90, 0.45, 'sawtooth', 0.11 * L, 40, 0, P, 600, 0.35);
      sfxSweep(0.4, 0.1 * L, 1800, 200, 0, P, 'lowpass', 0.8);
      sfxTone(55, 0.4, 'sine', 0.14 * L, 30, 0, P);
    } else if (school === 'nature') {
      sfxSweep(0.35, 0.11 * L, 800, 4000, 0, P, 'bandpass', 2);
      sfxTone(300, 0.3, 'triangle', 0.07 * L, 150, 0, P, 0, 0.3);
      sfxNoise(0.2, 0.08 * L, 900, 0.03, P, 'lowpass');
    } else {
      sfxSweep(0.3, 0.12 * L, 5000, 800, 0, P, 'bandpass', 1.5);
      sfxTone(1200, 0.25, 'triangle', 0.07 * L, 300, 0, P, 0, 0.35);
      sfxTone(70, 0.3, 'sine', 0.13 * L, 35, 0, P);
      sfxNoise(0.06, 0.09 * L, 6000, 0.01, P, 'highpass');
    }
  },
  frost(u) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    sfxSweep(0.6, 0.13 * L, 6000, 1200, 0, P, 'highpass', 0.8);
    for (let i = 0; i < 6; i++)
      sfxTone(
        1800 + Math.random() * 2400,
        0.18,
        'sine',
        0.03 * L,
        null,
        0.05 + i * 0.04,
        P + (Math.random() - 0.5) * 0.6,
        0,
        0.3
      );
    sfxTone(80, 0.35, 'sine', 0.12 * L, 40, 0, P);
  },
  cc(u) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    sfxTone(220, 0.5, 'triangle', 0.06 * L, 110, 0, P, 0, 0.4);
    sfxTone(330, 0.5, 'sine', 0.04 * L, 140, 0.05, P, 0, 0.4);
    sfxSweep(0.5, 0.06 * L, 1500, 300, 0, P, 'bandpass', 3);
  },
  kick(u) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    sfxTone(1400, 0.12, 'square', 0.06 * L, 500, 0, P, 2500, 0.15);
    sfxMetal(0.05 * L, P, 0, 700);
    sfxNoise(0.08, 0.12 * L, 3000, 0, P);
  },
  whoosh(u) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    sfxSweep(0.35, 0.13 * L, 300, 3000, 0, P, 'bandpass', 1.2);
    sfxTone(200, 0.3, 'sine', 0.05 * L, 600, 0, P);
  },
  power(u) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    [146.8, 220, 293.7, 440].forEach((f, i) => sfxTone(f, 0.9, 'sawtooth', 0.03 * L, f * 1.5, i * 0.06, P, 1800, 0.4));
    sfxSweep(0.9, 0.06 * L, 200, 4000, 0, P, 'bandpass', 2);
  },
  charge(u) {
    const a = sfxSpatial(u),
      L = a.level,
      P = a.pan;
    sfxSweep(0.5, 0.15 * L, 200, 1500, 0, P, 'lowpass', 0.8);
    sfxTone(70, 0.5, 'sawtooth', 0.08 * L, 45, 0, P, 400, 0.3);
  }
};
// Sort lancé : son choisi d'après ce que fait le sort (corps à corps, soin, incantation, contrôle…).
function sfxForSkill(u, S, i) {
  if (!u || !S) return;
  const n = S.n || '',
    k = S.k;
  if (S.kick) return SFX.kick(u);
  if (/Heal|Hymn|Dispel|Rejuvenation|Regrowth/.test(n)) return SFX.holy(u, /Hymn/.test(n));
  if (/Shield|Barrier|Cloak|Shield Wall/.test(n)) return SFX.shield(u);
  if (/Charge/.test(n)) return SFX.charge(u);
  if (/Frost Nova/.test(n)) return SFX.frost(u);
  if (/Blink|Step|Advance|Gate|Shadowstep/.test(n) || k === 'stealth' || k === 'cat' || k === 'bear' || k === 'human')
    return SFX.whoosh(u);
  if (/Pillar|Vendetta|Roar/.test(n)) return SFX.power(u);
  if (S.t === 'melee' || k === 'swipe') {
    SFX.effort(u);
    SFX.swing(u, true);
    if (!/Sap/.test(n)) SFX.meleeHit(u, true);
    return;
  }
  if (/Sap|Maim|Kidney|Cheap|Asphyx|Silence|Terror|Roots|Grip/.test(n)) return SFX.cc(u);
  if (/Moonfire|Swipe|Coil/.test(n)) return SFX.spellHit(u, 'arcane');
  if (/Pain|Corruption|Drain/.test(n)) return SFX.cc(u);
  if (u.cast) return SFX.castStart(u, S.s);
  SFX.spellHit(u, S.s);
}
function spellSfx(u, i) {
  sfxForSkill(u, skillsOf(u)[i], i);
}
function spellSfxKind(u, S) {
  sfxForSkill(u, S);
}
function spellImpactSfx(u, kind = 'damage') {
  if (kind === 'heal') return SFX.holy(u, false);
  if (kind === 'fear') return SFX.cc(u);
  const S = CLASS[u.cls].skills[0];
  SFX.spellHit(u, S?.s);
}
function sfxSpatial(u) {
  if (!state?.player || !u) return { pan: 0, level: 1 };
  const dx = u.x - state.player.x,
    dz = u.z - state.player.z,
    dist = Math.hypot(dx, dz);
  const pan = clamp(dx / 18, -0.78, 0.78),
    level = u === state.player ? 1 : clamp(1 - dist / 38, 0.28, 0.68);
  // positions invalides (téléportation en cours, test) : son centré plutôt qu'une erreur
  return { pan: Number.isFinite(pan) ? pan : 0, level: Number.isFinite(level) ? level : 0.5 };
}
function sfxTone(
  freq,
  dur = 0.18,
  type = 'sine',
  vol = 0.14,
  slide = null,
  delay = 0,
  pan = 0,
  filterFreq = 0,
  rev = 0.12
) {
  const ctx = sfxCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let inp = o;
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    o.connect(f);
    f.connect(g);
  } else o.connect(g);
  const out = audioPan(g, pan);
  out.connect(MUSIC.sfxMaster);
  if (MUSIC.reverb && rev > 0) {
    const rg = ctx.createGain();
    rg.gain.value = rev;
    out.connect(rg);
    rg.connect(MUSIC.reverb);
  }
  o.start(t);
  o.stop(t + dur + 0.03);
}
function sfxNoise(dur = 0.16, vol = 0.1, filterFreq = 1200, delay = 0, pan = 0, kind = 'bandpass') {
  const ctx = sfxCtx();
  if (!ctx || !MUSIC.noise) return;
  const t = ctx.currentTime + delay,
    n = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  n.buffer = MUSIC.noise;
  f.type = kind;
  f.frequency.value = filterFreq;
  f.Q.value = 0.7;
  g.gain.setValueAtTime(Math.max(0.0002, vol), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f);
  f.connect(g);
  const out = audioPan(g, pan);
  out.connect(MUSIC.sfxMaster);
  n.start(t);
  n.stop(t + dur + 0.02);
}
function sfxChord(freqs, dur, type, vol, pan = 0, delay = 0) {
  freqs.forEach((f, i) =>
    sfxTone(f, dur, type, vol / (1 + i * 0.22), null, delay + i * 0.008, pan + (i - 1) * 0.05, 2200, 0.18)
  );
}
