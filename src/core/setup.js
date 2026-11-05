'use strict';
// Raccourcis DOM, aides de calcul communes, détection mobile, préférences (volume, raccourcis), contexte WebGL du jeu.
const $ = id => document.getElementById(id),
  canvas = $('c');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  now = () => performance.now() / 1000,
  lerp = (a, b, t) => a + (b - a) * t,
  css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
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
// Interface verrouillée comme dans un jeu (05/11/2026) : on ne fait plus glisser une image ou une icône (souris, doigt),
// ni sélection de texte, ni menu du navigateur (clic droit, appui long) ; les champs de saisie restent utilisables.
const editableTarget = t => !!t?.closest?.('input, textarea, select, [contenteditable="true"]');
for (const type of ['dragstart', 'selectstart', 'contextmenu'])
  document.addEventListener(type, e => {
    if (!editableTarget(e.target)) e.preventDefault();
  });
const PREF_KEY = 'arenaAscendantPrefs_v1';
const DEFAULT_PREFS = {
  musicOn: true,
  volume: 0.65,
  // après un glisser au clic gauche (caméra seule), la caméra revient derrière le personnage
  cameraReturn: true,
  // Codes physiques (identiques en AZERTY et QWERTY) : KeyQ = touche A en AZERTY / Q en QWERTY, KeyE = E ;
  // déplacements KeyW/KeyA/KeyS/KeyD = ZQSD en AZERTY, WASD en QWERTY. 7 emplacements (le druide a 7 sorts).
  keybinds: {
    skills: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyE', 'Digit5'],
    trinket: 'KeyR',
    // tourner à gauche / à droite au clavier : non réglé par défaut (« Unset »)
    move: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', turnLeft: '', turnRight: '' }
  },
  // raccourcis propres à chaque classe (classe → même forme que keybinds), créés à la première modification ;
  // une classe jamais réglée suit `keybinds` (réglages d'avant le 04/11/2026 = valeur de départ de chaque classe)
  classKeybinds: {},
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
    d.keybinds = normalizeKeybinds(v.keybinds);
    if (v.classKeybinds && typeof v.classKeybinds === 'object')
      for (const cls of Object.keys(v.classKeybinds))
        if (/^[a-z]+$/.test(cls)) d.classKeybinds[cls] = normalizeKeybinds(v.classKeybinds[cls]);
    if (v.ui && typeof v.ui === 'object') d.ui = v.ui;
    if (typeof v.musicOn === 'boolean') d.musicOn = v.musicOn;
    if (typeof v.cameraReturn === 'boolean') d.cameraReturn = v.cameraReturn;
  } catch (_) {}
  return d;
}
// Raccourcis enregistrés (une classe ou les réglages communs) remis d'aplomb : touches manquantes complétées.
function normalizeKeybinds(raw) {
  const d = cloneDefaults().keybinds;
  // anciens réglages par défaut (1–6) : remplacés par les nouveaux ; réglages personnalisés gardés et complétés
  const old = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
  const sk = raw?.skills,
    custom = Array.isArray(sk) && sk.length >= 5 && !old.every((c, i) => sk[i] === c || (i === 5 && sk.length === 5));
  if (raw?.move && typeof raw.move === 'object')
    for (const k of Object.keys(d.move)) if (typeof raw.move[k] === 'string') d.move[k] = raw.move[k];
  if (typeof raw?.trinket === 'string') d.trinket = raw.trinket;
  // une touche ne commande jamais deux choses : une case sans touche valide (ou en double) prend sa touche par
  // défaut si elle est libre, sinon la première libre (bug : la 7e case du druide héritait du « 5 » déjà pris) ;
  // une case laissée « Unset » (touche reprise par une autre action dans Settings) le reste
  const used = new Set([...Object.values(d.move), d.trinket].filter(Boolean)),
    spare = ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyF', 'KeyG', 'KeyT', 'KeyV', 'KeyC', 'KeyX'];
  d.skills = d.skills.map((def, i) => {
    if (custom && sk[i] === '') return '';
    const c = [custom && sk[i], def, ...spare].find(k => typeof k === 'string' && k && !used.has(k));
    used.add(c);
    return c;
  });
  return d;
}
let PREFS = loadPrefs();
// Raccourcis d'une classe (lecture) : les siens s'ils ont été réglés, sinon les réglages communs.
function keybindsFor(cls) {
  return (cls && PREFS.classKeybinds[cls]) || PREFS.keybinds;
}
// Raccourcis d'une classe à modifier : créés à partir des réglages communs à la première modification (sans classe
// choisie, on modifie les réglages communs, suivis par toutes les classes jamais réglées).
function editableKeybinds(cls) {
  if (!cls) return PREFS.keybinds;
  return (PREFS.classKeybinds[cls] ||= JSON.parse(JSON.stringify(PREFS.keybinds)));
}
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
  if (short && code === 'Space') return 'Spc'; // case de sort étroite (« ⇧Spc »)
  const lay = KEY_LAYOUT?.get?.(code);
  if (lay && /^Key[A-Z]$/.test(code)) return lay.toUpperCase(); // chiffres : toujours 1, 2, 3…
  const m = {
    Space: 'Space',
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
// touches non attribuables seules (Espace = saut, TAB = cible, flèches = déplacement ; les déplacements réglables sont
// vérifiés à part) ; avec Shift / Ctrl / Alt elles deviennent libres (Shift + Espace…), sauf Échap (Settings)
const RESERVED_BIND_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Escape']);
// combinaisons gardées par le navigateur ou le système (fermer / ouvrir un onglet ou une fenêtre, changer d'onglet) :
// la page ne les reçoit jamais, le sort ne partirait pas
const BROWSER_BIND_CODES = new Set(
  ['Ctrl+KeyW', 'Ctrl+KeyT', 'Ctrl+KeyN', 'Ctrl+Tab', 'Ctrl+F4', 'Alt+Tab', 'Alt+F4'].flatMap(c => [
    c,
    c.replace(/^(Ctrl|Alt)\+/, '$1+Shift+')
  ])
);
// raison du refus d'un raccourci de sort ou de trinket ('' = accepté)
function bindRefusal(code) {
  const key = code.split('+').pop();
  if (key === 'Escape' || (code === key && RESERVED_BIND_CODES.has(key))) return 'is reserved for movement/gameplay';
  if (BROWSER_BIND_CODES.has(code)) return 'is used by the browser';
  return '';
}
const gl =
  canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) ||
  canvas.getContext('experimental-webgl');
