const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const root = path.join(process.cwd(), 'public');
const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(request.url.split('?')[0]).replace(/^\//, '') || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(404).end(); }
});

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] });
    for (const width of [768, 1024, 1100, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => typeof normalizeAppData === 'function' && typeof render === 'function' && typeof showApp === 'function');
      await page.evaluate(() => { data = normalizeAppData(JSON.parse(JSON.stringify(seed))); isAuthenticated = true; showApp(); render(); });
      const menu = page.locator('#workspaceMenu');
      const sidebar = page.locator('.sidebar');
      assert(await menu.isVisible(), `Menu control missing at ${width}px`);
      assert(!(await sidebar.isVisible()), `Sidebar pinned at ${width}px`);

      await menu.click();
      assert(await sidebar.isVisible(), `Sidebar did not open at ${width}px`);
      await page.locator('#nav [data-tab="audits"]').click();
      assert(!(await sidebar.isVisible()), `Sidebar stayed open after Pool Audits at ${width}px`);
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      assert(await page.locator('#screen-audits iframe[data-commercial-audits]').isVisible(), `Audits unavailable at ${width}px`);

      await menu.click();
      await page.locator('#nav [data-sidebar-subgroup="audits|Action Register"]').click();
      assert(!(await sidebar.isVisible()), `Sidebar stayed open after an audit subsection at ${width}px`);

      await menu.click();
      await page.locator('#nav [data-tab="crm"]').click();
      assert(!(await sidebar.isVisible()), `Sidebar stayed open after CRM at ${width}px`);

      for (const section of ['salesorders', 'products', 'locations', 'purchase', 'warehouse', 'accounting', 'settings', 'dashboard']) {
        await menu.click();
        await page.locator(`#nav [data-tab="${section}"]`).click();
        assert(!(await sidebar.isVisible()), `Sidebar stayed open after ${section} at ${width}px`);
        assert(await page.locator(`#screen-${section}`).isVisible(), `${section} did not open at ${width}px`);
      }

      await menu.click();
      await page.keyboard.press('Escape');
      assert(!(await sidebar.isVisible()), `Escape did not close the sidebar at ${width}px`);
      await menu.click();
      await page.mouse.click(width - 20, 400);
      assert(!(await sidebar.isVisible()), `Outside tap did not close the sidebar at ${width}px`);
      await context.close();
    }
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktop.goto(`http://127.0.0.1:${server.address().port}/`);
    await desktop.waitForFunction(() => typeof normalizeAppData === 'function' && typeof render === 'function' && typeof showApp === 'function');
    await desktop.evaluate(() => { data = normalizeAppData(JSON.parse(JSON.stringify(seed))); isAuthenticated = true; showApp(); render(); });
    assert(await desktop.locator('.sidebar').isVisible(), 'Desktop sidebar must remain visible');
    assert(!(await desktop.locator('#workspaceMenu').isVisible()), 'Desktop menu toggle must be hidden');
    console.log('iPad navigation passed: portrait, landscape, 13-inch touch, desktop, audit sections, CRM, Escape and outside tap');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
