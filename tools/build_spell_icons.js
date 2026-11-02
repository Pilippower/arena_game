'use strict';
// Icônes de sorts dessinées par l'utilisateur : planche assets_src/ui/spells_all.png (icônes encadrées + noms)
// → assets/ui/spells/<sort>.webp : l'illustration seule (sans le cadre de la planche), recadrée au carré pour
// remplir toute l'icône ; la bordure reste celle du jeu.
// Les cadres sont trouvés automatiquement (taches claires sur le fond sombre), lus ligne par ligne.
// Usage : node tools/build_spell_icons.js   (puis lister les clés dans SPELL_ART, src/data/classes.js)
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const SHEET = path.join(root, 'assets_src/ui/spells_all.png');
// Sort du jeu de chaque case, dans l'ordre de lecture (le nom écrit sur la planche est en commentaire s'il diffère).
const NAMES = [
  [
    'Arcane Bolt',
    'Frost Nova',
    'Blink',
    'Polymorph',
    'Arcane Power',
    'Charge',
    'Hamstring',
    'Mortal Strike',
    'Death Grip'
  ],
  ['Chains of Ice', 'Obliterate', 'Shadowstep', 'Ambush', 'Sap', 'Backstab', 'Kidney Shot', 'Fear', 'Shadow Bolt'],
  [
    'Power Shield', // « Chield of Priest »
    'Shield Wall',
    'Cat Form',
    'Bear Form',
    'Frenzied Regeneration', // « Rejuvenate »
    'Shred', // « Claw »
    'Maim', // « Stun Drood »
    'Flash Heal', // « Flash of Light »
    'Pummel'
  ],
  [
    'Counterspell',
    'Silence',
    'Divine Hymn',
    'Angelic Step',
    'Asphyxiate',
    'Pillar of Frost',
    'Death Advance',
    'Wrath',
    'Entangling Roots'
  ],
  ['Barkskin', 'Starfall', 'Rake', 'Maul', 'Swipe', 'Wild Charge', 'Human Form', 'Cloak', 'Vendetta', 'Stealth'],
  ['Spell Lock', 'Dark Soul', 'Demonic Gate', 'Trinket']
];
const INSET = 8; // épaisseur du cadre de la planche, retirée
const slug = n => n.toLowerCase().replace(/\W+/g, '_');
// Boîtes englobantes des taches claires assez grandes pour être une icône (les lettres sont plus petites).
function findFrames(data, W, H) {
  const on = i => Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) > 75;
  const seen = new Uint8Array(W * H),
    boxes = [],
    st = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !on(s)) continue;
    let x0 = W,
      y0 = H,
      x1 = 0,
      y1 = 0;
    seen[s] = 1;
    st.push(s);
    while (st.length) {
      const p = st.pop(),
        x = p % W,
        y = (p / W) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W])
        if (q >= 0 && q < W * H && !seen[q] && on(q)) {
          seen[q] = 1;
          st.push(q);
        }
    }
    if (x1 - x0 > 80 && y1 - y0 > 70) boxes.push({ x0, y0, x1, y1 });
  }
  // on garde les cadres extérieurs (pas les taches intérieures à un cadre), triés en lignes puis de gauche à droite
  const outer = boxes.filter(
    b => !boxes.some(o => o !== b && o.x0 <= b.x0 && o.y0 <= b.y0 && o.x1 >= b.x1 && o.y1 >= b.y1)
  );
  const rows = [];
  for (const b of outer.sort((a, c) => a.y0 - c.y0)) {
    const r = rows.find(r => Math.abs(r[0].y0 - b.y0) < 40);
    r ? r.push(b) : rows.push([b]);
  }
  return rows.map(r => r.sort((a, c) => a.x0 - c.x0));
}
(async () => {
  const { data, info } = await sharp(SHEET).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = findFrames(data, info.width, info.height);
  const counts = rows.map(r => r.length).join(','),
    want = NAMES.map(r => r.length).join(',');
  if (counts !== want) throw Error(`cadres trouvés par ligne ${counts}, attendus ${want}`);
  const out = path.join(root, 'assets/ui/spells');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const done = [];
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const b = rows[r][c],
        w = b.x1 - b.x0 - 2 * INSET,
        h = b.y1 - b.y0 - 2 * INSET,
        side = Math.min(w, h);
      await sharp(SHEET)
        .extract({
          left: Math.round(b.x0 + INSET + (w - side) / 2),
          top: Math.round(b.y0 + INSET + (h - side) / 2),
          width: side,
          height: side
        })
        .resize(128, 128)
        .webp({ quality: 88 })
        .toFile(path.join(out, slug(NAMES[r][c]) + '.webp'));
      done.push(slug(NAMES[r][c]));
    }
  // icônes fournies une par une (assets_src/ui/spells_extra/<sort>.png, cadre décoratif autour) : intérieur du cadre
  const EXTRA = path.join(root, 'assets_src/ui/spells_extra');
  if (fs.existsSync(EXTRA))
    for (const f of fs.readdirSync(EXTRA).filter(f => f.endsWith('.png'))) {
      const m = await sharp(path.join(EXTRA, f)).metadata(),
        inset = Math.round(m.width * 0.13);
      await sharp(path.join(EXTRA, f))
        .extract({ left: inset, top: inset, width: m.width - 2 * inset, height: m.height - 2 * inset })
        .resize(128, 128)
        .webp({ quality: 88 })
        .toFile(path.join(out, f.replace('.png', '.webp')));
      done.push(f.replace('.png', ''));
    }
  console.log(done.length + ' icônes : ' + done.join(' '));
})();
