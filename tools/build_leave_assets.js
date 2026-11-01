'use strict';
// Fenêtre « Leave the match? » : découpe la maquette de l'utilisateur (assets_src/ui/leave_mockup.png, 1774×887)
//   node tools/build_leave_assets.js  →  assets/ui/leave/*.webp
// Cadre : la scène autour et l'intérieur deviennent transparents (le jeu peint le fond bleu nuit) ; titre et
// boutons découpés à part, fond sombre rendu transparent.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '../assets_src/ui/leave_mockup.png');
const OUT = path.join(__dirname, '../assets/ui/leave');
fs.mkdirSync(OUT, { recursive: true });
const crop = (x, y, w, h) => sharp(SRC).extract({ left: x, top: y, width: w, height: h });
const save = (img, name) => img.webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT, name + '.webp'));
const rawOf = async img => {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const fromRaw = r => sharp(r.data, { raw: { width: r.w, height: r.h, channels: 4 } });
// Rend transparent tout ce que le remplissage depuis les bords atteint sans traverser `stop`.
function clearFromEdges(r, stop) {
  const { data, w, h } = r,
    seen = new Uint8Array(w * h),
    st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) {
    const p = st.pop();
    if (seen[p] || stop(data, p * 4)) continue;
    seen[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) st.push(p - 1);
    if (x < w - 1) st.push(p + 1);
    if (p >= w) st.push(p - w);
    if (p < w * (h - 1)) st.push(p + w);
  }
}
const gold = (d, i) => d[i] > 110 && d[i] - d[i + 2] > 45;
const bright = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) > 62;
(async () => {
  const F = [360, 215, 1055, 425], // cadre complet (blason en haut, gemme en bas)
    frame = await rawOf(crop(...F));
  // dehors : le remplissage s'arrête sur l'or et n'entre pas dans le corps du cadre (rectangle aux coins arrondis :
  // sa bordure a des traits sombres)
  const at = i => [((i / 4) % frame.w) + F[0], Math.floor(i / 4 / frame.w) + F[1]],
    inRound = (x, y, x0, y0, x1, y1, r) => {
      const dx = Math.max(x0 + r - x, 0, x - (x1 - r)),
        dy = Math.max(y0 + r - y, 0, y - (y1 - r));
      return x >= x0 && x <= x1 && y >= y0 && y <= y1 && dx * dx + dy * dy <= r * r;
    },
    inBody = i => inRound(...at(i), 376, 294, 1400, 606, 30);
  clearFromEdges(frame, (d, i) => gold(d, i) || inBody(i));
  // dedans : intérieur transparent (le jeu peint le fond bleu nuit dessous), jusqu'au filet doré intérieur
  const I = [400, 324, 1376, 584];
  for (let y = I[1]; y <= I[3]; y++)
    for (let x = I[0]; x <= I[2]; x++) frame.data[((y - F[1]) * frame.w + x - F[0]) * 4 + 3] = 0;
  const seen = new Uint8Array(frame.w * frame.h),
    st = [];
  for (let x = I[0]; x <= I[2]; x++)
    st.push((I[1] - 1 - F[1]) * frame.w + x - F[0], (I[3] + 1 - F[1]) * frame.w + x - F[0]);
  for (let y = I[1]; y <= I[3]; y++)
    st.push((y - F[1]) * frame.w + I[0] - 1 - F[0], (y - F[1]) * frame.w + I[2] + 1 - F[0]);
  while (st.length) {
    const p = st.pop();
    if (seen[p] || gold(frame.data, p * 4) || frame.data[p * 4 + 3] === 0) continue;
    seen[p] = 1;
    frame.data[p * 4 + 3] = 0;
    st.push(p - 1, p + 1, p - frame.w, p + frame.w);
  }
  await save(fromRaw(frame), 'frame');
  for (const [name, box] of [
    ['title', [520, 332, 735, 66]],
    ['btn_leave', [543, 473, 324, 90]],
    ['btn_stay', [913, 473, 320, 90]]
  ]) {
    const r = await rawOf(crop(...box));
    clearFromEdges(r, bright);
    await save(fromRaw(r), name);
  }
  console.log('Leave : ' + fs.readdirSync(OUT).join(' '));
})();
