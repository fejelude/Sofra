# Sofra — Discord Community Bot

Sofra is a lightweight Discord bot designed to run continuously on Wispbyte.
It includes polished welcome, leveling, auto-role, moderation, information,
announcement, poll, and safe meme features.

Use Sofra's compact Discord command surface for everyday actions and the
companion Portfolio dashboard for deeper server configuration. Shared Upstash
configuration synchronizes the two deployments;
member XP, warnings, and ticket records remain in local SQLite. See
[PUBLIC_LAUNCH.md](PUBLIC_LAUNCH.md) for the audit, deployment order, limits,
and release checklist. This is not a multi-host or million-user certification.

## Public-server improvements

- `/sofra` provides private help, setup guidance, health checks, and a dashboard link.
- Watching presence displays the guild total, including ShardingManager totals
  when available. Join/leave updates are coalesced over 15 seconds.
- Advanced AutoMod configuration lives in the dashboard, keeping its large
  settings surface out of Discord's slash-command picker.
- Tickets and booster messages use neutral community copy, not studio rewards.
- The personal name-trigger feature is disabled unless `SOFRA_PERSONAL_GUILD_ID`
  explicitly restricts it to one server.
- Dashboard sync writes acknowledgements with short expiry, bounds concurrent
  polling, serializes per-guild tasks, and seeds without overwriting existing data.

## Features

### Welcome system

- Admin-only configuration through the companion dashboard
- 64 polished welcome messages with blush, pink, lavender, and cream styling
- Persistent per-server channel and enabled state
- Permission and stale-channel diagnostics
- Safe handling of duplicate joins, deleted channels, storage failures, and
  Discord API errors

### Level system

- Random XP for eligible text-channel messages, with a persistent anti-spam
  cooldown
- Public rank cards, a paged leaderboard, and a role-reward list
- Aesthetic level-up embeds with an optional dedicated notification channel
- Cumulative automatic role rewards with permission and hierarchy validation
- Per-server settings and SQLite persistence across restarts
- Duplicate-event protection and graceful handling of database, channel, role,
  and Discord API failures
- Message content is never read or stored
- Active Discord Server Boosters earn **1.5× XP (+50%)** on every eligible
  message while keeping the same anti-spam cooldown

### Auto-role system

- Instantly gives one configured role to each new human member
- Admin-only setup through the companion dashboard
- Validates Manage Roles, role hierarchy, managed roles, and deleted roles
- Persistent per-server role and enabled state
- Duplicate join protection and failure isolation from welcomes and levels

### Server Booster celebrations

- Detects the exact transition when a member begins boosting the server
- Assigns one configurable custom **Server Booster** role automatically
- Posts a pink Sofra thank-you embed with the current server name and icon
- Randomly selects from exactly 67 cute, sincere thank-you messages
- Removes the custom role when the member stops boosting
- Persistent per-server role, channel, and enabled state with safe duplicate-event handling

### Moderation and community tools

- `/mod` consolidates warn, warning history, timeout, kick, ban, unban,
  lockdown, unlock, and slowmode actions behind one entry point, while
  `/purge` remains direct for fast cleanup
- Private aesthetic warning DMs with persistent, moderator-only offense totals
- Lockdowns that remember and restore the channel's exact previous typing state
- Member and server information embeds
- Modal-based announcement embed builder
- Discord-native single-choice polls that survive bot restarts
- Retried, validated SFW memes from a small subreddit allowlist

### Context-aware automod

- Disabled-by-default, persistent per-server filtering with three profanity/hate
  severity tiers and conservative multilingual defaults
- Unicode, zero-width, homoglyph, leetspeak, symbol/spacing, capitalization, and
  repeated-character normalization while preserving original text for staff logs
- Separate normal-link and Discord-invite policies, so media URLs and attachments
  do not accidentally become profanity violations
- Owner/administrator/Manage Server access plus configurable manager, bypass,
  normal-link, and invite roles; non-owners cannot grant roles at or above their own
- Server defaults with exempt or relaxed channel/category overrides, custom blocked
  words, and exact false-positive whitelists
- Cute randomized warnings for profanity, direct wording for hate, warning cooldowns,
  bounded five-minute escalation tracking, optional timeouts, and optional Tier 1
  strikes in the existing warning history
- Detailed incidents sent through the existing private Staff Logs channel

### AI chat channel

- Optional, channel-scoped AI chat powered by Google Gemini using Gemini 3.6 Flash by default
- Sofra keeps a small, in-memory, per-user recent conversation window for 30 minutes;
  it is never written to the database or shared between users
- Bounded request timeouts, duplicate-request protection, safe error replies, and
  Discord-length-aware response splitting
- Server administrators use the single `/ai` command with an action option to
  view status, choose a channel, or disable AI chat

### Private moderation logs

- One-command creation of a private `Moderation` category and `#staff-logs`
- Persistent per-server channel and enabled state
- Aesthetic records for bans, unbans, kicks, warnings, timeouts, purges,
  lockdowns, unlocks, slowmode, and channel-permission moderation
- Mirrors supported manual Discord moderation through audit-log events while
  deduplicating actions performed through Sofra
- Stores only configuration; moderation log messages live in Discord and are
  never duplicated into a growing local event archive

### Private ticket system

- Admin-posted pink ticket panel for Bug Reports, Member Reports, and Other help
- Private numbered channels with persistent IDs such as `bug-0001`
- Access restricted to the creator, configured staff roles, and Sofra
- One open ticket of each type per member to prevent spam
- Persistent staff controls to claim, close, reopen, confirm, and delete tickets
- Ticket creation, claim, close, reopen, and deletion events sent through the
  existing private Staff Logs configuration

## Discord setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select Sofra, open **Bot**, and enable **Server Members Intent** and
   **Message Content Intent** under **Privileged Gateway Intents**. Server
   Members is required for joins, roles, and boost detection; Message Content
   is required for passive text-trigger features.
3. Invite Sofra with the `bot` and `applications.commands` scopes.
4. Give Sofra these permissions in welcome and level-notification channels:
   - View Channel
   - Send Messages (and Send Messages in Threads when the activity channel is a thread)
   - Embed Links
5. To use automatic level rewards or auto-role, also give Sofra **Manage
   Roles** and move Sofra's highest role above every role she needs to assign.
6. Give moderator roles only the permissions they should actually use. Sofra
   needs **Manage Messages**, **Kick Members**, **Ban Members**, **Moderate
   Members**, and **Manage Channels** for the corresponding commands. Channel
   lockdowns additionally require Sofra to have **Manage Roles**, because they
   safely edit the `@everyone` channel permission overwrite.
7. Polls require **Send Messages** and **Create Polls** in the channel.
8. Moderation logs require **View Audit Log** to detect supported actions made
   manually through Discord. Configure the Staff Logs destination in the
   dashboard; Sofra needs **Manage Channels** and **Manage Roles** when creating
   private moderation areas, and the destination needs **View Channel**,
   **Send Messages**, and **Embed Links**.
9. Tickets require **Manage Channels**. Sofra also needs **View Channel**, **Send
   Messages**, and **Embed Links** in the selected panel and Staff Logs channels.
10. Booster celebrations require **Manage Roles** with Sofra above the custom
    booster role. The thank-you channel needs **View Channel**, **Send Messages**,
    and **Embed Links**. No studio-specific media channel is required.
11. To enable AI chat, create a Google AI Studio key, set `GEMINI_API_KEY`,
    then run `/ai action:Set channel channel:#channel` as a server
    administrator. The configured channel needs **View Channel**, **Send
    Messages**, and **Read Message History**.

The level system deliberately ignores message text when awarding XP. Message
Content Intent is used only by passive text-trigger features; matching happens
in memory, and message text is not persisted. Presence Intent is not required.
Moderation logs add Discord's non-privileged **Guild Moderation** intent for
live audit-log events; it does not require another Developer Portal toggle.

## Wispbyte deployment

Use Node.js **24.15 or newer**. Wispbyte's Node.js 24.19 runtime is compatible
and provides the built-in SQLite module used for levels.

1. Set the startup file to `index.js`.
2. Add the required environment variable `DISCORD_TOKEN`.
3. Optionally add `DISCORD_GUILD_ID` with your server ID. This registers all
   slash-command groups immediately in that server. Without it, commands are
   registered globally and Discord may take time to show updates.
4. Deploy or update the repository and start Sofra.

Recommended Wispbyte startup command:

```bash
npm install --no-fund --no-audit && node index.js
```

For a clean manual installation, use:

```bash
npm ci --omit=dev
npm start
```

No new package dependency is required. Startup and runtime failures are logged
clearly in the Wispbyte console. The shared SQLite database uses bounded
warning history and a limited WAL journal to remain disk-conscious. `/meme`
requires ordinary outbound HTTPS access to the third-party
[Meme API](https://github.com/D3vd/Meme_Api) at `meme-api.com`.

## Commands

Sofra deliberately keeps Discord's slash-command picker small. Advanced module
configuration stays in the companion dashboard instead of being represented by
dozens of Discord subcommands.

### Core

- `/sofra [view]` — open Sofra's private control center. **Setup** and **Health**
  remain permission-gated to server managers; the buttons also link to the dashboard.
- `/level [member]` — show a rank card. The response includes interactive
  **Leaderboard** and **Rewards** buttons instead of separate level subcommands.
- `/info [view] [member]` — show server information or inspect a member.
- `/meme` — fetch a validated SFW meme.

### Staff

- `/mod action:...` — one moderation entry point for warn, warning history,
  timeout/remove-timeout, kick, ban, unban, lockdown, unlock, and slowmode.
  Sofra checks the matching Discord permission and role hierarchy at runtime.
- `/purge messages:1-100|all` — delete recent messages; `all` is capped at
  1,000 messages per run and Discord still cannot bulk-delete messages older than
  14 days.
- `/embed [channel]` — open the announcement embed modal.
- `/poll ...` — create a Discord-native poll.
- `/ticket ...` — configure/post the support ticket panel. This remains direct
  because posting the live Discord panel is an in-server operation.

### Server administration

- `/ai [action] [channel]` — view AI status, choose the AI chat channel, or
  disable AI chat without exposing a subcommand tree.
- Welcome, Auto Role, AutoMod, Boosters, Levels administration, Staff Logs, and
  deeper Ticket settings are configured through the existing dashboard.

The registered top-level command set is intentionally limited to:

`/sofra` · `/level` · `/purge` · `/mod` · `/info` · `/embed` ·
`/poll` · `/meme` · `/ai` · `/ticket`

At startup, Sofra reconciles Discord's registered commands to this exact list.
Commands removed from the code are deleted from Discord, preventing stale legacy
commands from continuing to appear in the slash picker.

## Level behavior and defaults

The level system starts **disabled** so existing deployments do not begin
tracking activity unexpectedly. Enable it from the dashboard once after deployment.

By default, each member can earn **15–25 XP once every 60 seconds**. The
cooldown is per member and per server and survives restarts. XP requirements
increase gradually at each level. Bots, webhook messages, system messages,
DMs, and duplicate events do not earn XP.

Active Server Boosters receive 1.5× the randomly rolled XP for each eligible
message. XP remains a whole number, so half-point results round upward (for
example, 15 base XP becomes 23 XP). The bonus is determined from Discord's live
boosting state and does not rely on a manually assigned role.

If no dedicated level channel is configured, a level-up appears in the channel
where XP was earned. If a configured channel is later deleted or loses access,
Sofra logs the problem and safely tries that activity channel instead.

Role rewards are cumulative. A member above several configured thresholds gets
every eligible missing role after their next XP award. Discord prevents Sofra
from assigning managed roles or roles above Sofra's highest role.

## Persistence and privacy

Welcome configuration is stored atomically in `data/welcome-config.json`.
Level configuration, XP, cooldown state, reward mappings, auto-role settings,
warnings, active lockdown restoration data, moderation-log configuration,
ticket settings, staff-role access, booster settings, increasing ticket IDs, status, claim, and
channel/message references are stored in
`data/levels.sqlite`. Both paths are ignored by Git.

The level database stores only the data needed for the feature: server and user
IDs, total XP, eligible-message count, last award timestamp/message ID, level
settings, channel ID, reward role IDs, the configured auto-role and booster IDs, warning
reasons/moderator IDs/timestamps, and temporary lockdown state. Detailed
warning history is limited to the latest 25 entries per member while the total
offense count remains accurate. Sofra does not store ordinary message text,
avatars, purged messages, moderation-log events, polls, memes, full message
history, ticket conversation contents, or join history.

Passive text-trigger checks inspect incoming message content only in memory.
They do not add commands, store matching messages, or write their contents to
logs or databases.

Normal Wispbyte restarts reload both files automatically. If you fully erase or
move the server, back up and restore the `data` directory to keep settings and
levels.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Sofra's bot token |
| `DISCORD_GUILD_ID` | No | Registers all Sofra slash commands immediately in one server |
| `WELCOME_CONFIG_PATH` | No | Overrides the welcome JSON path |
| `LEVEL_DATABASE_PATH` | No | Overrides the level SQLite path |
| `GEMINI_API_KEY` | Yes, when AI is enabled | Google AI Studio API key; keep it only in deployment secrets or `.env`; choose the channel with `/ai channel` |
| `GEMINI_MODEL` | No | Gemini model to use; defaults to `gemini-3.6-flash` |

No external database, migration command, port, web URL, or additional secret is
required.

## Welcome placeholders

The built-in welcome renderer supports `{user.mention}`, `{user.name}`,
`{user.avatar}`, `{server.name}`, `{server.member_count}`, and `{server.icon}`.
Names are escaped, Discord avatar/icon URLs are used directly, and allowed
mentions are restricted to the relevant member.

## Testing

```bash
npm test
npm run check
```

After deployment:

1. Confirm Discord shows exactly the compact top-level command set documented
   above and that removed legacy commands disappear after Sofra reconnects.
2. Test `/sofra`, `/info`, `/level`, `/poll`, and `/meme`.
3. Open `/sofra` → **Health** as a server manager and verify storage,
   permissions, and dashboard sync.
4. Use a private test channel and trusted test account with `/mod`; confirm
   successful actions still appear once in `#staff-logs`.
5. Verify `/mod action:Lock channel` and `/mod action:Unlock channel` preserve
   the channel's previous typing state.
6. Review Welcome, Auto Role, Levels, AutoMod, Boosters, Staff Logs, and Tickets
   in the dashboard to confirm their existing stored configuration is intact.
7. Test `/ai` status/channel handling and `/ticket` panel posting if those
   modules are enabled on the server.

For welcomes, use the dashboard's preview/test controls and then verify a real
join with a test account or trusted member.

## Known limitations

- XP is based on eligible messages, not message quality or length. The level
  system does not use message content even though passive triggers inspect it.
- Users who leave remain on the leaderboard so their progress survives a
  rejoin. There is no reset command in this focused implementation.
- Members already above a new reward threshold receive the role after their
  next eligible XP award rather than through a background scan.
- `/purge` cannot bulk-delete messages older than Discord's 14-day limit.
- `/meme` depends on the third-party Meme API and returns a friendly error when
  the service or Wispbyte outbound network is unavailable.
- Discord does not create an audit-log entry when a timeout expires naturally,
  so automatic timeout expiration has no moderator-attributed log. Timeouts
  applied or removed through Sofra, and manual timeout changes, are logged.
