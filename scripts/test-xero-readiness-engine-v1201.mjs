import assert from 'node:assert/strict';
import {xeroIntegrationReadiness,XERO_SCOPES} from '../server/accounting.js';

const base={
 SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'service',APP_ORIGIN:'https://app.invalid',
 XERO_CLIENT_ID:'client',XERO_CLIENT_SECRET:'secret',XERO_TOKEN_KEY:Buffer.alloc(32,1).toString('base64'),
 XERO_WEBHOOK_KEY:'webhook',CRON_SECRET:'cron'
};
let r=xeroIntegrationReadiness(base);
assert.equal(r.mode,'ready','Xero must default to Ready mode');
assert.equal(r.liveEnabled,false,'Ready mode must never permit live provider calls');
assert.equal(r.appConfigured,true,'Readiness should recognise a structurally configured Xero app');
assert.equal(r.readyToConnect,true,'All prerequisites should report ready without enabling Xero');
assert.equal(r.redirectUri,'https://app.invalid/api/finance?action=callback');
assert.equal(r.secretsExposed,false,'Readiness must never expose credential values');
assert(XERO_SCOPES.includes('accounting.invoices'));
assert(XERO_SCOPES.includes('accounting.payments.read'));
assert(XERO_SCOPES.includes('accounting.contacts.read'));
assert(XERO_SCOPES.includes('accounting.settings.read'));
assert(!XERO_SCOPES.includes('accounting.transactions'),'Deprecated broad transaction scope must not be requested');

r=xeroIntegrationReadiness({...base,XERO_INTEGRATION_MODE:'live'});
assert.equal(r.mode,'live');
assert.equal(r.liveEnabled,true,'Live provider calls require explicit XERO_INTEGRATION_MODE=live');

r=xeroIntegrationReadiness({...base,XERO_INTEGRATION_MODE:'live',XERO_CLIENT_SECRET:''});
assert.equal(r.liveEnabled,false,'Live mode must still be blocked if secure app configuration is incomplete');
assert.equal(r.readyToConnect,false);
assert(r.missing.includes('XERO_CLIENT_SECRET'));
console.log('PASS Xero readiness engine safe-mode and granular-scope contract');
