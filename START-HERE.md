# Start Here - Pool Shed v1.33.0

## Create a quote

Go to **Quotes -> New quote** or **CRM -> Customer -> New quote**.

Choose:
- **Quick Quote** for smaller, straightforward work
- **Project Proposal** for larger or staged projects

Use a template when useful. Leave **Advanced workflow** closed unless the safe defaults need changing.

## Build the proposal

1. Set the customer story and presentation.
2. Build quote choices from Product Hub, bespoke options, images and content.
3. Review commercial preflight and customer preview.
4. Publish the secure proposal.
5. Email separately if configured, or copy the secure link.

## Customer decision

- Interactive proposals allow permitted choices and questions.
- View + Accept proposals are read-only except for acceptance/decline.
- Publishing a new version supersedes the previous live link.
- Acceptance is recorded permanently before operational conversion starts.

## After acceptance

Pool Shed converts the frozen accepted version into the configured Sales Order / Project / stock / purchasing / finance workflow. A failed handover does not invalidate the customer acceptance and can be retried safely.

## Deploy

For this completion candidate, existing environments already through migration 010 must apply `database/011-project-extra-quotes.sql` before deploying the matching build. Fresh/staging environments should apply migrations 001 through 011 in order. Historical deployment guides remain under `docs/archive/releases/`.
