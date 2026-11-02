'use strict';
// Tests rapides (sans navigateur) des spécifications validées : docs/SPEC.md.
// Les données de jeu sont des scripts navigateur : on les évalue dans un contexte minimal.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./sources.js');

const ctx = { console, Math, window: {}, document: { addEventListener() {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
const run = f => vm.runInContext(read(f).replace(/^(const|let) /gm, 'var '), ctx, { filename: f });
// stubs des dépendances navigateur appelées au chargement des fichiers de données
vm.runInContext('var $=()=>({});var now=()=>0;var clamp=(v,a,b)=>Math.max(a,Math.min(b,v));', ctx);
run('src/data/classes.js');
const C = ctx.CLASS;
const skill = (cls, n) => [C[cls].skills, ...Object.values(C[cls].bars || {})].flat().find(s => s.n === n);

// Icônes du druide (régression signalée : elles avaient été inversées)
assert.equal(ctx.skillMotif('Cat Form'), 'claws', 'Cat Form = griffures');
assert.equal(ctx.skillMotif('Bear Form'), 'paw', 'Bear Form = empreinte de patte');
// CC sans recharge
assert.equal(skill('arcanist', 'Polymorph').cd, 0, 'Polymorph sans recharge');
assert.equal(skill('warlock', 'Fear').cd, 0, 'Fear sans recharge');
// Prêtre : Smite (moitié des dégâts du mage) et Holy Terror (fear de zone 10 m) ; chevalier de la mort sans Death Advance
assert.equal(C.oracle.skills.map(s => s.n).join(), 'Flash Heal,Power Shield,Holy Terror,Divine Hymn,Smite,Pain');
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
assert.match(
  read('src/game/combat.js'),
  /src\.cls === 'arcanist'.*t\.rootKind === 'ice'\) crit = true/,
  'mage : critique sur cible gelée'
);
assert.match(read('src/game/combat.js'), /if \(u\.cast\) return 'Not ready yet'/, 'incantation en cours : message');
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
  assert.match(
    read('src/data/classes.js'),
    /control\(t, 'stun', S\.stun, u, 'opener'\)|'opener'/,
    'Cheap Shot : DR à part'
  );
}
// Formes / camouflage
assert.equal(ctx.FORM_INFO.cat.speed, 1.3, 'félin +30 % de vitesse');
assert.equal(ctx.FORM_INFO.bear.hp, 1.4, 'ours +40 % PV');
assert.equal(ctx.FORM_INFO.bear.armor, 0.7, 'ours -30 % dégâts subis');
assert.match(read('src/game/combat.js'), /u\.stealth \? 0\.7 : 1/, 'camouflé -30 % de vitesse');
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
// Contrôles : glisser au clic gauche = caméra seule (la trajectoire ne suit pas la caméra)
const ctl = read('src/input/controls.js');
assert.match(
  ctl,
  /if \(looking && state\?\.player\?\.alive\) state\.player\.yaw = camera\.yaw/,
  'seul le clic droit oriente le personnage'
);
assert.match(
  read('src/game/ai.js'),
  /orbiting/,
  'déplacement : base de trajectoire figée pendant le glisser au clic gauche'
);
// Mobile : déviation franche du joystick = vitesse pleine
assert.match(read('src/game/ai.js'), /mobileStickBoost/, 'joystick mobile : vitesse pleine');
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
assert.ok(ctx.blockedBySurface({ x: B.rampX, z: B.halfW + 1, y: 0 }), 'on ne traverse pas une rampe par le côté');
// IA sur The Bridge : sable → tablier par une rampe (pied, puis haut), pas en dessous de la cible
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
const h3 = read('src/render/heroes3d.js');
assert.match(h3, /function hfRenderGhosts[\s\S]*GreaterDepth/, 'silhouette des personnages sous le pont');
assert.ok(h3.includes('(rec.opacity ?? 1) >= 1'), 'pas de silhouette pour les unités camouflées');
// Fluidité : qualité adaptative, ombres interpolées, passe des silhouettes seulement si besoin
assert.match(
  read('src/core/perf.js'),
  /PERF\.fps < 50[\s\S]*PERF\.locked = true|PERF\.locked = true[\s\S]*PERF\.fps < 50/,
  'qualité adaptative'
);
assert.ok(read('src/render/environment.js').includes('b.position.set(u.rx ?? u.x'), 'ombre au sol interpolée');
assert.match(h3, /if \(!groups\.size\) return;/, 'silhouettes : pas de passe inutile');
assert.match(read('src/render/world.js'), /CAM_VIEW\.dist = [^;]*camera\.dist/, 'zoom lissé');
assert.match(h3, /rotation\.set\(castLean, ryaw, deathTilt \|\| rec\.lean\)/, 'inclinaison dans les virages');
assert.match(h3, /ATTACK_HIT = \{\s*Sword_Attack/, 'frappe synchronisée avec les dégâts');
assert.match(
  read('src/game/combat.js'),
  /SCHOOL_COLOR\[school\][^;]*crit\)/,
  'dégâts colorés par école, critiques en gros'
);
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
  assert.ok(
    read('src/render/world.js').includes("aurasHTML(debuffList(u), 'buffs debuffs')"),
    'auras au-dessus des personnages'
  );
  assert.match(
    read('src/game/combat.js'),
    /t\[type\] = Math\.max\(t\[type\] \|\| 0, dur\);\s*markDebuff\(t, type\)/,
    'contrôle : sort noté'
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
  assert.match(
    read('src/game/rules.js'),
    /u\.lastEnemy = t\.team !== u\.team \? t : null/,
    'se cibler arrête le combat'
  );
  assert.match(read('src/game/match.js'), /function leaveMatch[\s\S]*?state = null/, 'quitter arrête le match');
  assert.ok(read('index.html').includes('id="leaveConfirm"'), 'confirmation avant de quitter');
  assert.ok(
    read('src/ui/lobby.css').replace(/\s+/g, ' ').includes('body.lobby #top .sub, body.lobby #status { display: none;'),
    'lobby épuré'
  );
}
assert.match(
  read('src/game/sim.js'),
  /if \(state\.ended\) \{[\s\S]*?u\.prevX = u\.x;[\s\S]*?u\.moving = false;/,
  'fin de manche : pas de tremblement'
);
assert.match(
  read('src/render/heroes3d.js'),
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
  read('src/characters/builder.js'),
  /function dwarfBeard[\s\S]*?Beard_Mass[\s\S]*?16, face \* 0\.2/,
  'barbe de nain tressée jusqu’à la ceinture'
);
assert.ok(
  ['function beastLoft', 'function beastSmooth', 'croissant de lune', 'cristaux de glace'].every(k =>
    read('src/render/heroes3d.js').includes(k)
  ),
  'druide : panthère d’ombre et ours de givre'
);
assert.ok(
  read('src/ui/lobby.js').includes('assets/ui/lobby2/${kind}_${key}.webp') &&
    read('src/ui/settings.js').includes('mapcard_castle'),
  'lobby : cartes peintes de l’utilisateur'
);
assert.ok(
  /Masse runique du nain[\s\S]*?0\.62 \* s[\s\S]*?AdditiveBlending/.test(read('src/characters/builder.js')),
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
  assert.ok(
    read('index.html').includes('id="onlineBtn"') && read('index.html').includes('id="netPanel"'),
    'lobby : bouton Online'
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
  assert.match(read('src/game/sim.js'), /if \(state\.loading\) return;/, 'chargement : simulation arrêtée');
  assert.match(read('src/game/combat.js'), /prepareMatch\(\);/, 'chargement à chaque manche');
  assert.match(
    read('src/render/world.js'),
    /function render\(\) \{\s*if \(!gl\) return;[^]*?style\.display !== 'none'\) return;/,
    'lobby : arène cachée non dessinée'
  );
  assert.ok(!/PointLight/.test(read('src/characters/builder.js')), 'pas de lumière ponctuelle sur les personnages');
  assert.ok(
    !/l\.visible = false|light\.l\.visible/.test(read('src/render/effects.js')),
    'lumières d’effets toujours présentes'
  );
}
assert.ok(
  read('src/render/environment.js').includes('c.width = c.height = 1;') &&
    read('index.html').includes('src/core/diag.js'),
  'iOS : mémoire des canevas libérée, diagnostic ?diag=1'
);
{
  const st = read('src/core/setup.js');
  assert.ok(
    st.includes("skills: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyE', 'Digit5']"),
    'raccourcis : 5 = A/Q, 6 = E'
  );
  assert.ok(
    st.includes("move: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' }"),
    'déplacements réglables'
  );
  assert.ok(
    read('src/input/controls.js').includes('const mv = PREFS.keybinds.move'),
    'déplacements selon les réglages'
  );
  assert.ok(read('src/ui/settings.js').includes("localStorage.setItem('arenaLastPick'"), 'race et classe mémorisées');
}
{
  const cb = read('src/game/combat.js');
  assert.ok(cb.includes('const SPELL_RANGE = 30;'), 'portée 30 m');
  assert.match(
    cb,
    /if \(!\(u\.cast && u\.cast\.i === i && u\.cast\.end > now\(\) && !u\.cast\.channel\)\) pay\(u, i\)/,
    'ressource prise à la fin de l’incantation'
  );
  assert.match(
    read('src/game/sim.js'),
    /u\.res = Math\.max\(0, u\.res - \(ca\.cost \|\| 0\)\)/,
    'prélèvement à la fin'
  );
  assert.ok(cb.includes("type === 'poly' && t.form && src?.cls === 'arcanist'"), 'formes insensibles au mouton');
  const sp = read('src/game/spells.js');
  assert.ok(
    cb.includes('const blinkOut = C.usableStunned && u.stun > 0;') && /Blink: \{[^}]*usableStunned: true/.test(sp),
    'Blink sous étourdissement'
  );
  assert.ok(!sp.includes('if (!hit.length) return false;'), 'sorts de zone sans cible');
}
assert.ok(read('src/game/ai.js').includes('if (!p.airVel) p.airVel = p.lastVel'), 'saut : trajectoire figée');
assert.ok(read('src/game/combat.js').includes('recordHeal(t.shieldSrc || t, q)'), 'boucliers comptés en soins');
assert.ok(
  read('src/core/loading.js').includes('const LOADING_MIN_MS = 3000;') &&
    read('src/core/loading.js').includes("if (first) loadingShow('Entering the arena');"),
  'chargement immédiat, 3 s minimum'
);
assert.ok(!/stunSwirl[\s\S]{0,400}'cone'/.test(read('src/render/world.js')), 'étourdissement : cercles');
assert.match(
  read('src/characters/kits.js'),
  /elf: \{[\s\S]*?neck_01: \[0\.95, 1\.18, 0\.95\][\s\S]*?thigh_l: \[0\.9, 1\.08, 0\.9\]/,
  'elfes élancés'
);
assert.ok(
  h3.includes("names = [rec.leftHit ? 'Punch_Jab' : 'Punch_Cross', 'Sword_Attack']") &&
    h3.includes("if (u.cls === 'reaver' && rec.kit && u.alive && !u.form) hfTwoHandIK(rec);"),
  'voleur deux lames, chevalier à deux mains'
);
assert.ok(
  ['function beastFurShells', 'extrémités bouchées', 'respiration'].every(k =>
    read('src/render/heroes3d.js').includes(k)
  ),
  'bêtes : fourrure, sans trou, animées'
);
assert.ok(read('src/data/classes.js').includes('  cds[i] = S.cd;'), 'recharge dans la barre du sort lancé');
assert.ok(
  read('src/ui/hud.js').includes('return u.cast.channel ? left : 1 - left;'),
  'canalisation : barre qui se vide'
);
for (const k of ['drain_life', 'demoralizing_roar']) assert.ok(ctx.SPELL_ART.has(k), 'icône ' + k);
assert.ok(
  h3.includes('function hfBladeSlash') && h3.includes('k.smooth.lerp(tgt, ease)'),
  'glaives du voleur, frappe fluide du chevalier'
);
{
  const on = read('src/net/online.js');
  assert.ok(
    on.includes('guests: new Map()') && on.includes('function netRenderGuests') && on.includes('With me'),
    'en ligne : plusieurs amis, avec / contre'
  );
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
// Demonic Gate : vers l'avant du personnage (pas vers la cible), comme Blink
assert.match(
  read('src/game/spells.js'),
  /'Demonic Gate': \{\s*mobility: true,\s*noFace: true/,
  'Demonic Gate vers l’avant'
);
// Chevalier de la mort : l'arme ne tremble pas (IK depuis la pose animée, mains lissées dans le temps)
{
  const h3 = read('src/render/heroes3d.js');
  assert.ok(
    h3.includes('b.quaternion.equals(k.out[i])) b.quaternion.copy(k.anim[i])'),
    'IK : repart de la pose animée'
  );
  assert.ok(h3.includes('ease = 1 - Math.exp(-dt * 26)') && h3.includes('k.handQ.slerp(rel, ease)'), 'IK : lissage');
}
// Fin de match : flammes animées sur les flammes peintes des torches
assert.ok(
  ['[30, 168]', '[696, 168]', '[37, 176]', '[859, 176]', 'flame: 1.6'].every(k =>
    read('src/ui/results.js').includes(k)
  ),
  'torches : flammes animées centrées sur les coupes peintes, plus grandes pour la victoire'
);
// Lobby PC : les murs touchent le cadre doré quelle que soit la forme de la fenêtre
assert.ok(
  read('src/ui/lobby.css').includes('calc((100% - var(--mw)) / 2 + 16px)) auto') &&
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
  const bd = read('src/characters/builder.js');
  assert.ok((bd.match(/weaponEnchant\(\s*THREE/g) || []).length >= 5, 'enchantements sur toutes les armes de mêlée');
  assert.ok(
    bd.includes('function flameWisp') && !/new THREE\.PointLight/.test(bd),
    'feux follets sans lumière ajoutée'
  );
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
  assert.ok(read('src/game/rules.js').includes('SFX.effort(u)'), 'cri sur les auto-attaques');
}
// Chevalier de la mort : garde à deux mains devant lui hors frappe (mains jamais derrière le dos)
assert.ok(
  read('src/render/heroes3d.js').includes("(rec.animKey === 'attack' ? 0 : 1)") &&
    read('src/render/heroes3d.js').includes('new THREE.Vector3(-0.1, 1.0 * hy, 0.3 * hy)'),
  'DK : garde à deux mains devant lui'
);
// Raccourcis : jamais deux sorts sur la même touche, même avec d'anciens réglages à 6 cases (bug : druide, 2 sorts sur 5)
{
  const vm = require('node:vm'),
    src = read('src/core/setup.js'),
    pick = re => src.match(re)[0];
  for (const stored of [
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyE'],
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'Digit5'],
    ['Digit1', 'Digit1', 'KeyW', 'Digit4', 'KeyQ', 'KeyE']
  ]) {
    const c = {
      clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
      localStorage: { getItem: () => JSON.stringify({ keybinds: { skills: stored } }) }
    };
    vm.createContext(c);
    vm.runInContext(
      [
        /const PREF_KEY[^\n]*/,
        /const DEFAULT_PREFS = \{[\s\S]*?\n\};/,
        /function cloneDefaults[\s\S]*?\n\}/,
        /function loadPrefs[\s\S]*?\n\}/
      ]
        .map(pick)
        .join('\n') + '\nvar out = loadPrefs();',
      c
    );
    const kb = c.out.keybinds,
      all = [...kb.skills, kb.trinket, ...Object.values(kb.move)];
    assert.equal(kb.skills.length, 7, '7 cases');
    assert.equal(new Set(all).size, all.length, 'touches uniques : ' + kb.skills.join(','));
  }
}
// Chevalier de la mort : paume gauche sur la poignée, sous la droite (mains alignées)
assert.ok(
  read('src/render/heroes3d.js').includes('palmL = k.grip.localToWorld(new THREE.Vector3(0, -0.09, 0))'),
  'DK : mains alignées sur la poignée'
);
