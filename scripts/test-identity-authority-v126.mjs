import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const file='public/identity-authority.js';assert.ok(fs.existsSync(file),'Identity authority must exist');
const users=[{id:'u1',name:'Legacy',role:'User'},{id:'u2',name:'Buyer',role:'Purchasing'},{id:'u3',name:'Odd',role:'Mystery'}];
const diagnostics=[];
const ctx={console,globalThis:null,window:null,__POOL_SHED_ALL_USERS__:()=>users,__POOL_SHED_CURRENT_USER__:()=>users[1],__POOL_SHED_IDENTITY_DIAGNOSTIC__:(e)=>diagnostics.push(e)};ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const id=ctx.PoolShedIdentity;assert.ok(id,'PoolShedIdentity global missing');
assert.deepEqual(Array.from(id.roles(),r=>r.id),['Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office']);
for(const role of ['Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office']){assert.equal(id.normalizeRole(role),role);assert.equal(id.isCanonicalRole(role),true);}
assert.equal(id.normalizeRole('User'),'Office');assert.equal(id.isCanonicalRole('User'),false);assert.equal(id.normalizeRole('Mystery'),'Office');
assert.equal(id.normalizeUser(users[0]).role,'Office');assert.equal(id.normalizeUser(users[1]).role,'Purchasing');assert.equal(id.normalizeUser(users[2],{diagnose:true}).role,'Office');
assert.equal(id.currentUser().role,'Purchasing');assert.equal(id.isAdmin({role:'Admin'}),true);assert.equal(id.isAdmin({role:'Management'}),false);assert.ok(diagnostics.length>=1,'unknown role normalization must expose a diagnostic path');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
assert.ok(!legacy.includes('["Admin", "Engineer", "User"].includes(profile.role)'),'Supabase profile load must not retain the three-role mapping');
assert.ok(!legacy.includes('["Admin", "Engineer", "User"].includes(user.role)'),'Supabase profile save must not retain the three-role mapping');
assert.ok(!legacy.includes('["Admin", "Engineer", "User"].includes(profile.role) ? profile.role : "User"'),'auth hydration must preserve canonical roles');
console.log('PASS v1.26 canonical identity authority and Supabase role boundary');
