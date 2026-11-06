'use strict';
// Interface en jeu (PC) : découpe la panoplie d'éléments de l'utilisateur (fonds transparents) en images du HUD.
//   node tools/build_hud_assets.js  →  assets/ui/hud/*.webp      (maquette : assets_src/ui/interface_in_game.png)
// Planches : hud_kit_1 (barres de bois, plaque, panneau), hud_kit_2 (cadres d'unité), hud_kit_3 (cases de sorts),
// hud_kit_4 (boutons, pastilles), hud_kit_5 (icônes), hud_kit_6 (blason). Coordonnées en pixels de chaque planche.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '../assets_src/ui');
const OUT = path.join(__dirname, '../assets/ui/hud');
fs.mkdirSync(OUT, { recursive: true });

const kit = n => path.join(SRC, `hud_kit_${n}.png`);
const crop = (n, x, y, w, h) => sharp(kit(n)).extract({ left: x, top: y, width: w, height: h });
const save = (img, name, q = 86) => img.webp({ quality: q, alphaQuality: 90 }).toFile(path.join(OUT, name + '.webp'));
const rawOf = async img => {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const fromRaw = r => sharp(r.data, { raw: { width: r.w, height: r.h, channels: 4 } });
// Barre de bois sans son ornement central : bout gauche + bout droit, recollés (étirée ensuite en 9 tranches).
async function joinEnds(n, y, h, [lx, lw], [rx, rw], name) {
  const L = await crop(n, lx, y, lw, h).png().toBuffer(),
    R = await crop(n, rx, y, rw, h).png().toBuffer();
  await save(
    sharp({ create: { width: lw + rw, height: h, channels: 4, background: '#0000' } }).composite([
      { input: L, left: 0, top: 0 },
      { input: R, left: lw, top: 0 }
    ]),
    name
  );
}
// Case de sort : l'intérieur (cuir bleu) devient transparent pour poser le cadre doré par-dessus l'illustration.
async function hollow(img, name) {
  const r = await rawOf(img),
    { data, w, h } = r,
    gold = i => data[i] > 110 && data[i] - data[i + 2] > 45,
    seen = new Uint8Array(w * h),
    st = [((h / 2) | 0) * w + ((w / 2) | 0)];
  while (st.length) {
    const p = st.pop();
    if (seen[p] || gold(p * 4)) continue;
    seen[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) st.push(p - 1);
    if (x < w - 1) st.push(p + 1);
    if (p >= w) st.push(p - w);
    if (p < w * (h - 1)) st.push(p + w);
  }
  await save(fromRaw(r), name);
}

// Cadre d'unité : le fond de cuir sombre à l'intérieur devient semi-transparent (on voit le jeu à travers ; demande du
// 06/11/2026 « le rectangle opaque cache trop le jeu »). box = [x0, y0, x1, y1] en fractions de l'image : seuls les
// pixels sombres et non dorés de cette zone (le fond) ; bordure dorée, barres peintes et contours restent opaques.
const FRAME_FILL_ALPHA = 0.5;
async function seeThrough(img, name, [x0, y0, x1, y1]) {
  const r = await rawOf(img),
    { data, w, h } = r;
  for (let y = Math.round(y0 * h); y < y1 * h; y++)
    for (let x = Math.round(x0 * w); x < x1 * w; x++) {
      const i = (y * w + x) * 4,
        [R, G, B] = [data[i], data[i + 1], data[i + 2]],
        gold = R > 110 && R - B > 45;
      if (!gold && Math.max(R, G, B) < 80) data[i + 3] = Math.round(data[i + 3] * FRAME_FILL_ALPHA);
    }
  await save(fromRaw(r), name);
}

(async () => {
  // barres du haut et du bas
  await joinEnds(1, 46, 95, [14, 416], [1020, 414], 'top_bar');
  await joinEnds(1, 927, 126, [15, 465], [960, 473], 'bottom_bar');
  await save(crop(6, 304, 8, 840, 167), 'crest');
  await save(crop(1, 487, 238, 473, 155), 'plaque');
  await save(crop(1, 618, 447, 707, 245), 'panel');
  // cadres d'unité (cercle du portrait transparent, barres peintes recouvertes par les vraies valeurs)
  await seeThrough(crop(2, 46, 20, 643, 243), 'frame_self', [0.06, 0.08, 0.97, 0.92]);
  await seeThrough(crop(2, 760, 20, 642, 243), 'frame_target', [0.03, 0.08, 0.94, 0.92]);
  await seeThrough(crop(2, 36, 299, 433, 129), 'frame_party', [0.06, 0.08, 0.97, 0.92]);
  await seeThrough(crop(2, 981, 299, 432, 129), 'frame_enemy', [0.03, 0.08, 0.94, 0.92]);
  // case de sort, bouton, pastille
  await hollow(crop(3, 45, 85, 228, 220), 'slot');
  await save(crop(4, 31, 72, 296, 100), 'button');
  await save(crop(4, 44, 217, 113, 47), 'pill');
  // icônes des boutons du haut (illustration seule, sans le cadre de la planche)
  const ICONS = { swords: [44, 51], gear: [345, 50], speaker: [644, 51], music: [946, 51], shield: [44, 339] };
  for (const [k, [x, y]] of Object.entries(ICONS))
    await save(crop(5, x + 34, y + 34, 196, 182).resize(64, 64, { fit: 'cover' }), 'icon_' + k);
  console.log('HUD : ' + fs.readdirSync(OUT).join(' '));
})();
