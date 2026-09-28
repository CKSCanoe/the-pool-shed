import assert from 'node:assert/strict';
import {azzyOriginAllowed} from '../server/azzy-pool-shed.js';
const old={...process.env};
function req(origin,host,extra={}){return {headers:{origin,host,...extra}};}
try{
  delete process.env.APP_ORIGIN; delete process.env.APP_ORIGINS; delete process.env.VERCEL_URL; delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  assert.equal(azzyOriginAllowed(req('http://localhost:3000','localhost:3000')),true,'local same origin');
  process.env.APP_ORIGIN='https://pool-shed.example/';
  assert.equal(azzyOriginAllowed(req('https://pool-shed.example','pool-shed.example')),true,'configured app origin');
  assert.equal(azzyOriginAllowed(req('https://preview-abc.vercel.app','preview-abc.vercel.app')),true,'same-origin Vercel preview even when APP_ORIGIN differs');
  assert.equal(azzyOriginAllowed(req('https://evil.example','pool-shed.example')),false,'cross-site origin rejected');
  process.env.APP_ORIGINS='https://staff.example, https://ops.example/';
  assert.equal(azzyOriginAllowed(req('https://staff.example','api.example')),true,'additional configured origin');
  process.env.VERCEL_URL='pool-shed-git-main-example.vercel.app';
  assert.equal(azzyOriginAllowed(req('https://pool-shed-git-main-example.vercel.app','different.internal')),true,'Vercel deployment origin');
  console.log('PASS Azzy origin policy accepts Pool Shed aliases/previews and rejects cross-site origins');
} finally {
  for(const k of Object.keys(process.env)) if(!(k in old)) delete process.env[k];
  Object.assign(process.env,old);
}
