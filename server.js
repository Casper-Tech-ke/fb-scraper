const http = require('http');
const url = require('url');

const CHROMIUM = '/usr/bin/chromium';
const PUPPETEER_PATH = '/tmp/iss-capture/node_modules/puppeteer-core';
const PORT = 5757;

let puppeteer;
let browser;

async function getPuppeteer() {
  if (!puppeteer) puppeteer = require(PUPPETEER_PATH);
  return puppeteer;
}

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  const pptr = await getPuppeteer();
  browser = await pptr.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
  });
  browser.on('disconnected', () => { browser = null; });
  return browser;
}

async function scrapeFdown(fbUrl) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto('https://fdown.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.evaluate((u) => {
      const input = document.querySelector('input[name="URLz"]') || document.querySelector('input[type="text"]');
      if (input) input.value = u;
    }, fbUrl);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      }),
    ]);

    const links = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('a[href*="fbcdn.net"], a[href*="video-"][href*="fbcdn"]').forEach(a => {
        const href = a.getAttribute('href');
        if (href) result.push({ url: href, label: a.textContent.trim() });
      });
      return result;
    });

    const thumb = await page.evaluate(() => {
      const img = document.querySelector('img[src*="fbcdn"]') ||
                  document.querySelector('.thumbnail img') ||
                  document.querySelector('img.img-responsive');
      return img ? img.src : '';
    });

    const title = await page.evaluate(() => {
      const t = document.querySelector('h2') || document.querySelector('.video-title') || document.querySelector('title');
      return t ? t.textContent.trim() : 'Facebook Video';
    });

    return { success: true, title, thumbnail: thumb, links };
  } finally {
    await page.close().catch(() => {});
  }
}

// Detect quality from URL: m366 = HD, m412 = SD in fbcdn URLs
function detectQualityFromUrl(href) {
  if (/\/m366\//.test(href)) return 'HD';
  if (/\/m412\//.test(href)) return 'SD';
  if (/\/m420\//.test(href)) return 'HD';
  if (/hd/i.test(href)) return 'HD';
  if (/sd/i.test(href)) return 'SD';
  return null;
}

async function scrapeSavefrom(fbUrl) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto('https://en1.savefrom.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForSelector('input[name="sf_url"], input[type="text"], #sf_url', { timeout: 10000 }).catch(() => {});

    await page.evaluate((u) => {
      const input = document.querySelector('input[name="sf_url"]') ||
                    document.querySelector('#sf_url') ||
                    document.querySelector('input[type="text"]');
      if (input) {
        input.value = u;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, fbUrl);

    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') ||
                  document.querySelector('input[type="submit"]') ||
                  document.querySelector('.sf-btn-submit');
      if (btn) btn.click();
      else {
        const form = document.querySelector('form');
        if (form) form.submit();
      }
    });

    // Wait for fbcdn video download links
    try {
      await page.waitForFunction(
        () => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          return links.some(a => {
            const h = a.getAttribute('href') || '';
            return (h.includes('video-') && h.includes('fbcdn.net')) ||
                   (h.includes('.fbcdn.net') && h.includes('/v/'));
          });
        },
        { timeout: 30000, polling: 1000 }
      );
    } catch (e) {
      console.log('[savefrom] Timeout waiting for CDN links');
    }

    // Extract ONLY real Facebook CDN video links (not navigation links)
    const links = await page.evaluate((detectFn) => {
      const result = [];
      const seen = new Set();

      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('http')) return;

        // Must be a real Facebook CDN URL — NOT savefrom.net, google, etc.
        const isVideoLink = (href.includes('fbcdn.net') || href.includes('fbwat.ch')) &&
                            !href.includes('scontent') && // exclude image thumbnails
                            (href.includes('/v/') || href.includes('video-') || href.includes('/m3') || href.includes('/m4'));

        // Also accept scontent fbcdn links that look like videos
        const isScontent = href.includes('fbcdn.net') && href.includes('scontent') &&
                           (href.includes('.mp4') || href.includes('/v/t2/'));

        if (!isVideoLink && !isScontent) return;
        if (seen.has(href)) return;
        seen.add(href);

        const label = a.textContent.trim();
        const isHD = /hd|high|1080|720|mp4 hd/i.test(label);
        const isSD = /sd|low|480|360|mp4 sd/i.test(label);

        result.push({ url: href, label, isHD, isSD });
      });

      return result;
    }, detectQualityFromUrl.toString());

    const thumb = await page.evaluate(() => {
      // Get thumbnail (scontent image, not a video link)
      const img = document.querySelector('img[src*="fbcdn"]') ||
                  document.querySelector('[class*="result"] img, [class*="preview"] img, [class*="thumbnail"] img');
      return img ? img.src : '';
    });

    const title = await page.evaluate(() => {
      const el = document.querySelector('.sf-result-title, .video-name, [class*="title"]');
      return el ? el.textContent.trim().slice(0, 100) : 'Facebook Video';
    });

    // Post-process: assign HD/SD using URL patterns if labels didn't work
    const processed = links.map(l => {
      let qualityFromUrl = null;
      if (/\/m366\//.test(l.url)) qualityFromUrl = 'HD';
      else if (/\/m412\//.test(l.url)) qualityFromUrl = 'SD';
      return {
        ...l,
        isHD: l.isHD || qualityFromUrl === 'HD',
        isSD: l.isSD || qualityFromUrl === 'SD',
        qualityFromUrl,
      };
    });

    console.log(`[savefrom] links: ${JSON.stringify(processed.map(l => ({label: l.label, isHD: l.isHD, isSD: l.isSD, url: l.url.slice(0,60)})))}`);

    if (!processed.length) throw new Error('No download links found on savefrom.net');

    return { success: true, title: title || 'Facebook Video', thumbnail: thumb, links: processed };
  } finally {
    await page.close().catch(() => {});
  }
}


// ── scrapeSnapsave: uses snapsave.app/action.php (multipart POST + vm eval decode) ──
const vm = require('vm');
const https = require('https');

async function scrapeSnapsave(fbUrl) {
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2, 14);
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${fbUrl}\r\n--${boundary}--\r\n`;
  const bodyBuf = Buffer.from(body, 'utf8');

  const rawJs = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'snapsave.app',
      path: '/action.php?lang=en',
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': bodyBuf.length,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'Referer': 'https://snapsave.app/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('snapsave.app request timeout')); });
    req.write(bodyBuf);
    req.end();
  });

  if (!rawJs || rawJs.length < 200) throw new Error('Empty/short response from snapsave.app');

  // Execute the obfuscated JS in a vm sandbox — innerHTML setter captures the decoded HTML
  let capturedHTML = '';
  const domEl = {
    get innerHTML() { return capturedHTML; },
    set innerHTML(v) { capturedHTML = v; },
    remove() {},
  };
  const sandbox = vm.createContext({
    window: { location: { hostname: 'snapsave.app' } },
    document: { getElementById: () => domEl, querySelector: () => null },
    Math, Date,
  });

  try {
    vm.runInContext(rawJs, sandbox, { timeout: 6000 });
  } catch (_) { /* expected — missing non-critical browser APIs */ }

  if (!capturedHTML) throw new Error('Could not decode snapsave.app response — innerHTML not set');

  // capturedHTML has real (unescaped) double quotes from vm eval execution
  const linkRe = /href="(https:\/\/d\.rapidcdn\.app\/v2[^"]+)"/g;
  const links = [];
  let m;
  while ((m = linkRe.exec(capturedHTML)) !== null) links.push(m[1]);

  const qualRe = /class="video-quality">([^<]+)<\/td>/g;
  const quals = [];
  let qm;
  while ((qm = qualRe.exec(capturedHTML)) !== null) quals.push(qm[1].trim());

  const thumbM = capturedHTML.match(/img src="(https:\/\/d\.rapidcdn\.app\/thumb[^"]+)"/);
  const thumb = thumbM ? thumbM[1] : '';

  if (!links.length) throw new Error('No rapidcdn download links found in snapsave response');

  const result = links.map((u, i) => {
    const q = quals[i] || `Quality ${i + 1}`;
    return {
      url: u,
      label: q,
      isHD: /hd|720|1080/i.test(q),
      isSD: /sd|360|480/i.test(q),
    };
  });

  console.log(`[snapsave] ${result.length} links: ${result.map(r => r.label).join(', ')}`);
  return { success: true, title: 'Facebook Video', thumbnail: thumb, links: result };
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Static file server for public/
  if (req.method === 'GET') {
    const fs = require('fs');
    const path = require('path');
    const mimeMap = {
      '.html':'text/html; charset=utf-8',
      '.svg':'image/svg+xml',
      '.png':'image/png',
      '.jpg':'image/jpeg',
      '.ico':'image/x-icon',
      '.css':'text/css',
      '.js':'application/javascript',
      '.json':'application/json',
    };
    let reqPath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
    const filePath = path.join(__dirname, 'public', reqPath);
    const ext = path.extname(filePath);
    if (mimeMap[ext] && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      res.setHeader('Content-Type', mimeMap[ext]);
      res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=86400');
      res.end(content);
      return;
    }
  }

  if (parsed.pathname === '/health') {
    res.end(JSON.stringify({ ok: true, port: PORT, endpoints: ['/scrape', '/scrape-sf', '/scrape-snap'] }));
    return;
  }

  const fbUrl = parsed.query.url;
  if (!fbUrl) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  if (parsed.pathname === '/scrape') {
    console.log(`[fb-scraper/fdown] Scraping: ${fbUrl}`);
    try {
      const result = await scrapeFdown(fbUrl);
      console.log(`[fb-scraper/fdown] Got ${result.links.length} links`);
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[fb-scraper/fdown] Error:', err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (parsed.pathname === '/scrape-sf') {
    console.log(`[fb-scraper/savefrom] Scraping: ${fbUrl}`);
    try {
      const result = await scrapeSavefrom(fbUrl);
      console.log(`[fb-scraper/savefrom] Got ${result.links.length} links`);
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[fb-scraper/savefrom] Error:', err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (parsed.pathname === '/scrape-snap') {
    console.log(`[fb-scraper/snapsave] Scraping: ${fbUrl}`);
    try {
      const result = await scrapeSnapsave(fbUrl);
      console.log(`[fb-scraper/snapsave] Got ${result.links.length} links`);
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[fb-scraper/snapsave] Error:', err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found. Use /scrape?url=FB_URL or /scrape-sf?url=FB_URL' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fb-scraper] Running on port ${PORT}`);
});

getBrowser().then(() => console.log('[fb-scraper] Browser ready')).catch(console.error);
