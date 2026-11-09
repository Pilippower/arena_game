'use strict';
// Lobby, onglet PvE (src/pve/pve_ui.js) : visuels dans le style des pièces de l'utilisateur.
//   node tools/build_pve_assets.js  →  assets/ui/lobby2/tag_adventure.webp, assets/ui/lobby2/mapcard_pve.webp
// - étiquette « ADVENTURE » : l'étiquette peinte « DIFFICULTY » (lobby_assets.png, mêmes coordonnées que
//   build_lobby2_assets.js), texte effacé (bande reconstituée rangée par rangée) puis réécrit ;
// - carte « The Mistvale Road » : capture du jeu (assets_src/ui/pve_card_shot.png, prise sur ?pve=arcanist, sans
//   interface) recadrée, sous le bandeau peint de la carte « The Castle » (blason, filets dorés), nom effacé puis
//   réécrit. Comme pour les arènes, la description courte est écrite par le jeu.
const sharp = require('sharp');
const path = require('path');
const { clearBg } = require('./image_tools.js');

const SRC = path.join(__dirname, '../assets_src/ui');
const OUT = path.join(__dirname, '../assets/ui/lobby2');
const GOLD = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d6"/><stop offset=".55" stop-color="#f1cf7e"/><stop offset="1" stop-color="#b98432"/></linearGradient>`;
// Texte peint : dégradé doré, contour brun foncé, ombre portée (comme les noms peints des cartes et étiquettes).
const goldText = (w, h, x, y, size, text) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${GOLD}<filter id="s"><feDropShadow dx="0" dy="${size / 18}" stdDeviation="${size / 20}" flood-color="#000" flood-opacity=".8"/></filter></defs><text x="${x}" y="${y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${size}" letter-spacing="${size / 30}" fill="url(#g)" stroke="#3a2208" stroke-width="${size / 24}" paint-order="stroke" filter="url(#s)">${text}</text></svg>`
  );
// Efface une zone de texte : chaque rangée est refaite par un dégradé entre ses deux pixels bordant la zone.
function eraseRows(data, width, x0, x1, y0, y1) {
  for (let r = y0; r < y1; r++)
    for (let c = x0; c < x1; c++) {
      const t = (c - x0) / (x1 - x0),
        a = (r * width + x0 - 1) * 4,
        b = (r * width + x1) * 4,
        o = (r * width + c) * 4;
      for (let k = 0; k < 4; k++) data[o + k] = data[a + k] * (1 - t) + data[b + k] * t;
    }
}
async function raw(img) {
  return img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
const fromRaw = ({ data, info }) => sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });

async function tagAdventure() {
  const SCALE = 2,
    base = await raw(
      await clearBg(sharp(path.join(SRC, 'lobby_assets.png')).extract({ left: 795, top: 173, width: 174, height: 34 }))
    );
  eraseRows(base.data, base.info.width, 44, 154, 4, 30); // « DIFFICULTY », entre la gemme et la pointe
  const w = 174 * SCALE,
    h = 34 * SCALE;
  await fromRaw(base)
    .resize(w, h, { kernel: 'lanczos3' })
    .composite([{ input: goldText(w, h, 100 * SCALE, 23.5 * SCALE, 14 * SCALE, 'ADVENTURE') }])
    .webp({ quality: 92 })
    .toFile(path.join(OUT, 'tag_adventure.webp'));
}

// Bandeau de la carte « The Castle » : le disque du blason, ses ailes dorées et la bande bleu nuit ; l'illustration
// d'origine (herbe, pierres, ciel) devient transparente. Coordonnées de la carte à 720 × 596.
const W = 720,
  H = 596,
  BAND_Y = 450, // haut de la bande (son filet doré), un peu plus haut au centre sous le blason
  BAND_END = 486, // en dessous : bande entière
  DISC = { x: 366, y: 428, r: 45 },
  WINGS = { x0: 226, x1: 498, y0: 424 };
const gold = (r, g, b) => r > 110 && r >= g && g > b * 1.05,
  green = (r, g, b) => g > r * 1.04 && g > b * 0.95;
function keepBand(d, o, x, y) {
  const [r, g, b] = [d[o], d[o + 1], d[o + 2]];
  if (y >= BAND_END || Math.hypot(x - DISC.x, y - DISC.y) <= DISC.r) return true;
  if (y >= WINGS.y0 && x >= WINGS.x0 && x < WINGS.x1 && gold(r, g, b)) return true;
  return y >= BAND_Y && !green(r, g, b) && (gold(r, g, b) || b >= r * 0.9);
}
async function mapcardPve() {
  const card = await raw(sharp(path.join(OUT, 'mapcard_castle.webp')).resize(W, H));
  const { data } = card;
  eraseRows(data, W, 192, 562, 466, 530); // « THE CASTLE »
  for (let y = 0; y < BAND_END; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (!keepBand(data, o, x, y)) data[o + 3] = 0;
    }
  // illustration : la capture (bandes de l'interface retirées) à mi-taille, calée pour que le château et la colline
  // tombent dans la tranche que le lobby montre au-dessus du bandeau (rangées SHOT_TOP… : object-position en bas) ;
  // au-dessus, ciel de nuit
  const SHOT_TOP = 252,
    shotPart = await sharp(path.join(SRC, 'pve_card_shot.png'))
      .extract({ left: 0, top: 62, width: 1440, height: (H - SHOT_TOP) * 2 })
      .resize(W, H - SHOT_TOP)
      .modulate({ brightness: 1.08, saturation: 1.1 })
      .png()
      .toBuffer(),
    sky = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05081a"/><stop offset="1" stop-color="#121a3c"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#k)"/></svg>`
    ),
    shot = sharp(sky).composite([{ input: shotPart, top: SHOT_TOP, left: 0 }]);
  const scene = await shot.png().toBuffer();
  const band = await fromRaw(card).png().toBuffer();
  // coins arrondis du cadre d'origine (les cartes peintes ont des coins transparents)
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="26" ry="26"/></svg>`
  );
  await sharp(scene)
    .composite([
      { input: band },
      { input: goldText(W, H, 370, 513, 30, 'THE MISTVALE ROAD') },
      { input: mask, blend: 'dest-in' }
    ])
    .webp({ quality: 86 })
    .toFile(path.join(OUT, 'mapcard_pve.webp'));
}
(async () => {
  await tagAdventure();
  await mapcardPve();
  console.log('PvE : tag_adventure.webp, mapcard_pve.webp');
})();
