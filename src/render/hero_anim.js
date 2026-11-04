'use strict';
// Animations des personnages : choix des clips (hfSetAnim), instant d'impact des attaques, pas, mains sur l'arme (IK), traînée de lame.
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
  // course « tenue » 0,18 s après l'arrêt : pas de bascule course/repos à chaque pas de simulation
  const t = now();
  if (u.moving) rec.lastMove = t;
  const moving = u.moving || t - (rec.lastMove || 0) < 0.18;
  let key = 'idle',
    names = ['Idle_Loop', 'Idle'];
  if (!u.alive) {
    key = 'death';
    names = ['Death01', 'Death_A', 'Death', 'Die'];
  } else if (state?.ended && state.winTeam === u.team) {
    // joie du vainqueur : arme brandie (pose levée du coup d'épée, animée plus bas)
    key = 'cheer';
    names = ['Sword_Attack', 'Spell_Simple_Shoot'];
  } else if (u.stun > 0 || u.mobility?.type === 'grip') {
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
  const next = rec.mixer.clipAction(clip);
  next.reset();
  if (key === 'death' || key === 'land') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.fadeIn(key === 'air' ? 0.08 : key === 'attack' ? 0.05 : 0.1).play();
  next.timeScale = key === 'run' ? 1.12 : key === 'attack' ? 1.08 : key === 'land' ? 1.6 : 1;
  // les dégâts tombent au début de l'action : on démarre le coup juste avant l'impact (lame au contact ≈ 80 ms après)
  const hit = key === 'attack' && ATTACK_HIT[clip.name];
  if (hit) {
    next.time = hit.from;
    next.timeScale = hit.speed;
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
// par-dessus, le bras balaie de l'extérieur vers l'intérieur en s'élevant, et le poignet roule : la lame en croissant
// tranche en arc au lieu de frapper droit.
function hfBladeSlash(rec) {
  const a = rec.action,
    n = a?.getClip().name;
  if (rec.animKey !== 'attack' || !/^Punch_/.test(n)) return;
  const m = rec.model,
    left = n === 'Punch_Jab',
    up = m.getObjectByName(left ? 'upperarm_l' : 'upperarm_r'),
    hand = m.getObjectByName(left ? 'hand_l' : 'hand_r');
  if (!up || !hand) return;
  const q = clamp(a.time / a.getClip().duration, 0, 1),
    env = Math.sin(Math.PI * clamp(q / 0.62, 0, 1)),
    k = clamp((q - 0.04) / 0.36, 0, 1),
    e = k * k * (3 - 2 * k),
    side = left ? 1 : -1,
    mq = m.getWorldQuaternion(new THREE.Quaternion()),
    rot = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(mq), side * (1.05 - 2 * e) * env)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(mq), -0.35 * env)),
    turn = (bone, r) => {
      const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion()),
        bw = bone.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(pw.invert().multiply(r.multiply(bw)));
      bone.updateMatrixWorld(true);
    };
  turn(up, rot);
  // roulis du poignet autour de l'avant-bras
  const fore = hand
    .getWorldPosition(new THREE.Vector3())
    .sub(hand.parent.getWorldPosition(new THREE.Vector3()))
    .normalize();
  turn(hand, new THREE.Quaternion().setFromAxisAngle(fore, -side * 1.1 * env));
}
function hfTwoHandIK(rec) {
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
  // Le mixeur three.js ne réécrit un os que si sa valeur animée a changé : sur une pose immobile, le bras gardait la
  // correction de l'image précédente et l'IK repartait de son propre résultat (balancier, l'arme tremblait). On repart
  // donc toujours de la pose animée : mémorisée quand le mixeur l'a écrite, restaurée sinon.
  const bones = [...k.L, ...k.R, ...k.C];
  if (!k.anim) {
    k.anim = bones.map(b => b.quaternion.clone());
    k.out = bones.map(() => null);
  }
  bones.forEach((b, i) => {
    if (k.out[i] && b.quaternion.equals(k.out[i])) b.quaternion.copy(k.anim[i]);
    else k.anim[i].copy(b.quaternion);
  });
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
    k.cur = { p: k.guardKey.p.clone(), d: k.guardKey.d.clone() };
  }
  const STRIKE_T = 0.6;
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
  bones.forEach((b, i) => (k.out[i] = (k.out[i] || new THREE.Quaternion()).copy(b.quaternion)));
}

function inMeleeGuard(u) {
  if (!u.alive || u.form || !(SWING[u.cls] || u.cls === 'warden')) return false;
  const t = u.target?.alive && u.target.team !== u.team ? u.target : u.lastEnemy;
  return !!t?.alive && d2(u, t) < 3.2 && now() - (u.lastCombat || -99) < 4;
}
