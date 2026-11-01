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
  keybinds: { skills: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'], trinket: 'KeyR' },
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
    if (v.keybinds?.skills?.length >= 5)
      d.keybinds.skills = v.keybinds.skills.slice(0, 6).concat(v.keybinds.skills.length === 5 ? ['Digit6'] : []);
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
function keyLabel(code) {
  const m = {
    Space: 'Espace',
    Tab: 'TAB',
    Escape: 'Échap',
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
const RESERVED_BIND_CODES = new Set([
  'KeyZ',
  'KeyQ',
  'KeyS',
  'KeyD',
  'KeyW',
  'KeyA',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
  'Escape'
]);
const gl =
  canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) ||
  canvas.getContext('experimental-webgl');
