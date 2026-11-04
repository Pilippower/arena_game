'use strict';
// Outils d'image communs aux tools/build_*_assets.js (sharp).
const sharp = require('sharp');

// Fond sombre de la planche → transparent : remplissage depuis les bords sur les pixels sombres (l'or reste).
async function clearBg(img, limit = 58) {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    w = info.width,
    h = info.height,
    dark = p => Math.max(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) < limit,
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
module.exports = { clearBg };
