import { scrapePage, PRE_CAPTURE } from '../lib/scraper.js';
import { pickServiceForScrape } from '../lib/tui.js';
import { printBanner, printSection, printSpin } from '../lib/ui.js';
import { saveScrapedPage, getService } from '../lib/service-registry.js';
import chalk from 'chalk';

export async function scrapeCommand(serviceArg, options) {
  printBanner();

  let target;
  if (serviceArg) {
    const svc = getService(serviceArg);
    if (svc) {
      target = { id: serviceArg, name: svc.name, url: svc.loginUrl };
    } else {
      target = { id: serviceArg, name: serviceArg, url: serviceArg, custom: true };
    }
  } else {
    target = await pickServiceForScrape();
  }

  if (!target.custom && !getService(target.id)) {
    const svc = getService(target.id);
    if (svc) target.url = svc.loginUrl;
  }

  if (!target.url) {
    console.log(chalk.red(`  ✗ Unknown service: ${target.id}`));
    return;
  }

  printSection(`Scraping ${chalk.cyan(target.name)}`);

  let loginHtml;
  let twofaHtml = null;

  // Scrape login page
  const loginSpin = printSpin('Downloading login page...');
  try {
    const preAction = PRE_CAPTURE[target.id];
    loginHtml = await scrapePage(target.url, preAction || null);
    loginSpin.stop(`Login page saved (${(loginHtml.length / 1024).toFixed(1)}KB)`);
  } catch (err) {
    loginSpin.fail(`Failed: ${err.message}`);
    return;
  }

  // Save login page
  saveScrapedPage(target.id, 'login', loginHtml);
  console.log(chalk.gray(`  Saved to: scraped/${target.id}/login.html`));

  // Try to scrape 2FA page if service has one defined
  const svc = getService(target.id);
  if (svc?.twofaUrl) {
    const twofaSpin = printSpin('Downloading 2FA page...');
    try {
      twofaHtml = await scrapePage(svc.twofaUrl);
      if (twofaHtml && twofaHtml.length > 1000) {
        saveScrapedPage(target.id, 'twofa', twofaHtml);
        twofaSpin.stop(`2FA page saved (${(twofaHtml.length / 1024).toFixed(1)}KB)`);
        console.log(chalk.gray(`  Saved to: scraped/${target.id}/twofa.html`));
      } else {
        twofaSpin.fail('2FA page too small, skipping');
      }
    } catch (err) {
      twofaSpin.fail(`2FA page not available: ${err.message}`);
    }
  }

  console.log();
  console.log(chalk.green(`  ✓ ${target.name} scraped successfully`));
  console.log();
  console.log(chalk.gray(`  To serve: fishy serve ${target.id}`));
  console.log(chalk.gray(`  To serve with tunnel: fishy serve ${target.id} --tunnel`));
  console.log();
}
