#!/usr/bin/env node
// Render what a user SEES for D59, from a real install: the popup on a stood-down site (and on a control
// site), and the settings card, in light and dark. Same non-automation rig as probe-site.mjs.
//
//   NULLECHO_PUPPETEER_DIR=<dir> node ui-render.mjs <outDir> <unzipped chrome zip>
//
// The popup normally reads the active tab; opened as a page it would read its own tab, so its
// `chrome.tabs.query` is pointed at the measured tab before any of its scripts run. Nothing else in the
// popup is touched — the report it renders is the service worker's real answer for that tab.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const puppeteer = createRequire(path.join(process.env.NULLECHO_PUPPETEER_DIR, 'package.json'))('puppeteer');
const [OUT, EXT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-bm59-ui-'));
const browser = await puppeteer.launch({ headless: false, userDataDir,
  args: ['--no-first-run', '--window-size=1280,1000', '--disable-blink-features=AutomationControlled', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  ignoreDefaultArgs: ['--enable-automation', '--disable-extensions'] });
await new Promise((r) => setTimeout(r, 1500));
const sw = browser.targets().find((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'));
const id = new URL(sw.url()).host;
const worker = await sw.worker();
const site = await browser.newPage();
const out = {};

async function shoot(siteUrl, label) {
  await site.bringToFront();
  await site.goto(siteUrl, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 6000));
  const tab = await worker.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url && t.url.startsWith(u)), new URL(siteUrl).origin);
  for (const scheme of ['light', 'dark']) {
    const p = await browser.newPage();
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await p.setViewport({ width: 380, height: 1100 });
    await p.evaluateOnNewDocument((t) => { chrome.tabs.query = async () => [t]; }, { id: tab.id, url: tab.url, active: true });
    await p.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    await p.screenshot({ path: path.join(OUT, `popup-${label}-${scheme}.png`), fullPage: true });
    out[`popup-${label}-${scheme}`] = await p.evaluate(() => ({
      alerts: [...document.querySelectorAll('#alerts .alert')].map((a) => a.textContent.trim()),
      personaId: document.getElementById('persona-id')?.textContent,
      rows: ['p-system', 'p-gpu', 'p-cpu'].map((k) => document.getElementById(k)?.textContent),
      personaNote: document.querySelector('.persona + .note')?.textContent,
      findings: [...document.querySelectorAll('#findings li')].map((l) => l.textContent.trim().slice(0, 240)),
    }));
    await p.close();
  }
}

await shoot('https://www.tesla.com/', 'tesla');
await shoot('https://en.wikipedia.org/wiki/Main_Page', 'wikipedia');

for (const scheme of ['light', 'dark']) {
  const o = await browser.newPage();
  await o.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await o.setViewport({ width: 1100, height: 900 });
  await o.goto(`chrome-extension://${id}/options/options.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));
  const card = await o.$('#bot-managers');
  await card.screenshot({ path: path.join(OUT, `options-card-${scheme}.png`) });
  out[`options-${scheme}`] = await o.evaluate(() => {
    const c = document.getElementById('bot-managers');
    const btn = c.querySelector('#bot-body button');
    const cs = btn ? getComputedStyle(btn) : null;
    return { rows: [...c.querySelectorAll('#bot-body tr')].map((tr) => tr.textContent.trim()), empty: !document.getElementById('bot-empty').hidden,
      button: btn ? { text: btn.textContent, color: cs.color, background: cs.backgroundColor } : null };
  });
  await o.close();
}
// The button itself: the warning is shown, and accepting it is what flips the override.
{
  const o = await browser.newPage();
  await o.goto(`chrome-extension://${id}/options/options.html`, { waitUntil: 'networkidle0' });
  const dialogs = [];
  o.on('dialog', async (d) => { dialogs.push(d.message()); if (dialogs.length === 1) await d.dismiss(); else await d.accept(); });
  const click = async () => { await o.click('#bot-body button'); await new Promise((r) => setTimeout(r, 800)); };
  const read = () => worker.evaluate(async () => (await chrome.storage.local.get('botManagerSites')).botManagerSites);
  await click();                                       // dismissed: nothing may change
  const afterDismiss = await read();
  await click();                                       // accepted
  const afterAccept = await read();
  const label = await o.$eval('#bot-body button', (b) => b.textContent);
  out.overrideButton = { dialogs, afterDismiss: afterDismiss?.['tesla.com']?.override, afterAccept: afterAccept?.['tesla.com']?.override, labelAfter: label };
  await o.close();
}
fs.writeFileSync(path.join(OUT, 'ui-render.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
fs.rmSync(userDataDir, { recursive: true, force: true });
