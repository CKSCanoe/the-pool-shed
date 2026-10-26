import assert from 'node:assert/strict';
import vm from 'node:vm';
import handler from '../api/audit-device-recovery.js';

function request(method) {
  const headers = {};
  const response = {
    setHeader(name, value) { headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    send(body) { this.body = body; return this; }
  };
  handler({ method }, response);
  return { ...response, headers };
}

const get = request('GET');
assert.equal(get.code, 200);
assert.match(get.headers['Cache-Control'], /no-store/);
assert.match(get.headers['Content-Security-Policy'], /connect-src 'none'/);
assert.match(get.headers['Content-Security-Policy'], /frame-ancestors 'none'/);
assert.match(get.body, /Keep the original audit tab open/);
assert.match(get.body, /same iPad and in the same browser/);
const script = get.body.match(/<script nonce="([^"]+)">([\s\S]*?)<\/script>/);
assert.ok(script, 'recovery page has a nonce-protected script');
assert.ok(get.headers['Content-Security-Policy'].includes("script-src 'nonce-" + script[1] + "'"));
new vm.Script(script[2]);
assert.match(script[2], /pool-shed-audit-media-v1/);
assert.match(script[2], /pool-shed-live-v1\.8/);
assert.match(script[2], /getAll\(\)/);
assert.match(script[2], /navigator\.share/);
assert.doesNotMatch(script[2], /\bfetch\s*\(/, 'recovery must not transmit local data');
assert.equal(request('POST').code, 405);
console.log('PASS read-only audit device recovery page, photo export, no-store and no-network controls');
