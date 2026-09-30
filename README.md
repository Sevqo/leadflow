# Sevqo LeadFlow

Sevqo LeadFlow is a multi-tenant lead capture, qualification, CRM, automation and analytics platform for SMEs. The current product includes a polished responsive workspace, persistent browser-based demo CRM, authenticated live CRM, shared Inbox, Knowledge Base, AI Assistant settings, integration health, signed outbound webhooks, durable automation retries, persistent organization settings, lead and contact management, an interactive pipeline, lead activity timelines, global search, notifications, theme switching, analytics, and a motion-rich public landing experience.

## Stack

- React + TypeScript + Vite
- CSS design tokens with responsive light/dark UI
- Supabase target architecture (Auth, PostgreSQL, RLS, Storage)
- Server-side AI, WhatsApp, email, billing and public-capture service boundaries

## Run locally

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Validate with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
Browser tests use installed Microsoft Edge and an isolated Vite server on port 5174.
Screenshots and failure traces are written to the ignored `test-results/` directory.

## Supabase backend

The repository includes reproducible migrations for authentication profiles, organizations, role-based memberships, tenant-isolated CRM data, inbox entities, knowledge, automations, audit events, tasks, AI configuration, integrations, subscriptions and analytics events. Privileged CRM workflows use transactional PostgreSQL functions so the record change, timeline entry, audit event and analytics event remain consistent.

See [backend foundation](docs/backend-foundation.md) for migration, authorization and production-verification guidance.
See [server functions](docs/server-functions.md) for the AI qualification and WhatsApp webhook/delivery trust boundaries and required secrets.
See [live workspace modules](docs/live-workspace-modules.md) for Inbox, Knowledge Base, AI Assistant and integration readiness behavior.

## Public product experience

The homepage is an interactive conversation-to-customer walkthrough, separate from the
demo workspace at `/#app`. It includes finite product animations, a sticky transformation
story, scripted AI questions, CRM/pipeline/inbox demonstrations, the real analytics
workbench with isolated sample records, industry examples, pricing and accessible FAQs.

See [landing experience notes](docs/landing-experience.md) for architecture, motion,
accessibility, testing and launch prerequisites. Marketing demonstrations do not call
live AI providers, send messages, create subscriptions or modify workspace data.

## Environment

Copy `.env.example` to `.env.local`. Demo mode only needs `VITE_APP_URL`; authenticated production mode also needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. AI, WhatsApp and billing secrets remain server-only until their adapters are configured. Never expose Supabase secret keys or provider credentials through `VITE_` variables.

## External go-live checklist

The repository-side product is implemented and validated. Production launch still requires account-specific infrastructure that cannot be committed safely:

1. Configure the deferred email sender and production application origin in Supabase.
2. Add server-side AI and channel credentials, then complete each provider's sandbox/certification flow. Select and integrate a payment provider that can onboard the business in Kenya; Stripe credentials alone are not a valid launch plan.
3. Configure customer-owned OAuth applications for channels that require delegated account access.
4. Schedule `automation-retry` with the production scheduler after setting its shared secret.
5. Apply all migrations through `0016_profile_pipeline_readiness.sql`, deploy the functions in `supabase/functions`, and run the documented production smoke tests.

See [product readiness audit](docs/product-readiness-audit.md) for what the workspace now verifies and what still needs live end-to-end evidence before customer shipment.

## Product expansion

The workspace now includes an embeddable website enquiry widget with tenant keys and origin allowlists, event-triggered automations with duplicate/delete controls, date-aware analytics, explainable lead scoring, persistent first-run setup progress, quick actions, notification preferences and operational database alerts. Live settings include profile, password, data export and owner-confirmed workspace deletion controls. Lead tables and conversation history use bounded page sizes so larger workspaces do not render an unbounded record set.

Apply all migrations through `0016_profile_pipeline_readiness.sql` and deploy `widget-inquiry` before enabling a live website widget. The generated snippet points to the deployed Supabase function and will reject requests from origins not saved in the widget configuration.

## Demo data

The Sevqo Demo Agency workspace is clearly labelled demo data. Lead, contact, pipeline, note and follow-up changes persist in local browser storage so complete workflows can be tested safely. It does not represent a live customer or production integration; shared data uses the configured Supabase project and credentials.

## CRM workflows available

- Create, search, filter, sort, assign, qualify and recoverably archive leads.
- Open a lead profile, edit its details, add notes and schedule follow-ups.
- Move opportunities through seven pipeline stages by drag and drop or accessible selectors.
- Create, edit, tag and search contacts, with related lead history.
- Open modules and leads through keyboard search (`Ctrl/Cmd + K`).
- Use the responsive mobile navigation, notification centre and persistent dark theme.

## Repository

The repository is maintained on the `master` branch at `Sevqo/leadflow`.
