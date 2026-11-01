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
// Formes / camouflage
assert.equal(ctx.FORM_INFO.cat.speed, 1.3, 'félin +30 % de vitesse');
assert.equal(ctx.FORM_INFO.bear.hp, 1.4, 'ours +40 % PV');
assert.equal(ctx.FORM_INFO.bear.armor, 0.7, 'ours -30 % dégâts subis');
assert.match(read('src/game/combat.js'), /u\.stealth \? 0\.7 : 1/, 'camouflé -30 % de vitesse');
// Armures
assert.equal(C.sentinel.armor, 'plate');
assert.equal(C.shade.armor, 'leather');
assert.equal(C.arcanist.armor, 'cloth');
assert.ok(ctx.ARMOR.plate.physical > ctx.ARMOR.leather.physical && ctx.ARMOR.leather.physical > ctx.ARMOR.cloth.physical);
// Voleur : 2× plus rapide, même DPS que le guerrier (rapport dégâts / intervalle)
const sw = read('src/game/rules.js').match(/const SWING = \{[^}]*\}/)[0];
const SW = vm.runInNewContext('(' + sw.replace('const SWING = ', '') + ')');
assert.ok(Math.abs(SW.shade[1] / SW.shade[0] - SW.sentinel[1] / SW.sentinel[0]) < 1.5, 'voleur : même DPS que le guerrier');
assert.ok(SW.shade[0] <= SW.sentinel[0] / 2 + 0.01, 'voleur : frappe 2× plus vite');
// Contrôles : glisser au clic gauche = caméra seule (la trajectoire ne suit pas la caméra)
const ctl = read('src/input/controls.js');
assert.match(ctl, /if \(looking && state\?\.player\?\.alive\) state\.player\.yaw = camera\.yaw/, 'seul le clic droit oriente le personnage');
assert.match(read('src/game/ai.js'), /orbiting/, 'déplacement : base de trajectoire figée pendant le glisser au clic gauche');
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
console.log('OK - spécifications validées (docs/SPEC.md)');
