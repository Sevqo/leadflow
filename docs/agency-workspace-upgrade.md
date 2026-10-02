# Agency workspace upgrade

This work adds agency delivery records to the existing LeadFlow app. It does not replace the CRM. Client and project records live alongside leads and tasks; migration `0023` links project work into the existing Tasks table. Workflows still use the existing automation engine and actual `automation_runs` history.

## Routes and access

- `/#app`: staff workspace. The membership-backed workspace switcher appears when an account belongs to more than one organization.
- `/portal`: client login. A client account sees only `client_portal_updates` explicitly published for its client membership. It does not inherit staff membership, CRM access, internal notes, team chat, or costs.
- Costs are owner/admin-only in both the UI and RLS. Approval decisions are made only through the audited `decide_agency_approval` RPC. Approval records do not themselves execute privileged automation actions.
- The Activity page shows server-recorded audit events to owners, admins, and managers. Team roster email and join dates come from a membership-authorized server function.
- Invitation acceptance requires a confirmed Auth email, cannot overwrite an existing membership role, and a database guard prevents demoting the last workspace owner. Invitation and role changes are audited.
- Client portal access can be granted and revoked per client. Revocation is audited. Portal users receive only client-safe published fields through membership-checked RPCs; they cannot select the update table or agency-client records directly.
- Agent configurations are persistent records, **not** live agents until an execution integration is connected. System status is manually managed; no synthetic health or cost telemetry is shown.
- Client contact name, email, website, industry, and private notes can be edited after creation. Project plans and target dates, milestone dates, and agent instructions, guardrails, and approval preference can also be edited. Delivery summaries count actual workspace records; the project deadline card includes overdue work and work due within seven days.

## Database rollout

Migrations `0021_agency_operations.sql` through `0025_outbound_campaigns.sql` must be applied in order. `0022` backfills a `# general` room for each existing organization, creates it for future organizations, and connects historical team messages to it. Existing `send_team_message` calls continue to write to General. Room and direct-message access is enforced in Postgres; the client uses room-scoped Realtime subscriptions. [Supabase documents that Postgres Changes applies table SELECT RLS to subscribed rows](https://supabase.com/docs/guides/realtime/authorization#interaction-with-postgres-changes).

The empty local Supabase database was rebuilt from scratch with Docker and all migrations through `0024`. Schema lint reported no errors and both pgtap files passed (30 assertions). Repeat the following checks before any production rollout:

```sh
npx supabase start
npx supabase db reset --local
npx supabase test db
npx supabase db lint --local --level error
npm run typecheck
npm run lint
npm test
npm run build
```

Only after those pass, inspect the production migration plan:

```sh
npx supabase db push --dry-run
```

Applying migrations to a production project requires a separate deliberate `npx supabase db push` after a backup and rollout window. The associated `ai-qualify`, `widget-inquiry`, `whatsapp-send`, and `team-invitations` Edge Function changes must be deployed only after the migrations are live. This document is not an instruction to deploy without confirming the migration plan, backup, and live configuration.

On 1 October 2026, the linked LeadFlow project `lgfnnlrkedzrnvnchash` received migrations `0021`–`0024`; a subsequent dry run reported no pending migrations. The four dependent functions were deployed and reported `ACTIVE`. A public-schema and public-data dump was stored outside Git under the user's local application-data directory before rollout. The data dump warned about a circular foreign key on `automation_runs`, so recovery requires a reviewed restore procedure. These checks do not prove provider credentials, email delivery, or authenticated user journeys are operational.

## Outbound campaigns

Migration `0025` adds tenant-scoped campaign strategy, reviewed sequence steps and prospect records. The Outbound workspace supports offer and ICP definition, manual or CSV prospect intake, evidence and fit scoring, reviewed message drafts, suppression/outcome states, campaign learning and atomic promotion into the CRM. Owners, admins and managers can write; other workspace members can read; client-portal accounts cannot access these records.

This is the internal control plane, not an Explee data or delivery integration. Proprietary prospect databases, web research, enrichment, email validation, sending mailboxes, reply synchronization and calendar booking require separately selected providers, legal/compliance review, server-side credentials and live tests. Campaign activation stays disabled until that infrastructure is implemented and verified.

On 2 October 2026, migration `0025_outbound_campaigns.sql` was rebuilt and tested on the disposable local Docker stack, then applied to the linked LeadFlow project. A follow-up production dry run reported no pending migrations. No outbound provider credentials or functions were deployed.

## Honest setup states

External provider replies remain limited to configured channels. A non-WhatsApp Inbox reply is clearly labelled an internal record, not customer delivery. Internal notes are excluded from AI qualification input. New client systems do not claim monitoring data without a verified source. Agency costs are user-entered amounts only and profitability is not fabricated. The client portal requires an existing confirmed user account; an owner/admin grants that account access to a specific client and can then publish updates.

Production secret-name inspection found `AUTOMATION_CRON_SECRET` configured, but `APP_ORIGIN`, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENAI_API_KEY`, and `WHATSAPP_ACCESS_TOKEN` absent. Invitation email, provider AI and WhatsApp delivery therefore remain setup-required; their UI/backend must not be described as successfully delivering messages yet. Provider account creation, keys, webhook verification and live connection tests are intentionally left to the workspace owner.

Billing checkout is disabled by default because the current Stripe flow is not a verified usable provider for this business. The browser flag `VITE_BILLING_PROVIDER_READY` defaults to `false`; it must only be enabled after a supported provider, server-side secrets, webhooks, pricing and an end-to-end checkout have been verified. This UI gate is not a replacement for server-side authorization or provider validation.

## Known follow-up work before shipment

- Repeat the local migration rebuild, lint and pgtap suite after any further SQL edit.
- Build authenticated end-to-end journeys for channels/DMs, portal membership, and multi-workspace switching (demo UI tests are not a substitute).
- Add message attachments, mentions, reactions, presence, typing, and explicit notification preferences when storage, authorization and retention are designed.
- Expand project-task assignment and connect systems with documents, AI agents, activity history, and verified telemetry.
- Expand role-aware global search, management analytics, and audit log UI. Client financial reporting requires a verified revenue source.
- Approval records currently capture review decisions but do not execute queued privileged actions. Agent configurations do not yet run. System health is manually recorded, not observed. Do not present any of these as a connected production automation until the execution and telemetry integrations are implemented and verified.
## Outbound provider infrastructure

LeadFlow owns the orchestration layer while external providers own research, enrichment, email verification, mailbox delivery, and calendar execution. The browser never receives provider keys or adapter URLs.

Configure these Edge Function secrets when providers are selected: `OUTBOUND_CRON_SECRET`, `OUTBOUND_WEBHOOK_SECRET`, plus the matching `OUTBOUND_<CAPABILITY>_API_URL` and `OUTBOUND_<CAPABILITY>_API_KEY` pair documented in `.env.example`. Each adapter implements:

- `POST /health` with `{ capability, workspaceId }` and a JSON success response.
- `POST /execute` with the normalized job, campaign, prospect, and sequence payload. Research returns `researchNotes`; enrichment returns `data` and optional `contactId`; validation returns `verdict` (`VALID`, `RISKY`, or `INVALID`) and `reason`; mailbox returns `messageId` and optional `subject`.
- Signed event callbacks to `outbound-webhook` using `x-leadflow-signature: sha256=<HMAC_SHA256(raw_body)>`. Events support `DELIVERED`, `REPLIED`, `BOUNCED`, `COMPLAINED`, `UNSUBSCRIBED`, and `MEETING_BOOKED`.

After deploying `outbound-provider-check`, `outbound-worker`, and `outbound-webhook`, configure the one-minute worker with the service-role-only `configure_outbound_worker_scheduler(project_url, cron_secret)` function. Sending is rejected unless the prospect is approved, the email is valid, and the address is absent from the suppression list.
