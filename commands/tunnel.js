import { startTunnel } from '../lib/tunnel.js';
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
    const url = await startTunnel(tunnelType, port);
    if (url) {
      spin.stop(`Tunnel active at ${chalk.green(url)}`);
      console.log();
      console.log(chalk.gray('  ─────────────────────────────────────────────'));
      console.log(`  ${chalk.white('Public URL:')} ${chalk.green(url)}`);
      console.log(`  ${chalk.white('Tunnel:')}     ${chalk.cyan(tunnelType)}`);
      console.log(`  ${chalk.white('Target:')}     ${chalk.gray('http://localhost:' + port)}`);
      console.log(chalk.gray('  ─────────────────────────────────────────────'));
      console.log();
      console.log(chalk.gray('  Press Ctrl+C to stop the tunnel.'));
      console.log();
    } else {
      spin.fail('Could not retrieve tunnel URL');
    }
  } catch (err) {
    spin.fail(`Tunnel failed: ${err.message}`);
  }

  // Keep alive
  await new Promise(() => {});
}
