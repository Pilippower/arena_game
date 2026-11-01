'use strict';
// Pas de simulation (120 Hz) et état visuel.
function update(dt) {
  if (!state) return;
  if (state.loading) return; // écran de chargement : chrono, IA et déplacements arrêtés (src/core/loading.js)
  if (window.NET?.role === 'guest') return netGuestUpdate(dt); // en ligne : l'invité suit l'hôte (src/net/online.js)
  if (state.splash > 0) state.splash -= dt;
  if (state.ended) {
    if (window.NET?.role === 'host') netHostUpdate(dt); // l'invité doit voir la fin de manche
    // fin de manche : plus de mouvement ni d'interpolation résiduelle entre les deux dernières positions
    // (le personnage tremblait sur place) ; les vainqueurs fêtent la victoire (heroes3d.js, « cheer »)
    for (const u of state.units) {
      u.prevX = u.x;
      u.prevY = u.y || 0;
      u.prevZ = u.z;
      u.prevYaw = u.yaw;
      u.moving = false;
      u.cast = null;
      u.mobility = null;
    }
    updateVisualState(dt);
    return;
  }
  for (const u of state.units) {
    u.prevX = u.x;
    u.prevY = u.y || 0;
    u.prevZ = u.z;
    u.prevYaw = u.yaw;
  }
  state.t = Math.max(0, state.t - dt);
  state.elapsed = (state.elapsed || 0) + dt;
  state.dampening = clamp(((state.elapsed - 35) / 90) * 0.45, 0, 0.45);
  playerMove(dt);
  if (window.NET?.role === 'host') netHostUpdate(dt);
  for (const u of state.units) {
    for (const cs of u.cdSets ? Object.values(u.cdSets) : [u.cd])
      for (let i = 0; i < cs.length; i++) cs[i] = Math.max(0, cs[i] - dt);
    u.gcd = Math.max(0, u.gcd - dt);
    u.trinket = Math.max(0, u.trinket - dt);
    u.stun = Math.max(0, u.stun - dt);
    u.spellImmune = Math.max(0, (u.spellImmune || 0) - dt);
    u.poly = Math.max(0, (u.poly || 0) - dt);
    if (u.poly <= 0) u.polyOwner = null;
    u.root = Math.max(0, u.root - dt);
    u.silence = Math.max(0, u.silence - dt);
    u.fear = Math.max(0, (u.fear || 0) - dt);
    if (u.fear <= 0) u.fearOwner = null;
    u.rootMin = Math.max(0, (u.rootMin || 0) - dt);
    if (u.root <= 0) {
      u.rootBreakDamage = 0;
      u.rootMin = 0;
      u.rootKind = null;
    }
    u.burst = Math.max(0, u.burst - dt);
    u.speedBuff = Math.max(0, u.speedBuff - dt);
    u.slow = Math.max(0, (u.slow || 0) - dt);
    if (u.slow <= 0) u.slowPct = 0;
    u.flash = Math.max(0, u.flash - dt);
    u.action = Math.max(0, u.action - dt);
    u.antiheal = Math.max(0, u.antiheal - dt * 0.025);
    u.res = clamp(u.res + CLASS[u.cls].regen * dt, 0, 100);
    updateMobility(u, dt);
    updateFearMovement(u, dt);
    updatePolyWander(u, dt);
    autoAttack(u, dt);
    // sol variable (pont, rampes) : on suit la surface, ou on tombe si elle disparaît sous les pieds
    const ground = groundAt(u);
    if (u.grounded) {
      if ((u.y || 0) > ground + 0.05) {
        u.grounded = false;
        u.vy = 0;
      } else u.y = ground;
    }
    if (!u.grounded) {
      u.vy -= 19 * dt;
      u.y += u.vy * dt;
      if (u.y <= ground) {
        u.y = ground;
        u.vy = 0;
        u.grounded = true;
        fx('ring', u.x, 0.04, u.z, [0.65, 0.58, 0.45], 0.35, 0.5);
      }
    }
    for (const k in u.drT) {
      u.drT[k] -= dt;
      if (u.drT[k] <= 0) {
        u.dr[k] = 1;
        u.drT[k] = 0;
      }
    }
    if (u.cast && now() >= u.cast.end) {
      const ca = u.cast;
      SPELL_NOW = ca.name;
      if (!(ca.target?.alive && los(u, ca.target))) {
        refundCast(u, ca);
        unitError(u, ca.target?.alive ? 'Target not in line of sight' : 'Invalid target');
      } else {
        if (ca.type === 'damage') {
          const proj = u.cls === 'warlock' ? 'shadowProjectile' : 'arcaneProjectile';
          fx(proj, u.x, (u.y || 0) + 1.55, u.z, CLASS[u.cls].accent, 0.48, 0.24, [
            ca.target.x,
            (ca.target.y || 0) + 1.2,
            ca.target.z
          ]);
          u.curSchool = CLASS[u.cls].skills[ca.i]?.s || 'magic';
          damage(u, ca.target, ca.value);
          spellImpactSfx(u, 'damage');
        } else if (ca.type === 'poly') {
          for (const e of state.units) if (e !== ca.target && e.poly > 0 && e.polyOwner === u.id) endPoly(e, false);
          if (control(ca.target, 'poly', ca.value, u) && (ca.target.polyKind = 'sheep'))
            fx('blinkBurst', ca.target.x, (ca.target.y || 0) + 0.8, ca.target.z, [0.95, 0.85, 1], 0.7, 0.8);
          spellImpactSfx(u, 'fear');
        } else if (ca.type === 'fear') {
          for (const e of state.units)
            if (e !== ca.target && e.fear > 0 && e.fearOwner === u.id) {
              e.fear = 0;
              e.fearOwner = null;
            }
          control(ca.target, 'fear', ca.value, u);
          fx('fear', ca.target.x, (ca.target.y || 0) + 1.15, ca.target.z, CLASS[u.cls].accent, 1.0, 1.05);
          spellImpactSfx(u, 'fear');
        } else {
          fx('healBeam', u.x, (u.y || 0) + 1.45, u.z, CLASS[u.cls].accent, 0.34, 0.16, [
            ca.target.x,
            (ca.target.y || 0) + 1.25,
            ca.target.z
          ]);
          heal(u, ca.target, ca.value);
          spellImpactSfx(u, 'heal');
        }
      }
      u.cast = null;
    }
    if ((u === state.player || u.remote) && u.queuedSkill) {
      const q = u.queuedSkill;
      if (now() > q.until) u.queuedSkill = null;
      else if (u.gcd <= 0 && u.cd[q.i] <= 0 && !u.cast && u.stun <= 0) {
        u.queuedSkill = null;
        useSkill(u, q.i);
      }
    }
    if (u.ai) ai(u, dt);
  }
  updateHealthShrines(dt);
  updateVisualState(dt);
  const aliveA = state.units.some(u => u.team === 0 && u.alive),
    aliveB = state.units.some(u => u.team === 1 && u.alive);
  if (!aliveA || !aliveB || state.t <= 0) {
    const ah = state.units.filter(u => u.team === 0).reduce((s, u) => s + u.hp / u.maxHp, 0),
      bh = state.units.filter(u => u.team === 1).reduce((s, u) => s + u.hp / u.maxHp, 0),
      win = (aliveA && !aliveB) || (state.t <= 0 && ah > bh);
    endRound(win);
  }
  state.uiTick -= dt;
  if (state.uiTick <= 0) {
    state.uiTick = 0.08;
    updateUI();
  }
}
function updateVisualState(dt) {
  for (const f of state.fx) {
    f.life -= dt;
  }
  state.fx = state.fx.filter(f => f.life > 0);
  for (const f of state.floaters) {
    f.life -= dt;
    f.y += dt * 0.6;
  }
  state.floaters = state.floaters.filter(f => f.life > 0);
}
