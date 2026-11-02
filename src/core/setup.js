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
    move: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' }
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
    const sk = v.keybinds?.skills;
    if (Array.isArray(sk) && sk.length >= 5 && !old.every((c, i) => sk[i] === c || (i === 5 && sk.length === 5)))
      d.keybinds.skills = d.keybinds.skills.map((c, i) =>
        typeof sk[i] === 'string' && !sk.slice(0, i).includes(sk[i]) ? sk[i] : c
      );
    if (v.keybinds?.move && typeof v.keybinds.move === 'object')
      for (const k of Object.keys(d.keybinds.move))
        if (typeof v.keybinds.move[k] === 'string') d.keybinds.move[k] = v.keybinds.move[k];
    if (typeof v.keybinds?.trinket === 'string') d.keybinds.trinket = v.keybinds.trinket;
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
function keyLabel(code) {
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
