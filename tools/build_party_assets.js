'use strict';
// Onglet Multiplayer du lobby, design de l'utilisateur (maquette assets_src/ui/party_interface.png, 1827 × 861) :
//   node tools/build_party_assets.js  →  assets/ui/party/*.webp
// Pièces peintes : bandeaux des deux équipes (blason + titre), « VS » et son trait vertical, boutons Start Match et
// Auto-Balance ; le fond bleu du panneau est rendu transparent (clearBg). Coordonnées en pixels de la maquette.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { clearBg } = require('./image_tools.js');

const SRC = path.join(__dirname, '../assets_src/ui/party_interface.png');
const OUT = path.join(__dirname, '../assets/ui/party');
fs.mkdirSync(OUT, { recursive: true });
// [x, y, largeur, hauteur, seuil du fond sombre]
const PIECES = {
  ribbon_ally: [455, 377, 410, 48, 62],
  ribbon_enemy: [968, 377, 405, 48, 62],
  vs: [884, 414, 62, 196, 62],
  start: [892, 628, 288, 60, 50],
  balance: [664, 632, 204, 54, 50]
};
(async () => {
  for (const [name, [x, y, w, h, limit]] of Object.entries(PIECES)) {
    const img = await clearBg(sharp(SRC).extract({ left: x, top: y, width: w, height: h }), limit);
    await img.webp({ quality: 88 }).toFile(path.join(OUT, name + '.webp'));
  }
  console.log('Party :', Object.keys(PIECES).join(' '));
})();
