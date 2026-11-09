'use strict';
// Tests unitaires du clavier : préférences et raccourcis (src/core/setup.js), touches en jeu (src/input/controls.js),
// fenêtre Settings (src/ui/settings.js). Le vrai code est chargé dans un contexte vm avec un faux DOM minimal ;
// on vérifie le résultat (sort lancé, fenêtre ouverte, touche enregistrée), pas le texte du code.
const assert = require('node:assert/strict');
const { sandbox } = require('./sources.js');

// faux élément DOM : juste ce que lisent ces fichiers
function fakeEl() {
  const cls = new Set(),
    on = {};
  return {
    on, // écouteurs posés sur l'élément (le canevas : souris)
    style: {},
    textContent: '',
    innerHTML: '',
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
    addEventListener: (type, f) => (on[type] = on[type] || []).push(f),
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
    docHandlers = {},
    storage = stored ? { arenaAscendantPrefs_v1: JSON.stringify(stored) } : {},
    cast = [],
    body = new Set();
  const on = (type, f) => (handlers[type] = handlers[type] || []).push(f);
  const S = sandbox({
    window: { addEventListener: on },
    document: {
      getElementById: $el,
      body: { classList: { add: c => body.add(c), remove: c => body.delete(c), contains: c => body.has(c) } },
      addEventListener: (type, f) => (docHandlers[type] = docHandlers[type] || []).push(f)
    },
    location: { search: '' },
    GameLogic: require('../game_logic.js'),
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
    CLASS: {
      warden: { name: 'Druid', skills: [] },
      sentinel: { name: 'Warrior', skills: [] },
      arcanist: {
        name: 'Mage',
        skills: ['Frost Bolt', 'Frost Nova', 'Counterspell', 'Arcane Barrier', 'Blink', 'Polymorph'].map(n => ({ n }))
      }
    },
    updateUI() {},
    endCast: (u, why) => (u.cast = null), // fin d'incantation (src/game/combat.js : saut = annulation)
    renderSkillBar() {},
    setMusicVolume() {},
    applyFramePositions() {},
    setUiEditMode() {},
    slotOrder: () => [0, 1, 2, 3, 4, 5, 6],
    tryPlayerSkill: i => cast.push(i),
    useTrinket: () => cast.push('trinket'),
    tabTargets: () => [], // cibles de TAB (src/game/rules.js)
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
  S.fn('src/game/player.js', 'keepsHeading');
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
  return { ...S, $el, press, inGame, inLobby, bind, cast, storage, docHandlers, handlers };
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
  // Settings : une ligne par sort de la classe (mage : 6 sorts, pas de « 7. Spell 7 » ; sans classe : 7 emplacements)
  w.inLobby('arcanist');
  w.ctx.renderBindGrid();
  const grid = () => w.$el('bindGrid').innerHTML;
  assert.ok(grid().includes('6. Polymorph') && !grid().includes('7. '), 'mage : 6 lignes de sorts');
  const played = w.ctx.state;
  w.ctx.state = null; // ni partie ni classe choisie : réglages communs
  w.inLobby(null);
  w.ctx.renderBindGrid();
  assert.ok(grid().includes('7. Spell 7'), 'réglages communs : 7 emplacements');
  w.ctx.state = played;
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

// ---------- Ordre des sorts (Shift + glisser) : aussi au lobby, gardé par classe ----------
{
  const w = keyboardWorld(),
    { ctx } = w,
    drawn = [];
  ctx.skillsOf = p => ctx.CLASS[p.cls].skills;
  ctx.barKey = () => '';
  ctx.renderSkillBar = u => drawn.push(u);
  w.fn('src/ui/skillbar.js', 'slotOrder');
  w.fn('src/ui/skillbar.js', 'swapSlots');
  w.inLobby('arcanist');
  ctx.swapSlots(0, 4); // Frost Bolt <-> Blink sur la barre du lobby
  assert.deepEqual(ctx.slotOrder({ cls: 'arcanist' }), [4, 1, 2, 3, 0, 5], 'lobby : ordre du mage changé');
  assert.equal(drawn.at(-1), ctx.LOBBY_UNIT, 'lobby : barre redessinée');
  assert.equal(ctx.PREFS.ui?.order?.['warden:'], undefined, 'les autres classes ne changent pas');
  const again = keyboardWorld(JSON.parse(w.storage.arenaAscendantPrefs_v1));
  assert.equal(again.ctx.PREFS.ui.order['arcanist:'].join(), '4,1,2,3,0,5', 'ordre relu au prochain lancement');
}

// ---------- Clic droit, caméra laissée de côté (« Camera returns behind you » désactivé, 05/11/2026) ----------
// le personnage garde sa trajectoire : seul un vrai glisser au clic droit le réaligne sur la caméra, pas l'appui
{
  const w = keyboardWorld(),
    { ctx } = w;
  w.inGame();
  Object.assign(ctx.state.player, { yaw: 1 });
  ctx.camera.yaw = 2;
  ctx.orbitBase = 1; // après un glisser au clic gauche
  const mouse = (target, type, e) => {
    const ev = { button: 0, clientX: 0, clientY: 0, movementX: 0, movementY: 0, preventDefault() {}, ...e };
    for (const f of target[type] || []) f(ev);
  };
  const canvas = w.$el('c').on,
    win = w.handlers;
  for (const ret of [false, true]) {
    ctx.PREFS.cameraReturn = ret;
    ctx.state.player.yaw = 1;
    mouse(canvas, 'mousedown', { button: 0 }); // gauche puis droit = avancer
    mouse(canvas, 'mousedown', { button: 2 });
    if (!ret) {
      assert.ok(!ctx.looking && ctx.state.player.yaw === 1, 'gauche + droit : le personnage garde sa trajectoire');
      mouse(w.docHandlers, 'mousemove', { movementX: 3 });
      assert.ok(!ctx.looking, 'petit tremblement de souris : toujours pas réaligné');
      mouse(w.docHandlers, 'mousemove', { movementX: 6 });
      assert.ok(ctx.looking && ctx.state.player.yaw === ctx.camera.yaw, 'vrai glisser au clic droit : réaligné');
    } else assert.ok(ctx.looking && ctx.state.player.yaw === 2, 'retour activé : clic droit = caméra + personnage');
    mouse(win, 'mouseup', { button: 2 });
    mouse(win, 'mouseup', { button: 0 });
    assert.ok(!ctx.looking, 'clic droit relâché');
    ctx.orbitBase = 1;
    ctx.camera.yaw = 2;
  }
}

// ---------- Interface verrouillée comme dans un jeu (05/11/2026) : pas de glisser d'image, de sélection, de menu ----------
{
  const w = keyboardWorld();
  // cible : image / icône du lobby, ou champ de saisie (closest trouve le champ)
  const target = editable => ({ closest: sel => (editable && /input/.test(sel) ? {} : null) });
  for (const type of ['dragstart', 'selectstart', 'contextmenu']) {
    const fire = editable => {
      const e = {
        target: target(editable),
        defaultPrevented: false,
        preventDefault: () => (e.defaultPrevented = true)
      };
      for (const f of w.docHandlers[type] || []) f(e);
      return e.defaultPrevented;
    };
    assert.ok(fire(false), `${type} bloqué sur une image / un bouton`);
    assert.ok(!fire(true), `${type} permis dans un champ de saisie`);
  }
}

console.log('OK - clavier (tests unitaires : Échap / Settings, Shift + Espace, Ctrl + touche, raccourcis par classe)');
