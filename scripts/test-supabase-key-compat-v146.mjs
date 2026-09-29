import assert from 'node:assert/strict';
import {supabaseServerKey,supabasePublicKey,supabaseApiKey,isLegacyJwtApiKey,elevatedSupabaseHeaders} from '../server/supabase-keys.js';

const modern={SUPABASE_SECRET_KEY:'sb_secret_test_value',SUPABASE_SERVICE_ROLE_KEY:'eyJlegacy.value.sig',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
assert.equal(supabaseServerKey(modern),'sb_secret_test_value');
assert.equal(supabasePublicKey(modern),'sb_publishable_test');
assert.equal(supabaseApiKey(modern),'sb_secret_test_value');
assert.equal(isLegacyJwtApiKey('sb_secret_test_value'),false);
assert.deepEqual(elevatedSupabaseHeaders(modern,{Accept:'application/json'}),{apikey:'sb_secret_test_value',Accept:'application/json'},'modern secret must not be sent as Bearer');

const legacy={SUPABASE_SERVICE_ROLE_KEY:'eyJabc.def.ghi',SUPABASE_ANON_KEY:'eyJanon.def.ghi'};
assert.equal(supabaseServerKey(legacy),'eyJabc.def.ghi');
assert.equal(isLegacyJwtApiKey(legacy.SUPABASE_SERVICE_ROLE_KEY),true);
assert.equal(elevatedSupabaseHeaders(legacy).Authorization,'Bearer eyJabc.def.ghi');
assert.equal(supabaseApiKey({SUPABASE_PUBLISHABLE_KEY:'sb_publishable_only'},{preferServer:false}),'sb_publishable_only');
console.log('PASS modern Supabase secret keys and legacy service_role keys use the correct headers');
