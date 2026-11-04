'use strict';
// Bruitages : primitives de synthèse (sfxTone, sfxSweep, sfxNoise, sfxMetal, nappe tenue sfxBed), sons de mêlée
// enregistrés, SFX ; les recettes des sorts sont dans spell_sounds.js.
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
  // Formes du druide : grognement de tigre (chat) ou grognement d'ours (ours) à la place du cri.
  effort(u) {
    if (!u || u.stealth) return;
    const t = performance.now();
    if (u.effortAt && t - u.effortAt < 1200) return;
    u.effortAt = t;
    if (u.form === 'cat' || u.form === 'bear') {
      const a = sfxSpatial(u),
        cat = u.form === 'cat';
      sfxSample(cat ? 'snarl_cat' : 'roar_bear', (cat ? 0.5 : 0.65) * a.level, a.pan, {
        rate: (cat ? 1.02 : 0.95) * (0.94 + Math.random() * 0.12)
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
  }
};
// Sort lancé : son dédié du sort (SPELL_SOUND, audio/spell_sounds.js) ; les coups de mêlée gardent en plus le cri,
// le souffle de l'arme et l'impact enregistrés. Sort sans son dédié : son générique de son école.
function sfxForSkill(u, S) {
  if (!u || !S) return;
  const melee = S.t === 'melee' || S.k === 'swipe';
  if (melee) {
    SFX.effort(u);
    SFX.swing(u, true);
    if (S.n !== 'Sap') SFX.meleeHit(u, true);
  }
  if (!playSpellSound(SPELL_SOUND, u, S.n) && !melee) SFX.spellHit(u, S.s);
}
function spellSfx(u, i) {
  sfxForSkill(u, skillsOf(u)[i]);
}
function spellSfxKind(u, S) {
  sfxForSkill(u, S);
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
  rev = 0.12,
  attack = 0.008 // montée du son : courte = attaque franche, longue = nappe qui s'épanouit
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
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(attack, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
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
// Nappe tenue (incantation, canalisation) : sources continues reliées à un gain commun qui monte en douceur.
// stop(fondu) les arrête toutes ensemble (aucune source laissée en vie) ; garde-fou : tout s'arrête seul après `max`
// secondes si stop() n'est jamais appelé. null sans contexte audio.
//   voice(fréq, { type, vol, to, rise, vib, vibDepth, trem, tremDepth, lp }) : voix tenue, glissée vers `to` en `rise`
//     secondes (montée de l'incantation), vibrato (Hz, écart en Hz), trémolo (Hz, profondeur 0–1), passe-bas ;
//   air(fréq, { vol, q, kind, sweep, sweepDepth }) : souffle (bruit en boucle filtré), centre balayé par un LFO.
function sfxBed(pan = 0, max = 8, rev = 0.35) {
  const ctx = sfxCtx();
  if (!ctx || !MUSIC.sfxMaster) return null;
  const t0 = ctx.currentTime,
    out = ctx.createGain(),
    srcs = [];
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(1, t0 + 0.2);
  const pn = audioPan(out, pan);
  pn.connect(MUSIC.sfxMaster);
  if (MUSIC.reverb && rev > 0) {
    const rg = ctx.createGain();
    rg.gain.value = rev;
    pn.connect(rg);
    rg.connect(MUSIC.reverb);
  }
  const run = n => {
    n.start(t0);
    n.stop(t0 + max);
    srcs.push(n);
    return n;
  };
  const lfo = (param, rate, depth) => {
    if (!rate || !depth) return;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    run(o);
  };
  const layer = (src, vol, trem, tremDepth, filter) => {
    const g = ctx.createGain();
    g.gain.value = vol * (1 - tremDepth / 2);
    lfo(g.gain, trem, (vol * tremDepth) / 2);
    (filter ? (src.connect(filter), filter) : src).connect(g);
    g.connect(out);
  };
  const bed = {
    voice(
      f,
      { type = 'sine', vol = 0.05, to = 0, rise = 1, vib = 0, vibDepth = 0, trem = 0, tremDepth = 0, lp = 0 } = {}
    ) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + rise);
      lfo(o.frequency, vib, vibDepth);
      let filter = null;
      if (lp) {
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lp;
      }
      layer(run(o), vol, trem, tremDepth, filter);
    },
    air(f, { vol = 0.04, q = 1.5, kind = 'bandpass', sweep = 0, sweepDepth = 0 } = {}) {
      if (!MUSIC.noise) return;
      const n = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter();
      n.buffer = MUSIC.noise;
      n.loop = true;
      filter.type = kind;
      filter.frequency.value = f;
      filter.Q.value = q;
      lfo(filter.frequency, sweep, sweepDepth);
      layer(run(n), vol, 0, 0, filter);
    },
    stop(fade = 0.12) {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      for (const n of srcs) n.stop(t + fade + 0.03);
      bed.stop = () => {};
    }
  };
  return bed;
}
