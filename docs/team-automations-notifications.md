# Team, automation and notification setup

Migration `0008_team_automation_notifications.sql` enables real-time updates and secure invitation acceptance. Deploy `team-invitations`, `automation-run`, and `notification-email` with JWT verification enabled.

Set these server-only function secrets:

- `APP_ORIGIN` — the public HTTPS Sevqo URL used in invitation links; invitation delivery fails closed until configured.
- `RESEND_API_KEY` — the Resend API key.
- `EMAIL_FROM` — a verified sender, for example `Sevqo <notifications@example.com>`.

Invitation tokens are stored only as SHA-256 hashes, expire after seven days, and can only be accepted by a signed-in account with a confirmed matching Auth email. Invites cannot change an existing membership role; a last-owner guard prevents removing the final owner through role changes. Automation runs are recorded as `RUNNING`, then finalized as `SUCCEEDED`, `SKIPPED`, or `FAILED`; execution details remain available for auditing.
