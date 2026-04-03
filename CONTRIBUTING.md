# Contributing to fb-scraper

**Project:** fb-scraper  
**Maintainer:** TRABY CASPER · CASPER TECH  

Thank you for your interest in contributing! All contributions are welcome and appreciated.

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 8 or higher
- Chromium installed (for Puppeteer-based endpoints)
- Git

### Local Setup

```bash
git clone https://github.com/Casper-Tech-ke/fb-scraper.git
cd fb-scraper

# Install dependencies
npm install puppeteer-core node-fetch

# Set your Chromium path in server.js if different from /usr/bin/chromium

# Start the service
node server.js
```

The service will be available at `http://127.0.0.1:5757`.

---

## How to Contribute

### 1. Bug Reports

Before opening an issue, please:
- Search existing issues to avoid duplicates
- Confirm the bug is reproducible with a real Facebook URL

When opening a bug report, include:
- Description of the issue
- The Facebook URL that failed (if not sensitive)
- Which endpoint failed (`/scrape`, `/scrape-sf`, or `/scrape-snap`)
- Expected vs actual behaviour
- Node.js version and OS

### 2. Feature Requests

Open an issue with the label `enhancement`. Describe:
- The new scraping provider or strategy you want to add
- Why it would benefit users
- Any implementation ideas you have

### 3. Adding a New Provider

To add a new upstream scraping provider:

1. Write a new async function (e.g. `scrapeNewProvider(fbUrl)`) in `server.js`
2. Return the standard format:
   ```js
   {
     success: true,
     title: 'Facebook Video',
     thumbnail: 'https://...',
     links: [
       { url: 'https://...', label: 'HD Download', isHD: true, isSD: false }
     ]
   }
   ```
3. Add a new route block in the server's request handler:
   ```js
   if (parsed.pathname === '/scrape-newprovider') {
     // call your function
   }
   ```
4. Document the new endpoint in `README.md`

### 4. Pull Requests

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Make your changes** — keep commits focused and descriptive
4. **Test your changes** — ensure all endpoints respond correctly with a real Facebook URL
5. **Open a Pull Request** against `main` with a clear description

---

## Code Style

- Use `const`/`let`, not `var`
- Async/await over callbacks and raw Promises
- Keep scraper functions self-contained — one function per provider
- Always `close()` Puppeteer pages in a `finally` block
- Standard response shape:
  ```js
  { success: true, title, thumbnail, links: [{ url, label, isHD, isSD }] }
  ```
- Error responses:
  ```js
  res.statusCode = 500;
  res.end(JSON.stringify({ error: err.message }));
  ```

---

## Commit Message Format

Use clear, present-tense messages:

```
feat: add snapsave.app vm-decode endpoint
fix: handle empty links array from fdown.net
docs: update README with new provider
chore: bump node version requirement
```

---

## Code of Conduct

Be respectful, constructive, and inclusive. Harassment of any kind will not be tolerated.

---

© 2026 CASPER TECH · TRABY CASPER · Kenya 🇰🇪
