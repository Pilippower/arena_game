'use strict';
// npm test        : tests rapides (code + partie lancée dans le navigateur, ~15 s)
// npm run test:all : + test navigateur complet (35 personnages, 7 classes, mobile ; plusieurs minutes) — avant de publier
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const full = process.argv.includes('--all');
const list = dir =>
  fs
    .readdirSync(path.join(__dirname, dir))
    .filter(f => f.endsWith('.test.js'))
    .sort()
    .map(f => path.join(dir, f));
const files = [...list('.'), ...list('browser').filter(f => full || !f.endsWith('full.test.js'))];
const t0 = Date.now();
for (const f of files) {
  process.stdout.write(`> ${f}\n`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`ÉCHEC : ${f}`);
    process.exit(r.status || 1);
  }
}
console.log(`\n${files.length} fichiers de test OK (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
