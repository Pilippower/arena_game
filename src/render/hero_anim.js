'use strict';
// Animations des personnages : choix des clips (hfSetAnim), vivant à l'arrêt (hfIdleLife : respiration, regard,
// clignements), instant d'impact des attaques, pas, mains sur l'arme (IK), traînée de lame.
function hfFindClip(rec, names) {
  const clips = rec.clips || [];
  for (const n of names) {
    const x = clips.find(c => c.name.toLowerCase() === n.toLowerCase());
    if (x) return x;
  }
  for (const n of names) {
    const x = clips.find(c => c.name.toLowerCase().includes(n.toLowerCase()));
    if (x) return x;
  }
  return clips[0] || null;
}
function hfSetAnim(rec, u) {
  if (!rec.mixer || !rec.clips?.length || u.poly > 0) return;
  // IA : course « tenue » 0,18 s après l'arrêt (pas de bascule course/repos à chaque pas de son pilotage) ;
  // joueur : arrêt immédiat (05/11/2026, « délai gênant »)
  const t = now();
  if (u.moving) rec.lastMove = t;
  const moving = u.moving || (u !== state?.player && t - (rec.lastMove || 0) < 0.18);
  let key = 'idle',
    names = ['Idle_Loop', 'Idle'];
  if (!u.alive) {
    key = 'death';
    names = ['Death01', 'Death_A', 'Death', 'Die'];
  } else if (state?.ended && state.winTeam === u.team) {
    // joie du vainqueur : arme brandie (pose levée du coup d'épée, animée plus bas)
    key = 'cheer';
    names = ['Sword_Attack', 'Spell_Simple_Shoot'];
  } else if (u.stun > 0) {
    // étourdi : repos, la tête penchée qui tourne doucement est posée par-dessus (hfStunPose) ; Hit_Chest en boucle
    // rejetait la tête en arrière à chaque tour (« il bug »)
    key = 'stun';
    names = ['Idle_Loop', 'Idle'];
  } else if (u.mobility?.type === 'grip') {
    key = 'cc';
    names = ['Hit_Chest', 'Hit_A', 'Hit', 'Idle'];
  } else if (!u.grounded && !u.mobility) {
    key = 'air';
    names = ['Jump_Loop', 'Jump_Idle', 'Jump'];
  } else if (u.fear > 0) {
    key = 'run';
    names = ['Jog_Fwd_Loop', 'Running_A', 'Run', 'Walking_A', 'Walk'];
  } else if (u.action > 0 && u.actionType === 'melee') {
    key = 'attack';
    names = ['Sword_Attack', '1H_Melee_Attack_Chop', 'Unarmed_Melee_Attack_Punch_A', 'Attack'];
    // voleur (deux lames) : frappe alternée main gauche (Punch_Jab) / main droite (Punch_Cross)
    if (u.cls === 'shade' && !u.form) {
      if (rec.animKey !== 'attack') rec.leftHit = !rec.leftHit;
      names = [rec.leftHit ? 'Punch_Jab' : 'Punch_Cross', 'Sword_Attack'];
    }
  } else if (u.cast || (u.action > 0 && u.actionType === 'cast')) {
    key = 'cast';
    names = ['Spell_Simple_Shoot', 'Spellcast_Long', 'Spellcast', 'Cast', 'Interact', 'Spell'];
  } else if (moving && rec.back) {
    key = 'back';
    names = ['Walk_Loop', 'Jog_Fwd_Loop'];
  } else if (moving) {
    key = 'run';
    names = ['Jog_Fwd_Loop', 'Running_A', 'Run', 'Walking_A', 'Walk'];
  }
  // garde de combat : mêlée immobile au contact d'un ennemi (entre deux frappes d'auto-attaque)
  else if (key === 'idle' && inMeleeGuard(u)) {
    key = 'guard';
    names = ['Sword_Idle', 'Idle_Loop'];
  }
  // réception de saut : brève animation d'atterrissage si on ne repart pas en courant
  if (key === 'idle' && rec.animKey === 'air' && hfFindClip(rec, ['Jump_Land'])?.name === 'Jump_Land') {
    key = 'land';
    names = ['Jump_Land'];
    rec.landUntil = t + 0.45;
  }
  if (key === 'idle' && rec.animKey === 'land' && t < rec.landUntil) return;
  if (rec.animKey === key) return;
  const clip = hfFindClip(rec, names);
  if (!clip) return;
  // même clip sous un autre nom (repos → étourdi, repos → garde sans Sword_Idle) : on le laisse jouer ; le relancer
  // depuis le début faisait sauter la pose
  if (rec.action?.getClip() === clip && key !== 'death' && key !== 'land') {
    rec.animKey = key;
    return;
  }
  const next = rec.mixer.clipAction(clip);
  next.reset();
  if (key === 'death' || key === 'land') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.fadeIn(key === 'air' ? 0.08 : key === 'attack' ? 0.05 : key === 'stun' ? 0.3 : 0.1).play();
  next.timeScale = key === 'run' ? 1.12 : key === 'attack' ? 1.08 : key === 'land' ? 1.6 : 1;
  // les dégâts tombent au début de l'action : on démarre le coup juste avant l'impact (lame au contact ≈ 80 ms après)
  const hit = key === 'attack' && ATTACK_HIT[clip.name];
  if (hit) {
    next.time = hit.from;
    next.timeScale = hit.speed * raceStrike(u).speed;
  }
  if (rec.action && rec.action !== next) rec.action.fadeOut(0.1);
  rec.action = next;
  rec.animKey = key;
  rec.footPhase = null;
}
// Pose du pied (talon au sol) dans les clips de course / marche, en fraction du clip : mesurée sur les os
// foot_l / foot_r des modèles (le son du pas tombe exactement quand le pied touche le sol).
const FOOT_CONTACTS = { Jog_Fwd_Loop: [0.01, 0.51], Walk_Loop: [0.46, 0.96], default: [0.01, 0.51] };
// Animation de frappe : instant de départ dans le clip et vitesse, pour que l'impact (vitesse max de la main,
// 0,38 s dans Sword_Attack) coïncide avec les dégâts et les sons au lieu d'arriver 0,35 s plus tard, coupé.
// (impact mesuré sur l'os de la main : Sword_Attack 0,38 s, Punch_Jab 0,22 s, Punch_Cross 0,30 s)
const ATTACK_HIT = {
  Sword_Attack: { from: 0.26, speed: 1.5 },
  Punch_Jab: { from: 0.11, speed: 1.6 },
  Punch_Cross: { from: 0.18, speed: 1.6 }
};
// Partir de la pose animée à chaque image : le mixeur three.js ne réécrit un os que si sa valeur animée a changé ; sur
// une pose immobile, l'os gardait la correction de l'image précédente et la correction repartait de son propre
// résultat (balancier, l'arme tremblait). On mémorise donc la pose animée quand le mixeur l'a écrite et on la restaure
// sinon ; hfKeepOutput note la pose corrigée en fin d'image. store = { anim, out } propre à chaque correction.
function hfFromAnimPose(store, bones) {
  if (!store.anim) {
    store.anim = bones.map(b => b.quaternion.clone());
    store.out = bones.map(() => null);
  }
  bones.forEach((b, i) => {
    if (store.out[i] && b.quaternion.equals(store.out[i])) b.quaternion.copy(store.anim[i]);
    else store.anim[i].copy(b.quaternion);
  });
}
function hfKeepOutput(store, bones) {
  bones.forEach((b, i) => (store.out[i] = (store.out[i] || new THREE.Quaternion()).copy(b.quaternion)));
}
// Frappe propre à chaque race (guerrier, chevalier de la mort, voleur) : surcouche sur le clip de frappe.
//  speed : vitesse du coup ; twist : rotation du buste (élan puis frappe, rad) ; lean : penché vers l'avant à l'impact ;
//  flourish : geste de finition (rotation en plus après l'impact) ; snap : tête qui bascule sur le côté à l'impact ;
//  arc : amplitude de l'arc de l'arme (lame à deux mains du DK, balayage des glaives).
// Elfe = souple, rapide et démonstratif ; nain = ramassé, lent, le poids jeté en avant ; orc = grand élan brutal ;
// mort-vivant = raide, tête qui bascule ; humain = équilibré.
const RACE_STRIKE = {
  human: { speed: 1, twist: 0.3, lean: 0.14, flourish: 0, snap: 0, arc: 1 },
  elf: { speed: 1.18, twist: 0.55, lean: 0.08, flourish: 0.4, snap: 0, arc: 1.2 },
  dwarf: { speed: 0.88, twist: 0.16, lean: 0.3, flourish: 0, snap: 0, arc: 0.82 },
  orc: { speed: 0.95, twist: 0.5, lean: 0.24, flourish: 0.12, snap: 0, arc: 1.12 },
  undead: { speed: 1.05, twist: 0.26, lean: 0.16, flourish: 0, snap: 0.3, arc: 1 }
};
const STRIKE_CLASSES = new Set(['sentinel', 'reaver', 'shade']);
const STRIKE_DUR = 0.62; // durée de la surcouche à vitesse 1 (s)
const raceStrike = u => RACE_STRIKE[u?.race] || RACE_STRIKE.human;
const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
// Courbe d'une frappe (q = 0..1) : élan (rotation en arrière), frappe (vers l'avant jusqu'à l'impact), finition, retour.
// Fonction pure (testée) : angles en radians.
function strikePose(q, P) {
  const wind = smoothstep(0, 0.22, q) * (1 - smoothstep(0.22, 0.4, q)),
    hit = smoothstep(0.22, 0.4, q) * (1 - smoothstep(0.55, 1, q)),
    flour = q > 0.45 && q < 0.9 ? Math.sin((Math.PI * (q - 0.45)) / 0.45) ** 2 : 0; // départ et fin en douceur
  return {
    twist: (hit - 0.8 * wind) * P.twist + flour * P.flourish,
    lean: (hit - 0.3 * wind) * P.lean,
    tilt: hit * P.snap
  };
}
// Tourne un os d'un angle autour d'un axe monde (axe ramené dans le repère du parent, échelles comprises).
function hfRotateLocal(bone, axisWorld, angle) {
  const axis = axisWorld.clone().transformDirection(new THREE.Matrix4().copy(bone.parent.matrixWorld).invert());
  bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
  bone.updateMatrixWorld(true);
}
// Surcouches du buste et de la tête (frappe par race, étourdissement) : une seule mémoire de la pose animée pour ces os
// (deux corrections qui gardaient chacune la leur sur les mêmes os prenaient le résultat de l'autre pour la pose du
// clip et s'accumulaient).
function hfBodyPose(rec, u, dt) {
  const m = rec.model;
  if (!rec.body) {
    const f = n => m.getObjectByName(n),
      spine = ['spine_01', 'spine_02', 'spine_03'].map(f).filter(Boolean),
      neck = f('neck_01'),
      head = f('Head');
    rec.body = spine.length && head ? { spine, neck, head, bones: [...spine, neck, head].filter(Boolean) } : false;
  }
  const B = rec.body;
  if (!B) return;
  hfFromAnimPose(B, B.bones);
  m.updateMatrixWorld(true);
  const mq = m.getWorldQuaternion(new THREE.Quaternion()),
    axes = {
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(mq),
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(mq), // rotation positive = penché vers l'avant
      fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(mq)
    };
  hfRaceStrike(rec, u, B, axes);
  const blink = hfIdleLife(rec, u, dt, B, axes);
  hfStunPose(rec, u, dt, B, axes);
  hfCloseEyes(rec, rec.stunEyes || blink);
  hfKeepOutput(B, B.bones);
}
// Vivant à l'arrêt (05/11/2026) : respiration du buste, regard qui se promène, léger transfert du poids, clignements.
// Au repos et en garde seulement (plus rapide et plus ample en garde, regard plus fixe) ; chaque personnage a sa phase.
const LIFE_IN = 0.4, // s : la surcouche s'installe à l'arrêt
  LIFE_OUT = 0.2, // s : et s'efface quand on repart (clip de course intact)
  BREATH = { idle: 3.8, guard: 2.6 }, // s : durée d'une respiration
  BLINK = 0.13; // s : durée d'un clignement
const lifeSeed = id => {
  let h = 7;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h / 9973;
};
// Courbe (fonction pure, testée) : t = temps (s), seed 0..1, w = poids 0..1, guard = garde de combat. Angles en rad.
function idleLifePose(t, seed, w, guard) {
  const s = seed * 2 * Math.PI,
    b = Math.sin((2 * Math.PI * t) / (guard ? BREATH.guard : BREATH.idle) + s),
    look = guard ? 0.35 : 1,
    period = 3.2 + seed * 1.8; // clignements tous les 3,2 à 5 s selon le personnage
  return {
    chest: -w * (guard ? 0.032 : 0.024) * b, // inspiration : la poitrine se soulève (buste un peu en arrière)
    spine: -w * (guard ? 0.016 : 0.012) * b,
    sway: w * 0.02 * Math.sin(t * 0.29 + s), // poids d'une jambe sur l'autre
    headYaw: w * look * (0.09 * Math.sin(t * 0.37 + 2 * s) + 0.05 * Math.sin(t * 0.83 + s)),
    headPitch: w * (0.03 * Math.sin(t * 0.53 + 3 * s) + 0.012 * b),
    blink: w > 0.5 && (t + seed * 7) % period < BLINK
  };
}
function hfIdleLife(rec, u, dt, B, axes) {
  const L = (rec.life = rec.life || { w: 0, t: 0, seed: lifeSeed(u.id) }),
    on = u.alive && !u.form && !(u.stun > 0) && (rec.animKey === 'idle' || rec.animKey === 'guard');
  L.w = clamp(L.w + (on ? dt / LIFE_IN : -dt / LIFE_OUT), 0, 1);
  L.t += dt;
  if (!L.w) return false;
  const P = idleLifePose(L.t, L.seed, smoothstep(0, 1, L.w), rec.animKey === 'guard'),
    chest = B.spine[B.spine.length - 1];
  hfRotateLocal(B.spine[0], axes.fwd, P.sway);
  if (B.spine.length > 1) hfRotateLocal(B.spine[1], axes.right, P.spine);
  hfRotateLocal(chest, axes.right, P.chest);
  hfRotateLocal(B.head, axes.up, P.headYaw);
  hfRotateLocal(B.head, axes.right, P.headPitch);
  return P.blink;
}
function hfRaceStrike(rec, u, B, axes) {
  if (!STRIKE_CLASSES.has(u.cls) || u.form || !u.alive) return;
  const S = (rec.strike = rec.strike || {}),
    t = performance.now() / 1000;
  if (rec.animKey === 'attack' && S.lastKey !== 'attack') S.t0 = t;
  S.lastKey = rec.animKey;
  const P = raceStrike(u),
    q = S.t0 != null ? ((t - S.t0) * P.speed) / STRIKE_DUR : 2;
  if (q >= 1) return;
  const pose = strikePose(q, P),
    side = u.cls === 'shade' && rec.leftHit ? -1 : 1; // voleur : coup de la main gauche = rotation inverse
  for (const b of B.spine) {
    hfRotateLocal(b, axes.up, (side * pose.twist) / B.spine.length);
    hfRotateLocal(b, axes.right, pose.lean / B.spine.length);
  }
  if (pose.tilt) hfRotateLocal(B.head, axes.fwd, side * pose.tilt);
}
// Étourdi : tête et cou penchés vers l'avant, petits cercles lents de la tête, léger balancement du buste, yeux fermés.
const STUN_IN = 0.45, // s : la tête s'incline en douceur au début de l'étourdissement
  STUN_OUT = 0.5, // s : et se redresse à la fin (sans à-coup)
  STUN_CIRCLE = 2.6; // s : durée d'un cercle de la tête
// Courbe (fonction pure, testée) : t = temps depuis le début de l'étourdissement, w = poids 0..1 (entrée / sortie).
// Angles en radians : neck / head = penché vers l'avant, roll = inclinaison sur le côté, sway* = balancement du buste.
function stunPose(t, w) {
  const a = (2 * Math.PI * t) / STUN_CIRCLE;
  return {
    neck: w * (0.1 + 0.03 * Math.sin(a)),
    head: w * (0.15 + 0.05 * Math.sin(a)),
    roll: w * 0.07 * Math.cos(a),
    swayRoll: w * 0.035 * Math.sin(a - 0.8),
    swayPitch: w * 0.04
  };
}
function hfStunPose(rec, u, dt, B, axes) {
  const St = (rec.stunned = rec.stunned || { s: 0, t: 0 }),
    on = u.alive && u.stun > 0 && !u.form && !(u.poly > 0);
  St.s = clamp(St.s + (on ? dt / STUN_IN : -dt / STUN_OUT), 0, 1);
  St.t = St.s > 0 ? St.t + dt : 0;
  rec.stunEyes = on && St.s > 0.5;
  if (!St.s || u.form) return;
  const P = stunPose(St.t, smoothstep(0, 1, St.s)),
    chest = B.spine[B.spine.length - 1];
  hfRotateLocal(chest, axes.right, P.swayPitch);
  hfRotateLocal(chest, axes.fwd, P.swayRoll);
  if (B.neck) hfRotateLocal(B.neck, axes.right, P.neck);
  hfRotateLocal(B.head, axes.right, P.head);
  hfRotateLocal(B.head, axes.fwd, P.roll);
}
// Yeux fermés : paupières (couleur de peau, posées sur les yeux, `eyelids` dans characters/head.js) visibles, lueur
// des yeux éteinte.
function hfCloseEyes(rec, closed) {
  if (rec.eyesClosed === closed) return;
  rec.eyesClosed = closed;
  if (!rec.lids) {
    rec.lids = [];
    rec.model.traverse(o => /^(Eyelid|EyeGlow)$/.test(o.name) && rec.lids.push(o));
  }
  for (const o of rec.lids) o.visible = (o.name === 'Eyelid') === closed;
}
// Arme à deux mains (chevalier de la mort) : la main gauche rejoint la poignée sous la main droite à chaque image
// (cinématique inverse à deux os : bras, avant-bras ; le coude garde son côté), aussi pendant la frappe.
let IK_V = null; // créés à la première utilisation (THREE peut manquer : modèle de secours)
function hfAimBone(bone, from, to) {
  // tourne `bone` pour que la direction from→(enfant) devienne from→to (calcul exact, voir hfTurnLocal)
  const [a, b] = [IK_V[4], IK_V[5]];
  hfTurnLocal(bone, a.copy(from[1]).sub(from[0]), b.copy(to).sub(from[0]));
}
// Tourne `bone` pour que la direction monde `from` (portée par lui ou un enfant) devienne `to`. Calcul exact dans le
// repère de son parent (vraie matrice, échelles non uniformes comprises) : la rotation s'applique avant l'échelle du
// parent, donc directions ramenées par la matrice inverse puis rotation au plus court.
function hfTurnLocal(bone, from, to) {
  const inv = new THREE.Matrix4().copy(bone.parent.matrixWorld).invert(),
    a = from.clone().transformDirection(inv),
    b = to.clone().transformDirection(inv);
  bone.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(a, b));
  bone.updateMatrixWorld(true);
}
// Bras (épaule, coude, main) dirigé vers `target` : le coude reste dans le plan du bras actuel.
// pole : direction vers laquelle pointe le coude (fixe dans le repère du personnage). Prendre le coude actuel le
// faisait basculer d'un côté à l'autre quand le bras était presque tendu : la frappe « glitchait ».
function hfArmIK(up, lo, hand, target, pole) {
  const [A, Bp, Cp] = IK_V;
  up.getWorldPosition(A);
  lo.getWorldPosition(Bp);
  hand.getWorldPosition(Cp);
  const l1 = A.distanceTo(Bp),
    l2 = Bp.distanceTo(Cp),
    d = Math.min(A.distanceTo(target), (l1 + l2) * 0.999),
    dir = target.clone().sub(A).normalize(),
    side = pole
      .clone()
      .sub(dir.clone().multiplyScalar(pole.dot(dir)))
      .normalize(),
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  hfAimBone(up, [A, Bp], A.clone().addScaledVector(dir, x).addScaledVector(side, h));
  lo.getWorldPosition(Bp);
  hand.getWorldPosition(Cp);
  hfAimBone(lo, [Bp, Cp], A.clone().addScaledVector(dir, d));
}
// Voleur : coup de glaive. Le coup de poing du clip (Punch_Jab = main gauche, Punch_Cross = main droite) donne l'élan ;
// par-dessus, le bras balaie de l'extérieur vers l'intérieur et la lame est couchée à l'horizontale le long d'un arc
// (repère du personnage : la rotation du buste des frappes par race ne l'annule pas) : elle tranche au lieu de frapper
// droit comme un poing.
const SLASH_DUR = 0.36; // durée du coup à vitesse 1 (s) = durée de l'action de mêlée
let Y_AXIS = null,
  Z_AXIS = null; // créés à la première utilisation (THREE peut manquer : modèle de secours)
// Courbe du coup (p = 0..1 depuis le début du coup, arc = amplitude de la race). Fonction pure (testée) :
//  w = poids de la surcouche (part de 0 et y revient : pas de saut depuis le clip) ; sweep / lift = balayage horizontal
//  et élévation du bras (rad) ; yaw = direction de la lame dans le plan horizontal (0 = vers l'extérieur, π/2 = devant,
//  π = vers l'intérieur) ; pitch = élévation de la lame (levée à l'armé, un peu basse à la fin).
function bladeSlashPose(p, arc) {
  const w = smoothstep(0, 0.2, p) * (1 - smoothstep(0.65, 1, p)),
    e = smoothstep(0.1, 0.6, p);
  return {
    w,
    sweep: (0.9 - 1.8 * e) * w * arc,
    lift: -0.35 * w * arc,
    yaw: 0.15 + 2.4 * arc * e,
    pitch: 0.5 - 0.75 * e
  };
}
// Orientation d'un repère donné par deux axes (y, puis z rendu perpendiculaire) : continue, même si les axes mesurés
// sur un os étiré ne sont pas tout à fait perpendiculaires.
function frameOf(y, z) {
  const yy = y.clone().normalize(),
    zz = z.clone().addScaledVector(yy, -z.dot(yy)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(yy.clone().cross(zz), yy, zz));
}
// Repart de la pose animée à chaque image (hfFromAnimPose) : la main gauche de Punch_Jab n'a qu'une pose fixe, le
// mixeur ne la réécrit jamais ; une correction qui partait de son propre résultat s'ajoutait à elle-même à chaque image
// et le glaive tournoyait au hasard (selon la cadence d'images).
function hfBladeSlash(rec, u) {
  const m = rec.model;
  if (!rec.slash) {
    const f = n => m.getObjectByName(n),
      L = [f('upperarm_l'), f('hand_l')],
      R = [f('upperarm_r'), f('hand_r')];
    rec.slash = [...L, ...R].every(Boolean) ? { L, R, bones: [...L, ...R] } : false;
  }
  const S = rec.slash;
  if (!S) return;
  Y_AXIS = Y_AXIS || new THREE.Vector3(0, 1, 0);
  Z_AXIS = Z_AXIS || new THREE.Vector3(0, 0, 1);
  hfFromAnimPose(S, S.bones);
  // le coup commence avec le clip de frappe et va au bout de sa courbe (poids revenu à 0), même si le clip suivant a
  // déjà pris le relais : couper la surcouche en cours faisait sauter la lame
  const t = performance.now() / 1000,
    n = rec.action?.getClip().name,
    on = rec.animKey === 'attack' && /^Punch_/.test(n);
  if (on && !S.on) Object.assign(S, { t0: t, left: n === 'Punch_Jab', G0: null });
  S.on = on;
  const P = raceStrike(u),
    pose = S.t0 != null ? bladeSlashPose(((t - S.t0) * P.speed) / SLASH_DUR, P.arc) : null;
  if (pose && pose.w > 0) {
    const [up, hand] = S.left ? S.L : S.R,
      side = S.left ? 1 : -1, // +x du personnage = sa gauche : l'extérieur de la main gauche
      mq = m.getWorldQuaternion(new THREE.Quaternion());
    m.updateMatrixWorld(true);
    // bras : élévation autour de l'axe latéral du personnage, puis balayage autour de sa verticale. Rotations par axe
    // (hfRotateLocal) : reconstruire l'orientation monde d'un os étiré (elfe, nain) donnait des sauts d'une image à l'autre
    hfRotateLocal(up, new THREE.Vector3(1, 0, 0).applyQuaternion(mq), pose.lift);
    hfRotateLocal(up, Y_AXIS.clone().applyQuaternion(mq), side * pose.sweep);
    // Glaive couché le long de l'arc. Au début du coup, la lame du clip est couchée sur la direction de départ de l'arc
    // (moitié du glaive la plus proche : deux lames symétriques) : orientation de départ G0 (repère du personnage). La
    // cible suit ensuite l'arc (yaw, pitch) : cible = arc(p)·arc(départ)⁻¹·G0, continue et indépendante du clip (le
    // poing de Punch_Cross monte et redressait la lame). La main est tournée de la pose du clip vers la cible, pondérée
    // par w, par une rotation autour d'un axe (hfRotateLocal) : pas de bascule d'une image à l'autre ni de saut sur les
    // bras étirés (elfe, nain).
    const arc = (yaw, pitch) =>
        new THREE.Quaternion()
          .setFromAxisAngle(Y_AXIS, -side * yaw)
          .multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, side * pitch)),
      toModel = mq.clone().invert(),
      glaive = hand.children.find(c => c.name === 'Dagger') || hand,
      axis = v => v.transformDirection(glaive.matrixWorld).applyQuaternion(toModel),
      bladeY = axis(new THREE.Vector3(0, 1, 0)),
      bladeZ = axis(new THREE.Vector3(0, 0, 1)),
      live = frameOf(bladeY, bladeZ);
    if (!S.G0) {
      const want = new THREE.Vector3(side, 0, 0).applyQuaternion(arc(pose.yaw, pose.pitch)),
        b = bladeY.clone().multiplyScalar(bladeY.dot(want) < 0 ? -1 : 1);
      S.G0 = new THREE.Quaternion().setFromUnitVectors(b, want).multiply(live);
      S.arc0 = arc(pose.yaw, pose.pitch).invert();
    }
    const target = arc(pose.yaw, pose.pitch).multiply(S.arc0).multiply(S.G0),
      fix = target.multiply(live.invert());
    if (fix.w < 0) fix.set(-fix.x, -fix.y, -fix.z, -fix.w); // le plus court chemin
    const angle = 2 * Math.acos(Math.min(1, fix.w)) * pose.w,
      sn = Math.sqrt(Math.max(0, 1 - fix.w * fix.w));
    if (sn > 1e-6)
      hfRotateLocal(hand, new THREE.Vector3(fix.x, fix.y, fix.z).divideScalar(sn).applyQuaternion(mq), angle);
  }
  hfKeepOutput(S, S.bones);
}
function hfTwoHandIK(rec, u) {
  const m = rec.model;
  if (!IK_V) {
    IK_V = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
  }
  if (!rec.ik) {
    const f = n => m.getObjectByName(n),
      grip = f('Runeblade');
    rec.ik =
      grip && f('upperarm_l') && f('upperarm_r')
        ? {
            grip,
            L: [f('upperarm_l'), f('lowerarm_l'), f('hand_l')],
            R: [f('upperarm_r'), f('lowerarm_r'), f('hand_r')],
            C: [f('clavicle_l'), f('clavicle_r')].filter(Boolean)
          }
        : false;
  }
  const k = rec.ik;
  if (!k) return;
  const bones = [...k.L, ...k.R, ...k.C];
  hfFromAnimPose(k, bones);
  // Main droite pilotée entièrement ici, dans le repère du personnage (+z = avant, +x = sa gauche) : garde à deux mains
  // (mains devant la hanche droite, lame dressée) et frappe à deux mains calculée (armé au-dessus de l'épaule droite,
  // taille vers l'avant, accompagnement vers le bas, retour en garde). Les clips n'ont pas de prise à deux mains : leurs
  // mains finissaient derrière le dos, et mélanger la garde avec Sword_Attack faisait plonger et remonter la lame deux
  // fois par coup (le « tremblement »). Le corps garde l'élan du clip de frappe.
  const tc = performance.now() / 1000;
  m.updateMatrixWorld(true);
  if (!k.keys) {
    const hy = m.worldToLocal(m.getObjectByName('Head').getWorldPosition(new THREE.Vector3())).y / 1.61,
      K = (x, y, z, dx, dy, dz) => ({
        p: new THREE.Vector3(x, y * hy, z * hy),
        d: new THREE.Vector3(dx, dy, dz).normalize()
      });
    k.guardKey = K(-0.1, 1.0, 0.3, 0.25, 0.8, 0.55);
    // [instant dans la frappe (0..1), pose] ; la frappe dure STRIKE_T s, impact vers 35 %
    k.keys = [
      [0.17, K(-0.22, 1.45, 0.08, -0.2, 0.75, -0.62)], // armé : lame au-dessus de l'épaule droite, pointe en arrière
      [0.35, K(0.02, 1.12, 0.52, -0.25, 0.05, 0.97)], // impact : lame à l'horizontale devant soi
      [0.58, K(0.2, 0.86, 0.38, -0.62, -0.5, 0.6)], // accompagnement : vers le bas et la gauche
      [1, k.guardKey]
    ];
    // amplitude de l'arc selon la race (elfe : grand arc ; nain : coup ramassé)
    const arc = raceStrike(u).arc;
    for (const [, P] of k.keys) if (P !== k.guardKey) P.p.sub(k.guardKey.p).multiplyScalar(arc).add(k.guardKey.p);
    k.cur = { p: k.guardKey.p.clone(), d: k.guardKey.d.clone() };
  }
  const STRIKE_T = 0.6 / raceStrike(u).speed;
  if (rec.animKey === 'attack' && k.lastKey !== 'attack') {
    k.atk0 = tc;
    k.from = { p: k.cur.p.clone(), d: k.cur.d.clone() }; // nouvelle frappe : on part de la pose actuelle (pas de saut)
  }
  k.lastKey = rec.animKey;
  const ph = k.atk0 != null ? (tc - k.atk0) / STRIKE_T : 2;
  if (ph < 1) {
    let a = { t: 0, ...k.from },
      b = null;
    for (const [t, P] of k.keys) {
      if (ph <= t) {
        b = { t, ...P };
        break;
      }
      a = { t, ...P };
    }
    const x = clamp((ph - a.t) / (b.t - a.t), 0, 1),
      e = x * x * (3 - 2 * x);
    k.cur.p.copy(a.p).lerp(b.p, e);
    k.cur.d.copy(a.d).lerp(b.d, e).normalize();
  } else {
    k.cur.p.copy(k.guardKey.p);
    k.cur.d.copy(k.guardKey.d);
  }
  // coudes vers le bas, l'arrière et l'extérieur (gauche = +x du modèle)
  const mq = m.getWorldQuaternion(new THREE.Quaternion()),
    poleL = new THREE.Vector3(0.7, -1, -0.6).applyQuaternion(mq),
    poleR = new THREE.Vector3(-0.7, -1, -0.6).applyQuaternion(mq);
  const [up, lo, hand] = k.L;
  hfArmIK(...k.R, m.localToWorld(k.cur.p.clone()), poleR);
  m.updateMatrixWorld(true);
  // orientation de la main droite : la lame est tournée au plus court vers la direction voulue, puis la main roule
  // autour de la lame pour garder la paume tournée comme à l'image précédente (dans le repère du personnage) : aucune
  // rotation parasite venant du clip. Rotations exactes dans le repère de l'avant-bras (hfTurnLocal) : avec les os
  // étirés du nain et de l'elfe, l'ancien calcul par rotations « monde » approchées faisait trembler l'arme.
  const H = k.R[2],
    want = k.cur.d.clone().applyQuaternion(mq),
    bladeNow = () => new THREE.Vector3(0, 1, 0).transformDirection(k.grip.matrixWorld),
    palmNow = () => new THREE.Vector3(-1, 0, 0).transformDirection(H.matrixWorld),
    across = v => v.addScaledVector(want, -v.dot(want)).normalize();
  hfTurnLocal(H, bladeNow(), want);
  if (k.palm) {
    hfTurnLocal(H, across(palmNow()), across(k.palm.clone().applyQuaternion(mq)));
    hfTurnLocal(H, bladeNow(), want);
  }
  k.palm = palmNow().applyQuaternion(mq.clone().invert());
  // main gauche : sa PAUME (pas son poignet) sur la poignée, juste sous la droite, paume tournée du même côté que la
  // droite et pouce vers la lame (prise à deux mains). Repère d'une main : +y = doigts, +z = pouce, paume en +x
  // (gauche) / -x (droite) ; centre de la paume à (±0,028 ; 0,075 ; 0) du poignet.
  const bladeW = new THREE.Vector3(0, 1, 0).transformDirection(k.grip.matrixWorld),
    palmN = new THREE.Vector3(-1, 0, 0).transformDirection(H.matrixWorld),
    zL = bladeW.clone(),
    xL = palmN.clone().addScaledVector(zL, -palmN.dot(zL)).normalize(),
    yL = new THREE.Vector3().crossVectors(zL, xL),
    qL = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xL, yL, zL)),
    palmL = k.grip.localToWorld(new THREE.Vector3(0, -0.09, 0)),
    wrist = palmL.sub(new THREE.Vector3(0.028, 0.075, 0).applyQuaternion(qL)),
    tgt = wrist;
  hfArmIK(up, lo, hand, tgt, poleL);
  m.updateMatrixWorld(true);
  // orientation qL appliquée par rotations exactes (pouce vers la lame, puis paume), comme la main droite
  const axis = v => v.transformDirection(hand.matrixWorld);
  hfTurnLocal(hand, axis(new THREE.Vector3(0, 0, 1)), zL);
  const xNow = axis(new THREE.Vector3(1, 0, 0));
  hfTurnLocal(hand, xNow.addScaledVector(zL, -xNow.dot(zL)).normalize(), xL);
  hfKeepOutput(k, bones);
}

function inMeleeGuard(u) {
  if (!u.alive || u.form || !(SWING[u.cls] || u.cls === 'warden')) return false;
  const t = u.target?.alive && u.target.team !== u.team ? u.target : u.lastEnemy;
  return !!t?.alive && d2(u, t) < 3.2 && now() - (u.lastCombat || -99) < 4;
}
