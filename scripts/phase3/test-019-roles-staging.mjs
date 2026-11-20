// Phase 3.4 proof on STAGING ONLY: what each role can obtain, and that restricted saves never erase hidden data.
// Each role runs in one database transaction that is rolled back, so staging data is not changed.
// The forbidden-field lists below are written independently of database/019 on purpose.
// Usage: node scripts/phase3/test-019-roles-staging.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadEnv } from '../phase0/lib.mjs';

loadEnv();
const url = process.env.STAGING_SUPABASE_DB_URL || '';
const refOf = u => (String(u || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
const stagingRef = refOf(process.env.STAGING_SUPABASE_URL), liveRef = refOf(process.env.SUPABASE_URL);
if (!stagingRef || !liveRef || stagingRef === liveRef || !url.includes(stagingRef) || url.includes(liveRef)) throw new Error('Refusing: staging only');

const COST = /^(cost|costs|unitcost|confirmedunitcost|costnet|shippingcost|.*margin|margin.*|.*profit|originalcostbudget|riskbuffernet|rate)$/i;
const FINANCE = /^(payments?|paymentcorrections|paymentruns|xeroref|xerocontactid|invoice.*|credit(limit|days|termtype|used|amount|net|gross|vat)|deposit.*)$/i;
const PRICE = /^(unitprice|specialprice|rrp|trade|wholesale|sellnet|quotenet|quoteref|shippingcharge|discount|customerdiscountrate|.*net|.*gross|total.*|amount)$/i;
const AUDIT_SECTIONS = ['auditLog', 'auditEvents', 'actionAuthority'];
const expect = {
  Admin:     { cost: true,  finance: true,  price: true,  security: true },
  Accounts:  { cost: true,  finance: true,  price: true,  security: false },
  Sales:     { cost: true,  finance: false, price: true,  security: false },
  Warehouse: { cost: false, finance: false, price: true,  security: false },
  Engineer:  { cost: false, finance: false, price: false, security: false }
};

function run(sqlText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-roles-'));
  const file = path.join(dir, 't.sql');
  fs.writeFileSync(file, sqlText, { mode: 0o600 });
  try {
    const r = spawnSync('/opt/homebrew/opt/libpq/bin/psql', [url, '-X', '-q', '-A', '-t', '-f', file], { encoding: 'utf8', maxBuffer: 1 << 29 });
    return (r.stdout || '') + '\n' + (r.stderr || '');   // notices (FULLSAVE / FINANCEEDIT) arrive on stderr
  }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const grab = (out, tag) => { const line = out.split('\n').find(l => l.startsWith(tag + ':')); return line ? line.slice(tag.length + 1) : null; };
function keysFound(value, re, acc = new Set(), p = '') {
  if (Array.isArray(value)) value.forEach(v => keysFound(v, re, acc, p + '[]'));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { if (re.test(k)) acc.add(p + '.' + k); keysFound(v, re, acc, p + '.' + k); }
  return acc;
}

const report = [];
for (const role of Object.keys(expect)) {
  const e = expect[role];
  const out = run(`
begin;
select set_config('ps.uid', (select id::text from user_profiles where role='Admin' order by email limit 1), true);
select set_config('ps.since', (select updated_at::text from workspace_snapshots where workspace_id='pool-bros-main'), true);
update user_profiles set role='${role}' where id=current_setting('ps.uid')::uuid;
-- Engineer: assign the first job to them (mirror table only; rolled back).
update ps_records set data = jsonb_set(data, '{assignedUserIds}', jsonb_build_array(current_setting('ps.uid')))
 where section='jobs' and key=(select key from ps_records where section='jobs' and deleted_at is null order by ord limit 1) and '${role}'='Engineer';
create temp table before_rec on commit drop as select section, key, data from ps_records where deleted_at is null and section in ('products','salesOrders','customers');
grant select on before_rec to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ps.uid'), 'role', 'authenticated')::text, true);
set local role authenticated;
select 'LOAD:' || ps_workspace_load('pool-bros-main')::text;
-- A restricted-style save: edit a visible product name and the first visible sales order's first line quantity,
-- starting from what this user was given (hidden fields absent).
create temp table l as select ps_workspace_load('pool-bros-main') j;
select 'SAVE:' || coalesce(ps_workspace_save_changes('pool-bros-main', current_setting('ps.since')::timestamptz, jsonb_build_object('sections', jsonb_build_array(
  jsonb_build_object('s','products','kind','list','upserts', jsonb_build_array(jsonb_build_array('id:'||((select j from l)->'data'->'products'->0->>'id'),
     jsonb_set((select j from l)->'data'->'products'->0, '{name}', to_jsonb(((select j from l)->'data'->'products'->0->>'name')||' (role test)'))))),
  jsonb_build_object('s','salesOrders','kind','list','upserts', coalesce((select jsonb_build_array(jsonb_build_array('id:'||(o->>'id'),
     jsonb_set(o, '{lines,0,qty}', to_jsonb(coalesce((o->'lines'->0->>'qty')::numeric,0)+1)))) from jsonb_array_elements((select j from l)->'data'->'salesOrders') o
     where jsonb_array_length(coalesce(o->'lines','[]'::jsonb))>0 limit 1), '[]'::jsonb))
)))::text, 'null');
select 'FEED:' || ps_records_changes('pool-bros-main', current_setting('ps.since')::timestamptz)::text;
do $$ begin
  begin perform ps_workspace_save('pool-bros-main', (select updated_at from workspace_snapshots), (select data from workspace_snapshots)); raise notice 'FULLSAVE:allowed';
  exception when others then raise notice 'FULLSAVE:refused %', sqlerrm; end;
  begin perform ps_workspace_save_changes('pool-bros-main', (select updated_at from workspace_snapshots), '{"sections":[{"s":"financeCommand","kind":"settings","data":{}}]}');
        raise notice 'FINANCEEDIT:allowed';
  exception when others then raise notice 'FINANCEEDIT:refused %', sqlerrm; end;
end $$;
reset role;
-- After the save, as the database owner: did any hidden field change?
select 'CHANGED:' || coalesce(jsonb_agg(jsonb_build_object('s', b.section, 'k', b.key, 'field', f.k)), '[]'::jsonb)::text
from before_rec b join ps_records r on r.section=b.section and r.key=b.key and r.deleted_at is null
cross join lateral (select k from jsonb_object_keys(b.data) k
                    where k ~* '^(cost|payments|xeroref|creditlimit)$' and (b.data->k) is distinct from (r.data->k)) f;
select 'LINECOST:' || coalesce(jsonb_agg(jsonb_build_object('k', b.key, 'before', b.data->'lines'->0->'unitCost', 'after', r.data->'lines'->0->'unitCost',
                                                            'pb', b.data->'lines'->0->'unitPrice', 'pa', r.data->'lines'->0->'unitPrice')), '[]'::jsonb)::text
from before_rec b join ps_records r on r.section=b.section and r.key=b.key
where b.section='salesOrders' and (b.data->'lines'->0) is distinct from (r.data->'lines'->0);
select 'VERIFY:' || ps_records_verify('pool-bros-main')::text;
rollback;
`);
  const load = JSON.parse(grab(out, 'LOAD'));
  const feed = JSON.parse(grab(out, 'FEED') || '{}');
  const save = JSON.parse(grab(out, 'SAVE') || 'null');
  const changed = JSON.parse(grab(out, 'CHANGED') || '[]');
  const lineCost = JSON.parse(grab(out, 'LINECOST') || '[]');
  const verify = JSON.parse(grab(out, 'VERIFY') || '{}');
  if (!verify.ok && process.env.PS_DEBUG) console.error(out.split('\n').filter(l => /ERROR|NOTICE/.test(l)).join('\n').slice(0, 3000));
  const d = load.data;
  const given = [load, feed];
  const leaks = { cost: new Set(), finance: new Set(), price: new Set() };
  for (const v of given) { keysFound(v, COST, leaks.cost); keysFound(v, FINANCE, leaks.finance); keysFound(v, PRICE, leaks.price); }
  const counts = { products: (d.products || []).length, salesOrders: (d.salesOrders || []).length, jobs: (d.jobs || []).length, quotes: (d.quotes || []).length };

  if (!e.cost) assert.equal(leaks.cost.size, 0, `${role}: cost fields reached the user: ${[...leaks.cost].slice(0, 8)}`);
  if (!e.finance) assert.equal(leaks.finance.size, 0, `${role}: finance fields reached the user: ${[...leaks.finance].slice(0, 8)}`);
  if (!e.price) assert.equal(leaks.price.size, 0, `${role}: price fields reached the user: ${[...leaks.price].slice(0, 8)}`);
  if (e.cost) assert(leaks.cost.size > 0, `${role} should see costs`);
  if (e.finance) assert(leaks.finance.size > 0, `${role} should see finance`);
  if (!e.security) assert(!('securityControl' in d), `${role}: security settings visible`);
  if (!(e.cost && e.finance)) for (const s of AUDIT_SECTIONS) assert(!(s in d), `${role}: ${s} visible`);
  if (!e.finance) assert(!('financeCommand' in d), `${role}: finance settings visible`);
  if (role === 'Engineer') {
    assert.equal(counts.jobs, 1, 'engineer sees only the assigned job');
    assert.equal(counts.quotes, 0, 'engineer sees no quotes');
    assert(d.salesOrders.every(o => o.jobId === d.jobs[0].id || o.projectId === d.jobs[0].id), 'engineer sees only orders linked to their job');
  }
  assert(save && save.updated_at, `${role}: a normal edit saves (${JSON.stringify(save)})`);
  assert.equal(changed.length, 0, `${role}: hidden fields changed by the save: ${JSON.stringify(changed)}`);
  for (const l of lineCost) {
    assert.deepEqual(l.after, l.before, `${role}: line cost changed on ${l.k}`);
    assert.deepEqual(l.pa, l.pb, `${role}: line price changed on ${l.k}`);
  }
  const restricted = load.access && load.access.restricted;
  assert.equal(/FULLSAVE:refused/.test(out) || !restricted, true, `${role}: full save must be refused`);
  if (!e.finance) assert(/FINANCEEDIT:refused/.test(out), `${role}: finance settings edit must be refused`);
  assert.equal(verify.ok, true, `${role}: record copy consistent after the save: ${JSON.stringify(verify.problems)}`);
  report.push(`${role.padEnd(10)} products ${String(counts.products).padStart(5)}  orders ${String(counts.salesOrders).padStart(3)}  jobs ${counts.jobs}  quotes ${counts.quotes}  ` +
    `cost fields ${leaks.cost.size ? 'visible' : 'none'}  finance ${leaks.finance.size ? 'visible' : 'none'}  prices ${leaks.price.size ? 'visible' : 'none'}  ` +
    `save ok, hidden fields unchanged${restricted ? ', full save refused' : ''}`);
}
console.log(report.join('\n'));
console.log('Role visibility proof passed (all transactions rolled back).');
