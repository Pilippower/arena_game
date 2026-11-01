'use strict';
const assert = require('node:assert/strict');
const { read, scripts, flat } = require('./sources.js');
const html = read('index.html'),
  code = flat(),
  files = scripts();

// game_logic.js est la seule source de la logique validée (mouvement / caméra) : chargé avant le jeu, aucune copie.
assert.ok(files.includes('game_logic.js'), 'index.html doit charger game_logic.js');
assert.ok(
  files.indexOf('game_logic.js') < files.findIndex(f => f.startsWith('src/')),
  'game_logic.js doit être chargé avant le jeu'
);
assert.doesNotMatch(html, /game-logic-inline/, 'plus de copie inline de GameLogic');
assert.match(code, /GameLogic\.moveVector\(state\.keys,camera\.yaw\)/, 'playerMove doit utiliser GameLogic.moveVector');
assert.match(
  code,
  /GameLogic\.applyLook\(camera\.yaw,camera\.pitch,dx,dy\)/,
  'caméra desktop doit utiliser GameLogic.applyLook'
);
assert.match(code, /GameLogic\.selfCheck\(\)/, 'le jeu doit exécuter le self-check au démarrage');
assert.doesNotMatch(code, /r=\(\(state\.keys\.d[^\n]*-\(\(state\.keys\.q/, 'ancienne formule D-Q interdite');
assert.doesNotMatch(code, /camera\.yaw\s*\+=\s*dx/, 'ancienne rotation horizontale inversée interdite');
// chaque script local référencé existe et se parse
for (const f of files) {
  assert.doesNotThrow(() => new Function(read(f)), `${f} : erreur de syntaxe`);
}
console.log(`OK - ${files.length} scripts locaux, logique validée unique (game_logic.js)`);
// Le jeu est en anglais : aucun texte affiché ne doit contenir de mots français courants.
{
  const { scripts, read } = require('./sources.js');
  const FR = /\b(Bouclier|Étourdi|Immobilisé|Ralenti|Vous|Jouer|Classe|Difficulté|Chargement|Musique|Raccourci|Fermer|Aucune cible|Ligne de vue)\b/;
  for (const f of ['index.html', ...scripts().filter(s => s.startsWith('src/'))])
    read(f)
      .split('\n')
      .forEach((l, i) => {
        if (/^\s*\/\//.test(l) || /console\.(warn|log|error)/.test(l)) return;
        for (const m of l.matchAll(/(['"`])((?:(?!\1).){2,})\1/g))
          assert.doesNotMatch(m[2], FR, `${f}:${i + 1} texte français : ${m[2].slice(0, 60)}`);
      });
}
