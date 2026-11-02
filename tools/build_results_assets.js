'use strict';
// Écran de fin de match (Victory / Defeat), planches HD de l'utilisateur (fonds transparents) :
//   node tools/build_results_assets.js  →  assets/ui/results/*.webp
// assets_src/ui/results2_a.png : bandeaux Victory / Defeat à plaque de score vide (titres extraits), grand cadre de victoire (torches,
// fanions bleus), boutons, rubans d'équipe ; results2_c.png : cadre de défaite (drapés rouges déchirés).
// Cadres en 3 morceaux (haut / bande étirable / bas) : le panneau s'allonge avec le nombre de joueurs en n'étirant que
// la bande où tout est uniforme (bords du cadre, sous les fanions, au-dessus de l'ornement du bas).
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '../assets_src/ui');
const OUT = path.join(__dirname, '../assets/ui/results');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const save = (img, name) => img.webp({ quality: 90, alphaQuality: 95 }).toFile(path.join(OUT, name + '.webp'));
const crop = (file, x, y, w, h) => sharp(path.join(SRC, file)).extract({ left: x, top: y, width: w, height: h });
const rawOf = async img => {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const fromRaw = r => sharp(r.data, { raw: { width: r.w, height: r.h, channels: 4 } });
// boîte [x, y, w, h] dans la planche ; cut = bande étirable [y0, y1) dans le cadre
const FRAMES = {
  victory: { file: 'results2_a.png', box: [38, 218, 896, 467], cut: [376, 392] },
  defeat: { file: 'results2_c.png', box: [784, 210, 726, 394], cut: [302, 312], clearTop: 16 }
};
// Titres intégrés au bord haut du cadre (maquette d'origine) : du bandeau, on ne garde que le mot, les lauriers et la
// plaque du score, avec un fondu doux (sans la plaque dorée, les cornes, la crête ni les drapés du bandeau).
// box = bandeau dans la planche ; t = [cx, cy, rx, ry] zone du titre (super-ellipse) ; p = [x0, x1, y0, y1] plaque.
const TITLES = {
  victory: { box: [23, 6, 722, 215], t: [365, 118, 210, 50], p: [258, 470, 148, 204] },
  defeat: { box: [787, 14, 729, 201], t: [371, 110, 205, 47], p: [262, 470, 141, 197] }
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

(async () => {
  for (const [k, F] of Object.entries(FRAMES)) {
    // haut de la boîte : pointes des drapés du bandeau voisin dans la planche, effacées hors de la crête du cadre
    const r = await rawOf(crop(F.file, ...F.box));
    for (let y = 0; y < (F.clearTop || 0); y++)
      for (let x = 0; x < r.w; x++) if (Math.abs(x - r.w / 2) > 60) r.data[(y * r.w + x) * 4 + 3] = 0;
    const full = await fromRaw(r).png().toBuffer(),
      [c0, c1] = F.cut,
      h = F.box[3],
      part = (y, hh) => sharp(full).extract({ left: 0, top: y, width: F.box[2], height: hh });
    await save(part(0, c0), `frame_${k}_top`);
    await save(part(c0, c1 - c0), `frame_${k}_mid`);
    await save(part(c1, h - c1), `frame_${k}_bottom`);
  }
  for (const [k, T] of Object.entries(TITLES)) {
    const r = await rawOf(crop('results2_a.png', ...T.box)),
      [cx, cy, rx, ry] = T.t,
      [x0, x1, y0, y1] = T.p;
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const d = Math.pow(Math.abs((x - cx) / rx) ** 4 + Math.abs((y - cy) / ry) ** 4, 0.25),
          aT = 1 - smooth(0.82, 1, d),
          aP = Math.min(
            smooth(x0 - 8, x0 + 4, x),
            1 - smooth(x1 - 4, x1 + 8, x),
            smooth(y0 - 4, y0 + 2, y),
            1 - smooth(y1 - 2, y1 + 4, y)
          ),
          i = (y * r.w + x) * 4 + 3;
        r.data[i] = Math.round(r.data[i] * Math.max(aT, aP));
      }
    // agrandi ×2 (Lanczos) et contours accentués : le titre s'affiche plus grand que la planche (sinon flou)
    await sharp(await fromRaw(r).png().toBuffer())
      .resize(r.w * 2, r.h * 2, { kernel: 'lanczos3' })
      .sharpen({ sigma: 1.1, m1: 0.6, m2: 2.2 })
      .webp({ quality: 96, alphaQuality: 100 })
      .toFile(path.join(OUT, `title_${k}.webp`));
  }
  // fanion bleu pendu dans les coins du haut du cadre de victoire (maquette)
  await save(crop('results2_a.png', 1106, 686, 142, 188).trim(), 'pennant');
  await save(crop('results2_a.png', 950, 246, 286, 66), 'btn_again_win');
  await save(crop('results2_a.png', 1248, 246, 278, 66), 'btn_lobby');
  // « Play again » rouge de la défaite : le bouton vert recoloré (le vert devient rouge, l'or ne bouge pas)
  const g = await rawOf(crop('results2_a.png', 950, 246, 286, 66));
  for (let i = 0; i < g.data.length; i += 4) {
    const [R, G, B] = [g.data[i], g.data[i + 1], g.data[i + 2]];
    if (G > R + 15 && G > B) [g.data[i], g.data[i + 1], g.data[i + 2]] = [G, R * 0.45, B * 0.5];
  }
  await save(fromRaw(g), 'btn_again_loss');
  await save(crop('results2_a.png', 952, 512, 245, 48), 'ribbon_ally');
  await save(crop('results2_a.png', 1247, 512, 230, 48), 'ribbon_enemy');
  console.log('Résultats : ' + fs.readdirSync(OUT).join(' '));
})();
