'use strict';
const assert=require('node:assert/strict');
const {read,scripts,all}=require('./sources.js');
const html=read('index.html'),code=all(),files=scripts();

// game_logic.js est la seule source de la logique validée (mouvement / caméra) : chargé avant le jeu, aucune copie.
assert.ok(files.includes('game_logic.js'),'index.html doit charger game_logic.js');
assert.ok(files.indexOf('game_logic.js')<files.findIndex(f=>f.startsWith('src/')),'game_logic.js doit être chargé avant le jeu');
assert.doesNotMatch(html,/game-logic-inline/,'plus de copie inline de GameLogic');
assert.match(code,/GameLogic\.moveVector\(state\.keys,camera\.yaw\)/,'playerMove doit utiliser GameLogic.moveVector');
assert.match(code,/GameLogic\.applyLook\(camera\.yaw,camera\.pitch,dx,dy\)/,'caméra desktop doit utiliser GameLogic.applyLook');
assert.match(code,/GameLogic\.selfCheck\(\)/,'le jeu doit exécuter le self-check au démarrage');
assert.doesNotMatch(code,/r=\(\(state\.keys\.d[^\n]*-\(\(state\.keys\.q/,'ancienne formule D-Q interdite');
assert.doesNotMatch(code,/camera\.yaw\s*\+=\s*dx/,'ancienne rotation horizontale inversée interdite');
// chaque script local référencé existe et se parse
for(const f of files){assert.doesNotThrow(()=>new Function(read(f)),`${f} : erreur de syntaxe`)}
console.log(`OK - ${files.length} scripts locaux, logique validée unique (game_logic.js)`);
