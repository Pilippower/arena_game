'use strict';
// Découpe la maquette du lobby de l'utilisateur (interface_target.png, 1806×871) en images du lobby :
//   node tools/build_lobby_assets.js [assets_src/ui/interface_target.png]  →  assets/ui/lobby/*.webp
// Coordonnées en pixels de la maquette. Les zones contenant du texte sont repeintes (plaque du chrono)
// ou évitées (cartes : illustration seule, le nom est affiché par le jeu).
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = process.argv[2] || path.join(__dirname, '../assets_src/ui/interface_target.png');
const OUT = path.join(__dirname, '../assets/ui/lobby');
fs.mkdirSync(OUT, { recursive: true });

const crop = (x, y, w, h) => sharp(SRC).extract({ left: x, top: y, width: w, height: h });
const save = (img, name, q = 82) => img.webp({ quality: q }).toFile(path.join(OUT, name + '.webp'));
const rawOf = async img => {
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const fromRaw = r => sharp(r.data, { raw: { width: r.w, height: r.h, channels: 4 } });
// Remplace un rectangle par l'interpolation horizontale de ses deux colonnes de bord (efface texte / personnage).
function patch(r, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) / (x1 - x0),
        a = (y * r.w + x0 - 1) * 4,
        b = (y * r.w + x1) * 4,
        o = (y * r.w + x) * 4;
      for (let c = 0; c < 3; c++) r.data[o + c] = r.data[a + c] * (1 - t) + r.data[b + c] * t;
    }
}

const RACES = { human: [421, 531], dwarf: [554, 657], elf: [683, 787], orc: [812, 916], undead: [941, 1045] };
const CLASSES = {
  sentinel: [410, 564, 509, 570],
  arcanist: [579, 725, 509, 570],
  oracle: [741, 887, 509, 570],
  reaver: [903, 1054, 509, 570],
  warden: [411, 602, 611, 677],
  shade: [624, 819, 611, 677],
  warlock: [841, 1054, 611, 677]
};

(async () => {
  // murs de bois et torches de chaque côté, bois des barres du haut et du bas, panneau intérieur
  // flammes figées des torches effacées : le jeu dessine un vrai feu animé (src/ui/lobby.js, TORCHES)
  const wl = await rawOf(crop(0, 55, 330, 690));
  patch(wl, 84, 258, 192, 380);
  await save(fromRaw(wl).blur(0.6), 'wall_l');
  const wr = await rawOf(crop(1478, 55, 328, 690));
  patch(wr, 138, 258, 246, 380);
  await save(fromRaw(wr).blur(0.6), 'wall_r');
  await save(crop(372, 0, 250, 54), 'wood_top');
  await save(crop(250, 752, 370, 112), 'wood_bottom');
  await save(crop(1070, 210, 350, 90), 'panel');
  // blason : découpé selon son contour (ailes, feuilles, écu), bords adoucis
  const pts = [
    [15, 27],
    [100, 18],
    [165, 20],
    [180, 23],
    [225, 5],
    [345, 5],
    [385, 23],
    [400, 20],
    [465, 18],
    [550, 27],
    [505, 52],
    [440, 64],
    [420, 76],
    [380, 84],
    [330, 86],
    [283, 112],
    [235, 86],
    [190, 84],
    [150, 76],
    [125, 64],
    [60, 52]
  ];
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="566" height="118"><filter id="b"><feGaussianBlur stdDeviation="1.6"/></filter><polygon filter="url(#b)" fill="#fff" points="${pts.join(' ')}"/></svg>`
  );
  const crestRGB = await crop(620, 0, 566, 118).removeAlpha().toBuffer();
  const alpha = await sharp(mask).resize(566, 118).extractChannel('alpha').toBuffer();
  await save(sharp(crestRGB).joinChannel(alpha), 'crest', 88);
  // plaque du chrono, texte effacé
  const pl = await rawOf(crop(625, 742, 430, 128));
  patch(pl, 770 - 625, 762 - 742, 930 - 625, 850 - 742);
  await save(fromRaw(pl), 'plaque', 90);
  // fond de la prévisualisation (voûtes, torches) : le personnage de la maquette est effacé, le socle est en 3D
  const pv = await rawOf(crop(1101, 361, 288, 322));
  patch(pv, 1158 - 1101, 398 - 361, 1322 - 1101, 683 - 361);
  await save(fromRaw(pv), 'preview_bg', 86);
  // illustrations des cartes de race et de classe (sans le nom, affiché par le jeu)
  for (const [k, [x0, x1]] of Object.entries(RACES)) await save(crop(x0, 386, x1 - x0, 445 - 386), 'race_' + k, 88);
  for (const [k, [x0, x1, y0, y1]] of Object.entries(CLASSES))
    await save(crop(x0, y0, x1 - x0, y1 - y0), 'class_' + k, 88);
  console.log('OK - images du lobby dans', OUT);
})();
