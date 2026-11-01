'use strict';
// Écran de fin de match (Victory / Defeat) : découpe la panoplie de l'utilisateur (fond transparent)
//   node tools/build_results_assets.js  →  assets/ui/results/*.webp
// Planche : assets_src/ui/results_kit.png ; maquettes : results_victory.png, results_defeat.png.
// Cadre en 3 morceaux (haut / bande étirable / bas) : le panneau s'allonge avec le nombre de joueurs en n'étirant
// que la bande où tout est uniforme (bord du cadre, tissu des bannières des torches, entre leurs deux étoiles).
// Le score peint sur la plaque est effacé : le jeu affiche le vrai score par-dessus.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '../assets_src/ui/results_kit.png');
const OUT = path.join(__dirname, '../assets/ui/results');
fs.mkdirSync(OUT, { recursive: true });

const save = (img, name) => img.webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT, name + '.webp'));
const crop = (x, y, w, h) => sharp(SRC).extract({ left: x, top: y, width: w, height: h });
const rawOf = async img => {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const fromRaw = r => sharp(r.data, { raw: { width: r.w, height: r.h, channels: 4 } });
// Remplace un rectangle par l'interpolation horizontale de ses deux colonnes de bord (efface le texte du score).
function patch(r, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) / (x1 - x0),
        a = (y * r.w + x0 - 1) * 4,
        b = (y * r.w + x1) * 4,
        o = (y * r.w + x) * 4;
      for (let c = 0; c < 4; c++) r.data[o + c] = r.data[a + c] * (1 - t) + r.data[b + c] * t;
    }
}
// x, y, w, h du cadre ; score = rectangle intérieur de la plaque ; cut = bande étirable [y0, y1)
const FRAMES = {
  victory: { box: [21, 2, 652, 354], score: [268, 113, 393, 137], cut: [210, 235] },
  defeat: { box: [713, 2, 613, 352], score: [247, 107, 367, 130], cut: [210, 235] }
};

(async () => {
  for (const [k, F] of Object.entries(FRAMES)) {
    const r = await rawOf(crop(...F.box));
    patch(r, ...F.score);
    const full = await fromRaw(r).png().toBuffer(),
      [c0, c1] = F.cut,
      part = (y, h) => sharp(full).extract({ left: 0, top: y, width: r.w, height: h });
    await save(part(0, c0), `frame_${k}_top`);
    await save(part(c0, c1 - c0), `frame_${k}_mid`);
    await save(part(c1, r.h - c1), `frame_${k}_bottom`);
  }
  await save(crop(1094, 451, 207, 54), 'btn_again_win');
  await save(crop(1315, 379, 207, 53), 'btn_lobby');
  // « Play again » rouge de la défaite : le bouton vert recoloré (le vert devient rouge, l'or ne bouge pas)
  const g = await rawOf(crop(1094, 451, 207, 54));
  for (let i = 0; i < g.data.length; i += 4) {
    const [R, G, B] = [g.data[i], g.data[i + 1], g.data[i + 2]];
    if (G > R + 15 && G > B) [g.data[i], g.data[i + 1], g.data[i + 2]] = [G, R * 0.45, B * 0.5];
  }
  await save(fromRaw(g), 'btn_again_loss');
  await save(crop(18, 571, 274, 50), 'ribbon_ally');
  await save(crop(347, 570, 249, 50), 'ribbon_enemy');
  console.log('Résultats : ' + fs.readdirSync(OUT).join(' '));
})();
