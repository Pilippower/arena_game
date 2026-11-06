'use strict';
// Placement et taille des cadres en jeu (Settings → Move frames), gardés dans PREFS.ui[id] = { x, y, s } (position
// relative 0..1 dans #game, échelle). Quatre blocs indépendants : son cadre, celui de la cible, son groupe entier et le
// groupe ennemi entier (les membres d'un groupe bougent ensemble : #partyFrames / #arenaFrames). Demande du
// 06/11/2026 : le panneau Settings cachait la cible et le groupe ennemi pendant le placement → il se range, une barre
// d'outils (taille, réinitialiser, terminer) le remplace. Chargé avant settings.js (index.html).
let uiEditMode = false,
  dragFrame = null,
  uiSelected = 'selfFrame';
const FRAME_IDS = ['selfFrame', 'targetFrame', 'partyFrames', 'arenaFrames'],
  FRAME_SCALE = { min: 0.6, max: 1.6, step: 0.05 },
  FRAME_LABEL = { selfFrame: 'You', targetFrame: 'Target', partyFrames: 'Your party', arenaFrames: 'Enemy team' };
function frameIds() {
  return FRAME_IDS;
}
// Échelle permise (pure, testée) : bornée et arrondie au pas du curseur.
function frameScale(s) {
  const k = Math.round((+s || 1) / FRAME_SCALE.step) * FRAME_SCALE.step;
  return +clamp(k, FRAME_SCALE.min, FRAME_SCALE.max).toFixed(2);
}
// Coin haut-gauche (px dans #game) d'un cadre de taille réelle w × h (échelle comprise) à la position relative v :
// toujours entièrement dans la zone de jeu (pure, testée).
function framePlace(v, w, h, areaW, areaH) {
  return { x: clamp(v.x, 0, 1) * Math.max(0, areaW - w), y: clamp(v.y, 0, 1) * Math.max(0, areaH - h) };
}
function applyFrame(el, v) {
  const s = v?.s ?? 1;
  el.style.transformOrigin = '0 0';
  el.style.transform = s !== 1 ? `scale(${s})` : '';
  if (!v || v.x === undefined) return;
  const gr = $('game').getBoundingClientRect(),
    p = framePlace(v, el.offsetWidth * s, el.offsetHeight * s, gr.width, gr.height);
  Object.assign(el.style, { left: p.x + 'px', top: p.y + 'px', right: 'auto', bottom: 'auto' });
}
function applyFramePositions() {
  for (const id of FRAME_IDS) {
    const el = $(id);
    if (el) applyFrame(el, PREFS.ui[id]);
  }
}
// Position actuelle (taille réelle, échelle comprise) → PREFS.ui
function saveFramePosition(el) {
  const gr = $('game').getBoundingClientRect(),
    er = el.getBoundingClientRect(),
    maxX = Math.max(1, gr.width - er.width),
    maxY = Math.max(1, gr.height - er.height);
  PREFS.ui[el.id] = {
    ...PREFS.ui[el.id],
    x: clamp((er.left - gr.left) / maxX, 0, 1),
    y: clamp((er.top - gr.top) / maxY, 0, 1)
  };
  savePrefs();
}
function setFrameScale(id, s) {
  const el = $(id);
  if (!el) return;
  // agrandi depuis son coin haut-gauche, qui ne bouge pas (sauf pour rester dans l'écran)
  const gr = $('game').getBoundingClientRect(),
    er = el.getBoundingClientRect(),
    k = frameScale(s);
  el.style.transformOrigin = '0 0';
  el.style.transform = k !== 1 ? `scale(${k})` : '';
  const w = el.offsetWidth * k,
    h = el.offsetHeight * k;
  Object.assign(el.style, {
    left: clamp(er.left - gr.left, 0, Math.max(0, gr.width - w)) + 'px',
    top: clamp(er.top - gr.top, 0, Math.max(0, gr.height - h)) + 'px',
    right: 'auto',
    bottom: 'auto'
  });
  PREFS.ui[id] = { ...PREFS.ui[id], s: k };
  saveFramePosition(el);
  syncEditBar();
}
function resetFramePositions() {
  PREFS.ui = {};
  savePrefs();
  for (const id of FRAME_IDS) {
    const el = $(id);
    Object.assign(el.style, { left: '', top: '', right: '', bottom: '', transform: '' });
  }
  syncEditBar();
  $('bindStatus').textContent = 'Frame positions and sizes restored.';
}
// ---------- barre d'outils du mode placement ----------
function editBar() {
  let bar = $('uiEditBar');
  if (bar) return bar;
  bar = document.createElement('div');
  bar.id = 'uiEditBar';
  bar.innerHTML = `<span class="ueHint">Drag a frame to move it · click it, then set its size</span>
<span class="ueSel"><b id="uiEditSel"></b> size <input id="uiEditScale" type="range" min="${FRAME_SCALE.min * 100}" max="${FRAME_SCALE.max * 100}" step="${FRAME_SCALE.step * 100}"> <b id="uiEditScaleVal"></b></span>
<button id="uiEditReset">Reset</button><button id="uiEditDone">Done</button>`;
  $('game').appendChild(bar);
  $('uiEditScale').oninput = e => setFrameScale(uiSelected, e.target.value / 100);
  $('uiEditReset').onclick = resetFramePositions;
  $('uiEditDone').onclick = () => setUiEditMode(false);
  return bar;
}
function syncEditBar() {
  if (!$('uiEditBar')) return;
  const s = PREFS.ui[uiSelected]?.s ?? 1;
  $('uiEditSel').textContent = FRAME_LABEL[uiSelected];
  $('uiEditScale').value = Math.round(s * 100);
  $('uiEditScaleVal').textContent = Math.round(s * 100) + ' %';
  for (const id of FRAME_IDS) $(id)?.classList.toggle('uiSelected', uiEditMode && id === uiSelected);
}
function setUiEditMode(on) {
  uiEditMode = !!on;
  $('game').querySelector('.hud').classList.toggle('uiEdit', uiEditMode);
  document.body.classList.toggle('uiEditing', uiEditMode); // range le panneau Settings (theme.css)
  editBar().style.display = uiEditMode ? '' : 'none';
  $('editUiBtn').textContent = 'Move / resize frames';
  if (!uiEditMode && dragFrame) {
    dragFrame.el.classList.remove('dragging');
    dragFrame = null;
  }
  syncEditBar();
}
for (const id of FRAME_IDS) {
  $(id).addEventListener('pointerdown', e => {
    if (!uiEditMode) return;
    e.preventDefault();
    const el = e.currentTarget,
      er = el.getBoundingClientRect();
    uiSelected = el.id;
    syncEditBar();
    dragFrame = { el, dx: e.clientX - er.left, dy: e.clientY - er.top };
    el.classList.add('dragging');
    el.setPointerCapture?.(e.pointerId);
  });
  // molette au-dessus d'un cadre : sa taille
  $(id).addEventListener(
    'wheel',
    e => {
      if (!uiEditMode) return;
      e.preventDefault();
      uiSelected = id;
      setFrameScale(id, (PREFS.ui[id]?.s ?? 1) - Math.sign(e.deltaY) * FRAME_SCALE.step);
    },
    { passive: false }
  );
}
window.addEventListener('pointermove', e => {
  if (!dragFrame) return;
  const { el, dx, dy } = dragFrame,
    gr = $('game').getBoundingClientRect(),
    er = el.getBoundingClientRect();
  const x = clamp(e.clientX - gr.left - dx, 0, Math.max(0, gr.width - er.width)),
    y = clamp(e.clientY - gr.top - dy, 0, Math.max(0, gr.height - er.height));
  Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
});
window.addEventListener('pointerup', () => {
  if (!dragFrame) return;
  saveFramePosition(dragFrame.el);
  dragFrame.el.classList.remove('dragging');
  dragFrame = null;
});
window.addEventListener('resize', () => requestAnimationFrame(applyFramePositions));
