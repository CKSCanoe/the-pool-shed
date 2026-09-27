# Existing Pool Shed data migration

A fresh Supabase project contains the new schema but no operational business data. Existing Product Hub products, customers, suppliers, Sales Orders, Purchase Orders, stock, Projects and workspace quote drafts are carried in the `pool-bros-main` workspace snapshot.

Before production cutover:

1. Run `supabase-setup/Pool-Shed-v1.34-OLD-SUPABASE-DATA-INVENTORY.sql` against the old Supabase project.
2. Record the counts and `updated_at` value.
3. Export the complete `pool-bros-main` snapshot from the old project.
4. Import that snapshot into the new Supabase project only after the v1.34 schema and first-admin membership are installed.
5. Set `updated_by` to a valid Auth user in the new project if the old user UUID does not exist there.
6. Re-run the inventory query against the new project and compare counts.
7. Open the Vercel Preview and verify Product Hub, CRM, stock, Sales Orders, Purchase Orders and Projects before production cutover.

Product/customer files are separate from the workspace snapshot. Existing URL-based product images remain as legacy URLs until replaced. New v1.34 uploads use the private `product-media` and `customer-media` buckets.
