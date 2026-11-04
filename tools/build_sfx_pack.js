'use strict';
// Bruitages enregistrés (licences libres, voir assets/audio/LICENSES.md) :
//   node tools/build_sfx_pack.js  →  assets/audio/sfx_pack.js (WAV mono 22 kHz en base64 : le jeu se lance en
//   double-clic, file:// interdit de charger un fichier audio par fetch).
// Sources dans assets_src/audio/ (non versionné). Chaque extrait est décodé dans le navigateur, mixé en mono,
// rééchantillonné, débarrassé du silence de tête, coupé à sa durée utile avec un fondu et normalisé.
const path = require('path');
const fs = require('fs');
const { launch } = require('../tests/browser/browser.js');

const SRC = path.join(__dirname, '../assets_src/audio');
const OUT = path.join(__dirname, '../assets/audio/sfx_pack.js');
const SR = 22050;
// [fichier, durée max (s)] ; pour un fichier à plusieurs cris, seg = numéro du cri ; at = départ (s) dans un long
// enregistrement (le cri le plus proche après cet instant)
const PACK = {
  // cris d'effort masculins (cris et grognements courts, attaque rapide)
  effort_m: [
    ['1yell1.wav', 0.45],
    ['1yell9.wav', 0.4],
    ['1yell15.wav', 0.45],
    ['3grunt1.wav', 0.45],
    ['3grunt4.wav', 0.35],
    ['3grunt5.wav', 0.5],
    ['3yell3.wav', 0.45],
    ['yell12.wav', 0.55]
  ],
  // cris d'effort féminins : les 6 grognements de « Female Warrior Grunts »
  effort_f: [0, 1, 2, 3, 4, 5].map(seg => ['Grunts_HD_Deep.mp3', 0.6, seg]),
  // lame qui fend l'air
  whoosh: [
    ['starninjas/sword.1.ogg', 0.5],
    ['starninjas/sword.2.ogg', 0.45],
    ['starninjas/sword.3.ogg', 0.45],
    ['starninjas/sword.4.ogg', 0.4]
  ],
  // impact d'une lame (métal)
  clash: [
    ['starninjas/sword_clash.2.ogg', 0.45],
    ['starninjas/sword_clash.5.ogg', 0.4],
    ['starninjas/sword_clash.8.ogg', 0.45],
    ['starninjas/sword_clash.10.ogg', 0.45]
  ],
  // coup sourd (masse, hache, griffes) et résonance métallique grave
  thud: [['thud2.wav', 0.5]],
  bong: [['bong1.wav', 0.9]],
  clink: [['clink1_0.wav', 0.3]],
  // druide en forme d'ours : seulement les grognements graves de grizzly (Yellowstone, NPS, domaine public). Retirés le
  // 04/11/2026 car nasillards, « de cochon » : les deux clips U.S. Fish & Wildlife (0 à 2 % d'énergie sous 250 Hz) et le
  // « Grizzly Eating » (11 % au-dessus de 1 kHz) ; gardés : les passages à plus de 55 % d'énergie sous 250 Hz (le
  // long rugissement de 69,3 à 72 s donne deux extraits). La taille vient d'une couche de tigre abaissé (BEAST_VOICE).
  roar_bear: [42.49, 66.37, 69.5, 70.8].map(at => [
    'beasts/yell-YELLGrizzlyBearVocalizations20160520Android1.mp3',
    1.1,
    null,
    at
  ]),
  // druide en forme de chat : grognements d'un vrai tigre (« angry tiger », schots, CC0), hauteur naturelle. Seuls les
  // cris graves sont gardés, chacun au début exact d'un cri (pas de doublon) : ceux de 3,0 s, 5,4 s, 21,8 s et 40,5 s ont des
  // pics aigus (jusqu'à 35 % d'énergie au-dessus de 3 kHz) qui faisaient mal aux oreilles.
  snarl_cat: [0.21, 11.09, 15.47, 26.08].map(at => ['beasts/angry-tiger.wav', 0.75, null, at])
};

const wav = (pcm, sr) => {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((v, i) => b.writeInt16LE(v, 44 + i * 2));
  return b;
};

(async () => {
  const browser = await launch(),
    page = await browser.newPage();
  await page.goto('about:blank');
  const out = {};
  let bytes = 0;
  for (const [key, list] of Object.entries(PACK)) {
    out[key] = [];
    for (const [file, maxDur, seg, at] of list) {
      const b64 = fs.readFileSync(path.join(SRC, file)).toString('base64');
      const pcm = await page.evaluate(
        async ({ b64, maxDur, seg, at, SR }) => {
          const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const raw = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bin.buffer);
          // mono + rééchantillonnage
          const off = new OfflineAudioContext(1, Math.ceil(raw.duration * SR), SR),
            src = off.createBufferSource();
          src.buffer = raw;
          src.connect(off.destination);
          src.start();
          const d = (await off.startRendering()).getChannelData(0);
          // enveloppe 10 ms → début de chaque cri
          const win = Math.round(SR * 0.01),
            env = [];
          for (let i = 0; i < d.length; i += win) {
            let s = 0;
            for (let j = i; j < Math.min(d.length, i + win); j++) s += d[j] * d[j];
            env.push(Math.sqrt(s / win));
          }
          const pk = Math.max(...env),
            starts = [];
          let on = false;
          env.forEach((v, i) => {
            if (!on && v > pk * 0.15) {
              starts.push(i);
              on = true;
            } else if (on && v < pk * 0.03) on = false;
          });
          // instant donné (at) : le début de cri le plus proche (à 0,15 s près), sinon l'instant lui-même ; on remonte
          // au tout début du son, de 0,3 s au plus (un grognement continu ramenait plusieurs extraits au même début)
          const near = at != null ? starts.find(i => Math.abs(i * win - at * SR) < SR * 0.15) : null;
          let s0 = at != null ? (near ?? Math.round((at * SR) / win)) : (starts[seg ?? 0] ?? 0);
          const floor = Math.max(0, s0 - 30);
          while (s0 > floor && env[s0 - 1] > pk * 0.02) s0--;
          let a = Math.max(0, s0 * win - Math.round(SR * 0.005)),
            b = Math.min(d.length, a + Math.round(maxDur * SR));
          // ne pas déborder sur le cri suivant
          const next = starts.find(i => i * win > a + SR * 0.05);
          if (seg != null && next) b = Math.min(b, next * win - Math.round(SR * 0.01));
          const clip = d.slice(a, b);
          let m = 0;
          for (const v of clip) m = Math.max(m, Math.abs(v));
          const g = m > 0 ? 0.9 / m : 1,
            fade = Math.round(SR * 0.04);
          return Array.from(clip, (v, i) => {
            const f = Math.min(1, i / (SR * 0.003), (clip.length - i) / fade);
            return Math.round(Math.max(-1, Math.min(1, v * g * f)) * 32767);
          });
        },
        { b64, maxDur, seg, at, SR }
      );
      if (pcm.length < SR * 0.15) continue; // bruit parasite (ex. un cri découpé trop court)
      const w = wav(pcm, SR);
      bytes += w.length;
      out[key].push('data:audio/wav;base64,' + w.toString('base64'));
    }
  }
  await browser.close();
  fs.writeFileSync(
    OUT,
    '// Généré par tools/build_sfx_pack.js — bruitages enregistrés (licences : assets/audio/LICENSES.md)\n' +
      'window.SFX_PACK = ' +
      JSON.stringify(out) +
      ';\n'
  );
  console.log(
    'sfx_pack.js : ' +
      Object.entries(out)
        .map(([k, v]) => k + '×' + v.length)
        .join(' ') +
      ` (${Math.round(bytes / 1024)} Ko de WAV)`
  );
})().catch(e => {
  console.error(e);
  process.exit(1);
});
