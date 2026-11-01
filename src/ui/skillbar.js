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
  const T = {
    'Mortal Strike': `Frappe violente : ${D(175)} dégâts (18 % de critique). Réduit les soins reçus par la cible de 25 % (cumul max 50 %, se dissipe lentement).`,
    Hamstring: `${D(45)} dégâts et ralentit la cible de 50 % pendant 15 s.`,
    Pummel: `Coup qui interrompt l'incantation de la cible et bloque cette école de magie pendant 4 s.`,
    'Shield Wall': `Vous gagne un bouclier absorbant ${'<b class="tHeal">390</b>'} dégâts.`,
    Charge: `Fonce sur un ennemi entre 2,8 et 15 m : ${D(55)} dégâts et l'étourdit 2 s.`,
    'Arcane Bolt': `Incantation 1,35 s : projectile arcanique infligeant ${D(205)} dégâts.`,
    'Frost Nova': `Gèle les ennemis à moins de 8 m : ${D(90)} dégâts à la cible, ${D(60)} aux autres, immobilisés 2,5 s (brisé après 12 % des PV en dégâts).`,
    Counterspell: `Interrompt l'incantation de la cible et bloque cette école de magie 4 s.`,
    'Arcane Power': `Augmente vos dégâts de 35 % pendant 8 s.`,
    Blink: `Téléportation de 7 m droit devant ; libère des racines.`,
    Polymorph: `Incantation 1,5 s : transforme la cible en mouton pendant 8 s (puis 4 s, 2 s, immunité ; remis à zéro après 20 s). Le moindre dégât rompt l'effet.`,
    'Flash Heal': `Incantation 1,15 s : rend ${H(220)} points de vie à la cible amie (ou à vous).`,
    'Power Shield': `Bouclier sur la cible amie absorbant ${'<b class="tHeal">300</b>'} dégâts.`,
    Silence: `Réduit la cible au silence pendant 2,8 s.`,
    'Divine Hymn': `Rend ${H(230)} points de vie à tous vos alliés.`,
    'Angelic Step': `Bond de 4,2 m vers l'avant ; libère des racines.`,
    Obliterate: `Frappe runique : ${D(190)} dégâts (16 % de critique), réduit les soins reçus de 16 % (max 50 %).`,
    'Death Grip': `Attrape un ennemi à 15 m et le tire devant vous : ${D(50)} dégâts.`,
    Asphyxiate: `À distance : ${D(65)} dégâts et étourdit 2,5 s.`,
    'Pillar of Frost': `+35 % de dégâts et +18 % de vitesse pendant 7 s.`,
    'Death Advance': `Bond de 6 m dans la direction regardée, puis +18 % de vitesse 3 s.`,
    Wrath: `Incantation 1,5 s : ${D(175)} dégâts de nature.`,
    'Entangling Roots': `Des racines enserrent la cible : immobilisée 5 s.`,
    Barkskin: `Bouclier d'écorce absorbant ${'<b class="tHeal">420</b>'} dégâts.`,
    Starfall: `Pluie d'étoiles : ${D(135)} dégâts à tous les ennemis à moins de 5,3 m.`,
    'Cat Form': `Forme de félin : +30 % de vitesse, attaques rapides au corps à corps (${D(42)} toutes les 1 s).`,
    'Bear Form': `Forme d'ours : +40 % de points de vie, -30 % de dégâts subis, coups puissants (${D(58)} toutes les 2 s).`,
    'Human Form': `Reprend votre forme normale.`,
    Shred: `Lacère la cible : ${D(150)} dégâts (18 % de critique).`,
    Rake: `Griffure : ${D(80)} dégâts et ralentit de 30 % pendant 6 s.`,
    Maim: `${D(60)} dégâts et étourdit la cible 4 s.`,
    'Wild Charge': `Bondit sur un ennemi entre 2,8 et 15 m : ${D(55)} dégâts et l'immobilise 2 s.`,
    Maul: `Coup de patte : ${D(120)} dégâts (18 % de critique).`,
    Swipe: `Balayage : ${D(85)} dégâts à tous les ennemis à moins de 5 m.`,
    'Frenzied Regeneration': `Rend ${H(380)} points de vie.`,
    Backstab: `${D(150)} dégâts (22 % de critique).`,
    Cloak: `Absorbe ${'<b class="tHeal">220</b>'} dégâts, +18 % de vitesse 5 s, libère des racines, ralentissements et silences.`,
    'Kidney Shot': `${D(55)} dégâts et étourdit 3 s.`,
    Vendetta: `+35 % de dégâts pendant 6,5 s.`,
    Shadowstep: `Surgit jusqu'à 8 m devant la cible ; ${D(55)} dégâts si vous arrivez au contact.`,
    Stealth: `Vous camoufle (hors combat) : quasi invisible et impossible à cibler, -30 % de vitesse. Débloque Ambush et Sap.`,
    Ambush: `Depuis le camouflage : ${D(330)} dégâts (30 % de critique). Rompt le camouflage.`,
    Sap: `Depuis le camouflage, à 5 m : assomme la cible 8 s (mêmes rendements décroissants que la Métamorphose). Le moindre dégât rompt l'effet.`,
    'Shadow Bolt': `Incantation 1,45 s : ${D(195)} dégâts d'ombre.`,
    Fear: `Incantation 1,35 s : la cible fuit, terrorisée, pendant 3,6 s (un gros coup la libère).`,
    'Spell Lock': `Interrompt l'incantation de la cible et bloque cette école de magie 4 s.`,
    'Dark Soul': `+35 % de dégâts pendant 8 s et bouclier de ${'<b class="tHeal">180</b>'}.`,
    'Demonic Gate': `Téléportation de 5 m vers l'avant.`
  };
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
  const castT = {
    'Arcane Bolt': 1.35,
    Polymorph: 1.5,
    'Flash Heal': 1.15,
    Wrath: 1.5,
    'Shadow Bolt': 1.45,
    Fear: 1.35
  }[S.n];
  return `<div class="tName">${S.n}</div><div class="tRow"><span>${S.c ? `${S.c} ${C.res}` : 'Gratuit'}</span><span>${range}</span></div>
  <div class="tRow"><span>${castT ? `Incantation ${fmtS(castT)}` : 'Instantané'}</span><span>${S.cd ? `Recharge ${fmtS(S.cd)}` : 'Pas de recharge'}</span></div>
  <div class="tDesc">${T[S.n] || ''}</div>${burst > 1 ? '<div class="tNote">Burst actif : dégâts +35 % inclus</div>' : ''}${dmp < 1 ? `<div class="tNote">Dampening : soins -${Math.round((1 - dmp) * 100)} % inclus</div>` : ''}`;
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
