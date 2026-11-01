'use strict';
// Lobby, 2e version du design de l'utilisateur (maquette assets_src/ui/lobby_interface.png) :
//   node tools/build_lobby2_assets.js  →  assets/ui/lobby2/*.webp
// Planches opaques (fond bleu nuit, comme l'intérieur du cadre du lobby) : lobby_assets.png (étiquettes de
// section, bouton PLAY, ornements du titre) et maps_lobby_assets.png (illustrations des deux arènes, sans le
// bandeau de texte : le jeu écrit le nom et la description). Coordonnées en pixels des planches.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '../assets_src/ui');
const OUT = path.join(__dirname, '../assets/ui/lobby2');
fs.mkdirSync(OUT, { recursive: true });
const crop = (file, x, y, w, h) => sharp(path.join(SRC, file)).extract({ left: x, top: y, width: w, height: h });
const save = (img, name, q = 86) => img.webp({ quality: q }).toFile(path.join(OUT, name + '.webp'));
// Fond sombre de la planche → transparent : remplissage depuis les bords sur les pixels sombres (l'or reste).
async function clearBg(img) {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    w = info.width,
    h = info.height,
    dark = p => Math.max(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) < 58,
    seen = new Uint8Array(w * h),
    st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) {
    const p = st.pop();
    if (seen[p] || !dark(p)) continue;
    seen[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) st.push(p - 1);
    if (x < w - 1) st.push(p + 1);
    if (p >= w) st.push(p - w);
    if (p < w * (h - 1)) st.push(p + w);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } });
}

const TAGS = {
  mode: [635, 173, 132, 34],
  difficulty: [795, 173, 174, 34],
  arena: [997, 173, 130, 34],
  race: [1137, 173, 112, 34],
  class: [1258, 173, 114, 34],
  preview: [1381, 173, 132, 34]
};
(async () => {
  for (const [k, b] of Object.entries(TAGS)) await save(await clearBg(crop('lobby_assets.png', ...b)), 'tag_' + k);
  await save(await clearBg(crop('lobby_assets.png', 632, 390, 450, 125)), 'play');
  await save(await clearBg(crop('lobby_assets.png', 672, 82, 89, 24)), 'orn_l');
  await save(await clearBg(crop('lobby_assets.png', 1367, 82, 112, 24)), 'orn_r');
  // illustrations des arènes (grandes cartes, au-dessus du bandeau du titre)
  await save(crop('maps_lobby_assets.png', 56, 42, 540, 292).resize(640), 'map_castle', 84);
  await save(crop('maps_lobby_assets.png', 667, 38, 550, 300).resize(640), 'map_bridge', 84);
  // cartes d'arène complètes (illustration + blason + nom + description peints), sans le cadre de la planche
  await save(crop('maps_lobby_assets.png', 47, 33, 569, 471).resize(720), 'mapcard_castle', 86);
  await save(crop('maps_lobby_assets.png', 662, 33, 559, 471).resize(720), 'mapcard_bridge', 86);
  // cartes de race et de classe (illustration + nom peint), recadrées à l'intérieur de leur cadre doré
  const CARDS = {
    race_human: [717, 561, 98, 80],
    race_dwarf: [826, 561, 99, 80],
    race_elf: [936, 561, 99, 80],
    race_orc: [1046, 561, 99, 80],
    race_undead: [1156, 561, 100, 80],
    class_sentinel: [743, 666, 114, 80],
    class_arcanist: [870, 667, 113, 78],
    class_oracle: [995, 666, 114, 80],
    class_reaver: [1121, 666, 116, 80],
    class_warden: [786, 758, 128, 76],
    class_shade: [928, 759, 129, 75],
    class_warlock: [1070, 759, 129, 75]
  };
  for (const [k, [x, y, w, h]] of Object.entries(CARDS))
    await save(crop('lobby_assets.png', x + 4, y + 4, w - 8, h - 8).resize(2 * (w - 8)), k, 88);
  console.log('Lobby 2 : ' + fs.readdirSync(OUT).join(' '));
})();
