'use strict';
// Lance chaque tests/*.test.js dans un process séparé et s'arrête au premier échec.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const files = fs
  .readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .sort();
for (const f of files) {
  process.stdout.write(`> ${f}\n`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`ÉCHEC : ${f}`);
    process.exit(r.status || 1);
  }
}
console.log(`\n${files.length} fichiers de test OK`);
