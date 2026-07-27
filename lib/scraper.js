import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

let profileCounter = 0;

function findChrome() {
  const { CHROMIUM_PATH, CHROME_PATH } = process.env;
  if (CHROMIUM_PATH && fs.existsSync(CHROMIUM_PATH)) return CHROMIUM_PATH;
  if (CHROME_PATH && fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  for (const p of CHROME_PATHS) {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {}
  }
  return null;
}

const STEALTH_SCRIPT = `
(() => {
  // Override navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // Override navigator.plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5].map(i => ({
      name: 'Chrome PDF Plugin',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
      length: 1
    }))
  });

  // Override navigator.languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // Override chrome.runtime
  if (window.chrome) {
    window.chrome.runtime = {
      id: 'aapocclcgogkmnckokdopfmhonfmgoek',
      getManifest: () => ({ version: '125' }),
      getURL: (p) => p,
      connect: () => null,
      sendMessage: () => null
    };
  }

  // Override permissions query
  const origQuery = Permissions.prototype.query;
  Permissions.prototype.query = function(desc) {
    if (desc.name === 'notifications') return Promise.resolve({ state: 'prompt' });
    return origQuery.call(this, desc);
  };

  // Remove webdriver from navigator fully
  const getter = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
  if (getter) {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => false,
      configurable: true,
    });
  }

  // Hide headless chrome
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

  // Fix screen dimensions
  if (screen.width === 0 || screen.height === 0) {
    Object.defineProperty(screen, 'width', { get: () => 1440 });
    Object.defineProperty(screen, 'height', { get: () => 900 });
  }
})();
`;

export async function scrapePage(url, preCaptureActions = null) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Chrome/Chromium not found. Install it or set CHROMIUM_PATH env var.\n' +
      '  Debian: apt install chromium\n' +
      '  macOS:  brew install --cask google-chrome\n' +
      '  Or set: export CHROMIUM_PATH=/path/to/chrome'
    );
  }

  console.log(chalk.gray(`  Browser: ${chromePath}`));

  const tempDir = path.join('/tmp', `fishy-profile-${process.pid}-${profileCounter++}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    userDataDir: tempDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--disable-gpu',
      '--window-size=1440,900',
      '--disable-notifications',
      '--disable-popup-blocking',
      '--disable-infobars',
      `--window-name=fishy-scrape-${Date.now()}`,
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Ch-Ua': '"Chromium";v="125", "Google Chrome";v="125"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    });

    await page.evaluateOnNewDocument(STEALTH_SCRIPT);

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'font' || type === 'media' || type === 'manifest' || type === 'websocket' || type === 'other') {
        try { req.abort(); } catch {}
        return;
      }
      try { req.continue(); } catch {}
    });

    console.log(chalk.gray(`  Navigating to ${url}...`));

    let gotHtml = false;
    const errors = [];

    for (const waitUntil of ['networkidle2', 'load', 'domcontentloaded']) {
      if (gotHtml) break;
      try {
        await page.goto(url, {
          waitUntil,
          timeout: 45000,
        });
        gotHtml = true;
      } catch (e) {
        errors.push(`${waitUntil}: ${e.message}`);
      }
    }

    if (!gotHtml) {
      // Last resort: just get whatever content is available
      const html = await page.content();
      if (html && html.length > 100) {
        console.log(chalk.yellow(`  Partial page: ${(html.length / 1024).toFixed(1)}KB`));
        return html;
      }
      throw new Error(`Could not load page: ${errors.join('; ')}`);
    }

    await new Promise(r => setTimeout(r, 3000));

    // Wait for form input elements to appear (SPA rendering)
    try {
      await page.waitForSelector('input, textarea, select', {
        timeout: 20000,
      });
      console.log(chalk.gray(`  Input elements detected`));
    } catch {
      console.log(chalk.yellow(`  No input elements found (SPA may not have rendered)`));
    }

    if (preCaptureActions) {
      console.log(chalk.gray(`  Running pre-capture actions...`));
      await preCaptureActions(page, browser);
      await new Promise(r => setTimeout(r, 2000));
      try { await page.waitForNetworkIdle({ timeout: 10000 }); } catch {}
    }

    const html = await page.content();
    console.log(chalk.gray(`  Page loaded: ${(html.length / 1024).toFixed(1)}KB`));
    return html;

  } finally {
    await browser.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

export const PRE_CAPTURE = {
  async tiktok(page) {
    const log = (msg) => console.log(chalk.gray(`  [TikTok] ${msg}`));

    // Step 1: Click "Use phone / email / username" tab
    let clicked1 = await page.evaluate(() => {
      const targets = ['Use phone / email / username', 'Use phone/email/username'];
      for (const t of targets) {
        const el = document.evaluate(`//*[text()="${t}"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (el) { el.click(); return t; }
      }
      for (const el of document.querySelectorAll('*')) {
        const t = (el.textContent || '').trim();
        const lt = t.toLowerCase();
        if (lt === 'use phone / email / username' || lt === 'use phone/email/username') { el.click(); return t; }
        if (!el.children.length && lt.includes('phone') && (lt.includes('email') || lt.includes('username'))) { el.click(); return t; }
      }
      return null;
    });
    if (clicked1) log(`Step 1: clicked "${clicked1}"`);
    else log('Step 1: "Use phone/email/username" not found, may already be on email form');
    await new Promise(r => setTimeout(r, 3000));

    // Check if inputs already visible
    const hasEmailInput = await page.evaluate(() => !!document.querySelector('input[name="username"]'));
    if (hasEmailInput) {
      log('Email/password inputs already visible, skipping Step 2');
      return;
    }

    // Step 2: Click login tab/button with email/username option
    let clicked2 = await page.evaluate(() => {
      const all = document.querySelectorAll('a, button, span, div, [role="tab"], [role="button"]');
      for (const el of all) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (['log in with email or username', 'log in with password', 'email/username', 'use email', 'log in with email'].includes(t)) {
          el.click(); return t;
        }
      }
      for (const el of all) {
        if (!el.children.length) {
          const t = (el.textContent || '').trim().toLowerCase();
          if (t.includes('email') || t.includes('username')) { el.click(); return t; }
        }
      }
      return null;
    });
    if (clicked2) log(`Step 2: clicked "${clicked2}"`);
    else log('Step 2: no email/username option found');
    await new Promise(r => setTimeout(r, 3000));
  },

  async snapchat(page) {
    const log = (msg) => console.log(chalk.gray(`  [Snapchat] ${msg}`));
    // Snapchat is a two-step SPA. We serve the initial email form.
    // The user enters email, clicks Next → our capture fires with partial creds.
    // No pre-capture actions needed — just wait for the initial page to load.
    try { await page.waitForNetworkIdle({ timeout: 20000 }); } catch { log('network still busy, proceeding'); }
  },
};
