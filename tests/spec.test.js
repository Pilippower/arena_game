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
assert.equal(C.oracle.skills.map(s => s.n).join(), 'Flash Heal,Power Shield,Holy Terror,Divine Hymn,Smite');
assert.ok(
  Math.abs(skill('oracle', 'Smite').dmg * 2 - skill('arcanist', 'Arcane Bolt').dmg) <= 10,
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
assert.match(h3, /ATTACK_HIT = \{ Sword_Attack/, 'frappe synchronisée avec les dégâts');
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
  const b = ctx.buffList({ cls: 'warlock', burst: 4, shield: 90, shieldName: 'Dark Soul', spellImmune: 0 });
  assert.equal(b.length, 1, 'Dark Soul : une seule icône (dégâts + bouclier)');
  assert.deepEqual([b[0].n, b[0].t, b[0].v], ['Dark Soul', 4, 90]);
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
  assert.ok(!css.replace(/:not\(\.mobile-mode\)/g, '').includes('.mobile-mode'), 'HUD PC : rien pour le mobile');
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
  for (const f of ['frame_victory_top', 'frame_victory_mid', 'frame_defeat_top', 'btn_again_loss', 'ribbon_ally'])
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
  read('src/ui/results.css').includes('--scy: 118.5;') &&
    read('src/ui/results.css').includes('top: calc((var(--scy) - 14) * var(--u));'),
  'score centré sur la plaque (victoire et défaite)'
);
for (const m of Object.values(ctx.MAPS)) assert.ok(m.desc.length <= 40, 'description d’arène courte : ' + m.name);
assert.ok(
  /#overlay \.iconChoice \.cardArt \{\s*position: absolute;\s*top: 0;/.test(read('src/ui/lobby.css')),
  'cartes : illustration collée en haut (pas de bande vide)'
);
console.log('OK - spécifications validées (docs/SPEC.md)');
