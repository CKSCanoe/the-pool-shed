import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('public/index.html','utf8');
assert.match(html,/<meta name="description" content="[^"]+"/);
assert.match(html,/<meta name="color-scheme" content="light dark">/);
assert.match(html,/<link rel="icon" type="image\/png" href="\.\/assets\/img\/pb-logo\.png">/);
assert.match(html,/id="userMenuButton"[^>]+aria-haspopup="menu"[^>]+aria-controls="userMenuDropdown"/);
assert.match(html,/id="userMenuDropdown" role="menu"/);
console.log('PASS production shell metadata, favicon and account-menu semantics');
