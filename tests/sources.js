'use strict';
// Code source du jeu tel que chargé par index.html (HTML + scripts locaux, dans l'ordre), pour les tests statiques.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
function scripts() {
  const html = read('index.html');
  return [...html.matchAll(/<script src="([^"?:]+)(?:\?[^"]*)?"/g)].map(m => m[1]).filter(f => !/^https?:/.test(f));
}
function all() {
  return [read('index.html'), ...scripts().map(read)].join('\n');
}
// Code sans espaces : les tests ne dépendent pas de la mise en forme (Prettier).
function flat() {
  return all().replace(/\s+/g, '');
}
module.exports = { read, scripts, all, flat, ROOT };
