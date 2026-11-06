'use strict';
// Placement et taille des cadres en jeu (Settings → Move frames), gardés dans PREFS.ui[id] = { x, y, s } (position
// relative 0..1 dans #game, échelle). Quatre blocs indépendants : son cadre, celui de la cible, son groupe entier et le
// groupe ennemi entier (les membres d'un groupe bougent ensemble : #partyFrames / #arenaFrames). Demande du
// 06/11/2026 : « Move frames » ferme Settings (le panneau cachait la cible et le groupe ennemi) ; on glisse un cadre
// pour le déplacer, sa poignée d'angle (bas-droit) pour changer sa taille ; on rouvre Settings et « Done moving »
// termine. Chargé avant settings.js (index.html).
let uiEditMode = false,
  dragFrame = null; // { el, mode: 'move' | 'size', … }
const FRAME_IDS = ['selfFrame', 'targetFrame', 'partyFrames', 'arenaFrames'],
  FRAME_SCALE = { min: 0.6, max: 1.6, step: 0.05 };
function frameIds() {
  return FRAME_IDS;
}
// Échelle permise (pure, testée) : bornée et arrondie au pas.
function frameScale(s) {
  const k = Math.round((+s || 1) / FRAME_SCALE.step) * FRAME_SCALE.step;
  return +clamp(k, FRAME_SCALE.min, FRAME_SCALE.max).toFixed(2);
}
// Coin haut-gauche (px dans #game) d'un cadre de taille réelle w × h (échelle comprise) à la position relative v :
// toujours entièrement dans la zone de jeu (pure, testée).
function framePlace(v, w, h, areaW, areaH) {
  return { x: clamp(v.x, 0, 1) * Math.max(0, areaW - w), y: clamp(v.y, 0, 1) * Math.max(0, areaH - h) };
}
// Échelle tirée par la poignée d'angle (pure, testée) : la largeur suit la souris, coin haut-gauche fixe.
function frameDragScale(startScale, startWidth, dx) {
  return frameScale((startScale * (startWidth + dx)) / Math.max(1, startWidth));
}
function setFrameBox(el, left, top, s) {
  const gr = $('game').getBoundingClientRect();
  el.style.transformOrigin = '0 0';
  el.style.transform = s !== 1 ? `scale(${s})` : '';
  Object.assign(el.style, {
    left: clamp(left, 0, Math.max(0, gr.width - el.offsetWidth * s)) + 'px',
    top: clamp(top, 0, Math.max(0, gr.height - el.offsetHeight * s)) + 'px',
    right: 'auto',
    bottom: 'auto'
  });
}
function applyFramePositions() {
  const gr = $('game').getBoundingClientRect();
  for (const id of FRAME_IDS) {
    const el = $(id),
      v = PREFS.ui[id];
    if (!el) continue;
    const s = v?.s ?? 1;
    if (!v || v.x === undefined) {
      el.style.transform = '';
      continue;
    }
    const p = framePlace(v, el.offsetWidth * s, el.offsetHeight * s, gr.width, gr.height);
    setFrameBox(el, p.x, p.y, s);
  }
}
// Position et taille actuelles → PREFS.ui
function saveFramePosition(el, s = PREFS.ui[el.id]?.s ?? 1) {
  const gr = $('game').getBoundingClientRect(),
    er = el.getBoundingClientRect(),
    maxX = Math.max(1, gr.width - er.width),
    maxY = Math.max(1, gr.height - er.height);
  PREFS.ui[el.id] = { x: clamp((er.left - gr.left) / maxX, 0, 1), y: clamp((er.top - gr.top) / maxY, 0, 1), s };
  savePrefs();
}
function resetFramePositions() {
  PREFS.ui = {};
  savePrefs();
  for (const id of FRAME_IDS) Object.assign($(id).style, { left: '', top: '', right: '', bottom: '', transform: '' });
  $('bindStatus').textContent = 'Frame positions and sizes restored.';
}
// ---------- mode placement : rappel en haut, poignées d'angle (hors des cadres, que le HUD réécrit) ----------
function editOverlay() {
  if ($('uiEditHint')) return;
  const hint = document.createElement('div');
  hint.id = 'uiEditHint';
  hint.textContent = 'Move mode — drag a frame to move it, drag its corner to resize it. Open Settings → Done moving.';
  $('game').appendChild(hint);
  for (const id of FRAME_IDS) {
    const h = document.createElement('div');
    h.className = 'uiResize';
    h.dataset.for = id;
    h.addEventListener('pointerdown', e => startFrameDrag(e, $(id), 'size'));
    $('game').appendChild(h);
  }
}
// poignées collées à l'angle bas-droit de chaque cadre, à chaque image du mode placement
function placeHandles() {
  if (!uiEditMode) return;
  const gr = $('game').getBoundingClientRect();
  for (const h of document.querySelectorAll('.uiResize')) {
    const el = $(h.dataset.for),
      r = el.getBoundingClientRect(),
      shown = r.width > 0 && getComputedStyle(el).display !== 'none';
    h.style.display = shown ? '' : 'none';
    h.style.left = r.right - gr.left + 'px';
    h.style.top = r.bottom - gr.top + 'px';
  }
  requestAnimationFrame(placeHandles);
}
function setUiEditMode(on) {
  uiEditMode = !!on;
  editOverlay();
  $('game').querySelector('.hud').classList.toggle('uiEdit', uiEditMode);
  $('uiEditHint').style.display = uiEditMode ? '' : 'none';
  for (const h of document.querySelectorAll('.uiResize')) h.style.display = uiEditMode ? '' : 'none';
  $('editUiBtn').textContent = uiEditMode ? '✓ Done moving' : 'Move / resize frames';
  if (!uiEditMode && dragFrame) {
    dragFrame.el.classList.remove('dragging');
    dragFrame = null;
  }
  if (uiEditMode) requestAnimationFrame(placeHandles);
}
function startFrameDrag(e, el, mode) {
  if (!uiEditMode) return;
  e.preventDefault();
  e.stopPropagation();
  const er = el.getBoundingClientRect(),
    gr = $('game').getBoundingClientRect();
  dragFrame = {
    el,
    mode,
    dx: e.clientX - er.left,
    dy: e.clientY - er.top,
    x0: e.clientX,
    s0: PREFS.ui[el.id]?.s ?? 1,
    w0: er.width,
    left: er.left - gr.left,
    top: er.top - gr.top
  };
  el.classList.add('dragging');
  e.target.setPointerCapture?.(e.pointerId);
}
for (const id of FRAME_IDS) $(id).addEventListener('pointerdown', e => startFrameDrag(e, e.currentTarget, 'move'));
window.addEventListener('pointermove', e => {
  if (!dragFrame) return;
  const d = dragFrame,
    gr = $('game').getBoundingClientRect();
  if (d.mode === 'size') {
    d.s = frameDragScale(d.s0, d.w0, e.clientX - d.x0);
    setFrameBox(d.el, d.left, d.top, d.s);
  } else setFrameBox(d.el, e.clientX - gr.left - d.dx, e.clientY - gr.top - d.dy, PREFS.ui[d.el.id]?.s ?? 1);
});
window.addEventListener('pointerup', () => {
  if (!dragFrame) return;
  saveFramePosition(dragFrame.el, dragFrame.s ?? PREFS.ui[dragFrame.el.id]?.s ?? 1);
  dragFrame.el.classList.remove('dragging');
  dragFrame = null;
});
window.addEventListener('resize', () => requestAnimationFrame(applyFramePositions));
