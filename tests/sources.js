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
// Code d'un dossier (ex. 'src/characters/'), fichiers dans l'ordre de chargement : les tests ne dépendent pas
// du découpage en fichiers.
function code(dir) {
  return scripts()
    .filter(f => f.startsWith(dir))
    .map(read)
    .join('\n');
}
// Code sans espaces : les tests ne dépendent pas de la mise en forme (Prettier).
function flat() {
  return all().replace(/\s+/g, '');
}
// Tests unitaires : contexte vm où l'on charge le vrai code du jeu (scripts navigateur classiques).
// load(f) : fichier entier (const/let deviennent des var, lisibles sur le contexte) ; fn(f, nom) : une seule
// fonction de premier niveau, pour tester une règle sans charger les dépendances du fichier.
function sandbox(globals = {}) {
  const vm = require('node:vm');
  const ctx = vm.createContext({ console, Math, ...globals });
  const exec = (code, filename) => vm.runInContext(code.replace(/^(const|let) /gm, 'var '), ctx, { filename });
  return {
    ctx,
    load: f => exec(read(f), f),
    fn(f, name) {
      const src = read(f).match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`, 'm'));
      if (!src) throw new Error(`${f} : function ${name} introuvable`);
      exec(src[0], f);
    }
  };
}
module.exports = { read, scripts, all, flat, code, sandbox, ROOT };
