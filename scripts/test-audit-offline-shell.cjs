const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve('public');
const server = http.createServer((request,response) => {
  const relative = decodeURIComponent(request.url.split('?')[0]).replace(/^\//,'') || 'index.html';
  const file = path.resolve(root,relative);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    const ext = path.extname(file);
    response.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.html':'text/html'})[ext] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  try {
    const context = await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
    const page = await context.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin + '/');
    await page.waitForFunction(() => navigator.serviceWorker.controller, {timeout:30000});
    const prepared = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return await new Promise((resolve,reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => reject(Error('Preflight timeout')),90000);
        channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data); };
        registration.active.postMessage({type:'POOL_SHED_PREPARE_OFFLINE'},[channel.port2]);
      });
    });
    assert.equal(prepared.ok,true,`missing offline resources: ${(prepared.missing||[]).join(', ')}`);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => typeof window.__POOL_SHED_AUDIT_BRIDGE__ === 'object', {timeout:30000});
    const iframe = await page.evaluate(async () => {
      const response = await fetch('/commercial-audits/index.html');
      return {ok:response.ok,hasAudit:response.ok && (await response.text()).includes('Commercial Audit Studio')};
    });
    assert.deepEqual(iframe,{ok:true,hasAudit:true});
    console.log('PASS prepared Pool Shed shell and audit files reopen offline at iPad width');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode=1; });
