'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
// Fins de ligne normalisées : sous Windows, git (autocrlf) peut réécrire les fichiers en CRLF.
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const html=read('index.html');
const logic=read('game_logic.js').trim();

assert.doesNotMatch(html,/script src="game_logic\.js"/, 'index.html doit rester autonome');
assert.match(html,/script id="game-logic-inline"/, 'GameLogic inline manquant');
assert.ok(html.includes(logic),'la copie inline GameLogic doit correspondre au fichier testé');
assert.match(html,/GameLogic\.moveVector\(state\.keys,camera\.yaw\)/, 'playerMove doit utiliser GameLogic.moveVector');
assert.match(html,/GameLogic\.applyLook\(camera\.yaw,camera\.pitch,dx,dy\)/, 'caméra desktop doit utiliser GameLogic.applyLook');
assert.match(html,/GameLogic\.selfCheck\(\)/, 'le jeu doit exécuter le self-check au démarrage');
assert.doesNotMatch(html,/r=\(\(state\.keys\.d[^\n]*-\(\(state\.keys\.q/, 'ancienne formule D-Q interdite');
assert.doesNotMatch(html,/camera\.yaw\s*\+=\s*dx/, 'ancienne rotation horizontale inversée interdite');
console.log('OK - intégration HTML autonome verrouillée sur GameLogic');
