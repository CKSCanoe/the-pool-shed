# Start Here · Pool Shed v1.32.1

## Create a quote

**Quotes → New quote** or **CRM → Customer → New quote**.

- Quick Quote: accepted quote goes straight to a Sales Order by default.
- Project Proposal: accepted quote creates the full Project and linked Sales Order workflow.

## Build a premium proposal

1. **Details** — set project name, work type, hero story and upload/position a hero image.
2. **Build Quote** — use Sections, Elements, Media and Products. Click anything on the live client canvas to edit it in the right inspector.
3. **Pool Layout** — available for Project Proposals where required.
4. **Review** — check commercial controls, preview the exact customer experience, then Review & Send.

Images support JPG, PNG and WebP. They are resized automatically and saved to that quote’s Media Library for reuse.

## Customer boundary

Customers see only the private presentation, permitted choices, investment, controlled documents/questions and acceptance. They do not receive Pool Shed navigation, Product Hub costs, margins, stock, Sales Orders, POs, approvals or Project Handover information.

## Deploy

Read `DEPLOYMENT-GUIDE-1.32.1.md` before changing the live Vercel/Supabase environment.


## v1.32.1 secure quote media

Apply `database/007-quote-studio.sql` then `database/008-quote-media.sql` before enabling production Quote Studio publication with uploaded media. Quote media is private and resolved through temporary signed URLs.
