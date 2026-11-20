// Phase 3.4 prerequisite guard: only administrators (or server code) can change role, permissions, active or email.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/018-profile-role-protection.sql', 'utf8').replace(/--.*$/gm, '');
assert(/before update on public\.user_profiles/.test(code), 'runs before every profile update');
for (const col of ['role', 'permissions', 'active', 'email']) assert(new RegExp(`new\\.${col} is distinct from old\\.${col}`).test(code), col + ' protected');
assert(/if public\.current_user_is_admin\(\) then return new; end if;/.test(code), 'administrators keep full control');
assert(/raise exception 'Only an administrator/.test(code), 'self-promotion is refused, not ignored');
console.log('Migration 018 guard passed.');
