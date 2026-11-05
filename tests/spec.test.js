'use strict';
// Tests rapides (sans navigateur) des spécifications validées : docs/SPEC.md.
// Les données de jeu sont des scripts navigateur : on les évalue dans un contexte minimal.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read, code } = require('./sources.js');

const ctx = { console, Math, window: {}, document: { addEventListener() {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
const run = f => vm.runInContext(read(f).replace(/^(const|let) /gm, 'var '), ctx, { filename: f });
// stubs des dépendances navigateur appelées au chargement des fichiers de données
vm.runInContext('var $=()=>({});var now=()=>0;var clamp=(v,a,b)=>Math.max(a,Math.min(b,v));', ctx);
run('src/data/classes.js');
run('src/ui/icons.js');
const C = ctx.CLASS;
const skill = (cls, n) => [C[cls].skills, ...Object.values(C[cls].bars || {})].flat().find(s => s.n === n);

// Icônes du druide (régression signalée : elles avaient été inversées)
assert.equal(ctx.skillMotif('Cat Form'), 'claws', 'Cat Form = griffures');
assert.equal(ctx.skillMotif('Bear Form'), 'paw', 'Bear Form = empreinte de patte');
// CC sans recharge
assert.equal(skill('arcanist', 'Polymorph').cd, 0, 'Polymorph sans recharge');
assert.equal(skill('warlock', 'Fear').cd, 0, 'Fear sans recharge');
// Prêtre : Smite (moitié des dégâts du mage) et Holy Terror (fear de zone 10 m) ; chevalier de la mort sans Death Advance
assert.equal(C.oracle.skills.map(s => s.n).join(), 'Flash Heal,Power Shield,Holy Terror,Dispel,Smite,Pain');
assert.ok(
  Math.abs(skill('oracle', 'Smite').dmg * 2 - skill('arcanist', 'Frost Bolt').dmg) <= 10,
  'Smite = moitié de l’Arcane Bolt'
);
assert.equal(skill('oracle', 'Holy Terror').radius, 10);
assert.match(ctx.skillIconSVG('oracle', 2), /spells\/silence\.webp/, 'Holy Terror : icône de Silence');
assert.match(ctx.skillIconSVG('oracle', 4), /spells\/angelic_step\.webp/, 'Smite : icône d’Angelic Step');
assert.ok(!C.reaver.skills.some(s => s.n === 'Death Advance'), 'chevalier de la mort sans Death Advance');
assert.equal(skill('oracle', 'Holy Terror').dur, 6, 'Holy Terror : 6 s');
assert.equal(skill('arcanist', 'Frost Nova').root, 6, 'Frost Nova : 6 s');
assert.equal(ctx.FORM_INFO.bear.swing[1], 45, 'ours : 45 / 2 s');
assert.equal(skill('reaver', 'Death Grip').cd, 25);
assert.ok(skill('shade', 'Kidney Shot').stun === 6 && skill('shade', 'Kidney Shot').cd === 30, 'Kidney 6 s / 30 s');
assert.ok(
  skill('sentinel', 'Hamstring').cd === 0 && skill('sentinel', 'Hamstring').dmg === 10,
  'Hamstring 10, sans CD'
);
assert.ok(read('src/ui/skillbar.js').includes('function trinketTooltip'), 'infobulle du trinket');
{
  const names = cls => C[cls].skills.map(s => s.n).join();
  assert.equal(names('arcanist'), 'Frost Bolt,Frost Nova,Counterspell,Arcane Barrier,Blink,Polymorph');
  assert.equal(names('reaver'), 'Obliterate,Death Grip,Asphyxiate,Pillar of Frost,Death Coil');
  assert.equal(names('warden'), 'Wrath,Entangling Roots,Rejuvenation,Moonfire,Regrowth,Cat Form,Bear Form');
  assert.equal(names('warlock'), 'Shadow Bolt,Fear,Spell Lock,Corruption,Demonic Gate,Drain Life');
  assert.ok(skill('arcanist', 'Frost Bolt').slow === 0.6 && skill('arcanist', 'Frost Bolt').dur === 12);
  assert.ok(skill('arcanist', 'Arcane Barrier').shield === 300 && skill('arcanist', 'Arcane Barrier').cd === 15);
  assert.equal(skill('oracle', 'Pain').dot, Math.round(C.oracle.hp * 0.15));
  assert.equal(skill('warlock', 'Corruption').dot, Math.round(C.warlock.hp * 0.2));
  assert.equal(skill('warden', 'Rejuvenation').hot, Math.round(C.warden.hp * 0.4));
  assert.ok(skill('warden', 'Regrowth').cast === 1.15 && skill('warden', 'Regrowth').cd === 0);
  assert.ok(skill('warden', 'Moonfire').dmg === 50 && skill('warden', 'Moonfire').dot === 125);
  assert.equal(skill('warden', 'Demoralizing Roar').per, 15);
  assert.equal(skill('shade', 'Cheap Shot').stun, 3);
  for (const [cls, i, art] of [
    ['arcanist', 0, 'arcane_bolt'],
    ['arcanist', 3, 'arcane_power'],
    ['warden', 3, 'starfall'],
    ['warlock', 3, 'dark_soul'],
    ['warden', 2, 'rejuvenation'],
    ['warden', 4, 'regrowth']
  ])
    assert.ok(ctx.skillIconSVG(cls, i).includes(`spells/${art}.webp`), 'icône ' + art);
}
// Formes / camouflage (vitesse camouflée, insensibilité au mouton : tests/combat.test.js)
assert.equal(ctx.FORM_INFO.cat.speed, 1.3, 'félin +30 % de vitesse');
assert.equal(ctx.FORM_INFO.bear.hp, 1.4, 'ours +40 % PV');
assert.equal(ctx.FORM_INFO.bear.armor, 0.7, 'ours -30 % dégâts subis');
// Armures
assert.equal(C.sentinel.armor, 'plate');
assert.equal(C.shade.armor, 'leather');
assert.equal(C.arcanist.armor, 'cloth');
assert.ok(
  ctx.ARMOR.plate.physical > ctx.ARMOR.leather.physical && ctx.ARMOR.leather.physical > ctx.ARMOR.cloth.physical
);
// Voleur : 2× plus rapide, même DPS que le guerrier (rapport dégâts / intervalle)
const sw = read('src/game/rules.js').match(/const SWING = \{[^}]*\}/)[0];
const SW = vm.runInNewContext('(' + sw.replace('const SWING = ', '') + ')');
assert.ok(
  Math.abs(SW.shade[1] / SW.shade[0] - SW.sentinel[1] / SW.sentinel[0]) < 1.5,
  'voleur : même DPS que le guerrier'
);
assert.ok(SW.shade[0] <= SW.sentinel[0] / 2 + 0.01, 'voleur : frappe 2× plus vite');
// Voleur : techniques renforcées (il tue un soigneur : tools/duel.js shade oracle)
assert.deepEqual(
  ['Backstab', 'Ambush', 'Kidney Shot', 'Shadowstep'].map(n => skill('shade', n).dmg),
  [215, 465, 80, 80],
  'voleur : dégâts des techniques'
);
// Contrôles : glisser au clic gauche = caméra seule (la trajectoire ne suit pas la caméra)
const ctl = read('src/input/controls.js');
assert.match(
  ctl,
  /if \(looking && state\?\.player\?\.alive\) state\.player\.yaw = camera\.yaw/,
  'seul le clic droit oriente le personnage'
);
// base de trajectoire figée pendant le glisser au clic gauche, joystick mobile : tests/gameplay.test.js
// The Bridge : tablier praticable, 2 rampes à chaque extrémité qui descendent jusqu'au sable
vm.runInContext('var arena={};var HEALTH_SPOTS=[];', ctx);
run('src/data/maps.js');
ctx.applyMap('bridge');
const B = ctx.arena.bridge;
assert.equal(ctx.surfaceAt(0, 0).h, B.y, 'tablier à la hauteur du pont');
for (const sx of [-1, 1])
  for (const sz of [-1, 1]) {
    assert.equal(ctx.surfaceAt(sx * B.rampX, sz * (B.halfW + 0.01)).h > B.y - 0.1, true, 'rampe raccordée au pont');
    assert.ok(ctx.surfaceAt(sx * B.rampX, sz * (B.halfW + B.rampLen)).h < 0.01, 'rampe au niveau du sable');
  }
assert.equal(ctx.groundAt({ x: 0, z: 0, y: 0 }), 0, 'sous le pont : on reste au sol');
// flanc d'une rampe : on bute là où la pente est basse, on passe sous son haut (05/11/2026 : tests/combat.test.js)
assert.ok(
  ctx.blockedBySurface({ x: B.rampX, z: B.halfW + 7, y: 0 }),
  'on ne traverse pas le bas d’une rampe par le côté'
);
assert.ok(!ctx.blockedBySurface({ x: B.rampX, z: B.halfW + 1, y: 0 }), 'on passe sous le haut d’une rampe');
// IA sur The Bridge : sable → tablier par une rampe (pied, puis haut), pas en dessous de la cible
vm.runInContext('var state=null;var gatesOpen=()=>true;', ctx); // portes ouvertes (salles de départ : combat.test.js)
vm.runInContext(read('src/game/combat.js').match(/function resolveWalls[\s\S]*?\n\}/)[0], ctx);
run('src/game/ai.js');
{
  const goal = { x: 0, y: B.y, z: 0 },
    foot = ctx.aiWaypoint({ x: 0, y: 0, z: 8 }, goal);
  assert.ok(Math.abs(foot.x) === B.rampX && Math.abs(foot.z) > B.halfW + B.rampLen, 'IA : vers le pied de la rampe');
  const top = ctx.aiWaypoint({ x: B.rampX, y: 1.5, z: 9 }, goal);
  assert.ok(top.x === B.rampX && top.z > 0 && top.z < B.halfW, 'IA : sur la rampe, vers le tablier');
  const same = { x: 0, y: 0, z: 9 };
  assert.equal(ctx.aiWaypoint({ x: 3, y: 0, z: 9 }, same), same, 'IA : même niveau, tout droit');
  // descente depuis l'angle de l'ouverture : d'abord le haut de la rampe (dans l'ouverture), pas le pied en biais
  const corner = ctx.aiWaypoint({ x: B.rampX - 1.1, y: B.y, z: B.halfW - 0.35 }, { x: 20, y: 0, z: 10 });
  assert.ok(corner.x === B.rampX && corner.z < B.halfW, 'IA : descente sans buter dans l’angle');
  // en haut de la rampe, cible au sol à côté du pont : on sort de la zone du garde-corps, puis on saute par le côté
  const below = { x: 15, y: 0, z: 2.5 },
    w1 = ctx.aiWaypoint({ x: B.rampX, y: 4.7, z: B.halfW + 0.7 }, below),
    w2 = ctx.aiWaypoint({ x: B.rampX, y: 3, z: B.halfW + 4 }, below);
  assert.ok(w1.x === B.rampX && w1.z > B.halfW + 1.2, 'IA : descend sous la zone du garde-corps');
  assert.ok(w2.x < B.rampX - B.rampW / 2 && w2.z === B.halfW + 4, 'IA : saute par le côté de la rampe, vers la cible');
  // contre un mur : on longe au lieu de courir sur place
  const u = { x: ctx.arena.halfX - 0.72, z: 0, y: 0 };
  assert.notEqual(ctx.aiStep(u, Math.PI / 2 + 0.2, 0.05), null, 'IA : longe le mur');
  assert.ok(Math.abs(u.z) > 0.02, 'IA : avance le long du mur');
}
assert.match(read('src/game/ai.js'), /u\.aiKite \? 5 : 3\.2/, 'IA : fuit une mêlée jusqu’à 5 m (pas de va-et-vient)');
assert.match(read('src/game/ai.js'), /u\.aiRegroup \? 7 : 13/, 'IA : rejoint un allié jusqu’à 7 m');
// Téléportation sur la rampe du pont : monte en suivant la pente (n'est plus renvoyée au départ)
{
  vm.runInContext(read('src/game/combat.js').match(/function pointWalkable[\s\S]*?\n\}/)[0], ctx);
  vm.runInContext(read('src/game/combat.js').match(/function blinkForward[\s\S]*?\n\}/)[0], ctx);
  const u = { x: B.rampX, z: B.halfW + 10, y: ctx.surfaceAt(B.rampX, B.halfW + 10).h, yaw: Math.PI, root: 2 };
  ctx.blinkForward(u, 7, true);
  assert.ok(u.z < B.halfW + 4 && u.y > 2, 'Blink monte la rampe');
  assert.equal(u.root, 2, 'Demonic Gate : racines gardées');
}
// Formats de match : 1v1, 2v2, 3v3
{
  const ctx2 = {
    console,
    Math,
    window: {},
    document: { addEventListener() {} },
    location: { search: '' },
    URLSearchParams
  };
  ctx2.globalThis = ctx2;
  vm.createContext(ctx2);
  vm.runInContext(read('src/game/combat.js').replace(/^(const|let) /gm, 'var '), ctx2, { filename: 'combat.js' });
  for (const n of [1, 2, 3]) {
    const T = ctx2.teamsFor('arcanist', n);
    assert.equal(T.allies.length + 1, n, n + 'v' + n + ' : alliés');
    assert.equal(T.foes.length, n, n + 'v' + n + ' : adversaires');
  }
  assert.notEqual(ctx2.teamsFor('arcanist', 1).foes[0][0], 'oracle', '1v1 : pas de soigneur seul');
  assert.ok(read('index.html').includes('id="sizeChoices"'), 'lobby : choix du mode');
}
// Lobby : feu animé des torches, petites phrases masquées, cartes de race et de classe de même taille
const lobbyCss = read('src/ui/lobby.css').replace(/\s+/g, ' ');
assert.match(read('src/ui/lobby.js'), /TORCHES[\s\S]*requestAnimationFrame/, 'torches du lobby animées');
assert.ok(
  lobbyCss.includes('#overlay #selectedClass, #overlay .pvHead .tiny { display: none;'),
  'petites phrases du lobby masquées'
);
assert.match(
  lobbyCss,
  /#overlay \.classPick \{[^}]*width: var\(--cw\);[^}]*aspect-ratio: 1\.45;/,
  'cartes race/classe : même taille'
);
assert.ok(
  lobbyCss.includes('lobby/frame.webp') && read('tools/build_lobby_assets.js').includes("'kit_18.png'"),
  'cadre du lobby : panoplie, angles continus'
);
// The Bridge : personnages cachés par le tablier dessinés en silhouette translucide (pas les camouflés)
const h3 = code('src/render/');
assert.match(h3, /function hfRenderGhosts[\s\S]*GreaterDepth/, 'silhouette des personnages sous le pont');
assert.ok(h3.includes('(rec.opacity ?? 1) >= 1'), 'pas de silhouette pour les unités camouflées');
// Fluidité : qualité adaptative, ombres interpolées, passe des silhouettes seulement si besoin
assert.match(
  read('src/core/perf.js'),
  /PERF\.fps < 50[\s\S]*PERF\.locked = true|PERF\.locked = true[\s\S]*PERF\.fps < 50/,
  'qualité adaptative'
);
assert.ok(code('src/render/').includes('b.position.set(u.rx ?? u.x'), 'ombre au sol interpolée');
assert.match(h3, /if \(!groups\.size\) return;/, 'silhouettes : pas de passe inutile');
// aucun délai d'affichage (05/11/2026) : caméra et orientation du personnage immédiates
assert.match(code('src/render/'), /const dist = camera\.dist,/, 'zoom immédiat');
assert.doesNotMatch(code('src/render/'), /CAM_VIEW|dispYaw|rec\.lean/, 'pas de caméra ni de pivot lissés');
assert.match(h3, /rec\.moveOff = off;/, 'pas chassé : orientation immédiate');
assert.match(h3, /ATTACK_HIT = \{\s*Sword_Attack/, 'frappe synchronisée avec les dégâts');
assert.ok(read('index.html').includes('.nameplate.enemy .npCast'), "barre d'incantation ennemie lisible");
const aiSrc = read('src/game/ai.js');
for (const k of ['function aiSteer', 'function aiCover', 'u.aiPeel', 'const ccReady'])
  assert.ok(aiSrc.includes(k), 'IA : ' + k);
// Icônes dessinées par l'utilisateur : chaque entrée de SPELL_ART a son image
{
  const fs = require('node:fs');
  for (const k of ctx.SPELL_ART)
    assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', 'assets/ui/spells', k + '.webp')), 'icône ' + k);
  assert.match(
    ctx.skillIconSVG('arcanist', 5),
    /assets\/ui\/spells\/polymorph\.webp/,
    'Polymorph : icône de l’utilisateur'
  );
}
assert.match(read('src/core/main.js'), /render\(\);\s*hudCastFrame\(\);/, "barre d'incantation fluide");
assert.ok(read('index.html').includes('body.mobile-mode #partyFrames{left:4px!important'), 'mobile : équipe à gauche');
assert.match(ctx.skillIconSVG('arcanist', 5), /preserveAspectRatio="xMidYMid slice"/, 'icône plein bouton');
assert.ok(
  read('index.html').includes('.nameplate.enemy .npCast{width:140px;position:absolute'),
  'barre de vie de la cible stable'
);
assert.ok(read('index.html').includes('grid-template-rows:58px 1fr 84px;'), 'PC : bande du bas fine');
// Buffs à côté de la barre de vie : icône du sort et temps restant (bouclier : absorption restante)
run('src/ui/hud.js');
{
  const b = ctx.buffList({
    cls: 'arcanist',
    burst: 0,
    shield: 90,
    shieldName: 'Arcane Barrier',
    spellImmune: 0,
    auras: [{ n: 'Rejuvenation', kind: 'hot', rem: 7 }]
  });
  assert.equal(
    b.map(x => `${x.n}:${x.v ?? x.t}`).join(),
    'Arcane Barrier:90,Rejuvenation:7',
    'bouclier + soin dans la durée'
  );
  assert.equal(
    ctx
      .debuffList({ auras: [{ n: 'Corruption', kind: 'dot', rem: 9 }] })
      .map(x => x.n)
      .join(),
    'Corruption',
    'dégâts dans la durée en débuff'
  );
  const html = ctx.buffsHTML({ alive: true, cls: 'shade', spellImmune: 2.2, burst: 0, shield: 0 });
  assert.ok(html.includes('spells/cloak.webp') && html.includes('2.2'), 'Cloak : icône + temps restant');
  assert.ok(!read('src/ui/hud.js').includes('</div>${buffsHTML(u)}'), 'pas de buffs dans les cadres latéraux');
  assert.equal(
    ctx
      .debuffList({ stun: 2, slow: 0, debuffSpell: { stun: 'Kidney Shot', slow: 'Hamstring' } })
      .map(x => x.n)
      .join(),
    'Kidney Shot',
    'débuff : sort qui l’a posé, tant qu’il dure'
  );
  // contrôles (étourdi, mouton / Sap, peur, silence, racines) : icône 30 % plus grande que les autres débuffs
  const deb = ctx.aurasHTML(
    ctx.debuffList({
      stun: 2,
      slow: 3,
      root: 1,
      debuffSpell: { stun: 'Kidney Shot', slow: 'Hamstring', root: 'Frost Nova' }
    }),
    'buffs debuffs'
  );
  assert.equal((deb.match(/class="buff cc"/g) || []).length, 2, 'étourdi et racines marqués CC');
  assert.match(deb, /class="buff" title="Hamstring"/, 'ralentissement : taille normale');
  const auraCss = read('index.html');
  assert.ok(
    auraCss.includes('.npAuras .buff{width:34px;height:34px}.npAuras .buff.cc{width:44px;height:44px}') &&
      auraCss.includes(
        'body.mobile-mode .npAuras .buff{width:26px;height:26px}body.mobile-mode .npAuras .buff.cc{width:34px;height:34px}'
      ),
    'CC : 44 px (34 × 1,3), mobile 34 px (26 × 1,3)'
  );
  assert.ok(
    code('src/render/').includes("aurasHTML(debuffList(u), 'buffs debuffs')"),
    'auras au-dessus des personnages'
  );
}
// Interface en jeu PC : panoplie de l'utilisateur (assets/ui/hud), mobile et lobby inchangés
{
  const fs = require('node:fs'),
    css = read('src/ui/hud.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(read('index.html').includes('src/ui/hud.css'), 'interface PC chargée');
  for (const f of [
    'frame_self',
    'frame_target',
    'frame_party',
    'frame_enemy',
    'slot',
    'plaque',
    'top_bar',
    'bottom_bar'
  ])
    assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', 'assets/ui/hud', f + '.webp')), 'HUD : ' + f);
  // mobile : mêmes cadres et cases de sorts, tailles et positions propres (pas de chevauchement des commandes)
  assert.ok(
    css.includes('body.mobile-mode #partyFrames') && css.includes('body.mobile-mode #mobileActions'),
    'HUD mobile'
  );
  assert.ok(!read('src/ui/results.css').includes('body:not(.mobile-mode)'), 'fin de match et Leave aussi sur mobile');
  assert.ok(css.includes('.unitInfo:has(.castBar) .nm'), 'incantation adverse à la place du nom');
  assert.match(
    read('src/ui/hud.js'),
    /function frameHTML[^`]*`\$\{portraitHTML\(u\)\}\$\{badgeHTML\(u\)\}/,
    'portrait + emblème'
  );
}
// Barre de sorts stable (clic = sort, pas de tremblement), cible amie, sortie de match, lobby épuré
{
  const hud = read('src/ui/hud.js');
  assert.match(hud, /if \(box\._key !== key\)/, 'barre de sorts construite une fois');
  assert.ok(!/skills'\)\.innerHTML/.test(hud), 'pas de reconstruction à chaque mise à jour');
  assert.ok(!hud.includes('class="tag"'), 'pas de bulles sur la barre du bas');
  assert.match(read('src/game/match.js'), /function leaveMatch[\s\S]*?state = null/, 'quitter arrête le match');
  assert.ok(read('index.html').includes('id="leaveConfirm"'), 'confirmation avant de quitter');
  assert.match(
    read('index.html'),
    /id="restartBtn"><i class="ico shield"><\/i>Return to Lobby</,
    'bouton « Return to Lobby »'
  );
  assert.ok(
    read('src/ui/lobby.css')
      .replace(/\s+/g, ' ')
      .includes('body.lobby #status, body.lobby #top #restartBtn { display: none;'),
    'lobby épuré'
  );
  // barre du haut en jeu : icône + titre « Arena Ascendant » comme dans le lobby, jamais le sous-titre « 1v1 to 3v3 · WebGL… »
  assert.ok(!read('index.html').includes('1v1 to 3v3 · WebGL'), 'pas de sous-titre du jeu');
  assert.ok(read('index.html').includes('<h1><i class="ico swords"></i>Arena Ascendant</h1>'), 'icône + titre du jeu');
  assert.ok(!/#top h1\{display:none\}/.test(read('index.html').replace(/\s+/g, '')), 'titre visible en jeu');
  // mobile : icônes de la panoplie PC (pas de glyphes ⚙ ♫ ↻), centrées dans le bouton
  assert.ok(
    !/#(settingsBtn|musicBtn|restartBtn):after/.test(read('index.html')),
    'mobile : pas de glyphes à la place des icônes'
  );
  assert.ok(
    read('index.html').includes(
      'body.mobile-mode #top button{font-size:0;padding:0;min-width:34px;height:32px;display:inline-grid;place-items:center}'
    ) && read('index.html').includes('body.mobile-mode #top button .ico{width:20px;height:20px;margin:0;'),
    'mobile : icônes PC centrées'
  );
}
assert.match(
  code('src/render/'),
  /state\.winTeam === u\.team\) \{\s*\/\/[^\n]*\n\s*key = 'cheer'/,
  'vainqueurs : geste de joie'
);
// Écran de fin de match : panoplie de l'utilisateur, animé (flammes, étincelles / braises)
{
  const fs = require('node:fs');
  for (const f of [
    'frame_victory_top',
    'frame_victory_mid',
    'frame_defeat_top',
    'title_victory',
    'title_defeat',
    'pennant',
    'btn_again_loss',
    'ribbon_ally'
  ])
    assert.ok(
      fs.existsSync(require('node:path').join(__dirname, '..', 'assets/ui/results', f + '.webp')),
      'résultats : ' + f
    );
  assert.match(read('src/game/match.js'), /resultsFxStart\(win\)/, 'résultats : animation lancée');
  assert.match(read('src/ui/results.js'), /requestAnimationFrame/, 'résultats : rien de figé');
  assert.match(read('src/ui/results.css'), /cqh/, 'résultats : tient dans la hauteur');
}
assert.ok(!read('index.html').includes('class="features"'), 'lobby : pas de bulles');
assert.match(
  read('src/ui/theme.css'),
  /\.skill \.skillName \{\s*display: none !important;/,
  'pas de nom sous les sorts'
);
assert.ok(
  require('node:fs').existsSync(require('node:path').join(__dirname, '..', 'assets/audio/click.wav')) &&
    read('src/audio/tracks.js').includes("el.closest('#skills, #mobileControls')"),
  'clic de souris sur l’interface, pas sur les sorts'
);
assert.match(
  read('src/ui/settings.js'),
  /updateSelectPreview\(selectedRace, selectedClass\);\s*lobbySkillBar\(selectedClass\);/,
  'lobby : barre de sorts de la classe choisie'
);
// Lobby : un clic sur un sort de forme (druide) ou sur Stealth (voleur) affiche sa barre ; rien n'est lancé
{
  const { sandbox } = require('./sources.js'),
    els = { skills: {} },
    shown = [];
  const S = sandbox({
    CLASS: ctx.CLASS,
    barKey: ctx.barKey,
    skillsOf: ctx.skillsOf,
    $: id => els[id],
    renderSkillBar: u => shown.push(ctx.skillsOf(u)[0].n)
  });
  const src = read('src/ui/settings.js');
  vm.runInContext('var LOBBY_UNIT = null; var ' + src.match(/const (LOBBY_FORMS = [\s\S]*?;)\r?\n/)[1], S.ctx);
  for (const f of ['lobbySkillBar', 'lobbyBarAfter', 'lobbySpellClick']) S.fn('src/ui/settings.js', f);
  const X = S.ctx,
    click = name =>
      X.lobbySpellClick(
        X.LOBBY_UNIT,
        ctx.skillsOf(X.LOBBY_UNIT).findIndex(s => s.n === name)
      );
  X.lobbySkillBar('warden');
  click('Bear Form');
  assert.equal(shown.at(-1), 'Maul', 'Bear Form : barre de l’ours');
  X.lobbySkillBar('warden'); // choix d'une race : même classe, la barre de forme reste
  assert.equal(shown.at(-1), 'Maul', 'forme gardée tant que la classe ne change pas');
  click('Cat Form');
  assert.equal(shown.at(-1), 'Shred', 'Cat Form (barre de l’ours) : barre du félin');
  click('Human Form');
  assert.equal(X.LOBBY_UNIT.form, null, 'Human Form : barre de base');
  const n = shown.length;
  click(ctx.skillsOf(X.LOBBY_UNIT)[0].n);
  assert.equal(shown.length, n, 'sort ordinaire : la barre ne change pas');
  X.lobbySkillBar('shade');
  click('Stealth');
  assert.ok(X.LOBBY_UNIT.stealth, 'voleur : Stealth affiche la barre de camouflage');
  click('Stealth');
  assert.ok(!X.LOBBY_UNIT.stealth, 'Stealth dans sa barre : retour à la barre de base');
  assert.ok(!read('index.html').includes('lobbyBars'), 'plus d’onglets Normal / Cat / Bear');
}
// Lobby, 2e design : étiquettes de la panoplie, arènes illustrées, récapitulatif, grand PLAY
{
  const fs = require('node:fs'),
    html = read('index.html');
  for (const k of ['mode', 'difficulty', 'arena', 'race', 'class', 'preview'])
    assert.ok(
      html.includes('tag-' + k) &&
        fs.existsSync(require('node:path').join(__dirname, '..', 'assets/ui/lobby2/tag_' + k + '.webp')),
      'étiquette ' + k
    );
  assert.ok(
    html.indexOf('class="lobbyOpts"') < html.indexOf('class="pickerLayout"'),
    'Mode | Difficulty sous le titre'
  );
  assert.ok(html.includes('id="lobbyChips"'), 'récapitulatif sous l’aperçu');
  assert.match(read('src/ui/settings.js'), /MAP_ART\[id\] \|\| window\.MAP_THUMBS/, 'arènes illustrées');
}
assert.match(
  read('src/ui/lobby.css'),
  /\.mapCard \.mapArt \{[^}]*overflow: hidden;/,
  'zoom des arènes dans le cadre doré'
);
for (const f of ['frame', 'title', 'btn_leave', 'btn_stay'])
  assert.ok(
    require('node:fs').existsSync(require('node:path').join(__dirname, '..', 'assets/ui/leave', f + '.webp')),
    'Leave : ' + f
  );
assert.ok(read('src/ui/results.css').includes('#leaveConfirm #leaveYes'), 'Leave : boutons de la maquette');
assert.match(
  code('src/characters/'),
  /function dwarfBeard[\s\S]*?Beard_Mass[\s\S]*?16, face \* 0\.2/,
  'barbe de nain tressée jusqu’à la ceinture'
);
assert.ok(
  ['function beastLoft', 'function beastSmooth', 'croissant de lune', 'cristaux de glace'].every(k =>
    code('src/render/').includes(k)
  ),
  'druide : panthère d’ombre et ours de givre'
);
assert.ok(
  read('src/ui/lobby.js').includes('assets/ui/lobby2/${kind}_${key}.webp') &&
    read('src/ui/settings.js').includes('mapcard_castle'),
  'lobby : cartes peintes de l’utilisateur'
);
assert.ok(
  /Masse runique du nain[\s\S]*?0\.62 \* s[\s\S]*?AdditiveBlending/.test(code('src/characters/')),
  'masse du nain : grosse, lumineuse, plus courte'
);
// Jeu en ligne : points d'accroche présents, réseau isolé dans src/net/online.js (pas de chargement hors ligne)
{
  const on = read('src/net/online.js');
  assert.ok(/^var NET = \{/m.test(on), 'NET visible comme window.NET');
  assert.ok(
    on.includes("s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'") &&
      !read('index.html').includes('peerjs'),
    'PeerJS chargé seulement au clic'
  );
  assert.match(
    read('src/game/sim.js'),
    /NET\?\.role === 'guest'\) return netGuestUpdate\(dt\)/,
    'invité : suit l’hôte'
  );
  assert.match(
    read('src/game/combat.js'),
    /NET\?\.role === 'guest'\) return \(?netSend\(\{ t: 'skill', i \}\)/,
    'invité : sorts envoyés à l’hôte'
  );
  // jeu en ligne : onglet Multiplayer du lobby (plus de fenêtre Online) ; comportement : tests/online.test.js
  assert.ok(
    read('index.html').includes('id="tabMulti"') && !read('index.html').includes('netPanel'),
    'lobby : onglet Multiplayer'
  );
}
{
  const all = ['src/game/sim.js', 'src/game/combat.js', 'src/data/classes.js'].map(read).join(' ');
  assert.ok(!/u === state\.player\) showError/.test(all), 'erreurs d’unité : unitError (aussi pour l’ami en ligne)');
  assert.ok(
    read('src/net/online.js').includes('unitError(u, skillFailReason(u, m.i))'),
    'invité : message du sort raté'
  );
}
assert.ok(
  read('src/ui/results.css').includes('title_victory.webp') &&
    !read('src/ui/results.css').includes('banner_') &&
    read('src/ui/results.css').includes('top: calc((var(--ty) + var(--scy) * var(--ts)) * var(--g) - 14 * var(--u));'),
  'titre intégré au bord haut du cadre (pas de bandeau surélevé), score centré sur sa plaque'
);
for (const m of Object.values(ctx.MAPS)) assert.ok(m.desc.length <= 40, 'description d’arène courte : ' + m.name);
assert.ok(
  /#overlay \.iconChoice \.cardArt \{\s*position: absolute;\s*top: 0;/.test(read('src/ui/lobby.css')),
  'cartes : illustration collée en haut (pas de bande vide)'
);
{
  assert.match(read('src/game/combat.js'), /prepareMatch\(\);/, 'chargement à chaque manche');
  assert.match(
    code('src/render/'),
    /function render\(\) \{\s*if \(!gl\) return;[^]*?style\.display !== 'none'\) return;/,
    'lobby : arène cachée non dessinée'
  );
  assert.ok(!/PointLight/.test(code('src/characters/')), 'pas de lumière ponctuelle sur les personnages');
  assert.ok(
    !/l\.visible = false|light\.l\.visible/.test(read('src/render/effects.js')),
    'lumières d’effets toujours présentes'
  );
}
assert.ok(
  code('src/render/').includes('c.width = c.height = 1;') && read('index.html').includes('src/core/diag.js'),
  'iOS : mémoire des canevas libérée, diagnostic ?diag=1'
);
{
  const st = read('src/core/setup.js');
  assert.ok(
    st.includes("skills: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyE', 'Digit5']"),
    'raccourcis : 5 = A/Q, 6 = E'
  );
  assert.ok(
    st.includes("move: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', turnLeft: '', turnRight: '' }"),
    'déplacements réglables, tourner à gauche / à droite non réglés par défaut'
  );
  assert.ok(
    read('src/input/controls.js').includes('const mv = keybindsFor(state.player?.cls).move'),
    'déplacements selon les réglages'
  );
  assert.ok(read('src/ui/settings.js').includes("localStorage.setItem('arenaLastPick'"), 'race et classe mémorisées');
}
// Portée 30 m, ressource prise à la fin de l'incantation, sorts de zone sans cible : tests/combat.test.js
assert.ok(
  read('src/core/loading.js').includes('const LOADING_MIN_MS = 3000;') &&
    read('src/core/loading.js').includes("if (first) loadingShow('Entering the arena');"),
  'chargement immédiat, 3 s minimum'
);
assert.ok(!/stunSwirl[\s\S]{0,400}'cone'/.test(code('src/render/')), 'étourdissement : cercles');
assert.match(
  read('src/characters/kits.js'),
  /elf: \{[\s\S]*?neck_01: \[0\.95, 1\.18, 0\.95\][\s\S]*?thigh_l: \[0\.9, 1\.08, 0\.9\]/,
  'elfes élancés'
);
assert.ok(
  h3.includes("names = [rec.leftHit ? 'Punch_Jab' : 'Punch_Cross', 'Sword_Attack']") &&
    h3.includes("if (u.cls === 'reaver' && rec.kit && u.alive && !u.form) hfTwoHandIK(rec, u);"),
  'voleur deux lames, chevalier à deux mains'
);
assert.ok(
  ['function beastFurShells', 'extrémités bouchées', 'respiration'].every(k => code('src/render/').includes(k)),
  'bêtes : fourrure, sans trou, animées'
);
assert.ok(
  read('src/ui/hud.js').includes('return u.cast.channel ? left : 1 - left;'),
  'canalisation : barre qui se vide'
);
for (const k of ['drain_life', 'demoralizing_roar']) assert.ok(ctx.SPELL_ART.has(k), 'icône ' + k);
assert.ok(
  h3.includes('function hfBladeSlash') && h3.includes('hfArmIK(up, lo, hand, tgt, poleL)'),
  'glaives du voleur, frappe fluide du chevalier'
);
{
  assert.ok(read('src/game/combat.js').includes('function netTeamsFor'), 'en ligne : IA pour les places libres');
  assert.ok(!read('src/ui/settings.js').includes('size: online ? 1'), 'en ligne : mode du lobby respecté');
}
console.log('OK - spécifications validées (docs/SPEC.md)');
// Sorts : chaque sort de la barre de base a sa mécanique dans SPELL_CAST (game/spells.js), chaque rôle d'IA un vrai sort
{
  const sp = read('src/game/spells.js'),
    keys = new Set([...sp.matchAll(/^ {2}(?:'([^']+)'|(\w+)): \{/gm)].map(m => m[1] || m[2]));
  for (const cls in C)
    for (const s of C[cls].skills) if (!s.k) assert.ok(keys.has(s.n), 'SPELL_CAST sans entrée pour ' + s.n);
  const roles = read('src/game/ai.js').match(/const AI_ROLE = \{[\s\S]*?\n\};/)[0];
  for (const [, n] of roles.matchAll(/: '([^']+)'/g)) assert.ok(skill_any(n), 'AI_ROLE : sort inconnu ' + n);
  function skill_any(n) {
    return Object.keys(C).some(cls => skill(cls, n));
  }
}
// Fin de match mobile : cadre entier dans l'écran (bug : bas coupé, texte gonflé par le navigateur), colonnes alignées
{
  const css = read('src/ui/results.css');
  assert.ok(
    css.includes('text-size-adjust: 100%') && css.includes('var(--rows, 2)'),
    'mobile : résultats à la hauteur'
  );
  assert.ok(css.includes('table-layout: fixed'), 'résultats : colonnes alignées');
  assert.ok(read('src/game/match.js').includes("setProperty('--rows'"), 'résultats : nombre de lignes');
}
// Demonic Gate : vers l'avant du personnage (pas vers la cible), comme Blink : tests/combat.test.js
// Chevalier de la mort : l'arme ne tremble pas (IK depuis la pose animée hfFromAnimPose, lame orientée exactement même
// avec les os étirés du nain et de l'elfe hfTurnLocal) : tests/gameplay.test.js
// Fin de match : flammes animées sur les flammes peintes des torches
assert.ok(
  ['[26, 166]', '[699, 166]', '[37, 176]', '[859, 176]', 'flame: 1.6'].every(k =>
    read('src/ui/results.js').includes(k)
  ),
  'torches : flammes animées centrées sur les coupes peintes, plus grandes pour la victoire'
);
// Lobby PC : les murs touchent le cadre doré quelle que soit la forme de la fenêtre
assert.ok(
  read('src/ui/lobby.css').includes(
    '--wallw: max(calc((100vh - 142px) * 330 / 690), calc((100% - var(--mw)) / 2 + 16px));'
  ) &&
    read('src/ui/lobby.css').includes('var(--wallw) auto,') &&
    read('src/ui/lobby.css').includes('width: var(--mw);'),
  'lobby : murs jusqu’au cadre'
);
// Auras : jamais d'image absente (bug : Pain en carré noir et blanc qui clignotait)
{
  const fs = require('node:fs');
  assert.ok(
    read('src/ui/hud.js').includes('SPELL_ART.has(art)) return `<img'),
    'auras : icône vectorielle si pas d’image'
  );
  for (const k of ctx.SPELL_ART)
    assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', 'assets/ui/spells', k + '.webp')), 'image ' + k);
  for (const cls in C)
    for (const S of [C[cls].skills, ...Object.values(C[cls].bars || {})].flat()) {
      const art = ctx.spellArt(S.n);
      if (ctx.SPELL_ART.has(art)) continue;
      assert.ok(
        !fs.existsSync(require('node:path').join(__dirname, '..', 'assets/ui/spells', art + '.webp')),
        'SPELL_ART incomplet : ' + art
      );
    }
}
// Armes enchantées lumineuses (toutes les armes de mêlée) et feux follets des lanceurs
{
  const bd = code('src/characters/');
  assert.ok((bd.match(/weaponEnchant\(\s*THREE/g) || []).length >= 5, 'enchantements sur toutes les armes de mêlée');
  assert.ok(
    bd.includes('function flameWisp') && !/new THREE\.PointLight/.test(bd),
    'feux follets sans lumière ajoutée'
  );
}
// Auras au-dessus des personnages : icônes agrandies (cadres d'unité inchangés)
assert.ok(read('index.html').includes('.npAuras .buff{width:34px;height:34px}'), 'auras flottantes : 34 px');
// Elfes : armes et bâtons 40 % plus petits (les autres races gardent la taille normale)
{
  const K = require('../src/characters/kits.js');
  // toutes les armes et bâtons des elfes à 60 % (DK compris), taille normale pour les autres races
  for (const c of ['sentinel', 'arcanist', 'oracle', 'reaver', 'warden', 'shade', 'warlock']) {
    assert.equal(K.resolveKit('elf_' + c).weaponScale, 0.6, 'elfe ' + c + ' : armes à 60 %');
    for (const r of ['human', 'orc', 'dwarf', 'undead'])
      assert.equal(K.resolveKit(r + '_' + c).weaponScale, 1, r + ' ' + c);
  }
}
// Épaulières sculptées d'après les planches (characters/shoulders.js), toutes races ; les autres classes gardent les leurs
{
  const K = require('../src/characters/kits.js'),
    want = { arcanist: 'mage', warlock: 'warlock', shade: 'rogue', oracle: 'priest' };
  for (const r of ['human', 'orc', 'dwarf', 'elf', 'undead'])
    for (const c of ['sentinel', 'arcanist', 'oracle', 'reaver', 'warden', 'shade', 'warlock'])
      assert.equal(K.resolveKit(r + '_' + c).armor?.pauldron?.style, want[c], `${r} ${c} : épaulières`);
}
// Mêlée : cri d'effort et sons de frappe enregistrés par arme, licences documentées
{
  const fs = require('node:fs'),
    sfx = read('src/audio/sfx.js');
  assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', 'assets/audio/sfx_pack.js')), 'pack de sons');
  assert.ok(read('assets/audio/LICENSES.md').includes('CC-BY 3.0'), 'licences des sons');
  assert.ok(
    read('index.html').indexOf('assets/audio/sfx_pack.js') < read('index.html').indexOf('src/audio/sfx.js'),
    'pack avant sfx.js'
  );
  for (const k of ["'effort_m'", "'whoosh'", "'clash'", "'thud'", 'effort(u)'])
    assert.ok(sfx.includes(k), 'sons : ' + k);
  // cri sur les auto-attaques : tests/combat.test.js
}
// Chevalier de la mort : garde à deux mains devant lui hors frappe (mains jamais derrière le dos)
assert.ok(
  code('src/render/').includes('k.guardKey = K(-0.1, 1.0, 0.3, 0.25, 0.8, 0.55)') &&
    code('src/render/').includes('const STRIKE_T = 0.6 / raceStrike(u).speed;'),
  'DK : garde à deux mains devant lui et frappe calculée (pas de mélange avec le clip)'
);
// Raccourcis : jamais deux sorts sur la même touche, même avec d'anciens réglages : tests/keyboard.test.js
// Chevalier de la mort : paume gauche sur la poignée, sous la droite (mains alignées)
assert.ok(
  code('src/render/').includes('palmL = k.grip.localToWorld(new THREE.Vector3(0, -0.09, 0))'),
  'DK : mains alignées sur la poignée'
);
// Régressions signalées : icône d'origine de Death Coil, cri du mort-vivant non étouffé
assert.ok(!/'Death Coil': \{[^}]*art:/.test(read('src/data/classes.js')), 'Death Coil : pas l’icône d’un autre sort');
assert.ok(
  ctx.skillIconSVG('reaver', 4).includes('spells/death_coil.webp'),
  'Death Coil : illustration de l’utilisateur'
);
assert.ok(!read('src/audio/sfx.js').includes("lowpass: u.race === 'undead'"), 'cri du mort-vivant audible');
// Soins de la carte : pris par tout personnage (tests/gameplay.test.js), l'IA blessée va les chercher
// IA blessée qui va chercher le soin de la carte : tests/combat.test.js
// Réglages : une touche reprise rend l'ancienne action « Unset » (pas de permutation)
assert.ok(read('src/ui/settings.js').includes("if (other) set(other, '');"), 'touche reprise : ancienne action Unset');
assert.ok(
  read('src/core/setup.js').includes('if (!combo) return -1;') &&
    read('src/input/controls.js').includes('bindIndex(kb.skills, e)'),
  'Unset : aucune touche'
);
// PV de base (+50 %)
assert.deepEqual(
  ['sentinel', 'reaver', 'warden', 'shade', 'warlock', 'oracle', 'arcanist'].map(c => C[c].hp),
  [2400, 2175, 1875, 1770, 1740, 1620, 1470],
  'PV de base'
);
// Raccourcis combinés (Shift + E…) : la combinaison exacte d'abord, sinon la touche seule
{
  const vm = require('node:vm'),
    src = read('src/core/setup.js'),
    c = {};
  vm.createContext(c);
  vm.runInContext(
    [
      /const BIND_MODS = \[[\s\S]*?\];/,
      /const isModifierCode[^\n]*/,
      /function bindCombo[\s\S]*?\n\}/,
      /function bindIndex[\s\S]*?\n\}/
    ]
      .map(re => src.match(re)[0])
      .join('\n'),
    c
  );
  const ev = (code, mods = {}) => ({ code, shiftKey: false, ctrlKey: false, altKey: false, ...mods });
  const list = ['Digit1', 'KeyE', 'Shift+KeyE', 'Ctrl+Digit1'];
  assert.equal(c.bindIndex(list, ev('KeyE', { shiftKey: true })), 2, 'Shift + E');
  assert.equal(c.bindIndex(list, ev('KeyE')), 1, 'E seul');
  assert.equal(c.bindIndex(list, ev('Digit1', { ctrlKey: true })), 3, 'Ctrl + 1');
  assert.equal(c.bindIndex(list, ev('Digit1', { shiftKey: true })), 0, 'Shift + 1 non réglé : touche seule');
  assert.equal(c.bindCombo(ev('ShiftLeft', { shiftKey: true })), '', 'modificateur seul');
}
// Barres de vie des personnages assez grandes (demande : trop petites)
assert.ok(read('index.html').includes('.nameplate .npBar{height:clamp(7px,0.9vh,10px)'), 'barres de vie épaisses');
assert.ok(
  read('index.html').includes('body.mobile-mode #nameplates .nameplate .npBar{height:7px}'),
  'barres de vie mobile'
);
// Prêtre : Dispel (effets magiques) à la place de Divine Hymn, même icône ; soins fixes doublés
{
  assert.ok(ctx.skillIconSVG('oracle', 3).includes('spells/dispel.webp'), 'Dispel : icône de l’utilisateur');
  // ce que Dispel retire (magique seulement) et sur quelle cible : tests/combat.test.js
  assert.equal(skill('oracle', 'Flash Heal').heal, 440, 'Flash Heal doublé');
  assert.ok(read('src/data/classes.js').includes('const DRAIN_HEAL = 2;'), 'Drain Life : soin doublé');
}
// Pain : icône de l'utilisateur
assert.ok(ctx.skillIconSVG('oracle', 5).includes('spells/pain.webp'), 'Pain : icône de l’utilisateur');
assert.ok(read('index.html').includes('animation:npTargetGlow'), 'cible : contour doré qui pulse');
// Barres de forme : mêmes emplacements (touches) que la barre de base, bouton de forme à l'emplacement appuyé
{
  const sb = read('src/ui/skillbar.js');
  assert.ok(
    sb.includes("let j = k === bk ? bar.findIndex(s => s.k === 'human') : -1;"),
    'forme : retour humain sur la même touche'
  );
  assert.ok(read('src/ui/hud.js').includes("if (b.classList.contains('empty')) continue;"), 'emplacement vide');
}
// Druide : feulement en chat ; en ours, grognement grave de grizzly + couche de tigre abaissé et adouci (la taille),
// toutes les couches jouées ensemble ; licences documentées
{
  const src = read('src/audio/sfx.js'),
    V = vm.runInNewContext('(' + src.match(/const BEAST_VOICE = (\{[\s\S]*?\r?\n\});/)[1] + ')');
  assert.equal(V.cat.map(l => l.kind).join(), 'snarl_cat', 'chat : tigre');
  assert.equal(V.bear.map(l => l.kind).join(), 'roar_bear,snarl_cat', 'ours : grizzly + tigre');
  assert.ok(V.bear[1].rate < 0.7 && V.bear[1].lowpass > 0, 'ours : tigre abaissé, aigus coupés');
  assert.ok(/for \(const l of beast\)\s*sfxSample\(/.test(src), 'toutes les couches jouées');
}
assert.ok(
  read('assets/audio/LICENSES.md').includes('roar_bear') && read('assets/audio/LICENSES.md').includes('snarl_cat'),
  'licences des cris de bêtes'
);
// Cris des formes : graves, sans cri strident (félin) ni cri perçant « de cochon » (ours). Mesure : passages par zéro
// pondérés par l'énergie (≈ fréquence dominante, en Hz) ; anciens sons fautifs : 109 (félin) et 2312 (ours).
{
  const pk = read('assets/audio/sfx_pack.js'),
    PACK = JSON.parse(pk.slice(pk.indexOf('{'), pk.lastIndexOf('}') + 1));
  const brightness = uri => {
    const b = Buffer.from(uri.split(',')[1], 'base64'),
      sr = b.readUInt32LE(24);
    let z = 0,
      e = 0;
    for (let i = 46; i + 1 < b.length; i += 2) {
      const v = b.readInt16LE(i) / 32768,
        w = v * v;
      e += w;
      if (v >= 0 !== b.readInt16LE(i - 2) >= 0) z += w;
    }
    return ((z / e) * sr) / 2;
  };
  for (const [k, max] of [
    ['snarl_cat', 50],
    ['roar_bear', 50]
  ])
    PACK[k].forEach((u, i) => assert.ok(brightness(u) < max, `${k} n° ${i} trop aigu`));
  // ours : grave avant tout. Part d'énergie sous 250 Hz (passe-bas du 1er ordre) ; les clips « de cochon » retirés le
  // 04/11/2026 faisaient 19 à 36 %, les grognements de grizzly gardés 53 à 85 %
  const lowShare = uri => {
    const b = Buffer.from(uri.split(',')[1], 'base64'),
      a = Math.exp((-2 * Math.PI * 250) / b.readUInt32LE(24));
    let y = 0,
      e = 0,
      el = 0;
    for (let i = 44; i + 1 < b.length; i += 2) {
      const v = b.readInt16LE(i) / 32768;
      y = (1 - a) * v + a * y;
      e += v * v;
      el += y * y;
    }
    return el / e;
  };
  PACK.roar_bear.forEach((u, i) => assert.ok(lowShare(u) > 0.45, `ours n° ${i} pas assez grave (« cochon »)`));
}
assert.ok(!read('index.html').includes('pointerHint'), 'pas d’aide « Click: target » en haut au centre');
// bouclier visible dans les cadres de groupe : les règles des barres peintes ne visent que le remplissage de la vie
assert.ok(
  read('src/ui/hud.css').includes('body .unitRow .hpb > div:not(.shieldSpan),'),
  'bouclier visible dans les groupes'
);
// lobby mobile : rien ne déplace la barre du bas (régression du 04/11/2026 : « position: relative » des anciens
// onglets de forme la faisait recouvrir la moitié du lobby)
assert.ok(
  !/#bottom\s*\{\s*position:\s*relative/.test(read('src/ui/lobby.css')),
  'lobby mobile : barre du bas à sa place'
);
// Tourner au clavier : même rotation que le glisser au clic droit (convention validée)
assert.ok(
  read('src/input/controls.js').includes('GameLogic.applyLook(camera.yaw, camera.pitch, dir * TURN_PX_PER_S * dt, 0)'),
  'tourner au clavier'
);
// Réglage : la caméra revient (ou non) derrière le personnage après un glisser au clic gauche
assert.ok(
  read('index.html').includes('id="camReturnToggle"') && read('src/ui/settings.js').includes('cameraReturn'),
  'réglage retour caméra (comportement : tests/gameplay.test.js)'
);
// IA de mêlée : suit un pas en arrière : tests/gameplay.test.js
// Dispel : sans recharge, uniquement sur la cible actuelle amie
assert.equal(skill('oracle', 'Dispel').cd, 0, 'Dispel sans recharge');
// Projectiles des sorts : les deux moteurs d'effets visent la cible à chaque image (règle : tests/combat.test.js)
assert.ok(
  read('src/render/effects.js').includes('fxAim(o.f)') && read('src/render/fx_webgl.js').includes('fxAim(f)'),
  'les projectiles suivent leur cible au rendu'
);
// Poterne des salles de départ (05/11/2026, « les piliers de la porte tremblent ») : aucun bloc n'en recouvre un
// autre (faces confondues qui scintillent) et le rempart s'arrête à l'intérieur des piédroits, pas sur leur face
{
  const { sandbox } = require('./sources.js');
  const Obj = function () {
    this.position = { set() {} };
    this.rotation = {};
    this.userData = {};
    this.add = () => {};
  };
  const THREE = {
    Group: Obj,
    Mesh: Obj,
    BoxGeometry: Obj,
    CylinderGeometry: Obj,
    ConeGeometry: Obj,
    PlaneGeometry: Obj
  };
  const E = { registerMap() {} },
    S = sandbox({ window: { ArenaEnv: E }, ArenaEnv: E });
  S.load('src/render/start_rooms.js');
  const r = { side: 1, z: 0, wall: 1, depth: 10, halfW: 6, door: 1.9 },
    arena = { halfX: 30, halfZ: 20, rooms: [r] },
    boxes = [];
  E.startRooms(
    THREE,
    { add() {} },
    arena,
    { anim: [] },
    {
      wallH: 4.5,
      box: (w, h, d, x, y, z) => boxes.push([x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2])
    }
  );
  const overlap = (a, b) => [0, 2, 4].every(i => Math.min(a[i + 1], b[i + 1]) - Math.max(a[i], b[i]) > 1e-6);
  // piédroits, linteau, chaperon de la porte (pas les murs de la salle)
  const postern = boxes.filter(b => b[0] < arena.halfX + r.wall && Math.abs(b[4] + b[5]) / 2 < r.door + 1);
  postern.forEach((a, i) =>
    postern.slice(i + 1).forEach(b => assert.ok(!overlap(a, b), 'poterne : aucun bloc dans un autre'))
  );
  const gap = E.doorGap(arena, 1),
    posts = postern.filter(b => b[3] - b[2] > 4).map(b => [b[4], b[5]]);
  assert.equal(posts.length, 2, 'deux piédroits');
  for (const g of gap)
    assert.ok(
      posts.some(([a, b]) => g > a + 0.05 && g < b - 0.05),
      "le rempart s'arrête dans un piédroit"
    );
}
