import { startTunnel, stopTunnel } from '../lib/tunnel.js';
import { pickTunnelType } from '../lib/tui.js';
import { printBanner, printSection, printSpin } from '../lib/ui.js';
import chalk from 'chalk';

export async function tunnelCommand(type, options) {
  printBanner();

  const tunnelType = type || await pickTunnelType();
  const port = options.port || 8080;

  printSection(`Starting ${chalk.cyan(tunnelType)} tunnel → port ${port}`);

  const spin = printSpin('Establishing tunnel...');
  try {
    const result = await startTunnel(tunnelType, port);
    if (result && result.url) {
      spin.stop(`Tunnel active at ${chalk.green(result.url)}`);
      console.log();
      console.log(chalk.gray('  ─────────────────────────────────────────────'));
      console.log(`  ${chalk.white('Public URL:')} ${chalk.green(result.url)}`);
      console.log(`  ${chalk.white('Tunnel:')}     ${chalk.cyan(tunnelType)}`);
      console.log(`  ${chalk.white('Target:')}     ${chalk.gray('http://localhost:' + port)}`);
      console.log(chalk.gray('  ─────────────────────────────────────────────'));
      console.log();
      console.log(chalk.gray('  Press Ctrl+C to stop the tunnel.'));
      console.log();

      const tunnelProc = result.proc;
      const cleanup = () => { if (tunnelProc) stopTunnel(tunnelProc); };
      process.on('SIGINT', () => { cleanup(); process.exit(0); });
      process.on('SIGTERM', () => { cleanup(); process.exit(0); });
    } else {
      spin.fail(`Could not retrieve tunnel URL. Is ${tunnelType} installed?`);
      console.log(chalk.gray(`  Install: npm install -g ${tunnelType} or visit their website`));
    }
  } catch (err) {
    spin.fail(`Tunnel failed: ${err.message}`);
  }

  // Keep alive
  await new Promise(() => {});
}
