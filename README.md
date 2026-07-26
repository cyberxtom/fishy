# fishy

CLI-first phishing framework with real scraped login pages, credential validation against live sites, and 2FA capture. Uses Puppeteer to clone exact login interfaces from real services, validates submitted credentials against genuine auth endpoints, and serves pages via local or tunneled URLs.

**For authorized security testing and educational purposes only.**

## Features

- **Real page cloning** — scrapes live login pages with Puppeteer + system Chromium for 100% authentic appearance
- **9+ service templates** — Instagram, Google, Facebook, Twitter/X, LinkedIn, GitHub, Microsoft, Apple, Netflix, TikTok, Snapchat
- **Credential validation** — submitted creds POSTed to the real site's auth endpoint for verification
- **2FA capture** — HTML keyword analysis + URL pattern detection with real-looking 2FA page
- **Post-auth redirect** — instantly redirects to the real site
- **5 tunnel integrations** — ngrok, serveo, cloudflared, localhost.run, bore
- **CLI + TUI** — command-per-action via Commander, or interactive TUI via Inquirer
- **Terminal spool + files** — captured credentials logged to terminal, `captures/credentials.json`, and `captures/credentials.csv`

## Installation

```bash
apt install chromium
npm install
```

Optional — set custom Chromium path:

```bash
export CHROMIUM_PATH=/path/to/chromium
```

## Usage

```bash
# Interactive TUI
node bin/fishy.js

# List available services
node bin/fishy.js list

# Scrape a login page
node bin/fishy.js scrape instagram

# Serve a scraped page
node bin/fishy.js serve instagram --port 8080

# Serve with tunnel
node bin/fishy.js serve instagram --tunnel ngrok

# View captured credentials
node bin/fishy.js captures
```

## Architecture

```
bin/fishy.js          CLI entry point (Commander + Inquirer TUI)
commands/
  serve.js            Express server with capture script injection
  scrape.js           Puppeteer-based page scraper
  tunnel.js           Tunnel manager (ngrok, serveo, cloudflared, etc.)
  list.js             Service and capture listing
lib/
  server.js           Express server — capture script, CSP stripping, DOM fixing
  scraper.js          Puppeteer launcher with pre-capture click sequences
  service-registry.js Service definitions and auth validation logic
  forwarder.js        Credential forwarding to real auth endpoints
  capture.js          Credential store (JSON + CSV output)
  detect-2fa.js       2FA detection (URL patterns + HTML keywords)
  tunnel.js           Tunnel launcher wrappers
  tui.js              Interactive TUI menus
  ui.js               Terminal formatting helpers
```

## Services

| Service    | Scraped | Notes |
|------------|---------|-------|
| Instagram  | ✓       | `<div role="button">` login, 2FA supported |
| TikTok     | ✓       | Multi-step pre-capture with email tab navigation |
| Snapchat   | ✓       | Email-only first step (password requires server-side validation) |
| Google     |         | |
| Facebook   |         | |
| Twitter/X  |         | |
| LinkedIn   |         | |
| GitHub     |         | |
| Microsoft  |         | |
| Apple      |         | |
| Netflix    |         | |

## Legal

This software is for **authorized security testing and educational purposes only**. You must have explicit permission to test any system you use this against. Misuse may violate applicable laws.
