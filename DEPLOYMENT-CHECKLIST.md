# The Pool Shed Live V1.5 — Deployment Checklist

## Supabase
1. Create the Supabase project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Create the first user in Authentication > Users.
4. Add the matching row to `public.user_profiles` using that user's UUID.
5. Set Authentication > URL Configuration to the live Vercel URL.

## Vercel
1. Upload this extracted project to a private GitHub repository.
2. Import the repository into Vercel.
3. Framework preset: Other.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to Production, Preview and Development.
7. Deploy.

## First live test
1. Sign in with the Supabase user.
2. Create one customer, supplier and product.
3. Refresh and confirm the records remain.
4. Sign in from a second browser and confirm the same records appear.
5. Test one offline edit, reconnect, and confirm it uploads.

Never put the Supabase secret key in Vercel frontend variables or in this repository.
