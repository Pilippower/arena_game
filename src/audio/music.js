'use strict';
// Moteur audio et bande originale procédurale.
// ---------- Original adaptive battle-fantasy audio (Web Audio; no external copyrighted assets) ----------
const MUSIC = {
  ctx: null,
  master: null,
  sfxMaster: null,
  reverb: null,
  limiter: null,
  noise: null,
  timer: null,
  next: 0,
  step: 0,
  playing: false
};
function musicEnsure() {
  if (MUSIC.ctx) return MUSIC.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  MUSIC.ctx = ctx;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.16;
  limiter.connect(ctx.destination);
  MUSIC.limiter = limiter;
  const master = ctx.createGain();
  master.gain.value = 0.24 * PREFS.volume;
  master.connect(limiter);
  MUSIC.master = master;
  const sfxMaster = ctx.createGain();
  sfxMaster.gain.value = 0.7 * PREFS.volume;
  sfxMaster.connect(limiter);
  MUSIC.sfxMaster = sfxMaster;
  const con = ctx.createConvolver(),
    len = Math.floor(ctx.sampleRate * 2.2),
    buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.35);
  }
  con.buffer = buf;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  con.connect(wet);
  wet.connect(master);
  MUSIC.reverb = con;
  const nbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate),
    nd = nbuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  MUSIC.noise = nbuf;
  return ctx;
}
function audioPan(node, pan = 0) {
  const ctx = MUSIC.ctx;
  if (!ctx?.createStereoPanner) return node;
  const p = ctx.createStereoPanner();
  p.pan.value = clamp(pan, -1, 1);
  node.connect(p);
  return p;
}
function musicIntensity() {
  if (!state || $('overlay')?.style.display !== 'none') return 0.28;
  const alive = state.units?.filter(u => u.alive) || [];
  const danger = alive.length
    ? 1 - Math.min(...alive.filter(u => u.team === state.player.team).map(u => u.hp / u.maxHp), 1)
    : 0;
  const action = alive.some(u => u.cast || u.mobility || u.action > 0) ? 1 : 0;
  const pressure = (state.t || 150) < 65 ? 0.22 : 0;
  return clamp(0.38 + danger * 0.3 + action * 0.18 + pressure + (state.dampening || 0) * 0.3, 0.3, 1);
}
// ---- Bande originale « Ascendant » (composition originale, synthèse en direct) ----
// Musique d'arène : ré mineur, 140 BPM. Batterie, basse pulsée, ostinato de cordes, cuivres et un thème
// au « violon électrique » saturé. Forme : intro 4 · thème 8 · thème 8 (octave, cuivres) · pont 4 · thème 8.
// À l'écran de sélection, seuls basse, cordes et thème jouent, doucement.
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const SONG = (() => {
  const C = {
    Dm: [38, 50, 53, 57, 62],
    Bb: [34, 46, 50, 53, 58],
    C: [36, 48, 52, 55, 60],
    A: [33, 45, 49, 52, 57],
    F: [29, 41, 45, 48, 53],
    Gm: [31, 43, 46, 50, 55]
  };
  const hookA = [
    [
      [74, 1],
      [74, 1],
      [77, 1],
      [81, 2],
      [79, 1],
      [77, 1],
      [76, 1]
    ],
    [
      [77, 2],
      [74, 2],
      [70, 2],
      [72, 2]
    ],
    [
      [72, 1],
      [72, 1],
      [76, 1],
      [79, 2],
      [77, 1],
      [76, 1],
      [74, 1]
    ],
    [
      [73, 3],
      [76, 1],
      [81, 4]
    ]
  ];
  const hookB = [
    [
      [74, 1],
      [74, 1],
      [77, 1],
      [81, 2],
      [79, 1],
      [77, 1],
      [76, 1]
    ],
    [
      [82, 2],
      [81, 2],
      [77, 2],
      [74, 2]
    ],
    [
      [79, 1],
      [79, 1],
      [77, 1],
      [76, 2],
      [74, 1],
      [76, 1],
      [79, 1]
    ],
    [
      [74, 6],
      [69, 1],
      [72, 1]
    ]
  ];
  const toNotes = bar => {
    let at = 0;
    return bar.map(([n, d]) => {
      const o = { n, at, d };
      at += d;
      return o;
    });
  };
  const bars = [],
    add = (sec, ch, mel, opts = {}) => bars.push({ sec, chord: C[ch], mel: mel ? toNotes(mel) : [], ...opts });
  ['Dm', 'Dm', 'Bb', 'A'].forEach((c, i) => add('intro', c, null, { fill: i === 3 }));
  const theme = (oct, brass) => {
    ['Dm', 'Bb', 'C', 'A'].forEach((c, i) =>
      add(
        'main',
        c,
        hookA[i].map(([n, d]) => [n + oct, d]),
        { brass }
      )
    );
    ['Dm', 'Bb', 'C', 'Dm'].forEach((c, i) =>
      add(
        'main',
        c,
        hookB[i].map(([n, d]) => [n + oct, d]),
        { brass, fill: i === 3 }
      )
    );
  };
  theme(0, false);
  theme(12, true);
  ['Gm', 'Gm', 'Bb', 'A'].forEach((c, i) => add('bridge', c, null, { fill: i === 3 }));
  theme(0, true);
  return bars;
})();
function mVoice(
  freq,
  t,
  dur,
  {
    type = 'triangle',
    vol = 0.03,
    attack = 0.01,
    release = 0.15,
    filter = 0,
    q = 0.7,
    detune = 0,
    vib = 0,
    pan = 0,
    dest = null,
    wet = true,
    fEnv = 0
  } = {}
) {
  const ctx = MUSIC.ctx;
  if (!ctx) return;
  const o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.value = detune;
  if (vib) {
    const l = ctx.createOscillator(),
      lg = ctx.createGain();
    l.frequency.value = 5.6;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(freq * vib, t + Math.min(0.3, dur * 0.6));
    l.connect(lg);
    lg.connect(o.frequency);
    l.start(t);
    l.stop(t + dur + release + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  let src = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = q;
    if (fEnv) {
      f.frequency.setValueAtTime(filter * fEnv, t);
      f.frequency.exponentialRampToValueAtTime(filter, t + Math.min(dur, 0.25));
    } else f.frequency.value = filter;
    o.connect(f);
    src = f;
  }
  src.connect(g);
  const out = audioPan(g, pan);
  out.connect(dest || MUSIC.master);
  if (wet && MUSIC.reverb) out.connect(MUSIC.reverb);
  o.start(t);
  o.stop(t + dur + release + 0.05);
}
function mNoise(t, dur, vol, freq, kind = 'bandpass', q = 0.8, pan = 0) {
  const ctx = MUSIC.ctx;
  if (!MUSIC.noise) return;
  const n = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  n.buffer = MUSIC.noise;
  f.type = kind;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f);
  f.connect(g);
  audioPan(g, pan).connect(MUSIC.master);
  n.start(t);
  n.stop(t + dur + 0.02);
}
function mKick(t, vol) {
  const ctx = MUSIC.ctx,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g);
  g.connect(MUSIC.master);
  o.start(t);
  o.stop(t + 0.35);
  mNoise(t, 0.02, vol * 0.4, 3000, 'highpass');
}
function mSnare(t, vol) {
  mNoise(t, 0.18, vol, 1900, 'bandpass', 0.6);
  mNoise(t, 0.09, vol * 0.6, 5200, 'highpass');
  mVoice(185, t, 0.04, { type: 'triangle', vol: vol * 0.5, release: 0.08, wet: false });
}
function mTom(t, vol, f) {
  const ctx = MUSIC.ctx,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.25);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g);
  g.connect(MUSIC.master);
  if (MUSIC.reverb) g.connect(MUSIC.reverb);
  o.start(t);
  o.stop(t + 0.4);
}
function musicDrive() {
  if (MUSIC.drive) return MUSIC.drive;
  const ctx = MUSIC.ctx,
    ws = ctx.createWaveShaper(),
    c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = i / 511.5 - 1;
    c[i] = Math.tanh(x * 3.2);
  }
  ws.curve = c;
  const g = ctx.createGain();
  g.gain.value = 0.55;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 4200;
  ws.connect(f);
  f.connect(g);
  g.connect(MUSIC.master);
  if (MUSIC.reverb) g.connect(MUSIC.reverb);
  MUSIC.drive = ws;
  return ws;
}
function musicSchedule() {
  if (!MUSIC.playing || !MUSIC.ctx) return;
  const ctx = MUSIC.ctx,
    s16 = 60 / 140 / 4,
    look = 0.6,
    I = musicIntensity(),
    fight = I > 0.4;
  while (MUSIC.next < ctx.currentTime + look) {
    const st = MUSIC.step,
      t = MUSIC.next,
      q = st % 16,
      bar = SONG[Math.floor(st / 16) % SONG.length],
      c = bar.chord,
      root = c[0],
      bridge = bar.sec === 'bridge';
    // batterie
    if (fight) {
      if (!bridge) {
        if (q === 0 || q === 8 || (q === 10 && I > 0.6) || (q === 3 && I > 0.75)) mKick(t, 0.34);
        if (q === 4 || q === 12) mSnare(t, 0.16 + 0.06 * I);
        if (q % 2 === 0) mNoise(t, 0.03, 0.03 + 0.02 * I, 8000, 'highpass', 0.5, q % 4 ? 0.3 : -0.3);
        if (q % 4 === 2 && I > 0.65) mNoise(t, 0.06, 0.035, 7000, 'highpass');
      } else {
        if (q === 0 || q === 6 || q === 12) mTom(t, 0.32, 70);
        if (q === 14) mSnare(t, 0.12);
      }
      if (bar.fill && q >= 12) mTom(t, 0.22, [160, 130, 110, 90][q - 12]);
    }
    // basse pulsée en croches (octave en contretemps)
    if (q % 2 === 0 && !(bridge && q % 4)) {
      const f = midi(root + (q % 4 === 2 ? 12 : 0));
      mVoice(f, t, s16 * 1.6, {
        type: 'sawtooth',
        vol: fight ? 0.05 : 0.03,
        filter: fight ? 700 : 420,
        fEnv: 2.5,
        release: 0.05,
        wet: false
      });
      mVoice(f / 2, t, s16 * 1.6, { type: 'sine', vol: fight ? 0.06 : 0.035, release: 0.05, wet: false });
    }
    // ostinato de cordes en doubles croches
    const arp = [1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 3, 4, 2, 3, 4, 3][q];
    if (!bridge || q % 2 === 0)
      mVoice(midi(c[arp] + 12), t, s16 * 0.7, {
        type: 'sawtooth',
        vol: 0.016 + 0.012 * I,
        filter: 2200,
        release: 0.06,
        pan: q % 2 ? 0.25 : -0.25
      });
    // cuivres sur les temps forts
    if ((bar.brass || bridge) && fight && (q === 0 || (q === 6 && !bridge)))
      for (const n of c.slice(1, 4))
        for (const d of [-8, 8])
          mVoice(midi(n), t, s16 * (q === 0 ? 5 : 2), {
            type: 'sawtooth',
            vol: 0.022,
            filter: 1300,
            fEnv: 2,
            detune: d,
            release: 0.25
          });
    if (bridge && q === 0)
      for (const n of c.slice(1))
        mVoice(midi(n + 12), t, s16 * 15, {
          type: 'sawtooth',
          vol: 0.012,
          attack: 0.5,
          filter: 1500,
          detune: ((n % 3) - 1) * 9,
          release: 0.6
        });
    // thème : « violon électrique » saturé (calme : timbre doux, sans saturation)
    for (const n of bar.mel)
      if (n.at * 2 === q) {
        const d = n.d * s16 * 2 * 0.95,
          f = midi(n.n);
        if (fight) {
          const dv = musicDrive();
          mVoice(f, t, d, {
            type: 'sawtooth',
            vol: 0.07,
            attack: 0.015,
            release: 0.12,
            vib: 0.008,
            dest: dv,
            detune: -6
          });
          mVoice(f, t, d, { type: 'square', vol: 0.04, attack: 0.015, release: 0.12, vib: 0.008, dest: dv, detune: 6 });
          mVoice(f * 2, t, d, { type: 'triangle', vol: 0.014, attack: 0.02, release: 0.1, filter: 5000 });
        } else mVoice(f, t, d, { type: 'triangle', vol: 0.04, attack: 0.02, release: 0.2, filter: 2600, vib: 0.005 });
      }
    MUSIC.step++;
    MUSIC.next += s16;
  }
}
function setMusicVolume(v) {
  PREFS.volume = clamp(Number(v) || 0, 0, 2.0);
  savePrefs();
  if (MUSIC.ctx) {
    if (MUSIC.master) MUSIC.master.gain.setTargetAtTime(0.24 * PREFS.volume, MUSIC.ctx.currentTime, 0.025);
    if (MUSIC.sfxMaster) MUSIC.sfxMaster.gain.setTargetAtTime(0.7 * PREFS.volume, MUSIC.ctx.currentTime, 0.025);
  }
  if (typeof refreshTrackVolumes === 'function') refreshTrackVolumes();
  const pct = Math.round(PREFS.volume * 100);
  if ($('musicVolume')) $('musicVolume').value = pct;
  if ($('volumeMini')) $('volumeMini').value = pct;
  if ($('volumeValue')) $('volumeValue').textContent = pct + '%';
}
function musicStartProcedural() {
  const ctx = musicEnsure();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (MUSIC.playing) return;
  MUSIC.playing = true;
  MUSIC.next = ctx.currentTime + 0.08;
  MUSIC.step = 0;
  MUSIC.timer = setInterval(musicSchedule, 100);
  musicSchedule();
}
function musicStopProcedural() {
  MUSIC.playing = false;
  if (MUSIC.timer) {
    clearInterval(MUSIC.timer);
    MUSIC.timer = null;
  }
}
// Musique de l'écran courant (lobby ou partie) ; le bouton coupe / remet toute la musique (préférence mémorisée).
function musicStart() {
  playGameMusic();
}
function musicToggle() {
  PREFS.musicOn = !PREFS.musicOn;
  savePrefs();
  updateMusicButton();
  if (!PREFS.musicOn) stopAllMusic();
  else if (TRACKS.want === 'lobby') playLobbyMusic();
  else playGameMusic();
}
function updateMusicButton() {
  const b = $('musicBtn');
  if (b) b.innerHTML = `<i class="ico music"></i>Music: ${PREFS.musicOn ? 'ON' : 'OFF'}`;
}
