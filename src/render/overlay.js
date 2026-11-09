'use strict';
// Couche HTML au-dessus du monde : noms et barres des personnages (nameplates), chiffres flottants.
function projectScreen(x, y, z) {
  if (!viewProj) return null;
  const q = tf(viewProj, [x, y, z, 1]);
  if (q[3] <= 0.01) return null;
  const nx = q[0] / q[3],
    ny = q[1] / q[3];
  return { x: (nx * 0.5 + 0.5) * canvas.clientWidth, y: (1 - (ny * 0.5 + 0.5)) * canvas.clientHeight, z: q[2] / q[3] };
}
// Noms et chiffres flottants : éléments réutilisés et déplacés par transform (pas de reconstruction HTML à chaque image).
const OVERLAY = { plates: new Map(), floaters: [] };
function renderOverlayWorld() {
  if (!state) return;
  const np = $('nameplates'),
    W = canvas.clientWidth,
    H = canvas.clientHeight,
    seen = new Set();
  for (const u of state.units) {
    let e = OVERLAY.plates.get(u);
    if (!e) {
      e = document.createElement('div');
      e.className = 'nameplate';
      e.innerHTML =
        '<div class="npName"></div><div class="npBar"><div class="npFill"></div><div class="shieldSpan"></div></div><div class="npCast"><span class="npIcon"></span><div class="npTrack"><div></div><span></span><b></b></div></div><div class="npAuras"></div>';
      e.style.left = e.style.top = '0';
      np.appendChild(e);
      e._name = e.firstChild;
      e._fill = e.children[1].firstChild;
      e._shield = e.children[1].lastChild;
      e._cast = e.children[2];
      e._castIcon = e._cast.firstChild;
      e._castFill = e._cast.lastChild.firstChild;
      e._castName = e._cast.lastChild.children[1];
      e._castTime = e._cast.lastChild.children[2];
      e._auras = e.children[3];
      e._k = {};
      OVERLAY.plates.set(u, e);
    }
    seen.add(u);
    const p =
        u.alive && !(u.stealth && u.team !== state.player.team) && !pvePlateHidden(u)
          ? projectScreen(u.rx ?? u.x, (u.ry ?? u.y ?? 0) + 2.65, u.rz ?? u.z)
          : null,
      vis = !!p && p.x > -60 && p.x < W + 60 && p.y > -30 && p.y < H + 30;
    if (e._k.vis !== vis) {
      e.style.display = vis ? '' : 'none';
      e._k.vis = vis;
    }
    if (!vis) continue;
    e.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-100%)`;
    if (e._k.name !== u.name) {
      e._name.textContent = u.name;
      e._k.name = u.name;
    }
    const w = ((100 * u.hp) / u.maxHp).toFixed(1);
    if (e._k.w !== w) {
      e._fill.style.width = w + '%';
      e._k.w = w;
    }
    // bouclier d'absorption : portion hachurée qui prolonge la vie (shieldSpan, src/ui/hud.js)
    const S = u.alive ? shieldSpan(u.hp, u.maxHp, u.shield) : null,
      sk = S ? `${S.left.toFixed(1)},${S.width.toFixed(1)},${S.over}` : '';
    if (e._k.sh !== sk) {
      e._shield.style.display = S ? '' : 'none';
      if (S) {
        e._shield.style.left = S.left.toFixed(1) + '%';
        e._shield.style.width = S.width.toFixed(1) + '%';
        e._shield.classList.toggle('over', S.over);
      }
      e._k.sh = sk;
    }
    const c = u.team === state.player.team ? '#58c3ff' : '#ff6976';
    if (e._k.c !== c) {
      e._fill.style.background = c;
      e._k.c = c;
    }
    // ennemi : barre d'incantation plus grande et plus visible (pour interrompre au bon moment)
    const foe = u.team !== state.player.team;
    if (e._k.foe !== foe) {
      e.classList.toggle('enemy', foe);
      e._k.foe = foe;
    }
    const t = u === state.player.target;
    if (e._k.t !== t) {
      e.classList.toggle('target', t);
      e._k.t = t;
    }
    const cs = !!u.cast;
    if (e._k.cs !== cs) {
      e._cast.style.display = cs ? 'flex' : 'none';
      e._k.cs = cs;
    }
    if (cs) {
      const ck = u.cls + ':' + u.cast.i;
      if (e._k.ck !== ck) {
        e._castIcon.innerHTML = skillIconSVG(u.cls, u.cast.i ?? 0);
        e._castName.textContent = u.cast.name;
        e._k.ck = ck;
      }
    }
    // buffs à gauche de la barre de vie, débuffs à droite (src/ui/hud.js)
    const au = buffsHTML(u) + aurasHTML(debuffList(u), 'buffs debuffs');
    if (e._k.au !== au) e._auras.innerHTML = e._k.au = au;
    if (cs) {
      const left = Math.max(0, u.cast.end - now());
      e._castFill.style.width = (castProgress(u) * 100).toFixed(1) + '%'; // canalisation : se vide
      const lt = left.toFixed(1);
      if (e._k.lt !== lt) {
        e._castTime.textContent = lt;
        e._k.lt = lt;
      }
    }
  }
  for (const [u, e] of OVERLAY.plates)
    if (!seen.has(u)) {
      e.remove();
      OVERLAY.plates.delete(u);
    }
  const fl = $('floaters'),
    pool = OVERLAY.floaters;
  let n = 0;
  for (const f of state.floaters) {
    const p = projectScreen(f.x + f.off, f.y, f.z);
    if (!p) continue;
    let e = pool[n];
    if (!e) {
      e = document.createElement('div');
      e.className = 'floater';
      e.style.left = e.style.top = '0';
      fl.appendChild(e);
      e._k = {};
      pool.push(e);
    }
    n++;
    if (e._k.vis !== true) {
      e.style.display = '';
      e._k.vis = true;
    }
    // critique : le chiffre apparaît gonflé puis se pose (0,15 s)
    const age = f.max - f.life,
      pop = f.big ? 1 + Math.max(0, 0.15 - age) * 4 : 1;
    e.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%) scale(${pop.toFixed(2)})`;
    if (e._k.big !== f.big) {
      e.classList.toggle('big', !!f.big);
      e._k.big = f.big;
    }
    e.style.opacity = clamp(f.life / f.max, 0, 1).toFixed(2);
    if (e._k.text !== f.text) {
      e.textContent = f.text;
      e._k.text = f.text;
    }
    if (e._k.color !== f.color) {
      e.style.color = f.color;
      e._k.color = f.color;
    }
  }
  for (let i = n; i < pool.length; i++)
    if (pool[i]._k.vis !== false) {
      pool[i].style.display = 'none';
      pool[i]._k.vis = false;
    }
}
