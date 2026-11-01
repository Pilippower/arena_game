'use strict';
// Lancement du navigateur installé (Edge/Chrome) pour les tests et les captures.
// Par défaut on essaie la carte graphique (bien plus rapide) ; SOFTWARE_GL=1 force le rendu logiciel (machines sans GPU).
const fs = require('node:fs');
const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const findBrowser = () => CANDIDATES.find(p => p && fs.existsSync(p));
const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const SOFT_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
function launchArgs(extra = []) {
  return [...(process.env.SOFTWARE_GL === '1' || process.platform !== 'win32' ? SOFT_ARGS : GPU_ARGS), ...extra];
}
async function launch(extra = []) {
  const { chromium } = require('playwright-core');
  const executablePath = findBrowser();
  if (!executablePath) return null;
  return chromium.launch({ executablePath, headless: true, args: launchArgs(extra) });
}
module.exports = { findBrowser, launchArgs, launch };
