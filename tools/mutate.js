'use strict';
// Régression volontaire : remplace un extrait de code, lance un test, vérifie qu'il ÉCHOUE, puis restaure le fichier
// (toujours, même en cas d'erreur). Sert à prouver qu'un nouveau test protège bien sa règle.
// Usage : node tools/mutate.js <test> <fichier> <extrait> <remplacement>
//   ex. node tools/mutate.js tests/combat.test.js src/game/combat.js "const DR_RESET = 20;" "const DR_RESET = 10;"
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const [test, file, search, replace] = process.argv.slice(2);
if (!test || !file || search === undefined || replace === undefined) {
  console.error('Usage : node tools/mutate.js <test> <fichier> <extrait> <remplacement>');
  process.exit(2);
}
const root = path.join(__dirname, '..');
const target = path.join(root, file);
const original = fs.readFileSync(target, 'utf8');
const count = original.split(search).length - 1;
if (count !== 1) {
  console.error(`Extrait trouvé ${count} fois dans ${file} (il faut exactement 1).`);
  process.exit(2);
}
let result;
try {
  fs.writeFileSync(
    target,
    original.replace(search, () => replace)
  );
  result = spawnSync(process.execPath, [path.join(root, test)], { encoding: 'utf8' });
} finally {
  fs.writeFileSync(target, original);
}
const message =
  (result.stderr.match(/\[ERR_ASSERTION\]: ([^\n]*)/) ||
    result.stderr.match(/message: '([^']*)'/) ||
    result.stderr.match(/(\w*Error[^\n]*)/) ||
    [])[1] || '';
if (result.status !== 0) {
  console.log(`OK - régression attrapée par ${test} : ${message}`);
} else {
  console.log(`ÉCHEC - ${test} passe encore avec la régression : le test ne protège pas cette règle.`);
  process.exit(1);
}
