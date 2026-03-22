const { chromium } = require('playwright');

const BASE = 'https://unmissed-ai-production.up.railway.app';
const pages = [
  { name: 'landing', path: '/' },
  { name: 'pricing', path: '/pricing' },
  { name: 'login', path: '/login' },
  { name: 'onboard', path: '/onboard' },
  { name: 'for-realtors', path: '/for-realtors' },
  { name: 'for-auto-glass', path: '/for-auto-glass' },
  { name: 'for-plumbing', path: '/for-plumbing' },
  { name: 'for-hvac', path: '/for-hvac' },
  { name: 'for-dental', path: '/for-dental' },
  { name: 'for-legal', path: '/for-legal' },
  { name: 'demo', path: '/demo' },
  { name: 'try', path: '/try' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const results = {};

  for (const p of pages) {
    const page = await context.newPage();
    const logs = [];
    const errors = [];
    const networkErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        logs.push({ type: msg.type(), text: msg.text() });
      }
    });

    page.on('pageerror', err => {
      errors.push(err.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push({ url: response.url(), status: response.status() });
      }
    });

    try {
      const response = await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      const httpStatus = response ? response.status() : 'unknown';

      results[p.name] = {
        url: `${BASE}${p.path}`,
        httpStatus,
        consoleErrors: logs.filter(l => l.type === 'error'),
        consoleWarnings: logs.filter(l => l.type === 'warning'),
        pageErrors: errors,
        networkErrors,
      };
    } catch (err) {
      results[p.name] = {
        url: `${BASE}${p.path}`,
        error: err.message,
      };
    }

    await page.close();
  }

  await browser.close();

  // Output results
  console.log(JSON.stringify(results, null, 2));
})();
