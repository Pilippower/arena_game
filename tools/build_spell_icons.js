'use strict';
// Icônes de sorts dessinées par l'utilisateur : assets_src/ui/spells_<n>.png (planches avec cadres dorés et noms)
// → assets/ui/spells/<sort>.webp (illustration seule, carré centré dans le cadre ; le cadre est celui du jeu).
// Usage : node tools/build_spell_icons.js   (puis lister le résultat dans SPELL_ART, src/data/classes.js)
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
// Bords extérieurs des cadres (détectés sur les pixels dorés) : colonnes et lignes de chaque planche.
// Nom = sort du jeu (null = icône sans sort pour l'instant : enregistrée sous le nom de la planche).
const SHEETS = [
  {
    file: 'spells_1.png',
    cols: [
      [82, 402],
      [470, 788],
      [851, 1171]
    ],
    rows: [
      [20, 301],
      [408, 688],
      [794, 1084]
    ],
    names: [
      'Arcane Bolt', // « Frost Bolt » sur la planche
      'Frost Nova',
      'Blink',
      'Polymorph', // « Sheep »
      'Arcane Power',
      'Shadow Bolt',
      'Fear',
      'Power Shield', // « Priest Shield »
      'Flash Heal' // « Flash of Light »
    ]
  },
  {
    file: 'spells_2.png',
    cols: [
      [51, 393],
      [455, 797],
      [861, 1202]
    ],
    rows: [
      [21, 320],
      [413, 711],
      [803, 1105]
    ],
    names: [
      'Charge',
      'Hamstring',
      'Mortal Strike',
      'Death Grip',
      'Chains of Ice', // pas encore de sort de ce nom
      'Obliterate',
      'Shield Wall',
      'Backstab',
      'Kidney Shot'
    ]
  },
  {
    file: 'spells_3.png',
    cols: [
      [31, 351],
      [387, 708],
      [741, 1062],
      [1095, 1417]
    ],
    rows: [
      [64, 391],
      [531, 859]
    ],
    names: [
      'Shadowstep',
      'Ambush',
      'Sap',
      'Cat Form',
      'Bear Form',
      'Frenzied Regeneration', // « Rejuvenate »
      'Shred', // « Claw »
      'Maim' // « Druid Stun »
    ]
  }
];
const slug = n => n.toLowerCase().replace(/\W+/g, '_');
(async () => {
  const out = path.join(root, 'assets/ui/spells');
  fs.mkdirSync(out, { recursive: true });
  const done = [];
  for (const S of SHEETS) {
    const src = path.join(root, 'assets_src/ui', S.file);
    let k = 0;
    for (const [T, B] of S.rows)
      for (const [L, R] of S.cols) {
        const name = S.names[k++];
        // carré centré, à l'intérieur du cadre et de ses ornements d'angle
        const side = Math.round(Math.min(R - L, B - T) * 0.8),
          left = Math.round((L + R) / 2 - side / 2),
          top = Math.round((T + B) / 2 - side / 2);
        await sharp(src)
          .extract({ left, top, width: side, height: side })
          .resize(128, 128)
          .webp({ quality: 86 })
          .toFile(path.join(out, slug(name) + '.webp'));
        done.push(slug(name));
      }
  }
  console.log(done.length + ' icônes : ' + done.join(' '));
})();
