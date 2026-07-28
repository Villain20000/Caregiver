/**
 * scripts/audit-a11y.mjs
 *
 * Runs an automated accessibility audit of the built Caregiver web app using
 * axe-core via Playwright. Serves the built bundle with a tiny Node static
 * server that falls back to index.html for Angular's PathLocationStrategy.
 *
 * Usage:
 *   npm run build --workspace @caregiver/web
 *   node scripts/audit-a11y.mjs
 *
 * The script exits with code 0 when no violations are found and code 1 when
 * any axe-core violations are detected.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const PORT = 0; // Let the OS pick an ephemeral port.
const DIST_DIR = 'apps/web/dist/caregiver-web';
const BASE_URL = `http://localhost`;

/** MIME type for common static assets. */
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Start a static file server with SPA fallback and return the URL. */
async function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);
    const safePath = pathname === '/' ? 'index.html' : pathname;
    let filePath = join(DIST_DIR, safePath);

    // Prevent directory traversal outside the dist folder.
    if (!filePath.startsWith(join(process.cwd(), DIST_DIR))) {
      filePath = join(DIST_DIR, 'index.html');
    }

    try {
      const content = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { 'content-type': MIME_TYPES[ext] ?? 'application/octet-stream' });
      res.end(content);
    } catch {
      // Fallback to index.html for any non-file route (Angular SPA).
      try {
        const index = await readFile(join(DIST_DIR, 'index.html'));
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(index);
      } catch {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Server error');
      }
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'string' ? address : address?.port;
      resolve({ server, url: `${BASE_URL}:${port}` });
    });
  });
}

/** Run the audit for a single page. */
async function auditPage(page, baseUrl, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  return results;
}

/** Print violations grouped by impact. */
function printViolations(results) {
  if (results.violations.length === 0) {
    console.log('  No accessibility violations found.');
    return;
  }

  const grouped = results.violations.reduce((acc, v) => {
    (acc[v.impact] ??= []).push(v);
    return acc;
  }, {});

  for (const [impact, items] of Object.entries(grouped)) {
    if (!items) continue;
    console.log(`\n  ${impact.toUpperCase()} — ${items.length} issue(s)`);
    for (const violation of items) {
      console.log(`    • ${violation.help} (${violation.id})`);
      console.log(`      ${violation.helpUrl}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.log(`      - ${node.failureSummary?.split('\n')[0] ?? node.target.join(', ')}`);
      }
    }
  }
}

async function main() {
  console.log('Starting static server...');
  const { server, url } = await startServer();

  let browser;
  let hasViolations = false;

  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Audit the public login page first (no auth required).
    console.log(`Auditing login page at ${url}/login`);
    const loginResults = await auditPage(page, url, '/login');
    printViolations(loginResults);

    if (loginResults.violations.length > 0) {
      hasViolations = true;
    }

    // TODO: Authenticate and audit protected routes in the future.
  } catch (error) {
    console.error('Audit failed:', error);
    hasViolations = true;
  } finally {
    await browser?.close();
    server.closeAllConnections?.();
    server.close();
  }

  if (hasViolations) {
    process.exit(1);
  }
}

main();
