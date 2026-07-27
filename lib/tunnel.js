import { spawn } from 'child_process';
import chalk from 'chalk';

export function startTunnel(type, port) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log(chalk.yellow(`  [${type}] Timeout waiting for tunnel URL (25s)`));
      resolve(null);
    }, 25000);
    let resolved = false;
    let proc;

    const onUrl = (text) => {
      if (resolved) return;
      const match = text.match(TUNNEL_PATTERNS[type]);
      if (match) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: match[1] || match[0], proc });
      }
    };

    const onStderr = (text) => {
      if (resolved) return;
      const match = text.match(TUNNEL_PATTERNS[type]);
      if (match) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: match[1] || match[0], proc });
      }
      if (text.toLowerCase().includes('failed') || text.toLowerCase().includes('error')) {
        console.error(chalk.red(`  [${type}] ${text.trim()}`));
      }
    };

    switch (type) {
      case 'cloudflared':
        proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (data) => onUrl(data.toString()));
        proc.stderr.on('data', (data) => onStderr(data.toString()));
        break;

      case 'ngrok':
        proc = spawn('ngrok', ['http', String(port), '--log=stdout'], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (data) => onUrl(data.toString()));
        break;

      case 'serveo':
        proc = spawn('ssh', [
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ServerAliveInterval=30',
          '-R', `80:localhost:${port}`,
          'serveo.net',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (data) => onUrl(data.toString()));
        proc.stderr.on('data', (data) => onStderr(data.toString()));
        break;

      case 'localhostrun':
        proc = spawn('ssh', [
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ServerAliveInterval=30',
          '-R', `80:localhost:${port}`,
          'nokey@localhost.run',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (data) => onUrl(data.toString()));
        break;

      case 'bore':
        proc = spawn('bore', ['local', String(port), '--to', 'bore.pub'], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (data) => onUrl(data.toString()));
        break;

      default:
        clearTimeout(timeout);
        resolve(null);
        return;
    }

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (err.message.includes('ENOENT')) {
        resolve(null);
      } else if (!resolved) {
        console.log(chalk.red(`  [${type}] ${err.message}`));
        resolve(null);
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
}

const TUNNEL_PATTERNS = {
  cloudflared: /https:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*[a-zA-Z0-9]\.trycloudflare\.com/,
  ngrok: /https:\/\/[a-zA-Z0-9_-]+\.ngrok[-a-zA-Z0-9]*\.\w+/,
  serveo: /https?:\/\/[a-zA-Z0-9-]+\.serveo\.net/,
  localhostrun: /https?:\/\/[a-zA-Z0-9-]+\.lhr\.life/,
  bore: /bore\.pub:\d+/,
};

export function stopTunnel(proc) {
  if (proc) {
    try { proc.kill('SIGTERM'); } catch {}
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
    }, 3000);
  }
}
