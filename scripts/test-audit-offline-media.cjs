const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const source = fs.readFileSync('public/audit-offline-media.js');
const server = http.createServer((request, response) => {
  if (request.url === '/audit-offline-media.js') {
    response.writeHead(200, {'Content-Type':'application/javascript'});
    response.end(source);
  } else {
    response.writeHead(200, {'Content-Type':'text/html'});
    response.end('<!doctype html><title>Audit offline media test</title>');
  }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const url = `http://127.0.0.1:${server.address().port}/`;
    const install = async () => {
      await page.evaluate(() => {
        const secureRef = ref => /^customer-media:/.test(ref);
        const refsFrom = value => {
          const found = [];
          const walk = item => {
            if (typeof item === 'string' && secureRef(item)) found.push(item);
            else if (Array.isArray(item)) item.forEach(walk);
            else if (item && typeof item === 'object') Object.values(item).forEach(walk);
          };
          walk(value);
          return found;
        };
        window.PoolShedBusinessMedia = {
          secureRef, refsFrom, url:ref => ref,
          ensure:async () => ({}),
          upload:async () => ({ref:'customer-media:11111111-1111-4111-8111-111111111111'})
        };
      });
      await page.addScriptTag({url:'/audit-offline-media.js'});
    };
    await page.goto(url);
    await install();
    await context.setOffline(true);
    const ref = await page.evaluate(async () => {
      const file = new File([new Uint8Array([137,80,78,71])], 'site.png', {type:'image/png'});
      const photo = await PoolShedBusinessMedia.queueAuditPhoto('C1','A1','plant-photo',file,{title:'Plant room'});
      return photo.ref;
    });
    assert.match(ref,/^audit-local:/);
    const offlineUrl = await page.evaluate(async ref => {
      await PoolShedBusinessMedia.ensure([ref]);
      return PoolShedBusinessMedia.url(ref);
    },ref);
    assert.match(offlineUrl,/^blob:/);
    await context.setOffline(false);
    await page.reload();
    await install();
    const durable = await page.evaluate(async ref => {
      await PoolShedBusinessMedia.ensure([ref]);
      return PoolShedBusinessMedia.url(ref).startsWith('blob:');
    },ref);
    assert.equal(durable,true,'photo survives a browser reload from IndexedDB');
    const sync = await page.evaluate(async ref => {
      const audit = {id:'A1',customerId:'C1',photos:[{image:ref}]};
      const bridge = {
        getAll:() => [audit],
        isOfflinePhotoReferenced:(candidate,id,customerId) => candidate === audit.photos[0].image && id === audit.id && customerId === audit.customerId,
        replaceOfflinePhoto:async (oldRef,newRef) => { if(audit.photos[0].image === oldRef) audit.photos[0].image = newRef; }
      };
      await PoolShedBusinessMedia.syncAuditPhotos(bridge);
      return {ref:audit.photos[0].image,pending:await PoolShedBusinessMedia.pendingAuditPhotos(bridge)};
    },ref);
    assert.match(sync.ref,/^customer-media:/);
    assert.equal(sync.pending,0);
    console.log('PASS offline audit photo saved, survives reload, and uploads on reconnect');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
