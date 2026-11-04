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
    cast = [],
    body = new Set();
  const on = (type, f) => (handlers[type] = handlers[type] || []).push(f);
  const S = sandbox({
    window: { addEventListener: on },
    document: {
      getElementById: $el,
      body: { classList: { add: c => body.add(c), remove: c => body.delete(c), contains: c => body.has(c) } },
      addEventListener() {}
    },
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
    CLASS: { warden: { name: 'Druid', skills: [] }, sentinel: { name: 'Warrior', skills: [] } },
    updateUI() {},
    renderSkillBar() {},
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
  S.fn('src/ui/skillbar.js', 'shownUnit');
  for (const f of [
    'openSettings',
    'closeSettings',
    'toggleSettings',
    'bindClass',
    'renderBindGrid',
    'assignCapturedBind',
    'refreshKeyLabels',
    'resetBindings'
  ])
    S.fn('src/ui/settings.js', f);
  S.load('src/input/controls.js');
  // touche pressée : { code, shiftKey, ctrlKey, altKey } ; renvoie l'événement (defaultPrevented lisible)
  const press = (code, mods = {}) => {
    const e = { code, ...mods, defaultPrevented: false, preventDefault: () => (e.defaultPrevented = true) };
    for (const f of handlers.keydown) f(e);
    return e;
  };
  // partie lancée avec cette classe (lobby fermé)
  const inGame = (cls = 'warden') => {
    S.ctx.state = { keys: {}, player: { cls, alive: true, grounded: true, stun: 0, fear: 0, poly: 0, vy: 0 } };
    $el('overlay').style.display = 'none';
    body.delete('lobby');
  };
  // lobby, classe choisie (barre de sorts affichée)
  const inLobby = cls => {
    S.ctx.LOBBY_UNIT = cls ? { cls } : null;
    body.add('lobby');
  };
  // saisie dans Settings : on tient le modificateur puis on appuie sur la touche
  const bind = (type, i, code, mods = {}) => {
    S.ctx.captureBind = { type, i };
    if (mods.shiftKey || mods.ctrlKey || mods.altKey)
      press(mods.shiftKey ? 'ShiftLeft' : mods.ctrlKey ? 'ControlLeft' : 'AltLeft', mods);
    press(code, mods);
  };
  return { ...S, $el, press, inGame, inLobby, bind, cast, storage };
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
  const w = keyboardWorld(),
    { ctx, press, inGame, cast } = w;
  w.inGame();
  const bind = (i, code, mods) => (w.bind('skill', i, code, mods), ctx.keybindsFor('warden').skills[i]);
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
  assert.equal(ctx.keybindsFor('warden').skills[4], 'KeyQ', 'Espace seul reste le saut');
  for (const [code, mods] of [
    ['Escape', { shiftKey: true }],
    ['KeyW', { ctrlKey: true }],
    ['KeyT', { ctrlKey: true, shiftKey: true }]
  ]) {
    ctx.captureBind = { type: 'skill', i: 4 };
    press(code, mods);
    assert.equal(ctx.keybindsFor('warden').skills[4], 'KeyQ', `${code} refusé`);
  }
  ctx.captureBind = null;
  // en jeu : la combinaison lance son sort (sans sauter, sans bouger, sans raccourci du navigateur)
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

// ---------- Raccourcis propres à chaque classe ----------
{
  // anciens réglages (une seule configuration) : valeur de départ de chaque classe
  const old = {
    keybinds: { skills: ['KeyF', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyE', 'Digit5'], trinket: 'KeyG' }
  };
  const w = keyboardWorld(old),
    { ctx, press, cast } = w,
    kb = cls => ctx.keybindsFor(cls);
  assert.equal(kb('warden').skills[0], 'KeyF', 'druide : anciens réglages repris');
  assert.equal(kb('sentinel').trinket, 'KeyG', 'guerrier : anciens réglages repris');
  // Settings en jeu (druide) : seule la configuration du druide change
  w.inGame('warden');
  w.bind('skill', 0, 'KeyT');
  assert.equal(kb('warden').skills[0], 'KeyT', 'druide : nouvelle touche');
  assert.equal(kb('sentinel').skills[0], 'KeyF', 'guerrier : inchangé');
  assert.equal(w.$el('bindTitle').textContent, 'Keybinds · Druid', 'Settings : classe réglée affichée');
  // jamais deux actions sur la même touche, dans une même classe
  w.bind('skill', 1, 'KeyT');
  assert.equal(kb('warden').skills.slice(0, 2).join(), ',KeyT', 'druide : touche reprise, ancienne action Unset');
  // au lobby : la classe choisie
  w.inLobby('sentinel');
  w.bind('trinket', 0, 'KeyV');
  assert.equal(kb('sentinel').trinket, 'KeyV', 'lobby : réglage de la classe choisie');
  assert.equal(kb('warden').trinket, 'KeyG', 'lobby : les autres classes ne changent pas');
  // en jeu, chaque classe ses touches
  w.inGame('sentinel');
  press('KeyV');
  press('KeyF');
  assert.deepEqual(cast, ['trinket', 0], 'guerrier : ses touches');
  w.inGame('warden');
  cast.length = 0;
  press('KeyT');
  press('KeyV');
  assert.deepEqual(cast, [1], 'druide : ses touches (V ne lance rien)');
  // déplacements aussi propres à la classe
  w.bind('move', 'forward', 'KeyI');
  press('KeyI');
  assert.equal(ctx.state.keys.w, true, 'druide : avance avec I');
  w.inGame('sentinel');
  press('KeyI');
  assert.ok(!ctx.state.keys.w, 'guerrier : I ne fait pas avancer');
  // enregistré dans le navigateur, relu au prochain lancement
  const again = keyboardWorld(JSON.parse(w.storage.arenaAscendantPrefs_v1));
  assert.equal(again.ctx.keybindsFor('warden').skills[1], 'KeyT', 'druide relu');
  assert.equal(again.ctx.keybindsFor('sentinel').trinket, 'KeyV', 'guerrier relu');
  assert.equal(again.ctx.keybindsFor('arcanist').skills[0], 'KeyF', 'classe jamais réglée : anciens réglages');
  // « Default keys » : la classe réglée seulement
  w.inGame('warden');
  ctx.resetBindings();
  assert.equal(kb('warden').skills[0], 'Digit1', 'druide : touches par défaut');
  assert.equal(kb('sentinel').trinket, 'KeyV', 'guerrier : gardé');
}

// ---------- Anciens réglages : jamais deux sorts sur la même touche (bug : druide, 2 sorts sur 5) ----------
for (const stored of [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyE'],
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'Digit5'],
  ['Digit1', 'Digit1', 'KeyW', 'Digit4', 'KeyQ', 'KeyE'],
  ['', 'Digit2', 'Digit1', 'Digit4', 'KeyQ', 'KeyE', 'Digit5']
]) {
  const { ctx } = keyboardWorld({ keybinds: { skills: stored }, classKeybinds: { warden: { skills: stored } } });
  for (const kb of [ctx.keybindsFor(null), ctx.keybindsFor('warden')]) {
    const all = [...kb.skills, kb.trinket, ...Object.values(kb.move)].filter(Boolean);
    if (stored[0] === '') assert.equal(kb.skills[0], '', 'case Unset gardée');
    assert.equal(kb.skills.length, 7, '7 cases');
    assert.equal(new Set(all).size, all.length, 'touches uniques : ' + kb.skills.join(','));
  }
}

console.log('OK - clavier (tests unitaires : Échap / Settings, Shift + Espace, Ctrl + touche, raccourcis par classe)');
