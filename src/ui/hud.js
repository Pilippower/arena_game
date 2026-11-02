'use strict';
// Interface de combat : cadres, portraits, barres d'incantation.
// ---------- UI ----------
function showSplash(t) {
  $('roundSplash').textContent = t;
  $('roundSplash').style.opacity = '1';
  setTimeout(() => ($('roundSplash').style.opacity = '0'), 900);
}
function drText(u) {
  const a = [];
  if (u.poly > 0) a.push(`${u.polyKind === 'sap' ? 'Sapped' : 'Sheep'} ${u.poly.toFixed(1)}`);
  if (u.stealth) a.push('Stealthed');
  if (u.spellImmune > 0) a.push(`Cloak ${u.spellImmune.toFixed(1)}`);
  if (u.form) a.push(u.form === 'cat' ? 'Cat' : 'Bear');
  if (u.stun > 0) a.push(`Stun ${u.stun.toFixed(1)}`);
  if (u.root > 0) a.push(`Root ${u.root.toFixed(1)}`);
  if (u.silence > 0) a.push(`Sil ${u.silence.toFixed(1)}`);
  if (u.fear > 0) a.push(`Fear ${u.fear.toFixed(1)}`);
  if (u.slow > 0) a.push(`Slow ${Math.round((u.slowPct || 0) * 100)}% ${u.slow.toFixed(1)}`);
  return a.join(' · ');
}
// Auras au-dessus des personnages (barre de nom) : buffs à gauche de la barre de vie, débuffs à droite ;
// icône du sort, temps restant (ou absorption restante d'un bouclier).
// Lus dans l'état de l'unité, seule source de vérité : rien à tenir à jour dans le combat.
const BURST_SPELL = { reaver: 'Pillar of Frost', shade: 'Vendetta' };
function buffList(u) {
  const b = [];
  if (u.burst > 0 && BURST_SPELL[u.cls]) b.push({ n: BURST_SPELL[u.cls], t: u.burst });
  if (u.spellImmune > 0) b.push({ n: 'Cloak', t: u.spellImmune });
  if (u.shield > 0) {
    const n = u.shieldName || 'Power Shield',
      same = b.find(x => x.n === n);
    if (same) same.v = Math.ceil(u.shield);
    else b.push({ n, v: Math.ceil(u.shield) });
  }
  for (const a of u.auras || []) if (a.kind === 'hot') b.push({ n: a.n, t: a.rem });
  if (u.stealth) b.push({ n: 'Stealth' });
  if (u.form) b.push({ n: u.form === 'cat' ? 'Cat Form' : 'Bear Form' });
  return b;
}
// Débuffs : effets posés par les adversaires, avec le sort qui les a posés (debuffSpell, noté par le combat).
const DEBUFF_KEYS = ['poly', 'stun', 'fear', 'silence', 'root', 'slow'];
function debuffList(u) {
  const src = u.debuffSpell || {},
    b = [];
  for (const k of DEBUFF_KEYS) if (u[k] > 0 && src[k]) b.push({ n: src[k], t: u[k] });
  if (u.lockout?.until > now() && src.lockout) b.push({ n: src.lockout, t: u.lockout.until - now() });
  if (u.antiheal > 0.01 && src.antiheal) b.push({ n: src.antiheal, t: u.antiheal / 0.025 });
  for (const a of u.auras || []) if (a.kind !== 'hot') b.push({ n: a.n, t: a.rem });
  return b;
}
function buffsHTML(u) {
  return aurasHTML(u.alive ? buffList(u) : [], 'buffs');
}
// Icône d'aura : l'image du sort si elle existe (SPELL_ART), sinon son icône vectorielle, comme sur la barre de sorts
// (bug : une image absente, ex. Pain, donnait un carré noir et blanc qui clignotait à chaque mise à jour).
function auraIcon(n) {
  const art = spellArt(n);
  if (SPELL_ART.has(art)) return `<img src="assets/ui/spells/${art}.webp" alt="">`;
  for (const c in CLASS) {
    const S = [CLASS[c].skills, ...Object.values(CLASS[c].bars || {})].flat().find(s => s.n === n);
    if (S) return skillIconSVG(c, 0, S);
  }
  return '';
}
function aurasHTML(b, cls) {
  if (!b.length) return '';
  const time = t => (t < 3 ? t.toFixed(1) : Math.ceil(t) + 's');
  return `<div class="${cls}">${b
    .map(
      x =>
        `<span class="buff" title="${x.n}">${auraIcon(x.n)}${x.t != null ? `<b>${time(x.t)}</b>` : ''}${x.v != null ? `<i>${x.v}</i>` : ''}</span>`
    )
    .join('')}</div>`;
}
// Portrait : rendu 3D du visage (hfMakePortraits) ou, en attendant, l'icône de classe.
function portraitHTML(u) {
  const r = HF.records?.get(u.id);
  return `<div class="portrait">${r?.portrait ? `<img src="${r.portrait}" alt="">` : skillIconSVG(u.cls, 0)}${u.poly > 0 ? '<div class="cc">🐑</div>' : u.stun > 0 ? '<div class="cc">🌀</div>' : u.fear > 0 ? '<div class="cc">👁</div>' : ''}</div>`;
}
function unitRowHTML(u, enemy) {
  const p = state.player,
    C = CLASS[u.cls],
    hp = (100 * u.hp) / u.maxHp,
    col = enemy ? '#e65360' : hp > 50 ? '#3fcf6a' : hp > 25 ? '#e6c13f' : '#e65360';
  return `<div class="unitRow${enemy ? ' foe' : ''}${u === p.target ? ' sel' : ''}${u.alive ? '' : ' dead'}" data-uid="${state.units.indexOf(u)}">${portraitHTML(u)}${badgeHTML(u)}<div class="unitInfo"><div class="nm">${u === p ? 'You' : u.name}<span>${C.name}</span></div>
  <div class="hpb"><div style="width:${hp.toFixed(1)}%;background:${col}"></div></div><div class="rsb"><div style="width:${u.res}%"></div></div>${castBarHTML(u)}<div class="dr">${drText(u)}</div></div></div>`;
}
function castBarHTML(u) {
  const c = u.cast;
  if (!c) return '';
  // largeur remplie à chaque image par hudCastFrame (pas ici : l'interface n'est reconstruite que 12 fois/s)
  return `<div class="castBar"><span class="cbIcon">${skillIconSVG(u.cls, c.i ?? 0)}</span><div class="cbTrack"><div class="cbFill" data-u="${u.id}" style="width:${(castProgress(u) * 100).toFixed(1)}%"></div><span class="cbName">${c.name}</span></div></div>`;
}
// Emblème de la classe (médaillon des cadres de l'interface PC, src/ui/hud.css)
function badgeHTML(u) {
  return `<div class="badge"><img src="assets/ui/class_${u.cls}.png" alt=""></div>`;
}
// Cadre du joueur / de la cible. Portrait et emblème ne s'affichent que dans l'interface PC (hud.css).
function frameHTML(u, enemy = false) {
  const C = CLASS[u.cls];
  return `${portraitHTML(u)}${badgeHTML(u)}<div class="nameRow"><b>${u.name}</b><span>${Math.ceil(u.hp)} HP</span></div><div class="tiny fClass">${RACE[u.race]?.name || ''} ${C.name} · ${C.role} · ${ARMOR[C.armor]?.label || ''}</div><div class="bar fHp"><div class="fill ${enemy ? 'enemy' : ''}" style="width:${(100 * u.hp) / u.maxHp}%"></div></div><div class="bar resource fRes"><div class="fill" style="width:${u.res}%"></div></div><div class="tiny fInfo">${C.res} ${Math.round(u.res)}/100${u.shield > 0 ? ` · Shield ${Math.ceil(u.shield)}` : ''}</div>`;
}
function setHTML(el) {
  if (el._html !== el._shown) {
    el.innerHTML = el._html;
    el._shown = el._html;
  }
}
function updateUI() {
  if (!state) return;
  const p = state.player,
    t = p.target;
  $('timer').textContent =
    `${String(Math.floor(state.t / 60)).padStart(2, '0')}:${String(Math.floor(state.t % 60)).padStart(2, '0')}`;
  $('score').textContent = `${state.scoreA} - ${state.scoreB}`;
  $('round').textContent = `Round ${state.round} / ${MATCH_ROUNDS}`;
  $('selfFrame')._html = frameHTML(p, false);
  $('targetFrame')._html = t
    ? frameHTML(t, true) +
      `<div class="tiny fLos">${los(p, t) ? '✓ In line of sight' : '⚠ Line of sight blocked'}</div>${castBarHTML(t)}`
    : '<b>No target</b>';
  $('targetFrame').classList.toggle('noTarget', !t);
  $('arenaFrames')._html = state.units
    .filter(u => u.team !== p.team)
    .map(u => unitRowHTML(u, true))
    .join('');
  $('partyFrames')._html = state.units
    .filter(u => u.team === p.team)
    .map(u => unitRowHTML(u, false))
    .join('');
  $('status')._html =
    `${p.poly > 0 ? '🐑 Sheep ' : ''}${p.stun > 0 ? '🌀 Stunned ' : ''}${p.root > 0 ? '⛓ Rooted ' : ''}${p.silence > 0 ? '⛔ Silence ' : ''}${p.fear > 0 ? '👁 Fear ' : ''}${p.slow > 0 ? `❄ Slowed ${Math.round((p.slowPct || 0) * 100)}% ` : ''}${p.burst > 0 ? '🔥 Burst ' : ''}${p.trinket > 0 ? `· Trinket ${Math.ceil(p.trinket)}s` : ''}${state.dampening > 0 ? `<br>⚔ Dampening ${Math.round(state.dampening * 100)}%` : ''}`;
  for (const id of ['selfFrame', 'targetFrame', 'arenaFrames', 'partyFrames', 'status']) setHTML($(id));
  renderSkillBar(p);
  hudCastFrame();
}
// Barre de sorts : boutons construits une seule fois par barre (classe, forme, ordre, touches) ; ensuite seuls
// recharges et états changent. Reconstruits 12 fois/s, un clic tombait entre deux boutons (sort non lancé) et le
// survol repartait à chaque fois (icône qui tremble).
function renderSkillBar(p) {
  const box = $('skills'),
    bar = skillsOf(p),
    order = slotOrder(p),
    key = [p.cls, barKey(p), order, PREFS.keybinds.skills, PREFS.keybinds.trinket].join('|');
  if (box._key !== key) {
    box._key = key;
    box.classList.toggle('six', bar.length > 5);
    box.innerHTML =
      order
        .map((i, slot) => {
          const s = bar[i];
          return `<button class="skill" data-i="${i}" data-slot="${slot}"><span class="icon">${skillIconSVG(p.cls, i, s)}</span><span class="cdw"></span><span class="skillName">${s.n}</span><span class="cost">${s.c || ''}</span><span class="key">${keyLabel(PREFS.keybinds.skills[slot], true)}</span></button>`;
        })
        .join('') +
      `<button class="skill trinket" id="trinketBtn" title="Trinket PvP"><span class="icon">${trinketIconSVG()}</span><span class="skillName">Trinket</span><span class="key">${keyLabel(PREFS.keybinds.trinket, true)}</span><span class="cdw"></span></button>`;
    box.querySelectorAll('.skill[data-i]').forEach(b => {
      b.onclick = () => {
        if (!MOBILE.enabled) tryPlayerSkill(+b.dataset.i);
      };
      b.onpointerdown = e => {
        if (MOBILE.enabled) {
          e.preventDefault();
          tryPlayerSkill(+b.dataset.i);
        }
      };
    });
    $('trinketBtn').onclick = () => {
      if (!MOBILE.enabled) useTrinket(state.player);
    };
    // pas de focus clavier sur un bouton cliqué (sinon Espace, le saut, relancerait le sort)
    for (const b of box.children) b.onmousedown = e => e.preventDefault();
    $('trinketBtn').onpointerdown = e => {
      if (MOBILE.enabled) {
        e.preventDefault();
        useTrinket(state.player);
      }
    };
  }
  for (const b of box.children) {
    let cd;
    if (b.dataset.i != null) {
      const i = +b.dataset.i;
      b.classList.toggle('queued', p.queuedSkill?.i === i);
      b.classList.toggle('pressed', p.pressed?.i === i && now() - p.pressed.t < 0.18);
      b.classList.toggle('dragFrom', SKILL_DRAG.from === +b.dataset.slot);
      cd = cooldownHTML(p, i, bar[i]);
    } else cd = p.trinket > 0 ? sweepHTML(p.trinket / 90, p.trinket) : '';
    const w = b.querySelector('.cdw');
    if (w._h !== cd) w.innerHTML = w._h = cd;
  }
}
// incantation : la barre se remplit ; canalisation (Drain Life) : elle part pleine et se vide
const castProgress = u => {
  if (!u.cast) return 0;
  const left = clamp((u.cast.end - now()) / u.cast.dur, 0, 1);
  return u.cast.channel ? left : 1 - left;
};
// Barres d'incantation (la sienne, cible, cadres d'arène) : progression mise à jour à chaque image, sans à-coups.
function hudCastFrame() {
  const p = state?.player;
  if (!p) return;
  const cb = $('castBar');
  if (p.cast) {
    if (cb.style.display !== 'block') cb.style.display = 'block';
    cb.querySelector('.castFill').style.width = `${(castProgress(p) * 100).toFixed(2)}%`;
    const tx = cb.querySelector('.castText');
    if (tx.textContent !== p.cast.name) tx.textContent = p.cast.name;
  } else if (cb.style.display !== 'none') cb.style.display = 'none';
  for (const e of document.querySelectorAll('.cbFill[data-u]')) {
    const u = state.units.find(v => String(v.id) === e.dataset.u);
    if (u?.cast) e.style.width = `${(castProgress(u) * 100).toFixed(2)}%`;
  }
}

// Balayage circulaire de recharge (style MMO) : la partie sombre diminue en tournant ; chiffre si recharge longue.
function sweepHTML(frac, remain) {
  const pct = (clamp(frac, 0, 1) * 100).toFixed(1);
  return `<span class="sweep" style="--p:${pct}%"></span>${remain > 1.5 ? `<span class="cd">${remain < 10 ? remain.toFixed(1) : remain.toFixed(0)}</span>` : ''}`;
}
// Recharge propre au sort, sinon GCD (tous les sorts qui y sont soumis tournent ensemble).
function cooldownHTML(p, i, S) {
  if (p.cd[i] > 0) return sweepHTML(p.cd[i] / Math.max(S.cd || 0, p.cd[i] > (S.cd || 0) ? 4 : 0.01, 0.01), p.cd[i]);
  if (p.gcd > 0) return sweepHTML(p.gcd / (p.gcdMax || 1), 0);
  return '';
}
