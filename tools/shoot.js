'use strict';
// Captures du visualiseur. Usage : node tools/shoot.js out.png "part1|part2" [anim] [t] [yaw] [cam]
const path = require('node:path');
const { chromium } = require('playwright-core');
const { start } = require('./serve.js');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function shoot(jobs, { w = 520, h = 720 } = {}) {
  const server = await start();
  const port = server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || EDGE,
    args: require('../tests/browser/browser.js').launchArgs()
  });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    for (const j of jobs) {
      const qs = new URLSearchParams({
        kit: j.kit || '',
        parts: (j.parts || []).join('|'),
        anim: j.anim || '',
        t: j.t ?? 0.3,
        yaw: j.yaw ?? 0,
        cam: j.cam || 'full',
        headonly: j.headonly ? '1' : ''
      });
      await page.goto(`http://127.0.0.1:${port}/tools/char_viewer.html?${qs}`);
      await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
      const info = await page.evaluate(() => window.__info);
      await page.screenshot({ path: j.out });
      console.log(path.basename(j.out), JSON.stringify(info));
    }
  } finally {
    await browser.close();
    server.close();
  }
}
module.exports = { shoot };
if (require.main === module) {
  const [out, parts, anim, t, yaw, cam] = process.argv.slice(2);
  shoot([{ out, parts: parts.split('|'), anim, t: +t || 0.3, yaw: +yaw || 0, cam }]).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
