import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const css=fs.existsSync('public/assets/css/system/55-login-command.css')?fs.readFileSync('public/assets/css/system/55-login-command.css','utf8'):'';
const build=fs.readFileSync('scripts/build-css.mjs','utf8');

assert(legacy.includes('One secure place to <span>run the operation.</span>'),'premium staff login hero missing');
assert(legacy.includes('Pool Bros staff access'),'staff access copy missing');
assert(legacy.includes(`Pool Shed v${pkg.version} · Pool Bros Ltd`),'version footer must be discreet at page bottom and use current release');
assert(!legacy.includes('Platform Hardening'),'staff login must not expose Platform Hardening');
assert(!legacy.includes('Supabase authentication and role-based permissions.'),'staff login must not expose Supabase implementation detail');
assert(legacy.includes('data-login-password-toggle'),'password visibility control missing');
assert(legacy.includes('effectiveMode === "mfa"'),'MFA login state missing');
assert(legacy.includes('effectiveMode === "session"'),'session expired state missing');
assert(legacy.includes('effectiveMode === "denied"'),'access denied state missing');
assert(legacy.includes('supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel'),'Supabase AAL check missing');
assert(legacy.includes('supabaseClient.auth.mfa.challengeAndVerify'),'Supabase MFA verification missing');
assert(legacy.includes('profile && profile.active === false'),'inactive Supabase profiles must be checked');
assert(legacy.includes('isAuthenticated = false;'),'browser storage must not be initial auth authority');
assert(css.includes('.ps-login-stage'),'login command CSS authority missing');
assert(css.includes('.ps-login-footer'),'bottom version footer CSS missing');
assert(build.includes('system/55-login-command.css'),'CSS build must include login command authority');
console.log('PASS Login Command visual states, Supabase auth safety and CSS authority');
