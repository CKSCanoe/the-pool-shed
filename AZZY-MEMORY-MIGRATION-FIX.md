# Azzy memory migration fix

The first Brain Ready package expected the optional `public.ps_workspace_can_read(text)` helper to exist. The live Supabase project reported that helper was not present, so migration 012 stopped before commit.

The corrected migration makes `ps_azzy_memory` a server-only table:

- no dependency on `ps_workspace_can_read(text)`;
- no browser/`authenticated` access to the memory table;
- service-role access only;
- Pool Shed still authenticates the incoming user and derives workspace permissions before Azzy memory is loaded;
- `AZZY_MEMORY_MODE=external` now requires `SUPABASE_SERVICE_ROLE_KEY` server-side.

Because migration 012 used an explicit transaction, the failed run did not commit the partial table/policy changes. Run the corrected `database/012-azzy-memory.sql` normally.
