import { spawn } from 'child_process';
import chalk from 'chalk';

export function startTunnel(type, port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(null), 25000);
    let url = null;

    let proc;
    switch (type) {
      case 'ngrok':
        proc = spawn('ngrok', ['http', String(port), '--log=stdout'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/https:\/\/[a-zA-Z0-9_-]+\.ngrok[-a-zA-Z0-9]*\.\w+/);
          if (match && !url) {
            url = match[0];
            clearTimeout(timeout);
            resolve(url);
          }
        });
        break;

      case 'serveo':
        proc = spawn('ssh', [
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ServerAliveInterval=30',
          '-R', `80:localhost:${port}`,
          'serveo.net',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/https?:\/\/[a-zA-Z0-9-]+\.serveo\.net/);
          if (match && !url) {
            url = match[0];
            clearTimeout(timeout);
            resolve(url);
          }
        });
        proc.stderr.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/https?:\/\/[a-zA-Z0-9-]+\.serveo\.net/);
          if (match && !url) {
            url = match[0];
            clearTimeout(timeout);
            resolve(url);
          }
        });
        break;

      case 'cloudflared':
        proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (match && !url) {
            url = match[0];
            clearTimeout(timeout);
            resolve(url);
          }
        });
        break;

      case 'localhostrun':
        proc = spawn('ssh', [
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ServerAliveInterval=30',
          '-R', `80:localhost:${port}`,
          'nokey@localhost.run',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/https?:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
          if (match && !url) {
            url = match[0];
            clearTimeout(timeout);
            resolve(url);
          }
        });
        break;

      case 'bore':
        proc = spawn('bore', ['local', String(port), '--to', 'bore.pub'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          const match = text.match(/bore\.pub:\d+/);
          if (match && !url) {
            url = `http://${match[0]}`;
            clearTimeout(timeout);
            resolve(url);
          }
        });
        break;

      default:
        clearTimeout(timeout);
        reject(new Error(`Unknown tunnel type: ${type}`));
        return;
    }

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (type === 'ngrok' && err.message.includes('ENOENT')) {
        reject(new Error('ngrok not found. Install: https://ngrok.com/download'));
      } else if (type === 'cloudflared' && err.message.includes('ENOENT')) {
        reject(new Error('cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'));
      } else {
        reject(err);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Failed') || text.includes('error')) {
        console.error(chalk.red(`  [${type}] ${text.trim()}`));
      }
    });

    proc.on('close', (code) => {
      if (code !== 0 && !url) {
        clearTimeout(timeout);
        if (!url) resolve(null);
      }
    });
  });
}

export function stopTunnel(proc) {
  if (proc) {
    proc.kill('SIGTERM');
  }
}
