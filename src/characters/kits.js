(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CharacterKits = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // DONNÉES des personnages (aucune dépendance à three.js) : 7 classes × 5 races = 35 kits.
  // Lues par le jeu (src/characters/builder.js) et par l'outil de construction des bundles (tools/build_characters.js).
  // Assemblage des personnages à partir des packs CC0 Quaternius (même squelette 65 os pour tout) :
  // tête du corps de base + tenue + coiffure + pièces procédurales (robe, bâton), recoloration par classe/race.
  // La CLASSE choisit la tenue/silhouette, la RACE ne fait que la morphologie/peau/détails.

  // Clips de la bibliothèque d'animations conservés au build (le reste est retiré pour alléger).
  const ANIMS = [
    'Idle_Loop',
    'Jog_Fwd_Loop',
    'Sprint_Loop',
    'Walk_Loop',
    'Spell_Simple_Shoot',
    'Spell_Simple_Idle_Loop',
    'Sword_Attack',
    'Punch_Jab',
    'Punch_Cross',
    'Death01',
    'Hit_Chest',
    'Hit_Head',
    'Jump_Start',
    'Jump_Loop',
    'Jump_Land',
    'Roll'
  ];

  // CLASSE : tenue (pièces modulaires fusionnées au build), coiffure par défaut, palette, robe, arme, lueur des yeux.
  // Archétypes fantasy génériques et originaux (aucun personnage existant reproduit).
  const CLASSES = {
    sentinel: {
      // Guerrier : armure de plaques acier bordée d'or, grandes épaulières, épée et bouclier
      sex: 'M',
      outfit: ['Ranger_Body', 'Ranger_Arms', 'Ranger_Legs', 'Ranger_Feet'],
      hair: { M: 'Hair_Long', F: 'Hair_Long' },
      hairColor: [0.06, 0.05, 0.05],
      palette: { dark: [0.1, 0.1, 0.12], mid: [0.36, 0.37, 0.4], trim: [0.74, 0.56, 0.28], cloth: [0.48, 0.5, 0.54] },
      weapon: 'swordShield',
      cape: { raceTint: 1, trim: [0.92, 0.72, 0.3], length: 0.62, emblem: 1 },
      bones: { spine_03: 1.08, clavicle_l: 1.1, clavicle_r: 1.1, upperarm_l: 1.06, upperarm_r: 1.06 },
      armor: {
        mat: {
          kind: 'metal',
          style: {
            base: [0.16, 0.18, 0.22],
            trim: [0.88, 0.7, 0.32],
            diamonds: [0.08, 0.3, 0.72],
            rivets: true,
            plain: true
          }
        },
        trim: [0.92, 0.74, 0.32],
        thick: 1.9,
        shellMat: {
          belt: {
            kind: 'metal',
            style: { base: [0.55, 0.42, 0.2], trim: [0.95, 0.78, 0.36], diamonds: [0.08, 0.3, 0.72], plain: true }
          }
        },
        shells: ['cuirass', 'belt', 'rerebrace', 'vambrace', 'cuisse', 'greave'],
        pauldron: { layers: 2, size: 0.16, bigSpikes: 5, cover: 1.3 },
        mask: [0.4, 0.43, 0.5],
        maskMetal: true
      }
    },
    arcanist: {
      // Sorcière de bataille : robe violet profond / or, capuche, bâton à cristal arcane
      sex: 'F',
      outfit: ['Peasant_Body', 'Peasant_Arms', 'Peasant_Legs', 'Peasant_Feet', 'Ranger_Head_Hood'],
      hair: { F: 'Hair_Long', M: 'Hair_SimpleParted' },
      hairColor: [0.92, 0.72, 0.38],
      palette: { dark: [0.13, 0.05, 0.2], mid: [0.36, 0.14, 0.55], trim: [0.86, 0.66, 0.26], cloth: [0.93, 0.89, 0.8] },
      robe: { color: [0.3, 0.11, 0.47], trim: [0.86, 0.66, 0.26], length: 0.86, flare: 1.7 },
      staff: { crystal: [0.78, 0.55, 1.0] },
      eyeGlow: [0.55, 0.3, 1.0],
      orbs: { color: [0.7, 0.45, 1], n: 3 },
      cape: { color: [0.34, 0.12, 0.5], trim: [0.9, 0.7, 0.3], length: 0.82 },
      handFx: [{ kind: 'orb', color: [0.7, 0.4, 1] }],
      // mantelet de tissu brodé d'or, ceinture et brassards assortis
      armor: {
        mat: {
          kind: 'cloth',
          style: {
            base: [0.3, 0.11, 0.46],
            trim: [0.86, 0.66, 0.26],
            stitch: [0.86, 0.66, 0.26],
            grain: 0.05,
            glow: [0.75, 0.45, 1]
          }
        },
        trim: [0.86, 0.66, 0.26],
        shells: ['belt', 'vambrace'],
        pauldron: { layers: 2, size: 0.105, cover: 1.3 }
      }
    },
    oracle: {
      // Prêtresse : robe blanche et or, bâton solaire
      sex: 'F',
      outfit: ['Peasant_Body', 'Peasant_Arms', 'Peasant_Legs', 'Peasant_Feet'],
      hair: { F: 'Hair_Buns', M: 'Hair_SimpleParted' },
      hairColor: [0.45, 0.27, 0.14],
      palette: { dark: [0.4, 0.3, 0.16], mid: [0.86, 0.82, 0.72], trim: [0.9, 0.72, 0.3], cloth: [0.97, 0.95, 0.9] },
      robe: { color: [0.9, 0.88, 0.82], trim: [0.88, 0.68, 0.25], length: 0.9, flare: 1.6 },
      staff: { crystal: [1.0, 0.82, 0.4], wood: 0xe8dcc0, metal: 0xd9b55a },
      orbs: { color: [1, 0.85, 0.4], n: 3 },
      cape: { color: [0.92, 0.88, 0.78], trim: [0.92, 0.72, 0.28], length: 0.85, emblem: 'star' },
      handFx: [{ kind: 'star', color: [1, 0.85, 0.45] }],
      // mantelet blanc à larges bordures dorées, ceinture d'or
      armor: {
        mat: {
          kind: 'cloth',
          style: {
            base: [0.93, 0.91, 0.85],
            trim: [0.88, 0.68, 0.25],
            stitch: [0.88, 0.68, 0.25],
            lames: 2,
            grain: 0.04,
            glow: [1, 0.8, 0.35]
          }
        },
        trim: [0.92, 0.72, 0.28],
        shellMat: {
          belt: { kind: 'metal', style: { base: [0.88, 0.68, 0.28], lames: 1, rivets: true, trim: [0.95, 0.85, 0.5] } }
        },
        shells: ['belt', 'vambrace'],
        pauldron: { layers: 2, size: 0.11, cover: 1.35 }
      }
    },
    reaver: {
      // Chevalier runique : plaques d'acier noirci à runes de givre, épaulières à pointes, grande lame runique
      sex: 'M',
      outfit: ['Ranger_Body', 'Ranger_Arms', 'Ranger_Legs', 'Ranger_Feet'],
      hair: { M: 'Hair_Long', F: 'Hair_Long' },
      hairColor: [0.78, 0.8, 0.82],
      palette: { dark: [0.05, 0.06, 0.08], mid: [0.2, 0.24, 0.3], trim: [0.55, 0.74, 0.88], cloth: [0.26, 0.3, 0.36] },
      weapon: 'runeblade',
      eyeGlow: [0.4, 0.8, 1.0],
      cape: { color: [0.1, 0.11, 0.17], trim: [0.35, 0.55, 0.75], length: 0.78, tattered: 1, flare: 1.6 },
      skulls: { shoulders: 1, flame: [0.35, 0.75, 1] },
      armor: {
        mat: {
          kind: 'metal',
          style: { base: [0.17, 0.19, 0.22], trim: [0.3, 0.34, 0.4], lames: 3, ridge: true, rune: [0.45, 0.85, 1] }
        },
        trim: [0.34, 0.38, 0.46],
        thick: 1.6,
        bones: null,
        shells: ['cuirass', 'belt', 'rerebrace', 'vambrace', 'cuisse', 'greave'],
        pauldron: { layers: 4, size: 0.165, spikes: 3, cover: 1.3 }
      }
    },
    warden: {
      // Druidesse : robe de lin vert et crème, épaulières de feuilles, bois de cerf, bâton noueux à cristal vert
      sex: 'F',
      outfit: ['Peasant_Body', 'Peasant_Arms', 'Peasant_Legs', 'Peasant_Feet'],
      hair: { M: 'Hair_Long', F: 'Hair_Long' },
      hairColor: [0.55, 0.22, 0.08],
      palette: {
        dark: [0.12, 0.16, 0.06],
        mid: [0.26, 0.42, 0.16],
        trim: [0.78, 0.62, 0.26],
        cloth: [0.86, 0.82, 0.66]
      },
      robe: { color: [0.2, 0.38, 0.14], trim: [0.82, 0.66, 0.28], length: 0.9, flare: 1.6 },
      cape: { color: [0.16, 0.3, 0.12], trim: [0.6, 0.75, 0.25], length: 0.8, tattered: 0.8 },
      staff: { crystal: [0.45, 1.0, 0.35], wood: 0x4a3018, metal: 0x8a7a40, inHand: true },
      antlers: true,
      armor: {
        mat: {
          kind: 'leather',
          style: { base: [0.32, 0.21, 0.11], trim: [0.22, 0.34, 0.12], stitch: [0.6, 0.5, 0.3], glow: [0.35, 1, 0.3] }
        },
        shells: ['belt', 'vambrace'],
        pauldron: {
          layers: 2,
          size: 0.125,
          leaves: true,
          mat: { kind: 'leather', style: { base: [0.3, 0.2, 0.11], lames: 4, grain: 0.16 } }
        }
      }
    },
    shade: {
      // Voleuse : armure de cuir noir et rouge, masque, capuche, deux dagues aux hanches
      sex: 'F',
      outfit: ['Ranger_Body', 'Ranger_Arms', 'Ranger_Legs', 'Ranger_Feet', 'Ranger_Head_Hood'],
      hair: { F: 'Hair_Long', M: 'Hair_Buzzed' },
      hairColor: [0.1, 0.07, 0.06],
      palette: { dark: [0.04, 0.04, 0.05], mid: [0.14, 0.14, 0.17], trim: [0.5, 0.12, 0.1], cloth: [0.24, 0.24, 0.27] },
      weapon: 'daggers',
      cape: { color: [0.55, 0.06, 0.06], trim: [0.3, 0.04, 0.04], length: 0.42, width: 0.75, tattered: 1, flare: 1.7 },
      armor: {
        mat: {
          kind: 'leather',
          style: {
            base: [0.075, 0.065, 0.07],
            trim: [0.46, 0.07, 0.06],
            stitch: [0.7, 0.13, 0.1],
            lames: 2,
            grain: 0.08,
            glow: [1, 0.12, 0.08]
          }
        },
        shellMat: {
          belt: { kind: 'leather', style: { base: [0.48, 0.07, 0.06], stitch: [0.15, 0.02, 0.02], grain: 0.1 } }
        },
        shells: ['chest', 'belt', 'vambrace', 'greave'],
        pauldron: { layers: 2, size: 0.1 },
        mask: [0.025, 0.02, 0.025]
      }
    },
    warlock: {
      // Occultiste : robe noire et verte, capuche, bâton à flamme verte
      sex: 'M',
      outfit: ['Peasant_Body', 'Peasant_Arms', 'Peasant_Legs', 'Peasant_Feet', 'Ranger_Head_Hood'],
      hair: { M: 'Hair_SimpleParted', F: 'Hair_Long' },
      hairColor: [0.12, 0.1, 0.1],
      palette: { dark: [0.08, 0.03, 0.1], mid: [0.32, 0.1, 0.38], trim: [0.85, 0.65, 0.25], cloth: [0.36, 0.14, 0.42] },
      robe: { color: [0.3, 0.08, 0.38], trim: [0.45, 0.85, 0.22], length: 0.9, flare: 1.5 },
      cape: { color: [0.26, 0.06, 0.32], trim: [0.85, 0.65, 0.25], length: 0.85, tattered: 0.5 },
      skulls: { belt: 1 },
      handFx: [
        { kind: 'flame', color: [0.45, 1, 0.25], hand: 'r' },
        { kind: 'book', color: [0.45, 1, 0.25] }
      ],
      staff: { crystal: [0.4, 1.0, 0.25], wood: 0x1c1418, metal: 0x50604a },
      eyeGlow: [0.4, 1.0, 0.25],
      orbs: { color: [0.4, 1, 0.25], n: 3 },
      // mantelet sombre aux runes vertes et cornes d'os
      armor: {
        mat: {
          kind: 'cloth',
          style: { base: [0.24, 0.06, 0.3], trim: [0.85, 0.65, 0.25], rune: [0.4, 1.0, 0.25], grain: 0.06 }
        },
        trim: [0.85, 0.65, 0.25],
        shells: ['belt', 'vambrace'],
        pauldron: { layers: 2, size: 0.115, cover: 1.3, spikes: 2, spikeColor: 0xe6dcc0 }
      }
    }
  };
  // RACE : morphologie (échelle des os, rotations seulement dans les animations), peau, cheveux, détails.
  const RACES = {
    human: {},
    orc: {
      sex: { arcanist: 'F', warden: 'F' },
      defaultSex: 'M',
      hairF: 'Hair_Long',
      skin: [0.46, 0.98, 0.32],
      hairColor: [0.07, 0.05, 0.04],
      noHair: true,
      tusks: true,
      ears: { len: 0.055, up: 0.25 },
      bones: { spine_02: 1.1, spine_03: 1.1, neck_01: 0.86 }
    },
    dwarf: {
      sex: 'M',
      skin: [1.08, 0.92, 0.84],
      hairColor: [0.55, 0.24, 0.09],
      beard: true,
      hair: 'Hair_Buzzed',
      bigBeard: true,
      bones: {
        spine_01: 1.2,
        spine_02: 1.05,
        neck_01: 0.9,
        upperarm_l: 1.06,
        upperarm_r: 1.06,
        thigh_l: 0.78,
        thigh_r: 0.78
      }
    },
    elf: {
      skin: [1.06, 1.0, 0.98],
      hairColor: [0.93, 0.9, 0.8],
      hair: 'Hair_Long',
      ears: { len: 0.13, up: 0.6 },
      eyeGlow: [0.35, 0.85, 1.0],
      bones: { spine_03: 0.96 }
    },
    undead: {
      skin: [0.84, 0.8, 0.68],
      hairColor: [0.82, 0.84, 0.88],
      noHair: true,
      skull: true,
      eyeGlow: [0.45, 0.85, 1.0],
      bones: { spine_03: 0.95, neck_01: 0.97 }
    }
  };
  const SEXNAME = { F: 'Female', M: 'Male' };
  const PARTFILE = {
    Ranger_Feet: { F: 'Female_Ranger_Feet', M: 'Male_Ranger_Feet_Boots' },
    Ranger_Pauldron: { F: 'Female_Ranger_Acc_Pauldrons', M: 'Male_Ranger_Acc_Pauldron' }
  };
  const partFile = (key, sex) => (PARTFILE[key]?.[sex] || SEXNAME[sex] + '_' + key) + '.gltf';
  const sexFor = (race, cls) => {
    const x = RACES[race].sex;
    return typeof x === 'object' ? x[cls] || RACES[race].defaultSex || CLASSES[cls].sex : x || CLASSES[cls].sex;
  };
  // Kit complet d'une race+classe.
  function resolveKit(kitId) {
    const [race, cls] = kitId.split('_'),
      R = RACES[race],
      C = CLASSES[cls];
    if (!R || !C) throw new Error('Kit inconnu : ' + kitId);
    const noHelm = race === 'orc' || race === 'elf';
    let armor = C.armor && noHelm && C.armor.helmet ? { ...C.armor, helmet: null } : C.armor;
    if (armor?.maskMetal && (race === 'orc' || race === 'dwarf')) armor = { ...armor, mask: null };
    const sex = sexFor(race, cls),
      hair = armor?.helmet
        ? []
        : R.hairF && sex === 'F'
          ? [R.hairF]
          : R.noHair
            ? []
            : [R.hair && sex === 'M' ? R.hair : C.hair[sex]];
    if (R.beard) hair.push('Hair_Beard.gltf');
    return {
      ...C,
      race,
      cls,
      sex,
      body: 'Superhero_' + SEXNAME[sex] + '_FullBody.gltf',
      outfit: 'outfit_' + cls + '_' + sex,
      hair: hair.map(h => (/\.gltf$/.test(h) ? h : h + '.gltf')),
      hairColor: R.hairColor || C.hairColor,
      skin: R.skin || [1, 1, 1],
      eyeGlow: R.eyeGlow || C.eyeGlow,
      ears: R.ears,
      tusks: R.tusks,
      skull: R.skull,
      bigBeard: R.bigBeard,
      bones: mergeBones(mergeBones(HEROIC[sex], C.bones), R.bones),
      orbs: C.orbs,
      rim: RIM[cls],
      weapon:
        C.weapon === 'swordShield' ? { dwarf: 'hammerShield', orc: 'axeShield' }[race] || 'swordShield' : C.weapon,
      cape: tint(C.cape, race),
      tabard: tint(C.tabard, race),
      armor
    };
  }
  const RACE_TINT = {
      human: [0.12, 0.2, 0.52],
      elf: [0.1, 0.34, 0.16],
      dwarf: [0.14, 0.22, 0.5],
      orc: [0.5, 0.07, 0.05],
      undead: [0.36, 0.05, 0.08]
    },
    RACE_EMBLEM = { human: 'sword', elf: 'tree', dwarf: 'hammer', orc: 'axes', undead: 'sword' };
  function tint(c, race) {
    if (!c) return c;
    const o = { ...c };
    if (o.raceTint) o.color = RACE_TINT[race];
    if (o.emblem === 1) o.emblem = RACE_EMBLEM[race];
    return o;
  }
  // Silhouette héroïque (épaules larges, grandes mains, tête un peu plus petite), puis liseré de lumière par classe.
  const HEROIC = {
    M: {
      clavicle_l: 1.08,
      clavicle_r: 1.08,
      upperarm_l: 1.05,
      upperarm_r: 1.05,
      hand_l: 1.15,
      hand_r: 1.15,
      Head: 0.93,
      spine_03: 1.04
    },
    F: { hand_l: 1.06, hand_r: 1.06, Head: 0.95 }
  };
  const RIM = {
    sentinel: [1, 0.72, 0.38],
    arcanist: [0.72, 0.45, 1],
    oracle: [1, 0.86, 0.5],
    reaver: [0.4, 0.8, 1],
    warden: [0.5, 1, 0.4],
    shade: [1, 0.32, 0.25],
    warlock: [0.55, 1, 0.3]
  };
  function mergeBones(a, b) {
    const o = { ...(a || {}) };
    for (const k in b || {}) o[k] = (o[k] || 1) * b[k];
    return o;
  }
  const KITS = {};
  for (const r in RACES) for (const c in CLASSES) KITS[r + '_' + c] = { race: r, cls: c };
  // Pour le build : bundles de tenue (pièces fusionnées) et fichiers simples nécessaires.
  function buildManifest() {
    const outfits = {},
      files = new Set();
    for (const id in KITS) {
      const k = resolveKit(id);
      outfits[k.outfit] = CLASSES[k.cls].outfit.map(p => partFile(p, k.sex));
      files.add(k.body);
      k.hair.forEach(h => files.add(h));
    }
    return { outfits, files: [...files] };
  }
  const assetName = f => f.replace(/.(gltf|glb)$/i, '');
  const kitFor = (race, cls) => (KITS[race + '_' + cls] ? race + '_' + cls : null);

  return { ANIMS, CLASSES, RACES, KITS, resolveKit, buildManifest, assetName, kitFor };
});
