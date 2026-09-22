# Sofra: public-server audit and release guide

## Decision

Keep the existing Node 24 / discord.js service and companion Vercel dashboard.
The repository already has useful, tested guild-scoped modules. A rewrite would
discard working permission checks, migrations, and moderation behavior. This
release strengthens the public-server foundation and makes the product easier
to configure. It does **not** implement the entire earlier feature wishlist or
certify million-user capacity.

## Architecture reviewed

- `src/index.js`: Discord gateway, service composition and event routing.
- `src/level/store.js`: SQLite settings, XP, warnings, lockdowns, tickets.
- `src/welcome/store.js`: serialized local JSON welcome configuration.
- `src/shared-config.js`: Redis section documents mirrored into local stores.
- Module commands/services: runtime authorization, hierarchy checks, embeds.
- Portfolio `api/sofra`: Discord OAuth, server authorization, validation,
  ticket panel writes and Redis settings.
- Portfolio dashboard: vanilla JavaScript core plus branding/server-selector
  layer; no framework migration is required to improve this deployment.

## Findings and changes

| Finding | Change |
| --- | --- |
| Discord command picker was too crowded | Replace separate onboarding/configuration command trees with a compact `/sofra` control center, ten top-level entry points, private setup/health views, and runtime permission checks |
| No requested server-count presence | Watching presence, 15-second coalesced membership updates, periodic refresh, shard aggregation when managed shards are used |
| Personal name triggers ran in all communities | Disabled unless `SOFRA_PERSONAL_GUILD_ID` explicitly scopes the feature |
| Ticket copy promised studio-specific rewards | Neutral reports/support copy; remove expiring ticket banner URLs |
| Booster branding/media assumed a studio server | Current server name/icon, no private media-message dependency |
| AI persona concealed its external provider | Honest Gemini disclosure, no invented model identity or human impersonation |
| AutoMod log-only detections could escalate | Early non-enforcement path: no deletion, warning, timeout, strike, kick or ban |
| No behavioral traffic guard | Opt-in ten-second flood detection, duplicate fingerprint detection, mention threshold; bounded memory and guild isolation |
| Repeated events could duplicate enforcement | Short-lived message-content fingerprint deduplication before side effects |
| Config polling spawned requests for every guild | Four-guild worker bound, overlapping poll protection |
| Push/seed races | Per-guild task queues, dirty-generation tracking, HSETNX initialization |
| Dashboard could not distinguish storage from application | Expiring bot acknowledgements with per-section SHA-256 hashes |
| Ticket disable/type flags vanished on offline restart | Persist dashboard ticket options in SQLite |
| Interaction handler had an uncaught async path | Top-level handler logging and safe private failure response |
| README contradicted dashboard implementation | Updated integration and deployment guidance |

## New settings

- `SOFRA_WEBSITE_URL`: optional HTTPS origin for onboarding links.
- `SOFRA_PERSONAL_GUILD_ID`: optional guild ID; leave blank for general public use.
- AutoMod safety settings are configured through the dashboard instead of
  being exposed as a large Discord subcommand tree. Log-only testing still
  requires AutoMod's master toggle and staff logs for visible incidents.
- Dashboard AutoMod traffic protection can detect flooding, four identical
  messages within ten seconds, and configured mention limits. Defaults remain
  seven messages per ten seconds and six mentions in a message; threshold
  ranges remain 3–20.
- Existing bypass roles and exempt channels apply to traffic protection.
- Log-only mode keeps at most five incident logs per member per minute.

The new `automod_safety` and `ticket_options` tables are additive. Existing
settings and member records are not deleted. Spam protection remains off until
an administrator enables it. Live command registration now reconciles Discord
to Sofra's exact desired command set, including deleting obsolete legacy
commands; remove `DISCORD_GUILD_ID` to register commands globally.

## Coordinated deployment

1. Stop the bot cleanly and back up the SQLite database and welcome JSON. Copy
   WAL/SHM files too if backing up a running process; prefer a SQLite-aware backup.
2. Use a persistent disk for `LEVEL_DATABASE_PATH` and `WELCOME_CONFIG_PATH`.
3. Configure the same Upstash database in both deployments. Keep secrets in
   deployment variables, never frontend JavaScript or source control.
4. Configure `SOFRA_WEBSITE_URL`; leave the personal guild override blank unless
   explicitly wanted. Review optional AI provider/model availability and billing.
5. Deploy this bot branch first. Run `npm ci`, `npm run check`, and `npm test`.
6. Deploy the companion Portfolio branch, with the existing OAuth callback.
   `/sofra` remains the dashboard; `/sofra/about` becomes the public introduction.
7. Use the staging checklist below before inviting public communities.

Rollback: stop the new bot, restore a known-good code release and database
backup, then restart. Do not run two bot processes against the same local JSON
file. The old dashboard can ignore the new fields, but saving old AutoMod forms
can discard safety settings; roll back both projects together and recheck them.

## Staging acceptance checklist (requires operator credentials)

- Install in two unrelated servers. Confirm settings, XP, warnings, tickets,
  bypass roles, and moderation actions never cross guild boundaries.
- Test owner, Manage Server, ordinary member, and recently-demoted staff access.
- Change a dashboard-managed setting and refresh to see the exact section
  applied. Separately verify the retained Discord-side operations such as
  `/ai` and `/ticket` still behave correctly.
- Pause the bot; after 180 seconds the dashboard must show unknown sync status,
  not claim the bot is online. Change settings while paused and verify on restart.
- Disable tickets, restart with Redis unavailable, and click an old panel button:
  ticket creation must still be rejected. Existing tickets remain intact.
- Test AutoMod in log-only mode, then enable enforcement deliberately. Verify
  channel exemptions, bypass roles, duplicate events, edits and role hierarchy.
- Deny Manage Messages / Moderate Members / Manage Roles separately. Confirm
  failures are logged and do not crash the bot. Test role deletion and channels.
- Confirm `/sofra`, the documented compact top-level command set, stale-command
  cleanup, and Watching status.
- Review ticket privacy with members who do and do not hold configured staff roles.
- Test desktop/mobile dashboard, keyboard navigation and reduced-motion settings.

## Known limits / next implementation phase

These are release gates for broad promotion, not completed capabilities:

1. **Configuration conflicts:** task serialization addresses same-process races,
   but section documents remain last-writer-wins across independent writers.
   Introduce atomic revision/CAS writes, a durable change journal and field-aware
   merges before supporting concurrent staff editing at scale. Unsynced local
   changes can still lose precedence after a process restart during an outage.
2. **Storage and scaling:** SQLite/JSON is a single-deployment model. Plan shared
   transactional storage, shard ownership, distributed locks and durable jobs
   before running multiple hosts. Presence aggregation alone is not sharding
   infrastructure. Polling costs still grow with guild count.
3. **Traffic protection:** fingerprint windows are in-memory, bounded and reset
   on restart. This is anti-spam, not coordinated raid detection or an alt-account
   classifier. Load-test CPU, memory, moderation latency and false positives.
4. **API operations:** Discord side effects and Redis writes are not one atomic
   transaction. Ticket-panel reconciliation needs a durable outbox/idempotency
   strategy for failures after a Discord write but before configuration commit.
5. **AI:** optional Gemini chat needs explicit provider/model verification,
   server opt-in disclosure, per-guild quotas and billing controls before broad
   access. Do not advertise it as unlimited or as a privately hosted model.
6. **Privacy:** agree retention/export/deletion rules with the operator. Implement
   a guild-removal cleanup lifecycle and publish accurate privacy/support/terms
   pages. Do not guess an operator identity, retention promise or legal policy.
7. **Operations:** add metrics, error reporting, alerting, backup restoration
   drills, deployment rollback checks and real load tests.
8. **Product backlog:** configurable role panels, scheduled announcements,
   giveaways, reminders, appeals, ticket transcripts, extended case history,
   localization and native Discord AutoMod integration remain separate work.

## Verification

Local verification for this branch: **141 tests passed**. The runtime syntax
checks passed, and `npm audit --omit=dev --audit-level=high` reported zero
vulnerabilities at the time of the check. The companion website passed 52 tests
and fixture browser smoke tests at desktop (1440px) and mobile (390px) widths.
Public-page and dashboard screenshots were reviewed at both sizes.

Automated tests cover module behavior, persistent storage, permissions, new
presence aggregation, onboarding guards, non-punitive AutoMod, traffic isolation,
and synchronization race regressions. Tests do not use production credentials.
Run `npm test` and the staging checklist; passing unit tests alone is not
permission to claim a bug-free or million-user-ready service.
