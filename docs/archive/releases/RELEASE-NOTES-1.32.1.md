# Pool Shed v1.32.1 · Elite Quote Builder Secure Media

## What changed

v1.32.1 hardens the approved v1.32 visual Quote Studio for production media handling.

- Quote images uploaded while online are stored in a private Supabase `quote-media` bucket.
- Workspace quote records retain stable `quote-media:<uuid>` references rather than expiring signed URLs.
- Staff image previews use temporary signed URLs.
- Published customer proposals resolve stable media references server-side to short-lived signed URLs.
- Public proposal snapshots never contain Supabase service credentials, storage paths or internal commercial data.
- Image upload, hero images, option images, media library reuse, drag/drop and paste remain supported.
- Offline preview images remain available for local preview only. Online secure upload is required for production media persistence.
- Quick Quote, Project Proposal, acceptance-to-Sales-Order/Project, stock allocation, draft POs and Xero handover are unchanged.

## Database

Apply in order:

1. `database/007-quote-studio.sql`
2. `database/008-quote-media.sql`

Migration 008 creates the service-role-only quote media metadata table and private `quote-media` storage bucket.

## Verification

- `npm run test:deployment` · PASS
- `npm run build` · PASS
- Chromium secure-media Quote Studio QA · PASS
- Runtime JavaScript errors during Quote Studio/customer portal QA · 0

## Rollback

Keep v1.31 and v1.32.0 deployments available until v1.32.1 production smoke testing is complete. Do not remove media objects during rollback; older releases simply do not use the new secure-media references.
