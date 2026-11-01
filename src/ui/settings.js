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
  const names = state?.player
    ? CLASS[state.player.cls].skills.map(s => s.n)
    : ['Sort 1', 'Sort 2', 'Sort 3', 'Sort 4', 'Sort 5'];
  box.innerHTML =
    names
      .map(
        (n, i) =>
          `<span>${i + 1}. ${n}</span><button class="bindBtn ${captureBind?.type === 'skill' && captureBind.i === i ? 'capturing' : ''}" data-bind-skill="${i}">${captureBind?.type === 'skill' && captureBind.i === i ? 'Appuie sur une touche…' : keyLabel(PREFS.keybinds.skills[i])}</button>`
      )
      .join('') +
    `<span>Trinket PvP</span><button class="bindBtn ${captureBind?.type === 'trinket' ? 'capturing' : ''}" data-bind-trinket="1">${captureBind?.type === 'trinket' ? 'Appuie sur une touche…' : keyLabel(PREFS.keybinds.trinket)}</button>`;
  box.querySelectorAll('[data-bind-skill]').forEach(
    b =>
      (b.onclick = () => {
        captureBind = { type: 'skill', i: +b.dataset.bindSkill };
        $('bindStatus').textContent = 'Appuie sur la nouvelle touche…';
        renderBindGrid();
      })
  );
  box.querySelector('[data-bind-trinket]').onclick = () => {
    captureBind = { type: 'trinket' };
    $('bindStatus').textContent = 'Appuie sur la nouvelle touche…';
    renderBindGrid();
  };
}
function assignCapturedBind(code) {
  if (!captureBind) return false;
  if (RESERVED_BIND_CODES.has(code)) {
    $('bindStatus').textContent = `${keyLabel(code)} is reserved for movement/gameplay.`;
    return true;
  }
  const kb = PREFS.keybinds,
    old = captureBind.type === 'skill' ? kb.skills[captureBind.i] : kb.trinket;
  let otherType = null,
    otherIdx = -1;
  if (kb.trinket === code) {
    otherType = 'trinket';
  } else {
    otherIdx = kb.skills.indexOf(code);
    if (otherIdx >= 0) otherType = 'skill';
  }
  if (captureBind.type === 'skill') kb.skills[captureBind.i] = code;
  else kb.trinket = code;
  if (otherType) {
    if (otherType === 'skill') kb.skills[otherIdx] = old;
    else kb.trinket = old;
  }
  savePrefs();
  $('bindStatus').textContent = `Keybind set: ${keyLabel(code)}`;
  captureBind = null;
  renderBindGrid();
  updateUI();
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
function footstepNoiseLayer(
  u,
  { dur = 0.09, vol = 0.05, freq = 900, q = 0.8, delay = 0, kind = 'bandpass', rate = 1 } = {}
) {
  const ctx = sfxCtx();
  if (!ctx || !MUSIC.noise) return;
  const a = sfxSpatial(u),
    t = ctx.currentTime + delay,
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
function spellFlavorLayer(u, i) {
  const a = sfxSpatial(u),
    L = a.level,
    P = a.pan;
  if (!u) return;
  const c = u.cls;
  if (c === 'arcanist') {
    sfxTone(1720, 0.11, 'sine', 0.028 * L, 1180, 0, P, 5200, 0.22);
    if (i === 1 || i === 4) sfxNoise(0.14, 0.035 * L, 6200, 0, P, 'highpass');
  } else if (c === 'sentinel') {
    sfxNoise(0.06, 0.04 * L, 1500, 0, P);
    if (i === 4) sfxTone(160, 0.15, 'sawtooth', 0.04 * L, 78, 0, P, 900, 0.08);
  } else if (c === 'oracle') {
    sfxChord([659.25, 783.99, 987.77], 0.22, 'sine', 0.028 * L, P, 0.01);
  } else if (c === 'warlock') {
    sfxNoise(0.1, 0.03 * L, 700, 0, P, 'lowpass');
    sfxTone(132, 0.12, 'sawtooth', 0.025 * L, 72, 0, P, 800, 0.12);
  } else if (c === 'reaver') {
    sfxTone(118, 0.14, 'sawtooth', 0.028 * L, 62, 0, P, 650, 0.1);
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
// Cartes : une vignette par carte (assets/ui/map_thumbs.js), clic = applyMap.
function renderMapChoices() {
  const box = $('mapChoices');
  if (!box) return;
  box.innerHTML = Object.entries(MAPS)
    .map(
      ([id, M]) =>
        `<button class="mapCard${id === MAP_ID ? ' selected' : ''}" data-map="${id}"><img src="${window.MAP_THUMBS?.[id] || ''}" alt=""><div class="mapLabel"><b>${M.name}</b><span>${M.desc}</span></div></button>`
    )
    .join('');
  box.querySelectorAll('[data-map]').forEach(
    b =>
      (b.onclick = () => {
        applyMap(b.dataset.map);
        renderMapChoices();
      })
  );
}
function chooseClass() {
  playLobbyMusic();
  renderMapChoices();
  let selectedClass = state?.pcls || null,
    selectedRace = state?.prace || null;
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
    play.disabled = !(selectedClass && selectedRace);
    label.textContent =
      selectedClass && selectedRace
        ? `${RACE[selectedRace].name} ${CLASS[selectedClass].name}`
        : 'Choose a race and a class';
    raceBox.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.r === selectedRace));
    box.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.c === selectedClass));
    updateSelectPreview(selectedRace, selectedClass);
  };
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
    state = { pcls: selectedClass, prace: selectedRace, scoreA: 0, scoreB: 0, round: 0 };
    $('overlay').style.display = 'none';
    resetRound();
    musicStart();
    canvas.focus();
    requestAnimationFrame(mobileViewportSync);
  };
}
$('restartBtn').onclick = chooseClass;
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
