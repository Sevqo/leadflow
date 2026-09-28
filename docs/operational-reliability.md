# Operational reliability

Migration `0011_operational_reliability.sql` adds retry metadata to automation runs, tenant-isolated webhook endpoints and delivery history, plus an audited organization-settings command.

Failed automation runs schedule exponential retries up to three attempts. Invoke `automation-retry` from a trusted scheduler with `x-cron-secret`; both it and the internal path in `automation-run` require `AUTOMATION_CRON_SECRET`.

Owners and admins can configure HTTPS webhook destinations in the application. `webhook-delivery` derives an organization-specific HMAC key from `WEBHOOK_SIGNING_SECRET` and sends `x-nexara-signature: sha256=…` with a unique event ID. Provider secrets are never returned to the browser.

Before enabling production scheduling or delivery, configure strong independent values for `AUTOMATION_CRON_SECRET` and `WEBHOOK_SIGNING_SECRET` in Supabase Edge Function secrets.

Migration `0018_automation_retry_scheduler.sql` installs the Cron and HTTP extensions and exposes two service-role-only management functions. `configure_automation_retry_scheduler(project_url, cron_secret)` stores the URL and shared secret in Vault, replaces any existing `nexara-automation-retry` job, and schedules retries every minute. `disable_automation_retry_scheduler()` removes the job without deleting Vault secrets. The value passed to the configure function must exactly match the `AUTOMATION_CRON_SECRET` Edge Function secret.

For a clean local backend verification, start Docker Desktop and run:

```sh
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run test:backend
```
