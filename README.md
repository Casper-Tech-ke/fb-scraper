# fb-scraper

[![Social Preview](https://fb.xcasper.space/og.png)](https://fb.xcasper.space)

> **Internal Facebook video scraper service — multi-provider, no API key required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Live-brightgreen)](https://fb.xcasper.space)
[![Built by](https://img.shields.io/badge/Built%20by-TRABY%20CASPER-7c3aed)](https://xcasper.space)
[![CASPER TECH](https://img.shields.io/badge/CASPER%20TECH-Open%20API-a855f7)](https://xcasper.space)
[![Node](https://img.shields.io/badge/Node.js-22.x-green)](https://nodejs.org)

**Live:** [https://fb.xcasper.space](https://fb.xcasper.space)

**Share:** [Facebook](https://www.facebook.com/sharer/sharer.php?u=https://fb.xcasper.space) · [Twitter/X](https://twitter.com/intent/tweet?text=Free+Facebook+Video+Downloader+API+by+CASPER+TECH&url=https://fb.xcasper.space) · [WhatsApp](https://wa.me/?text=Check+out+fb-scraper+by+CASPER+TECH:+https://fb.xcasper.space)

**Part of:** [CASPER TECH API Hub](https://apis.xcasper.space) — 260+ free API endpoints

---

## What Is This?

`fb-scraper` is a lightweight internal Node.js HTTP service that powers the Facebook video downloader endpoints on the CASPER TECH API Hub (`apis.xcasper.space`). It runs on the VPS at `127.0.0.1:5757` and is not publicly exposed — all traffic comes from the Next.js API layer.

It provides three scraping strategies, each targeting a different upstream provider:

1. **fdown.net (Puppeteer)** — navigates fdown.net via a headless Chromium browser, submits the Facebook URL, and extracts `fbcdn.net` direct download links. HD/SD detected via URL pattern (`/m366/` = HD, `/m412/` = SD).
2. **savefrom.net (Puppeteer)** — drives en1.savefrom.net with a stealth browser session, extracts quality-labelled download links and thumbnail.
3. **snapsave.app (vm-decode, no browser)** — posts to `snapsave.app/action.php` via plain HTTP, receives obfuscated JavaScript, executes it inside a Node.js `vm` sandbox with a mocked `document.getElementById` setter, and parses the decoded HTML for `d.rapidcdn.app` JWT-proxied download links. No Puppeteer required — ~250ms response time.

Built and maintained by **TRABY CASPER** under the **CASPER TECH** umbrella.

---

## Owner & Author

| | |
|---|---|
| **Name** | TRABY CASPER |
| **Organisation** | CASPER TECH |
| **Country** | Kenya |
| **Website** | [xcasper.space](https://xcasper.space) |
| **GitHub** | [@Casper-Tech-ke](https://github.com/Casper-Tech-ke) |
| **Role** | Founder & Lead Developer |

CASPER TECH is a Kenyan tech initiative building free, accessible developer tools and APIs for African and global developers. fb-scraper is a core internal service of the CASPER TECH API Hub — [apis.xcasper.space](https://apis.xcasper.space).

---

## Endpoints

All endpoints accept the Facebook URL via `?url=` query parameter.

| Method | Path | Provider | Strategy |
|--------|------|----------|----------|
| GET | `/health` | — | Health check and uptime |
| GET | `/scrape?url=FB_URL` | fdown.net | Puppeteer (Chromium headless) |
| GET | `/scrape-sf?url=FB_URL` | savefrom.net | Puppeteer (Chromium headless) |
| GET | `/scrape-snap?url=FB_URL` | snapsave.app | Pure HTTP + vm sandbox |

---

## Self-Hosting

### Prerequisites

- Node.js 18 or higher
- Chromium installed (for Puppeteer endpoints)
- PM2 (recommended for production)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/Casper-Tech-ke/fb-scraper.git
cd fb-scraper

# Install puppeteer-core (and node-fetch if not on Node 18+)
npm install puppeteer-core node-fetch

# Set your Chromium path in server.js (default: /usr/bin/chromium)
# CHROMIUM = '/usr/bin/chromium'

# Run directly
node server.js

# Or run with PM2
pm2 start server.js --name fb-scraper
pm2 save
```

The service listens on `127.0.0.1:5757` by default. To change the port, update `PORT` at the top of `server.js`.

### Chromium Setup (Ubuntu/Debian)

```bash
apt-get install -y chromium-browser
# or
apt-get install -y chromium
```

### Deploy on Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect GitHub → select `Casper-Tech-ke/fb-scraper`
3. Configure:

| Setting | Value |
|---------|-------|
| Environment | Node |
| Build Command | `npm install puppeteer-core node-fetch` |
| Start Command | `node server.js` |
| Port | `5757` |

> **Puppeteer note:** Render free tier does not ship Chromium by default. Add the [Puppeteer buildpack](https://render.com/docs/render-buildpacks) in Settings → Buildpacks. Without it, only `/scrape-snap` (no browser) will work.

```bash
# Environment variable (Render dashboard)
CHROMIUM_PATH=/usr/bin/google-chrome-stable
```

### Deploy on Koyeb

1. Go to [koyeb.com](https://koyeb.com) → **Create App**
2. Select **GitHub** → `Casper-Tech-ke/fb-scraper`
3. Configure:

| Setting | Value |
|---------|-------|
| Run Command | `node server.js` |
| Port | `5757` |
| Plan | Nano (free) — snap endpoint only / Micro for full Puppeteer |

> **Docker deploy (recommended for Puppeteer):** Use a `Dockerfile` that installs Chromium. Example:

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y chromium --no-install-recommends
WORKDIR /app
COPY . .
RUN npm install puppeteer-core node-fetch
ENV CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 5757
CMD ["node", "server.js"]
```

### Deploy on Replit

1. Go to [replit.com](https://replit.com) → **Create Repl**
2. Select **Import from GitHub** → paste `https://github.com/Casper-Tech-ke/fb-scraper`
3. In the Shell tab:

```bash
npm install puppeteer-core node-fetch
```

4. Create or update `.replit`:

```toml
run = "node server.js"
```

> **⚠️ Important:** Chromium/Puppeteer is **NOT available** on Replit free tier. Only `/scrape-snap` (snapsave.app vm-decode — no browser) will work. To use `/scrape` and `/scrape-sf`, upgrade to **Replit Core**.

---

## Example Requests

```bash
# Health check
curl "http://127.0.0.1:5757/health"

# fdown.net scraper (HD + SD fbcdn.net links)
curl "http://127.0.0.1:5757/scrape?url=https://www.facebook.com/reel/1234567890"

# savefrom.net scraper
curl "http://127.0.0.1:5757/scrape-sf?url=https://www.facebook.com/reel/1234567890"

# snapsave.app — fast, no browser needed
curl "http://127.0.0.1:5757/scrape-snap?url=https://www.facebook.com/reel/1234567890"
```

---

## Response Format

### `/scrape` and `/scrape-sf`

```json
{
  "success": true,
  "title": "Facebook Video",
  "thumbnail": "https://scontent.fbcdn.net/...",
  "links": [
    { "url": "https://video-xxx.fbcdn.net/...m366...", "label": "HD Download" },
    { "url": "https://video-xxx.fbcdn.net/...m412...", "label": "SD Download" }
  ]
}
```

### `/scrape-snap`

```json
{
  "success": true,
  "title": "Facebook Video",
  "thumbnail": "https://d.rapidcdn.app/thumb?token=...",
  "links": [
    {
      "label": "720p (HD)",
      "url": "https://d.rapidcdn.app/v2?token=...",
      "isHD": true,
      "isSD": false
    }
  ]
}
```

### Error Response

```json
{
  "error": "Description of what went wrong"
}
```

---

## Quality Detection

For `/scrape` (fdown.net), HD/SD quality is detected from the fbcdn.net URL pattern:

| URL Pattern | Quality |
|-------------|---------|
| `/m366/` | HD |
| `/m412/` | SD |
| `/m420/` | HD |
| `hd` in URL | HD |
| `sd` in URL | SD |

---

## How the vm-decode Works (`/scrape-snap`)

snapsave.app returns obfuscated JavaScript instead of plain HTML. The decoding flow:

1. `POST https://snapsave.app/action.php?lang=en` with `multipart/form-data` body `url=<FB_URL>`
2. Response is ~23KB of obfuscated JS (eval-based)
3. A Node.js `vm.Script` is created with a mocked browser environment:
   - `window.location.hostname = 'snapsave.app'`
   - `document.getElementById()` returns an object with an `innerHTML` setter that captures the decoded HTML
   - `document.querySelector()` and `remove()` stubs to prevent errors
4. The captured HTML is parsed with regex for `href="https://d.rapidcdn.app/v2?token=..."` download links and thumbnail URLs
5. Links are JWT-proxied `fbcdn.net` URLs with ~60 minute expiry

---

## Supported Facebook URL Formats

```
https://www.facebook.com/videos/1234567890
https://www.facebook.com/reel/1234567890
https://web.facebook.com/reel/1234567890
https://m.facebook.com/watch/?v=1234567890
https://fb.watch/xxxxxxxx
https://www.facebook.com/share/v/xxxxxxxx
https://www.facebook.com/share/r/xxxxxxxx
```

---

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `puppeteer-core` | Headless Chromium automation for fdown.net and savefrom.net |
| `node-fetch` | HTTP requests for snapsave.app |
| Built-in `vm` | Sandboxed JS execution for snapsave obfuscation decode |
| Built-in `http` | HTTP server |

Chromium path: `/usr/bin/chromium`
Puppeteer path: `/tmp/iss-capture/node_modules/puppeteer-core`

---

## Project Structure

```
fb-scraper/
├── server.js              - Main HTTP server (all scraping logic + static file serving)
├── server.js.bak          - Backup of base server before snap function was added
├── public/
│   ├── index.html         - Interactive documentation frontend
│   ├── terms.html         - Terms of Service
│   ├── privacy.html       - Privacy Policy
│   ├── disclaimer.html    - Disclaimer page
│   ├── favicon.svg        - SVG favicon
│   └── og.png             - Social preview image (1200×630)
├── CONTRIBUTING.md
├── DISCLAIMER.md
├── LICENSE
└── README.md
```

---

## API Hub Integration

This service powers the following public endpoints on [apis.xcasper.space](https://apis.xcasper.space):

| Public Endpoint | Uses | Strategy |
|----------------|------|----------|
| `POST /api/downloader/fb` | `/scrape` | fdown.net Puppeteer, fallback: xaviabot |
| `POST /api/downloader/fb2` | `/scrape-sf` + `/scrape` | savefrom.net → fdown.net → xaviabot |
| `POST /api/downloader/fb3` | `/scrape` | fget.io direct API → fdown.net → xaviabot |
| `POST /api/downloader/fb4` | `/scrape-snap` | snapsave.app vm-decode |

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## Legal

- [Disclaimer](https://fb.xcasper.space/disclaimer.html) — not affiliated with Facebook/Meta
- [Terms of Service](https://fb.xcasper.space/terms.html) — usage rules and restrictions  
- [Privacy Policy](https://fb.xcasper.space/privacy.html) — no personal data stored
- [DISCLAIMER.md](DISCLAIMER.md) — GitHub markdown version

## License

[MIT](LICENSE) © 2026 TRABY CASPER · CASPER TECH

---

<div align="center">
  <strong>Built with passion in Kenya by <a href="https://xcasper.space">TRABY CASPER</a> &middot; CASPER TECH</strong>
</div>
