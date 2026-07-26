import puppeteer from 'puppeteer-core';
import fs from 'fs';
import chalk from 'chalk';

const CHROME_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

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

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-gpu',
      '--window-size=1440,900',
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
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'font' || type === 'media' || type === 'manifest') {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(chalk.gray(`  Navigating to ${url}...`));

    // First try with networkidle2, fallback to load
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });
    } catch (e) {
      console.log(chalk.yellow(`  networkidle2 timeout, trying with 'load'...`));
      try {
        await page.goto(url, {
          waitUntil: 'load',
          timeout: 60000,
        });
      } catch (e2) {
        console.log(chalk.yellow(`  'load' timeout too, trying with 'domcontentloaded'...`));
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
      }
    }

    await new Promise(r => setTimeout(r, 3000));

    if (preCaptureActions) {
      console.log(chalk.gray(`  Running pre-capture actions...`));
      await preCaptureActions(page, browser);
      // Wait for any navigation triggered by pre-capture actions to settle
      await new Promise(r => setTimeout(r, 2000));
      try { await page.waitForNetworkIdle({ timeout: 10000 }); } catch {}
    }

    const html = await page.content();
    console.log(chalk.gray(`  Page loaded: ${(html.length / 1024).toFixed(1)}KB`));
    return html;

  } finally {
    await browser.close();
  }
}

export const PRE_CAPTURE = {
  async tiktok(page) {
    // Step 1: Click "Use phone / email / username" tab
    let clicked1 = await page.evaluate(() => {
      const targets = ['Use phone / email / username', 'Use phone/email/username'];
      for (const t of targets) {
        const xpath = `//*[text()="${t}"]`;
        const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (el) { el.click(); return t; }
      }
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const t = (el.textContent || '').trim();
        if (t === 'Use phone / email / username' || t === 'Use phone/email/username') {
          el.click(); return t;
        }
        if (el.children.length === 0) {
          const lt = t.toLowerCase();
          if (lt.includes('phone') && (lt.includes('email') || lt.includes('username'))) {
            el.click(); return t;
          }
        }
      }
      return null;
    });
    if (clicked1) console.log(chalk.gray(`  Step 1: clicked "${clicked1}"`));
    await new Promise(r => setTimeout(r, 3000));

    // Step 2: Click "Log in with email or username" to get email+password form
    let clicked2 = await page.evaluate(() => {
      const targets = ['Log in with email or username', 'Log in with password'];
      for (const t of targets) {
        const xpath = `//*[text()="${t}"]`;
        const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (el) { el.click(); return t; }
      }
      const all = document.querySelectorAll('a, button, span, div');
      for (const el of all) {
        const t = (el.textContent || '').trim();
        const lt = t.toLowerCase();
        if (lt === 'log in with email or username' || lt === 'log in with password') {
          el.click(); return t;
        }
        if (el.children.length === 0) {
          if (lt.includes('email') || lt.includes('username')) {
            el.click(); return t;
          }
        }
      }
      return null;
    });
    if (clicked2) console.log(chalk.gray(`  Step 2: clicked "${clicked2}"`));
    await new Promise(r => setTimeout(r, 3000));
  },

  async snapchat(page) {
    // Find the email input and type a dummy value, then click Next
    const emailInput = await page.$('input[type="text"], input[name="username"], input[name="email"]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.type('snapchattest@example.com', { delay: 20 });
      console.log(chalk.gray(`  Typed email into input`));
    }

    // Click the "Next" button (Urdu: اگلا or English: Next)
    await new Promise(r => setTimeout(r, 1000));
    const clicked = await page.evaluate(() => {
      const texts = ['Next', 'اگلا', 'next'];
      const all = document.querySelectorAll('button, a, [role="button"], [role="link"]');
      for (const el of all) {
        const t = (el.textContent || '').trim();
        if (texts.includes(t)) { el.click(); return t; }
      }
      return null;
    });
    if (clicked) console.log(chalk.gray(`  Clicked Next: "${clicked}"`));
    await new Promise(r => setTimeout(r, 5000));
  },
};
