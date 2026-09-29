import assert from 'node:assert/strict';
import {appOriginAllowed,normalizedAppOrigin} from '../server/origin-policy.js';

const req=(origin,host,extra={})=>({headers:{origin,host,...extra}});
assert.equal(normalizedAppOrigin('https://pool.example/'),'https://pool.example');
assert.equal(appOriginAllowed(req('https://preview-123.vercel.app','preview-123.vercel.app'),{APP_ORIGIN:'https://pool.example'}),true);
assert.equal(appOriginAllowed(req('https://pool.example','api.internal'),{APP_ORIGIN:'https://pool.example/'}),true);
assert.equal(appOriginAllowed(req('https://staff.example','api.internal'),{APP_ORIGINS:'https://staff.example, https://ops.example/'}),true);
assert.equal(appOriginAllowed(req('https://evil.example','pool.example'),{APP_ORIGIN:'https://pool.example'}),false);
assert.equal(appOriginAllowed(req('https://branch.vercel.app','different.internal'),{VERCEL_URL:'branch.vercel.app'}),true);
console.log('PASS shared Pool Shed origin policy accepts aliases/previews and rejects cross-site calls');
