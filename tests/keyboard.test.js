'use strict';
// Tests unitaires du clavier : préférences et raccourcis (src/core/setup.js), touches en jeu (src/input/controls.js),
// fenêtre Settings (src/ui/settings.js). Le vrai code est chargé dans un contexte vm avec un faux DOM minimal ;
// on vérifie le résultat (sort lancé, fenêtre ouverte, touche enregistrée), pas le texte du code.
const assert = require('node:assert/strict');
const { sandbox } = require('./sources.js');

// faux élément DOM : juste ce que lisent ces fichiers
function fakeEl() {
  const cls = new Set();
  return {
    style: {},
    textContent: '',
    innerHTML: '',
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
    addEventListener() {},
    querySelectorAll: () => [],
    getContext: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus() {}
  };
}
// monde clavier : setup.js + controls.js entiers, fonctions de la fenêtre Settings ; `stored` = préférences déjà
// enregistrées dans le navigateur (objet, sérialisé dans le faux localStorage)
function keyboardWorld(stored = null) {
  const els = new Map(),
    $el = id => els.get(id) || (els.set(id, fakeEl()), els.get(id)),
    handlers = {},
    storage = stored ? { arenaAscendantPrefs_v1: JSON.stringify(stored) } : {},
    cast = [];
  const on = (type, f) => (handlers[type] = handlers[type] || []).push(f);
  const S = sandbox({
    window: { addEventListener: on },
    document: { getElementById: $el, body: { classList: { add() {} } }, addEventListener() {} },
    location: { search: '' },
    URLSearchParams,
    matchMedia: () => ({ matches: false }),
    navigator: { maxTouchPoints: 0 },
    localStorage: {
      getItem: k => storage[k] ?? null,
      setItem: (k, v) => (storage[k] = v)
    },
    performance: { now: () => 0 },
    state: null,
    camera: { yaw: 0, pitch: 0, dist: 8 },
    looking: false,
    orbitBase: null,
    uiEditMode: false,
    settingsOpen: false,
    captureBind: null,
    LOBBY_UNIT: null,
    CLASS: {},
    updateUI() {},
    setMusicVolume() {},
    applyFramePositions() {},
    setUiEditMode() {},
    slotOrder: () => [0, 1, 2, 3, 4, 5, 6],
    tryPlayerSkill: i => cast.push(i),
    useTrinket: () => cast.push('trinket'),
    enemies: () => [],
    setTarget() {}
  });
  S.load('src/core/setup.js');
  for (const f of ['openSettings', 'closeSettings', 'toggleSettings', 'renderBindGrid', 'assignCapturedBind'])
    S.fn('src/ui/settings.js', f);
  S.load('src/input/controls.js');
  // touche pressée : { code, shiftKey, ctrlKey, altKey } ; renvoie l'événement (defaultPrevented lisible)
  const press = (code, mods = {}) => {
    const e = { code, ...mods, defaultPrevented: false, preventDefault: () => (e.defaultPrevented = true) };
    for (const f of handlers.keydown) f(e);
    return e;
  };
  const inGame = () => {
    S.ctx.state = { keys: {}, player: { alive: true, grounded: true, stun: 0, fear: 0, poly: 0, vy: 0 } };
    $el('overlay').style.display = 'none';
  };
  return { ...S, $el, press, inGame, cast, storage };
}

// ---------- Échap ouvre / ferme Settings ----------
{
  const { ctx, $el, press } = keyboardWorld();
  const open = () => $el('settingsPanel').classList.contains('open');
  assert.equal(press('Escape').defaultPrevented, true, 'Échap pris par le jeu');
  assert.equal(open(), true, 'Échap ouvre Settings');
  press('Escape');
  assert.equal(open(), false, 'Échap à nouveau ferme Settings');
  // saisie d'un raccourci : Échap annule seulement la saisie, la fenêtre reste ouverte
  press('Escape');
  ctx.captureBind = { type: 'skill', i: 0 };
  press('Escape');
  assert.equal(ctx.captureBind, null, 'saisie annulée');
  assert.equal(open(), true, 'Settings reste ouvert pendant l’annulation de la saisie');
  assert.equal(ctx.PREFS.keybinds.skills[0], 'Digit1', 'raccourci inchangé');
}

// ---------- Raccourcis Shift + Espace et Ctrl + touche ----------
{
  const { ctx, press, inGame, cast } = keyboardWorld();
  // saisie dans Settings : on tient le modificateur puis on appuie sur la touche
  const bind = (i, code, mods) => {
    ctx.captureBind = { type: 'skill', i };
    press(mods.shiftKey ? 'ShiftLeft' : mods.ctrlKey ? 'ControlLeft' : 'AltLeft', mods);
    press(code, mods);
    return ctx.PREFS.keybinds.skills[i];
  };
  assert.equal(bind(0, 'Space', { shiftKey: true }), 'Shift+Space', 'Shift + Espace accepté');
  assert.equal(ctx.keyLabel('Shift+Space'), 'Shift + Space', 'libellé en anglais');
  assert.equal(ctx.keyLabel('Shift+Space', true), '⇧Spc', 'libellé court sur la case de sort');
  assert.equal(
    bind(1, 'KeyS', { ctrlKey: true }),
    'Ctrl+KeyS',
    'Ctrl + touche accepté (même une touche de déplacement)'
  );
  assert.equal(bind(2, 'Digit9', { ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+Digit9', 'Ctrl + Shift + touche');
  assert.equal(bind(3, 'ArrowUp', { ctrlKey: true }), 'Ctrl+ArrowUp', 'flèche avec Ctrl : libre');
  // refusés : Espace seul (saut), Échap (Settings), raccourcis gardés par le navigateur
  ctx.captureBind = { type: 'skill', i: 4 };
  press('Space');
  assert.equal(ctx.PREFS.keybinds.skills[4], 'KeyQ', 'Espace seul reste le saut');
  for (const [code, mods] of [
    ['Escape', { shiftKey: true }],
    ['KeyW', { ctrlKey: true }],
    ['KeyT', { ctrlKey: true, shiftKey: true }]
  ]) {
    ctx.captureBind = { type: 'skill', i: 4 };
    press(code, mods);
    assert.equal(ctx.PREFS.keybinds.skills[4], 'KeyQ', `${code} refusé`);
  }
  ctx.captureBind = null;
  // en jeu : la combinaison lance son sort (sans sauter, sans bouger, sans raccourci du navigateur)
  inGame();
  const p = ctx.state.player;
  assert.equal(press('Space', { shiftKey: true }).defaultPrevented, true, 'Shift + Espace pris par le jeu');
  assert.deepEqual(cast, [0], 'Shift + Espace : sort 1');
  assert.equal(p.vy, 0, 'Shift + Espace : pas de saut');
  const ctrlS = press('KeyS', { ctrlKey: true });
  assert.equal(ctrlS.defaultPrevented, true, 'Ctrl + S : pas d’enregistrement de la page');
  assert.deepEqual(cast, [0, 1], 'Ctrl + S : sort 2');
  assert.ok(!ctx.state.keys.s, 'Ctrl + S : pas de recul');
  press('Space');
  assert.equal(p.vy, 7.5, 'Espace seul : saut');
}

console.log('OK - clavier (tests unitaires : Échap / Settings, Shift + Espace, Ctrl + touche)');
