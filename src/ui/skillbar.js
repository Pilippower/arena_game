'use strict';
// Barre de sorts : ordre personnalisé (Shift + glisser) et infobulles.
// ---------- Barre de sorts : ordre personnalisé (Shift + glisser) et infobulles ----------
function slotOrder(p) {
  const bar = skillsOf(p),
    key = p.cls + ':' + barKey(p),
    o = PREFS.ui?.order?.[key];
  return Array.isArray(o) &&
    o.length === bar.length &&
    o
      .slice()
      .sort((a, b) => a - b)
      .every((v, i) => v === i)
    ? o
    : bar.map((_, i) => i);
}
function swapSlots(a, b) {
  const p = state?.player;
  if (!p || a === b) return;
  const o = slotOrder(p).slice();
  [o[a], o[b]] = [o[b], o[a]];
  PREFS.ui = PREFS.ui || {};
  PREFS.ui.order = PREFS.ui.order || {};
  PREFS.ui.order[p.cls + ':' + barKey(p)] = o;
  savePrefs();
  updateUI();
}
const SKILL_DRAG = { from: null };
document.addEventListener(
  'pointerdown',
  e => {
    const b = e.target.closest?.('.skill[data-slot]');
    if (!b) return;
    if (e.shiftKey || SKILL_DRAG.armed) {
      if (SKILL_DRAG.armed && SKILL_DRAG.from != null) {
        swapSlots(SKILL_DRAG.from, +b.dataset.slot);
        SKILL_DRAG.from = null;
        SKILL_DRAG.armed = false;
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      SKILL_DRAG.from = +b.dataset.slot;
      document.body.classList.add('skillDrag');
      e.stopPropagation();
      e.preventDefault();
    } else if (MOBILE.enabled) {
      clearTimeout(SKILL_DRAG.lp);
      const slot = +b.dataset.slot;
      SKILL_DRAG.lp = setTimeout(() => {
        SKILL_DRAG.from = slot;
        SKILL_DRAG.armed = true;
        document.body.classList.add('skillDrag');
        showError('Touche un autre sort pour échanger');
      }, 650);
    }
  },
  true
);
document.addEventListener(
  'pointerup',
  e => {
    clearTimeout(SKILL_DRAG.lp);
    if (SKILL_DRAG.from == null || SKILL_DRAG.armed) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.skill[data-slot]');
    if (el) swapSlots(SKILL_DRAG.from, +el.dataset.slot);
    SKILL_DRAG.from = null;
    document.body.classList.remove('skillDrag');
  },
  true
);
document.addEventListener(
  'click',
  e => {
    if (e.shiftKey && e.target.closest?.('.skill[data-slot]')) {
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true
);

// Texte des sorts : valeurs exactes du code (dégâts multipliés par 1,35 sous Burst ; coups critiques x1,5).
const fmtS = s => `${String(s).replace('.', ',')} s`;
function skillTooltip(u, i) {
  const S = skillsOf(u)[i];
  if (!S) return '';
  const C = CLASS[u.cls],
    burst = u.burst > 0 ? 1.35 : 1,
    dmp = 1 - (state?.dampening || 0);
  const D = v => `<b class="tDmg">${Math.round(v * burst)}</b>`,
    H = v => `<b class="tHeal">${Math.round(v * dmp)}</b>`;
  const range = S.range
    ? `${String(S.range).replace('.', ',')} m`
    : S.t === 'melee'
      ? 'Corps à corps'
      : S.t === 'ranged' || S.t === 'heal'
        ? '15 m'
        : S.t === 'charge'
          ? '2,8–15 m'
          : S.t === 'aoe'
            ? 'Autour de vous'
            : 'Personnel';
  const castT = S.cast;
  return `<div class="tName">${S.n}</div><div class="tRow"><span>${S.c ? `${S.c} ${C.res}` : 'Gratuit'}</span><span>${range}</span></div>
  <div class="tRow"><span>${castT ? `Incantation ${fmtS(castT)}` : 'Instantané'}</span><span>${S.cd ? `Recharge ${fmtS(S.cd)}` : 'Pas de recharge'}</span></div>
  <div class="tDesc">${S.text ? S.text(S, D, H) : ''}</div>${burst > 1 ? '<div class="tNote">Burst actif : dégâts +35 % inclus</div>' : ''}${dmp < 1 ? `<div class="tNote">Dampening : soins -${Math.round((1 - dmp) * 100)} % inclus</div>` : ''}`;
}
let TIP_SLOT = null;
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const b = e.target.closest?.('#skills .skill[data-i]');
  const tip = $('skillTip');
  if (!tip) return;
  if (!b || !state?.player) {
    tip.style.display = 'none';
    TIP_SLOT = null;
    return;
  }
  const i = +b.dataset.i;
  if (TIP_SLOT !== i) {
    TIP_SLOT = i;
    tip.innerHTML = skillTooltip(state.player, i);
  }
  tip.style.display = 'block';
  if (tip.parentNode !== document.body) document.body.appendChild(tip);
  const r = b.getBoundingClientRect(),
    w = tip.offsetWidth;
  tip.style.left = clamp(r.left + r.width / 2 - w / 2, 6, innerWidth - w - 6) + 'px';
  tip.style.top = Math.max(6, r.top - tip.offsetHeight - 10) + 'px';
});
function hostileTarget(u, fallback = true) {
  const t = u.target;
  if (t?.alive && t.team !== u.team) return t;
  if (u.lastEnemy?.alive) return u.lastEnemy;
  return fallback ? nearestEnemy(u) : null;
}
function updateFearMovement(u, dt) {
  if (!u?.alive || u.fear <= 0 || u.root > 0 || u.stun > 0) return;
  const ax = u.x - (u.fearSourceX ?? u.x),
    az = u.z - (u.fearSourceZ ?? u.z),
    base = Math.atan2(ax, az),
    wobble = Math.sin((state.elapsed || 0) * 4.2 + (u.fearPhase || 0)) * 0.72,
    ang = base + wobble,
    sp = CLASS[u.cls].speed * 1.12;
  u.x += Math.sin(ang) * sp * dt;
  u.z += Math.cos(ang) * sp * dt;
  u.yaw = ang;
  u.moving = true;
  u.movePhase += dt * 7.5;
  resolveWalls(u);
}
function updateHealthShrines(dt) {
  if (!state?.shrines) return;
  for (const sh of state.shrines) {
    if (!sh.active) {
      sh.respawn = Math.max(0, sh.respawn - dt);
      if (sh.respawn <= 0) sh.active = true;
    }
  }
  const p = state.player;
  if (!p?.alive) return;
  for (const sh of state.shrines) {
    if (sh.active && p.hp < p.maxHp && Math.hypot(p.x - sh.x, p.z - sh.z) < 1.45) {
      p.hp = p.maxHp;
      p.shield = 0;
      sh.active = false;
      sh.respawn = 45;
      fx('holyBurst', sh.x, 0.55, sh.z, [0.25, 1, 0.42], 1.25, 1.35);
      addFloat(p, 'FULL HP', '#8dff9d');
      updateUI();
      break;
    }
  }
}
