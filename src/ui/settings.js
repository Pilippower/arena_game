'use strict';
// Interface : raccourcis, déplacement des cadres, sélection race/classe/difficulté.
// ---------- Persistent UI customization ----------
let settingsOpen = false,
  captureBind = null,
  uiEditMode = false,
  dragFrame = null;
function renderBindGrid() {
  const box = $('bindGrid');
  if (!box) return;
  const cls = state?.player?.cls || LOBBY_UNIT?.cls,
    names = PREFS.keybinds.skills.map((_, i) => (cls && CLASS[cls].skills[i]?.n) || `Spell ${i + 1}`),
    btn = (type, i, code) =>
      `<button class="bindBtn ${captureBind?.type === type && captureBind.i === i ? 'capturing' : ''}${code ? '' : ' unset'}" data-bind="${type}" data-i="${i}">${captureBind?.type === type && captureBind.i === i ? 'Press a key…' : code ? keyLabel(code) : 'Unset'}</button>`;
  const MOVES = [
    ['forward', 'Move forward'],
    ['back', 'Move back'],
    ['left', 'Strafe left'],
    ['right', 'Strafe right']
  ];
  box.innerHTML =
    MOVES.map(([k, n]) => `<span>${n}</span>${btn('move', k, PREFS.keybinds.move[k])}`).join('') +
    names.map((n, i) => `<span>${i + 1}. ${n}</span>${btn('skill', i, PREFS.keybinds.skills[i])}`).join('') +
    `<span>Trinket PvP</span>${btn('trinket', 0, PREFS.keybinds.trinket)}`;
  box.querySelectorAll('[data-bind]').forEach(
    b =>
      (b.onclick = () => {
        const type = b.dataset.bind;
        captureBind = { type, i: type === 'skill' ? +b.dataset.i : type === 'move' ? b.dataset.i : 0 };
        $('bindStatus').textContent = 'Press the new key…';
        renderBindGrid();
      })
  );
}
function assignCapturedBind(code) {
  if (!captureBind) return false;
  if (!code) return true;
  if (RESERVED_BIND_CODES.has(code.split('+').pop())) {
    $('bindStatus').textContent = `${keyLabel(code)} is reserved for movement/gameplay.`;
    return true;
  }
  // toutes les touches (sorts, trinket, déplacements) : une touche déjà prise est retirée de son ancienne action, qui
  // devient « Unset » (pas d'échange : la permutation déplaçait une touche ailleurs sans qu'on le voie)
  const kb = PREFS.keybinds,
    slots = [...kb.skills.map((_, i) => ['skill', i]), ['trinket', 0], ...Object.keys(kb.move).map(k => ['move', k])],
    get = ([t, i]) => (t === 'skill' ? kb.skills[i] : t === 'move' ? kb.move[i] : kb.trinket),
    set = ([t, i], c) => (t === 'skill' ? (kb.skills[i] = c) : t === 'move' ? (kb.move[i] = c) : (kb.trinket = c)),
    me = [captureBind.type, captureBind.i],
    other = slots.find(s => get(s) === code && !(s[0] === me[0] && s[1] === me[1]));
  set(me, code);
  if (other) set(other, '');
  savePrefs();
  $('bindStatus').textContent = `Keybind set: ${keyLabel(code)}` + (other ? ' (previous action is now unset)' : '');
  captureBind = null;
  renderBindGrid();
  if (state) updateUI();
  return true;
}
function resetBindings() {
  PREFS.keybinds = cloneDefaults().keybinds;
  captureBind = null;
  savePrefs();
  renderBindGrid();
  if (state) updateUI();
  $('bindStatus').textContent = 'Default keybinds restored.';
}
function frameIds() {
  return ['selfFrame', 'targetFrame', 'arenaFrames', 'partyFrames'];
}
function applyFramePositions() {
  const game = $('game'),
    gr = game.getBoundingClientRect();
  for (const id of frameIds()) {
    const el = $(id),
      v = PREFS.ui[id];
    if (!el || !v) continue;
    const maxX = Math.max(0, gr.width - el.offsetWidth),
      maxY = Math.max(0, gr.height - el.offsetHeight);
    el.style.left = `${clamp(v.x, 0, 1) * maxX}px`;
    el.style.top = `${clamp(v.y, 0, 1) * maxY}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }
}
function saveFramePosition(el) {
  const gr = $('game').getBoundingClientRect(),
    er = el.getBoundingClientRect(),
    maxX = Math.max(1, gr.width - er.width),
    maxY = Math.max(1, gr.height - er.height);
  PREFS.ui[el.id] = { x: clamp((er.left - gr.left) / maxX, 0, 1), y: clamp((er.top - gr.top) / maxY, 0, 1) };
  savePrefs();
}
function resetFramePositions() {
  PREFS.ui = {};
  savePrefs();
  for (const id of frameIds()) {
    const el = $(id);
    el.style.left = '';
    el.style.top = '';
    el.style.right = '';
    el.style.bottom = '';
  }
  $('bindStatus').textContent = 'Frame positions restored.';
}
function setUiEditMode(on) {
  uiEditMode = !!on;
  $('game').querySelector('.hud').classList.toggle('uiEdit', uiEditMode);
  $('editUiBtn').textContent = uiEditMode ? '✓ Terminer le placement' : 'Move frames';
  if (!uiEditMode && dragFrame) {
    dragFrame.el.classList.remove('dragging');
    dragFrame = null;
  }
}
// Pas : les siens bien présents ; ceux des autres selon la distance (inaudibles au-delà de FOOT_HEAR m, de plus en
// plus forts en approchant) et placés à gauche / droite par rapport à la caméra.
const FOOT_HEAR = 24;
function footstepSpatial(u) {
  const p = state?.player;
  if (!p || u === p) return { pan: 0, level: 1.7 };
  const dx = u.x - p.x,
    dz = u.z - p.z,
    d = Math.hypot(dx, dz, ((u.y || 0) - (p.y || 0)) * 0.8),
    k = clamp(1 - d / FOOT_HEAR, 0, 1),
    r = GameLogic.screenRight(camera.yaw),
    side = d > 0.01 ? (dx * r.x + dz * r.z) / d : 0;
  return { pan: clamp(side * Math.min(1, d / 4) * 0.85, -0.85, 0.85) || 0, level: k * k * 1.1 };
}
function footstepNoiseLayer(
  u,
  { dur = 0.09, vol = 0.05, freq = 900, q = 0.8, delay = 0, kind = 'bandpass', rate = 1 } = {}
) {
  const ctx = sfxCtx();
  if (!ctx || !MUSIC.noise) return;
  const a = footstepSpatial(u);
  if (a.level < 0.01) return;
  const t = ctx.currentTime + delay,
    n = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  n.buffer = MUSIC.noise;
  n.playbackRate.value = rate;
  f.type = kind;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * a.level), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f);
  f.connect(g);
  const out = audioPan(g, a.pan);
  out.connect(MUSIC.sfxMaster);
  if (MUSIC.reverb) {
    const rg = ctx.createGain();
    rg.gain.value = 0.035;
    out.connect(rg);
    rg.connect(MUSIC.reverb);
  }
  n.start(t);
  n.stop(t + dur + 0.025);
}
function footstepSfx(u, side = 0) {
  if (!u?.alive) return;
  const heavy = u.cls === 'sentinel' || u.cls === 'reaver',
    edge = Math.max(Math.abs(u.x) / (arena.halfX || 1), Math.abs(u.z) / (arena.halfZ || 1)),
    grass = edge > 0.63;
  const jitter = 0.92 + Math.random() * 0.16,
    lr = side ? 1.025 : 0.975;
  if (grass) {
    // Soft turf: low body impact + dry vegetation rustle, no oscillator/beep.
    footstepNoiseLayer(u, {
      dur: 0.115,
      vol: heavy ? 0.07 : 0.052,
      freq: heavy ? 250 : 330,
      q: 0.65,
      kind: 'lowpass',
      rate: jitter * lr
    });
    footstepNoiseLayer(u, {
      dur: 0.085,
      vol: heavy ? 0.04 : 0.032,
      freq: 1550,
      q: 1.0,
      kind: 'bandpass',
      rate: (1.05 + Math.random() * 0.18) * lr,
      delay: 0.006
    });
  } else {
    // Stone: broad heel impact, short sole slap and a tiny high-frequency scuff.
    footstepNoiseLayer(u, {
      dur: 0.095,
      vol: heavy ? 0.082 : 0.06,
      freq: heavy ? 300 : 390,
      q: 0.72,
      kind: 'lowpass',
      rate: jitter * lr
    });
    footstepNoiseLayer(u, {
      dur: 0.06,
      vol: heavy ? 0.05 : 0.038,
      freq: 980,
      q: 1.15,
      kind: 'bandpass',
      rate: (0.96 + Math.random() * 0.12) * lr,
      delay: 0.008
    });
    footstepNoiseLayer(u, {
      dur: 0.032,
      vol: heavy ? 0.026 : 0.018,
      freq: 2900,
      q: 1.6,
      kind: 'bandpass',
      rate: (1.1 + Math.random() * 0.18) * lr,
      delay: 0.012
    });
  }
}

function openSettings() {
  if (state) state.keys = {};
  settingsOpen = true;
  $('settingsPanel').classList.add('open');
  setMusicVolume(PREFS.volume);
  renderBindGrid();
  applyFramePositions();
}
function closeSettings() {
  settingsOpen = false;
  captureBind = null;
  setUiEditMode(false);
  $('settingsPanel').classList.remove('open');
  canvas.focus();
}
for (const id of frameIds()) {
  $(id).addEventListener('pointerdown', e => {
    if (!uiEditMode) return;
    e.preventDefault();
    const el = e.currentTarget,
      gr = $('game').getBoundingClientRect(),
      er = el.getBoundingClientRect();
    dragFrame = { el, dx: e.clientX - er.left, dy: e.clientY - er.top };
    el.classList.add('dragging');
    el.setPointerCapture?.(e.pointerId);
  });
}
window.addEventListener('pointermove', e => {
  if (!dragFrame) return;
  const { el, dx, dy } = dragFrame,
    gr = $('game').getBoundingClientRect();
  const x = clamp(e.clientX - gr.left - dx, 0, Math.max(0, gr.width - el.offsetWidth)),
    y = clamp(e.clientY - gr.top - dy, 0, Math.max(0, gr.height - el.offsetHeight));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
});
window.addEventListener('pointerup', () => {
  if (!dragFrame) return;
  saveFramePosition(dragFrame.el);
  dragFrame.el.classList.remove('dragging');
  dragFrame = null;
});
window.addEventListener('resize', () => requestAnimationFrame(applyFramePositions));
function updateSelectPreview(selectedRace, selectedClass) {
  const box = $('selectPreview');
  if (!box) return;
  const rk = selectedRace || 'human',
    ck = selectedClass || 'sentinel';
  if (!$('preview3d'))
    box.innerHTML = `<div class="pvHead"><span>Preview</span><span class="tiny">same model as in the arena</span></div><div class="pvArt"><canvas id="preview3d" aria-hidden="true"></canvas><div id="previewLoading" class="previewLoading">Loading hero…</div></div><div class="previewHint"></div>`;
  updateSelectPreview3D(rk, ck);
}
// Cartes : illustration de l'utilisateur (assets/ui/lobby2/), sinon la capture du jeu (assets/ui/map_thumbs.js).
// cartes complètes (nom et description peints, bandeau à blason) : le texte du jeu est alors masqué (.painted)
const MAP_ART = { castle: 'assets/ui/lobby2/mapcard_castle.webp', bridge: 'assets/ui/lobby2/mapcard_bridge.webp' };
function renderMapChoices() {
  const box = $('mapChoices');
  if (!box) return;
  box.innerHTML = Object.entries(MAPS)
    .map(
      ([id, M]) =>
        `<button class="mapCard${id === MAP_ID ? ' selected' : ''}${MAP_ART[id] ? ' painted' : ''}" data-map="${id}" aria-label="${M.name}"><span class="mapArt"><img src="${MAP_ART[id] || window.MAP_THUMBS?.[id] || ''}" alt=""></span><div class="mapLabel"><b>${M.name}</b><span>${M.desc}</span></div></button>`
    )
    .join('');
  box.querySelectorAll('[data-map]').forEach(
    b =>
      (b.onclick = () => {
        applyMap(b.dataset.map);
        renderMapChoices();
        LOBBY_CHIPS?.();
      })
  );
}
// Lobby : la barre de sorts de la classe choisie, comme en jeu (survol = infobulle du sort) pour découvrir le
// personnage avant de jouer. Unité fictive : pas de recharge, ressource pleine.
let LOBBY_UNIT = null,
  LOBBY_CHIPS = null;
// Récapitulatif sous l'aperçu : race, classe, mode, difficulté, arène
const CHIP_ICON = {
  mode: '<svg viewBox="0 0 20 20"><path d="M3 3l8 8M3 3h4M3 3v4M17 3l-8 8M17 3h-4M17 3v4M6 14l-3 3M14 14l3 3" stroke="#e9c46a" stroke-width="2" fill="none"/></svg>',
  diff: '<svg viewBox="0 0 20 20"><rect x="2" y="12" width="4" height="6" fill="#e9c46a"/><rect x="8" y="8" width="4" height="10" fill="#e9c46a"/><rect x="14" y="3" width="4" height="15" fill="#e9c46a"/></svg>',
  map: '<svg viewBox="0 0 20 20"><path d="M10 19s6-6.5 6-11a6 6 0 0 0-12 0c0 4.5 6 11 6 11z" fill="#e9c46a"/><circle cx="10" cy="8" r="2.3" fill="#1a1d26"/></svg>'
};
function lobbyChipsHTML(race, cls) {
  const diff = DIFFICULTY[0].toUpperCase() + DIFFICULTY.slice(1);
  return [
    race && `<span><img src="assets/ui/lobby/race_${race}.webp" alt="">${RACE[race].name}</span>`,
    cls && `<span><img src="assets/ui/lobby/class_${cls}.webp" alt="">${CLASS[cls].name}</span>`,
    `<span>${CHIP_ICON.mode}${TEAM_SIZE}v${TEAM_SIZE}</span>`,
    `<span>${CHIP_ICON.diff}${diff}</span>`,
    `<span>${CHIP_ICON.map}${MAPS[MAP_ID]?.name || ''}</span>`
  ]
    .filter(Boolean)
    .join('');
}
function lobbySkillBar(cls) {
  const box = $('skills');
  LOBBY_UNIT = cls ? { cls, cd: [], gcd: 0, trinket: 0, res: 100, burst: 0, form: null, stealth: false } : null;
  if (LOBBY_UNIT) renderSkillBar(LOBBY_UNIT);
  else {
    box.innerHTML = '';
    box._key = null;
  }
}
function chooseClass() {
  playLobbyMusic();
  renderMapChoices();
  // dernière race / classe choisies : gardées dans le navigateur (aussi après fermeture du jeu)
  const last = (() => {
    try {
      return JSON.parse(localStorage.getItem('arenaLastPick') || '{}');
    } catch (_) {
      return {};
    }
  })();
  let selectedClass = state?.pcls || (CLASS[last.cls] ? last.cls : null),
    selectedRace = state?.prace || (RACE[last.race] ? last.race : null);
  const raceBox = $('raceChoices'),
    box = $('classChoices'),
    play = $('playBtn'),
    label = $('selectedClass');
  raceBox.innerHTML = Object.entries(RACE)
    .map(
      ([k, r]) =>
        `<button class="racePick iconChoice" data-r="${k}" title="${r.name}" aria-label="${r.name}">${lobbyCardArt('race', k)}<span class="label">${r.name}</span></button>`
    )
    .join('');
  box.innerHTML = Object.entries(CLASS)
    .map(
      ([k, c]) =>
        `<button class="classPick iconChoice" data-c="${k}" title="${c.name}" aria-label="${c.name}">${lobbyCardArt('class', k)}<span class="label">${c.name}</span></button>`
    )
    .join('');
  $('overlay').style.display = 'flex';
  $('reticle').style.display = 'none';
  play.disabled = true;
  const refresh = () => {
    play.disabled = !(selectedClass && selectedRace) || window.NET?.role === 'guest'; // invité : l'hôte lance
    label.textContent =
      selectedClass && selectedRace
        ? `${RACE[selectedRace].name} ${CLASS[selectedClass].name}`
        : 'Choose a race and a class';
    raceBox.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.r === selectedRace));
    box.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.c === selectedClass));
    updateSelectPreview(selectedRace, selectedClass);
    lobbySkillBar(selectedClass);
    try {
      localStorage.setItem('arenaLastPick', JSON.stringify({ race: selectedRace, cls: selectedClass }));
    } catch (_) {}
    LOBBY_CHIPS();
    if (window.NET?.role === 'guest') netLobbyChoice(selectedRace, selectedClass);
    else NET_CHOICE = { race: selectedRace, cls: selectedClass };
  };
  LOBBY_CHIPS = () => ($('lobbyChips').innerHTML = lobbyChipsHTML(selectedRace, selectedClass));
  raceBox.querySelectorAll('button').forEach(
    b =>
      (b.onclick = () => {
        selectedRace = b.dataset.r;
        refresh();
      })
  );
  const diffs = $('diffChoices'),
    diffRefresh = () =>
      diffs.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.d === DIFFICULTY));
  diffs.querySelectorAll('button').forEach(
    b =>
      (b.onclick = () => {
        DIFFICULTY = b.dataset.d;
        try {
          localStorage.setItem('arenaDifficulty', DIFFICULTY);
        } catch (_) {}
        diffRefresh();
        LOBBY_CHIPS();
      })
  );
  diffRefresh();
  const sizes = $('sizeChoices'),
    sizeRefresh = () =>
      sizes.querySelectorAll('button').forEach(b => b.classList.toggle('selected', +b.dataset.s === TEAM_SIZE));
  sizes.querySelectorAll('button').forEach(
    b =>
      (b.onclick = () => {
        TEAM_SIZE = +b.dataset.s;
        try {
          localStorage.setItem('arenaTeamSize', TEAM_SIZE);
        } catch (_) {}
        sizeRefresh();
        LOBBY_CHIPS();
        if (typeof netRenderGuests === 'function') netRenderGuests();
      })
  );
  sizeRefresh();
  box.querySelectorAll('button').forEach(
    b =>
      (b.onclick = () => {
        selectedClass = b.dataset.c;
        refresh();
      })
  );
  refresh();
  play.onclick = () => {
    if (!selectedClass || !selectedRace) return;
    if (MOBILE.enabled) mobileRequestFullscreen();
    // en ligne (hôte avec un ami prêt) : 1v1 contre lui
    // en ligne (hôte) : le mode du lobby, amis placés avec / contre lui, IA pour les places libres
    const online = window.NET?.role === 'host' ? netOnlineTeams() : null;
    if (window.NET?.role === 'host' && !online) {
      $('netPanel').style.display = 'flex';
      return netStatus('Waiting for your friends to join and pick a class…');
    }
    state = {
      pcls: selectedClass,
      prace: selectedRace,
      scoreA: 0,
      scoreB: 0,
      round: 0,
      online
    };
    $('overlay').style.display = 'none';
    resetRound();
    musicStart();
    canvas.focus();
    requestAnimationFrame(mobileViewportSync);
  };
}
$('restartBtn').onclick = () => requestChangeClass();
updateMusicButton();
$('musicBtn').onclick = musicToggle;
$('settingsBtn').onclick = openSettings;
$('closeSettingsBtn').onclick = closeSettings;
$('editUiBtn').onclick = () => setUiEditMode(!uiEditMode);
$('resetUiBtn').onclick = resetFramePositions;
$('resetBindsBtn').onclick = resetBindings;
$('musicVolume').oninput = e => setMusicVolume(e.target.value / 100);
$('volumeMini').oninput = e => setMusicVolume(e.target.value / 100);
setMusicVolume(PREFS.volume);
requestAnimationFrame(applyFramePositions);
