'use strict';
// Diagnostic sur l'appareil (ex. iPhone) : ouvrir le jeu avec ?diag=1. Un panneau affiche l'état de chaque contexte
// WebGL (perdu ?), le GPU et le système, l'état du décor 3D et les erreurs (dont les erreurs de shaders three.js).
// Chargé en premier pour capter toutes les erreurs. Sans ?diag=1, ne fait rien.
(() => {
  if (new URLSearchParams(location.search).get('diag') !== '1') return;
  const lines = [],
    lost = new Set(),
    el = document.createElement('pre');
  el.style.cssText =
    'position:fixed;left:4px;top:4px;right:4px;max-height:70vh;overflow:auto;z-index:9999;margin:0;padding:6px 8px;font:11px/1.35 monospace;color:#cfe;background:#000d;white-space:pre-wrap;pointer-events:auto';
  const log = t => lines.push(String(t).slice(0, 400));
  const oe = console.error.bind(console),
    ow = console.warn.bind(console);
  console.error = (...a) => (log('ERR ' + a.map(String).join(' ')), oe(...a));
  console.warn = (...a) => (log('WARN ' + a.map(String).join(' ')), ow(...a));
  addEventListener('error', e => log('JS ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  addEventListener('unhandledrejection', e => log('PROMISE ' + (e.reason?.message || e.reason)));
  // contextes perdus (mémoire graphique insuffisante, fréquent sur iPhone)
  addEventListener('DOMContentLoaded', () => {
    for (const id of ['env3d', 'c', 'character3d'])
      document
        .getElementById(id)
        ?.addEventListener('webglcontextlost', () => (lost.add(id), log('CONTEXT LOST ' + id)));
  });
  const gpu = () => {
    try {
      const c = document.createElement('canvas'),
        gl = c.getContext('webgl2') || c.getContext('webgl'),
        x = gl.getExtension('WEBGL_debug_renderer_info');
      return `${gl instanceof (window.WebGL2RenderingContext || Object) ? 'WebGL2' : 'WebGL1'} · ${x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)} · maxTex ${gl.getParameter(gl.MAX_TEXTURE_SIZE)} · fragUniforms ${gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)} · highp ${gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision}`;
    } catch (e) {
      return 'GPU ? ' + e.message;
    }
  };
  const head = `${navigator.userAgent}\n${gpu()} · dpr ${devicePixelRatio}`;
  setInterval(() => {
    if (!el.isConnected && document.body) document.body.appendChild(el);
    const R = window.ArenaEnv?.renderer,
      prog = R?.info.programs?.length,
      envState =
        typeof ENV !== 'undefined'
          ? `décor ok=${ENV.ok} essai=${ENV.attempted} carte=${window.ArenaEnv?.mapId}`
          : 'décor ?';
    el.textContent = `${head}\n${envState} · programmes décor ${prog ?? '-'} · contextes perdus: ${[...lost].join(',') || 'aucun'}\n${lines.slice(-25).join('\n')}`;
  }, 1000);
})();
