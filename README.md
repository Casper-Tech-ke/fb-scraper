# fb-scraper

> **Internal Facebook video scraper service — multi-provider, no API key required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Live-brightgreen)](https://apis.xcasper.space)
[![Built by](https://img.shields.io/badge/Built%20by-TRABY%20CASPER-7c3aed)](https://xcasper.space)
[![CASPER TECH](https://img.shields.io/badge/CASPER%20TECH-Open%20API-a855f7)](https://xcasper.space)
[![Node](https://img.shields.io/badge/Node.js-22.x-green)](https://nodejs.org)

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

## Quick Start

The service runs internally. To start it:

```bash
node server.js
```

Service listens on `127.0.0.1:5757`.

### Example Requests

```bash
# fdown.net scraper
curl "http://127.0.0.1:5757/scrape?url=https://www.facebook.com/reel/1234567890"

# savefrom.net scraper
curl "http://127.0.0.1:5757/scrape-sf?url=https://www.facebook.com/reel/1234567890"

# snapsave.app (fast, no browser)
curl "http://127.0.0.1:5757/scrape-snap?url=https://www.facebook.com/reel/1234567890"

# Health check
curl "http://127.0.0.1:5757/health"
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
├── server.js       - Main HTTP server (all scraping logic)
└── server.js.bak   - Backup of base server before snap function was added
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

## License

[MIT](LICENSE) © 2025 TRABY CASPER · CASPER TECH

---

<div align="center">
  <strong>Built with passion in Kenya by <a href="https://xcasper.space">TRABY CASPER</a> &middot; CASPER TECH</strong>
</div>
