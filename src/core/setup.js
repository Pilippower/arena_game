'use strict';
// Raccourcis DOM, détection mobile, préférences (volume, raccourcis), contexte WebGL du jeu.
const $ = id => document.getElementById(id),
  canvas = $('c');
const MOBILE = {
  enabled: false,
  moveForward: 0,
  moveRight: 0,
  joyPointer: null,
  lookPointer: null,
  lookX: 0,
  lookY: 0
};
function detectMobileMode() {
  const forced = window.__FORCE_MOBILE__ === true || new URLSearchParams(location.search).get('mobile') === '1';
  return forced || matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
}
MOBILE.enabled = detectMobileMode();
if (MOBILE.enabled) document.body.classList.add('mobile-mode');
const PREF_KEY = 'arenaAscendantPrefs_v1';
const DEFAULT_PREFS = {
  musicOn: true,
  volume: 0.65,
  // Codes physiques (identiques en AZERTY et QWERTY) : KeyQ = touche A en AZERTY / Q en QWERTY, KeyE = E ;
  // déplacements KeyW/KeyA/KeyS/KeyD = ZQSD en AZERTY, WASD en QWERTY. 7 emplacements (le druide a 7 sorts).
  keybinds: {
    skills: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyE', 'Digit5'],
    trinket: 'KeyR',
    // tourner à gauche / à droite au clavier : non réglé par défaut (« Unset »)
    move: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', turnLeft: '', turnRight: '' }
  },
  ui: {}
};
function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PREFS));
}
function loadPrefs() {
  const d = cloneDefaults();
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return d;
    const v = JSON.parse(raw);
    if (Number.isFinite(v.volume)) d.volume = clamp(v.volume, 0, 2.0);
    // anciens réglages par défaut (1–6) : remplacés par les nouveaux ; réglages personnalisés gardés et complétés
    const old = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    const sk = v.keybinds?.skills,
      custom = Array.isArray(sk) && sk.length >= 5 && !old.every((c, i) => sk[i] === c || (i === 5 && sk.length === 5));
    if (v.keybinds?.move && typeof v.keybinds.move === 'object')
      for (const k of Object.keys(d.keybinds.move))
        if (typeof v.keybinds.move[k] === 'string') d.keybinds.move[k] = v.keybinds.move[k];
    if (typeof v.keybinds?.trinket === 'string') d.keybinds.trinket = v.keybinds.trinket;
    // une touche ne commande jamais deux choses : une case sans touche valide (ou en double) prend sa touche par
    // défaut si elle est libre, sinon la première libre (bug : la 7e case du druide héritait du « 5 » déjà pris) ;
    // une case laissée « Unset » (touche reprise par une autre action dans Settings) le reste
    const used = new Set([...Object.values(d.keybinds.move), d.keybinds.trinket].filter(Boolean)),
      spare = ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyF', 'KeyG', 'KeyT', 'KeyV', 'KeyC', 'KeyX'];
    d.keybinds.skills = d.keybinds.skills.map((def, i) => {
      if (custom && sk[i] === '') return '';
      const c = [custom && sk[i], def, ...spare].find(k => typeof k === 'string' && k && !used.has(k));
      used.add(c);
      return c;
    });
    if (v.ui && typeof v.ui === 'object') d.ui = v.ui;
    if (typeof v.musicOn === 'boolean') d.musicOn = v.musicOn;
  } catch (_) {}
  return d;
}
let PREFS = null;
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(PREFS));
  } catch (_) {}
}
// Libellé réel de la touche selon la disposition du clavier (AZERTY : KeyQ → « A ») quand le navigateur le permet.
let KEY_LAYOUT = null;
try {
  navigator.keyboard?.getLayoutMap?.().then(m => {
    KEY_LAYOUT = m;
    if (typeof updateUI === 'function' && state) updateUI();
  });
} catch (_) {}
// Raccourcis combinés (sorts et trinket) : « Shift+KeyE », « Ctrl+Digit1 », « Alt+KeyQ »… (modificateurs dans cet ordre).
const BIND_MODS = [
  ['ctrlKey', 'Ctrl'],
  ['altKey', 'Alt'],
  ['shiftKey', 'Shift']
];
const isModifierCode = code => /^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code || '');
// combinaison pressée (touche + modificateurs tenus) ; '' pour un modificateur seul
function bindCombo(e) {
  if (!e.code || isModifierCode(e.code)) return '';
  return (
    BIND_MODS.filter(([k]) => e[k])
      .map(([, n]) => n + '+')
      .join('') + e.code
  );
}
// emplacement réglé pour cette touche : la combinaison exacte d'abord, sinon la touche seule (comme avant)
function bindIndex(list, e) {
  const combo = bindCombo(e);
  if (!combo) return -1;
  const i = list.indexOf(combo);
  return i >= 0 ? i : e.ctrlKey || e.altKey || e.shiftKey ? list.indexOf(e.code) : -1;
}
// libellé : « Shift + E » (short : « ⇧E » sur la barre de sorts)
function keyLabel(code, short = false) {
  if (code && code.includes('+')) {
    const parts = code.split('+'),
      key = keyLabel(parts.pop(), short);
    if (short) return parts.map(m => ({ Shift: '⇧', Ctrl: '^', Alt: 'Alt' })[m] || m).join('') + key;
    return [...parts, key].join(' + ');
  }
  const lay = KEY_LAYOUT?.get?.(code);
  if (lay && /^Key[A-Z]$/.test(code)) return lay.toUpperCase(); // chiffres : toujours 1, 2, 3…
  const m = {
    Space: 'Espace',
    Tab: 'TAB',
    Escape: 'Esc',
    ShiftLeft: 'Shift G',
    ShiftRight: 'Shift D',
    ControlLeft: 'Ctrl G',
    ControlRight: 'Ctrl D',
    AltLeft: 'Alt G',
    AltRight: 'Alt D',
    Backquote: '²',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Comma: ',',
    Period: '.',
    Slash: '/'
  };
  if (m[code]) return m[code];
  if (/^Digit\d$/.test(code)) return code.slice(-1);
  if (/^Key[A-Z]$/.test(code)) return code.slice(-1);
  if (/^F\d+$/.test(code)) return code;
  return code.replace(/^Numpad/, 'Num ');
}
// touches non attribuables (les déplacements sont vérifiés à part : ils sont eux aussi réglables)
const RESERVED_BIND_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Escape']);
const gl =
  canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) ||
  canvas.getContext('experimental-webgl');
