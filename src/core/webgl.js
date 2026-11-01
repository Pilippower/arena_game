'use strict';
// Arène (collision), état global, caméra, maths matrices/vecteurs, moteur WebGL historique (maillages primitifs).
const arena = {
  halfX: 34,
  halfZ: 25,
  pillars: [
    { x: -12, z: -8, r: 1.6, h: 5.0 },
    { x: 12, z: -8, r: 1.6, h: 5.0 },
    { x: -12, z: 8, r: 1.6, h: 5.0 },
    { x: 12, z: 8, r: 1.6, h: 5.0 },
    { x: 0, z: -14, r: 1.1, h: 4.0 },
    { x: 0, z: 14, r: 1.1, h: 4.0 },
    { x: -18, z: 0, r: 1.15, h: 4.1 },
    { x: 18, z: 0, r: 1.15, h: 4.1 }
  ]
};
const HEALTH_SPOTS = [
  { x: 0, z: -20 },
  { x: 0, z: 20 }
];

let state = null,
  camera = { yaw: Math.PI / 2, pitch: 0.2, dist: 8.3 },
  looking = false,
  lastPX = 0,
  lastPY = 0,
  rightPointerId = null,
  viewProj = null,
  camPos = [0, 4, -8];

// ---------- matrix / vectors ----------
function M4() {
  return new Float32Array(16);
}
function ident() {
  const m = M4();
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
function mul(a, b) {
  const o = M4();
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function trans(x, y, z) {
  const m = ident();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}
function scale(x, y, z) {
  const m = ident();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}
function rotX(a) {
  const m = ident(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}
function rotY(a) {
  const m = ident(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}
function rotZ(a) {
  const m = ident(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}
function model(p, r = [0, 0, 0], s = [1, 1, 1]) {
  return mul(mul(mul(mul(trans(p[0], p[1], p[2]), rotY(r[1])), rotX(r[0])), rotZ(r[2])), scale(s[0], s[1], s[2]));
}
function perspective(fovy, aspect, n, f) {
  const t = 1 / Math.tan(fovy / 2),
    m = M4();
  m[0] = t / aspect;
  m[5] = t;
  m[10] = (f + n) / (n - f);
  m[11] = -1;
  m[14] = (2 * f * n) / (n - f);
  return m;
}
function lookAt(e, t) {
  let z = [e[0] - t[0], e[1] - t[1], e[2] - t[2]],
    zl = Math.hypot(...z) || 1;
  z = z.map(v => v / zl);
  let x = [z[2], 0, -z[0]],
    xl = Math.hypot(x[0], x[2]) || 1;
  x = [x[0] / xl, 0, x[2] / xl];
  const y = [z[1] * x[2], z[2] * x[0] - z[0] * x[2], -z[1] * x[0]];
  const m = ident();
  m[0] = x[0];
  m[1] = y[0];
  m[2] = z[0];
  m[4] = x[1];
  m[5] = y[1];
  m[6] = z[1];
  m[8] = x[2];
  m[9] = y[2];
  m[10] = z[2];
  m[12] = -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]);
  m[13] = -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]);
  m[14] = -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]);
  return m;
}
function tf(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]
  ];
}
function hexish(c, m = 1) {
  return c.map(v => clamp(v * m, 0, 1));
}

// ---------- WebGL ----------
if (!gl) {
  $('bootError').style.display = 'block';
  $('bootError').textContent = 'WebGL n’est pas disponible dans ce navigateur.';
}
function shader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
  return s;
}
let program = null,
  loc = {},
  meshes = {};
if (gl) {
  const vs = `attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uVP;uniform mat4 uModel;varying vec3 vN;varying vec3 vW;varying float vH;void main(){vec4 w=uModel*vec4(aPos,1.0);vW=w.xyz;vH=w.y;vN=normalize(mat3(uModel)*aNormal);gl_Position=uVP*w;}`;
  const fs = `precision mediump float;varying vec3 vN;varying vec3 vW;varying float vH;uniform vec3 uColor;uniform vec3 uEm;uniform vec3 uCam;uniform float uAlpha;uniform float uTime;void main(){vec3 N=normalize(vN);vec3 L=normalize(vec3(-.55,.92,.34));float nd=max(dot(N,L),0.0);float toon=nd<.22?.16:(nd<.52?.48:(nd<.78?.72:.95));float bounce=max(dot(N,normalize(vec3(.25,.45,-.35))),0.0);vec3 V=normalize(uCam-vW);float rim=pow(1.0-max(dot(N,V),0.0),2.2);float pulse=.93+.07*sin(uTime*2.3+vW.x*.5+vW.z*.4);vec3 col=uColor*(.30+.72*toon+.10*bounce)+uEm*pulse+rim*(uColor*.32+uEm*.22);col=mix(col,col*vec3(1.08,1.03,.96),.28);float fog=clamp((distance(uCam,vW)-26.0)/48.0,0.0,.62);col=mix(col,vec3(.20,.22,.29),fog);gl_FragColor=vec4(col,uAlpha);}`;
  program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  loc = {
    pos: gl.getAttribLocation(program, 'aPos'),
    normal: gl.getAttribLocation(program, 'aNormal'),
    vp: gl.getUniformLocation(program, 'uVP'),
    model: gl.getUniformLocation(program, 'uModel'),
    color: gl.getUniformLocation(program, 'uColor'),
    em: gl.getUniformLocation(program, 'uEm'),
    cam: gl.getUniformLocation(program, 'uCam'),
    alpha: gl.getUniformLocation(program, 'uAlpha'),
    time: gl.getUniformLocation(program, 'uTime')
  };
}
function mesh(pos, norm, idx) {
  const m = { count: idx.length };
  m.vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
  m.nb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, m.nb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
  m.ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  return m;
}
function cubeMesh() {
  const p = [],
    n = [],
    i = [],
    F = [
      [
        [1, 0, 0],
        [1, -1, -1],
        [1, -1, 1],
        [1, 1, 1],
        [1, 1, -1]
      ],
      [
        [-1, 0, 0],
        [-1, -1, 1],
        [-1, -1, -1],
        [-1, 1, -1],
        [-1, 1, 1]
      ],
      [
        [0, 1, 0],
        [-1, 1, -1],
        [1, 1, -1],
        [1, 1, 1],
        [-1, 1, 1]
      ],
      [
        [0, -1, 0],
        [-1, -1, 1],
        [1, -1, 1],
        [1, -1, -1],
        [-1, -1, -1]
      ],
      [
        [0, 0, 1],
        [-1, -1, 1],
        [-1, 1, 1],
        [1, 1, 1],
        [1, -1, 1]
      ],
      [
        [0, 0, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, -1]
      ]
    ];
  for (const f of F) {
    const b = p.length / 3;
    for (let k = 1; k < 5; k++) {
      p.push(...f[k]);
      n.push(...f[0]);
    }
    i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return mesh(p, n, i);
}
function sphereMesh(lat = 14, lon = 18) {
  const p = [],
    n = [],
    i = [];
  for (let y = 0; y <= lat; y++) {
    const ph = (y / lat) * Math.PI;
    for (let x = 0; x <= lon; x++) {
      const th = (x / lon) * Math.PI * 2,
        s = Math.sin(ph),
        X = Math.sin(th) * s,
        Y = Math.cos(ph),
        Z = Math.cos(th) * s;
      p.push(X, Y, Z);
      n.push(X, Y, Z);
    }
  }
  for (let y = 0; y < lat; y++)
    for (let x = 0; x < lon; x++) {
      const a = y * (lon + 1) + x,
        b = a + lon + 1;
      i.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return mesh(p, n, i);
}
function cylMesh(seg = 20, topR = 1) {
  const p = [],
    n = [],
    i = [];
  for (let y = 0; y <= 1; y++)
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2,
        r = y ? topR : 1,
        x = Math.sin(a),
        z = Math.cos(a);
      p.push(x * r, y * 2 - 1, z * r);
      n.push(x, 0, z);
    }
  for (let k = 0; k < seg; k++) {
    const a = k,
      b = a + seg + 1;
    i.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const top = p.length / 3;
  p.push(0, 1, 0);
  n.push(0, 1, 0);
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    p.push(Math.sin(a) * topR, 1, Math.cos(a) * topR);
    n.push(0, 1, 0);
  }
  for (let k = 0; k < seg; k++) i.push(top, top + k + 1, top + k + 2);
  const bot = p.length / 3;
  p.push(0, -1, 0);
  n.push(0, -1, 0);
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    p.push(Math.sin(a), -1, Math.cos(a));
    n.push(0, -1, 0);
  }
  for (let k = 0; k < seg; k++) i.push(bot, bot + k + 2, bot + k + 1);
  return mesh(p, n, i);
}
function torusMesh(seg = 32, tube = 9) {
  const p = [],
    n = [],
    i = [],
    R = 1,
    r = 0.12;
  for (let a = 0; a <= seg; a++) {
    const A = (a / seg) * Math.PI * 2;
    for (let b = 0; b <= tube; b++) {
      const B = (b / tube) * Math.PI * 2,
        cb = Math.cos(B),
        sb = Math.sin(B),
        sa = Math.sin(A),
        ca = Math.cos(A);
      p.push(sa * (R + r * cb), r * sb, ca * (R + r * cb));
      n.push(sa * cb, sb, ca * cb);
    }
  }
  for (let a = 0; a < seg; a++)
    for (let b = 0; b < tube; b++) {
      const x = a * (tube + 1) + b,
        y = x + tube + 1;
      i.push(x, y, x + 1, y, y + 1, x + 1);
    }
  return mesh(p, n, i);
}
if (gl)
  meshes = {
    cube: cubeMesh(),
    sphere: sphereMesh(18, 24),
    cyl: cylMesh(24),
    cone: cylMesh(24, 0.08),
    torus: torusMesh(36, 10),
    chest: cylMesh(24, 1.28),
    robe: cylMesh(24, 0.58),
    boot: cylMesh(18, 0.78)
  };
function drawMesh(me, m, color, em = [0, 0, 0], alpha = 1) {
  gl.bindBuffer(gl.ARRAY_BUFFER, me.vb);
  gl.enableVertexAttribArray(loc.pos);
  gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, me.nb);
  gl.enableVertexAttribArray(loc.normal);
  gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, me.ib);
  gl.uniformMatrix4fv(loc.model, false, m);
  gl.uniform3fv(loc.color, color);
  gl.uniform3fv(loc.em, em);
  gl.uniform1f(loc.alpha, alpha);
  if (alpha < 0.999) {
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
  } else {
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }
  gl.drawElements(gl.TRIANGLES, me.count, gl.UNSIGNED_SHORT, 0);
  if (alpha < 0.999) {
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
function part(name, p, r, s, c, e = [0, 0, 0], a = 1) {
  drawMesh(meshes[name], model(p, r, s), c, e, a);
}
function glowPart(name, p, r, s, c, a = 0.45) {
  const me = meshes[name],
    m = model(p, r, s);
  if (!me) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, me.vb);
  gl.enableVertexAttribArray(loc.pos);
  gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, me.nb);
  gl.enableVertexAttribArray(loc.normal);
  gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, me.ib);
  gl.uniformMatrix4fv(loc.model, false, m);
  gl.uniform3fv(loc.color, [0, 0, 0]);
  gl.uniform3fv(loc.em, c);
  gl.uniform1f(loc.alpha, a);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
  gl.depthMask(false);
  gl.drawElements(gl.TRIANGLES, me.count, gl.UNSIGNED_SHORT, 0);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
function local(u, x, y, z) {
  const sy = Math.sin(u.yaw),
    cy = Math.cos(u.yaw);
  return [u.x + x * cy + z * sy, (u.y || 0) + y, u.z - x * sy + z * cy];
}
