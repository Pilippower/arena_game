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
  return `<div class="unitRow${u === p.target ? ' sel' : ''}${u.alive ? '' : ' dead'}" data-uid="${state.units.indexOf(u)}">${portraitHTML(u)}<div class="unitInfo"><div class="nm">${u === p ? 'You' : u.name}<span>${C.name}</span></div>
  <div class="hpb"><div style="width:${hp.toFixed(1)}%;background:${col}"></div></div><div class="rsb"><div style="width:${u.res}%"></div></div>${castBarHTML(u)}<div class="dr">${drText(u)}</div></div></div>`;
}
function castBarHTML(u) {
  const c = u.cast;
  if (!c) return '';
  const k = clamp(1 - (c.end - now()) / c.dur, 0, 1);
  return `<div class="castBar"><span class="cbIcon">${skillIconSVG(u.cls, c.i ?? 0)}</span><div class="cbTrack"><div class="cbFill" style="width:${(k * 100).toFixed(0)}%"></div><span class="cbName">${c.name}</span></div></div>`;
}
function frameHTML(u, enemy = false) {
  const C = CLASS[u.cls];
  return `<div class="nameRow"><b>${u.name}</b><span>${Math.ceil(u.hp)} HP</span></div><div class="tiny">${RACE[u.race]?.name || ''} ${C.name} · ${C.role} · ${ARMOR[C.armor]?.label || ''}</div><div class="bar"><div class="fill ${enemy ? 'enemy' : ''}" style="width:${(100 * u.hp) / u.maxHp}%"></div></div><div class="bar resource"><div class="fill" style="width:${u.res}%"></div></div><div class="tiny">${C.res} ${Math.round(u.res)}/100${u.shield > 0 ? ` · Bouclier ${Math.ceil(u.shield)}` : ''}</div>`;
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
      `<div class="tiny">${los(p, t) ? '✓ In line of sight' : '⚠ Line of sight blocked'}</div>${castBarHTML(t)}`
    : '<b>No target</b>';
  $('arenaFrames')._html = state.units
    .filter(u => u.team !== p.team)
    .map(u => unitRowHTML(u, true))
    .join('');
  $('partyFrames')._html = state.units
    .filter(u => u.team === p.team)
    .map(u => unitRowHTML(u, false))
    .join('');
  $('status')._html =
    `${CLASS[p.cls].tags.map(x => `<span class="tag">${x}</span>`).join('')}<br>${p.poly > 0 ? '🐑 Sheep ' : ''}${p.stun > 0 ? '🌀 Stunned ' : ''}${p.root > 0 ? '⛓ Rooted ' : ''}${p.silence > 0 ? '⛔ Silence ' : ''}${p.fear > 0 ? '👁 Fear ' : ''}${p.slow > 0 ? `❄ Slowed ${Math.round((p.slowPct || 0) * 100)}% ` : ''}${p.burst > 0 ? '🔥 Burst ' : ''}${p.trinket > 0 ? `· Trinket ${Math.ceil(p.trinket)}s` : ''}${state.dampening > 0 ? `<br>⚔ Dampening ${Math.round(state.dampening * 100)}%` : ''}`;
  for (const id of ['selfFrame', 'targetFrame', 'arenaFrames', 'partyFrames', 'status']) setHTML($(id));
  const C = CLASS[p.cls],
    bar = skillsOf(p),
    order = slotOrder(p);
  $('skills').classList.toggle('six', bar.length > 5);
  $('skills').innerHTML =
    order
      .map((i, slot) => {
        const s = bar[i];
        return `<button class="skill ${p.gcd > 0 ? 'gcding' : ''} ${p.queuedSkill?.i === i ? 'queued' : ''} ${SKILL_DRAG.from === slot ? 'dragFrom' : ''}" data-i="${i}" data-slot="${slot}"><span class="icon">${skillIconSVG(p.cls, i, s)}</span><span class="skillName">${s.n}</span><span class="cost">${s.c || ''}</span><span class="key">${keyLabel(PREFS.keybinds.skills[slot])}</span>${p.cd[i] > 0 ? `<span class="cd">${p.cd[i] < 10 ? p.cd[i].toFixed(1) : p.cd[i].toFixed(0)}</span>` : ''}</button>`;
      })
      .join('') +
    `<button class="skill trinket" id="trinketBtn" title="Trinket PvP"><span class="icon">${trinketIconSVG()}</span><span class="skillName">Trinket</span><span class="key">${keyLabel(PREFS.keybinds.trinket)}</span>${p.trinket > 0 ? `<span class="cd">${p.trinket.toFixed(0)}</span>` : ''}</button>`;
  document.querySelectorAll('.skill[data-i]').forEach(b => {
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
    if (!MOBILE.enabled) useTrinket(p);
  };
  $('trinketBtn').onpointerdown = e => {
    if (MOBILE.enabled) {
      e.preventDefault();
      useTrinket(p);
    }
  };
  const cb = $('castBar');
  if (p.cast) {
    cb.style.display = 'block';
    const q = clamp(1 - (p.cast.end - now()) / p.cast.dur, 0, 1);
    cb.querySelector('.castFill').style.width = `${q * 100}%`;
    cb.querySelector('.castText').textContent = p.cast.name;
  } else cb.style.display = 'none';
}
