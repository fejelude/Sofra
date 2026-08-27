# Sofra — Discord Community Bot

Sofra is a lightweight Discord bot designed to run continuously on Wispbyte.
It includes polished welcome, leveling, auto-role, moderation, information,
announcement, poll, and safe meme features.

There is no dashboard, web server, image generation, avatar downloading, or
message archive. Configuration happens through Discord slash commands.

## Features

### Welcome system

- Admin-only `/welcome` configuration
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
- Admin-only setup through `/autorole`
- Validates Manage Roles, role hierarchy, managed roles, and deleted roles
- Persistent per-server role and enabled state
- Duplicate join protection and failure isolation from welcomes and levels

### Server Booster celebrations

- Detects the exact transition when a member begins boosting the server
- Assigns one configurable custom **Server Booster** role automatically
- Posts a pink Sofra thank-you embed with the supplied banner and Nitro GIF
- Randomly selects from exactly 67 cute, sincere thank-you messages
- Removes the custom role when the member stops boosting
- Persistent per-server role, channel, and enabled state with safe duplicate-event handling

### Moderation and community tools

- Purge, ban, kick, timeout mute/unmute, warning, unban, lockdown, unlock, and
  slowmode commands with Discord permission and role-hierarchy checks
- Private aesthetic warning DMs with persistent, moderator-only offense totals
- Lockdowns that remember and restore the channel's exact previous typing state
- Member and server information embeds
- Modal-based announcement embed builder
- Discord-native single-choice polls that survive bot restarts
- Retried, validated SFW memes from a small subreddit allowlist

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

- Admin-posted pink ticket panel for Bug Reports, Player Reports, and Other help
- Private numbered channels with persistent IDs such as `bug-0001`
- Access restricted to the creator, configured staff roles, and Sofra
- One open ticket of each type per member to prevent spam
- Persistent staff controls to claim, close, reopen, confirm, and delete tickets
- Ticket creation, claim, close, reopen, and deletion events sent through the
  existing private Staff Logs configuration

## Discord setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select Sofra, open **Bot**, and enable **Server Members Intent** under
   **Privileged Gateway Intents**. This is required for welcome and auto-role
   join events.
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
   manually through Discord. `/modlog setup` additionally needs **Manage
   Channels** and **Manage Roles**; the destination needs **View Channel**,
   **Send Messages**, and **Embed Links**.
9. Tickets require **Manage Channels**. Sofra also needs **View Channel**, **Send
   Messages**, and **Embed Links** in the selected panel and Staff Logs channels.
10. Booster celebrations require **Manage Roles** with Sofra above the custom
    booster role. The thank-you channel needs **View Channel**, **Send Messages**,
    and **Embed Links**. Sofra also needs access and **Read Message History** in
    the channel containing the referenced Nitro GIF message.

The level system uses the normal **Guild Messages** gateway intent, which is
requested by the code automatically. Sofra does **not** need Message Content
Intent or Presence Intent. The level system deliberately ignores message text.
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

### Welcome administration

- `/welcome channel channel:#channel` — choose and validate the welcome channel
- `/welcome enable` — enable welcomes after validating the saved channel
- `/welcome disable` — disable welcomes without deleting the saved channel
- `/welcome test` — send a preview using the administrator who ran it
- `/welcome status` — show channel, permissions, storage health, and validity

All `/welcome` commands require **Manage Server** or Administrator permission.

### Public level commands

- `/level rank [member]` — show your rank or another member's rank card
- `/level leaderboard [page]` — show the server's paged XP leaderboard
- `/level rewards` — show configured automatic role rewards

### Level administration

- `/level enable` — turn XP earning on
- `/level disable` — pause XP earning while retaining all data
- `/level channel channel:#channel` — set a dedicated level-up channel
- `/level channel-reset` — send level-ups where the XP was earned
- `/level settings [cooldown-seconds] [minimum-xp] [maximum-xp]` — tune XP
- `/level role-add level:# role:@role` — add or update a cumulative reward
- `/level role-remove role:@role` — remove a reward without removing it from members
- `/level test` — preview a level-up without changing XP or roles
- `/level status` — diagnose settings, channel permissions, database, and roles

Administrative `/level` subcommands require **Manage Server** or Administrator
permission. Public rank, leaderboard, and rewards commands remain available to
normal members. Commands cannot be used in DMs.

### Auto-role administration

- `/autorole role role:@role` — choose and validate the role for new members
- `/autorole enable` — enable assignment after validating the saved role
- `/autorole disable` — disable assignment while keeping the saved role
- `/autorole test` — test assignment using the administrator who runs it
- `/autorole status` — diagnose storage, role existence, permission, and hierarchy

All `/autorole` commands require **Manage Server** or Administrator permission.
The feature starts disabled and ignores bots. If the configured role is deleted,
Sofra clears it and disables auto-role safely.

### Moderation

- `/purge messages:1-100|all` — delete recent messages; `all` is capped at
  1,000 per run
- `/ban user reason delete-message-days` — ban a user and optionally delete up
  to seven days of messages
- `/kick member reason` — remove a member
- `/mute member duration-minutes reason` — apply a Discord timeout for up to 28 days
- `/unmute member reason` — end a timeout early
- `/warn member reason` — record an offense and send an aesthetic private DM
- `/warnings member` — privately review total offenses and recent warning details
- `/unban user-id reason` — remove a ban using the exact Discord user ID
- `/lockdown channel reason` — deny public channel and thread typing
- `/unlock channel reason` — restore the pre-lockdown permission values
- `/slowmode seconds channel reason` — set 0–21,600 seconds of slowmode

Every response containing warning history is ephemeral. Moderation commands
require their matching Discord permission at both command-registration time and
runtime. Targeted actions also validate the moderator's and Sofra's role
hierarchies.

Discord bulk deletion cannot remove messages older than 14 days. `/purge all`
therefore deletes all recent messages it can find, up to 1,000 per command.

### Booster administration

- `/booster setup role:@Server Booster channel:#boosts` — save both destinations,
  validate permissions and hierarchy, and enable the feature
- `/booster enable` — resume role assignment and thank-you embeds
- `/booster disable` — pause the feature while keeping its settings
- `/booster test` — send a randomized preview without changing anyone's role
- `/booster status` — diagnose storage, role hierarchy, and channel permissions

All `/booster` commands require **Manage Server** or Administrator. The role must
be a custom assignable role; Discord's built-in managed booster role cannot be
assigned manually by bots. Sofra retrieves the GIF from the supplied Discord
message reference at send time so expiring attachment URLs remain fresh. If the
GIF cannot be accessed, Sofra safely falls back to her animated avatar.

### Moderation-log administration

- `/modlog setup` — create/configure `Moderation → #staff-logs`, keep it hidden
  from `@everyone`, send a preview, and enable logging
- `/modlog channel channel:#channel` — use an existing private text channel
- `/modlog enable` — enable logs after validating the configured channel
- `/modlog disable` — pause logs while retaining the saved channel
- `/modlog test` — send a preview even while logging is disabled
- `/modlog status` — diagnose channel access, audit-log access, storage, and
  configuration validity

All `/modlog` commands require **Manage Server** or Administrator. The automatic
setup allows Sofra and server administrators into the private area; add explicit
permission access for other staff roles that should read `#staff-logs`.

### Ticket administration and controls

- `/ticket-channel panel-channel:#tickets ticket-category:Tickets
  staff-role:@Moderator [staff-role-2..5] [staff-logs:#staff-logs]` — configure
  ticket access and post a new persistent panel
- **Claim Ticket** — record which staff member is handling the ticket
- **Close Ticket** — change the status to Closed and make the channel read-only
  for its creator without deleting anything
- **Reopen Ticket** — restore the creator's ability to reply, unless they already
  have another open ticket of that type
- **Delete Ticket** — show a separate confirmation before permanently deleting
  the ticket channel

`/ticket-channel` requires **Manage Server** or Administrator. The first staff
role is required and up to four additional roles may be configured. The optional
`staff-logs` option updates the same destination used by `/modlog`; when omitted,
Sofra reuses the existing configured Staff Logs channel. Ticket setup enables
that shared logging configuration.

### Information and community

- `/userinfo member` — show account creation, join date, IDs, avatar, and roles
- `/serverinfo` — show member count, boosts, creation date, owner, channels, and roles
- `/embed channel` — open a modal for title, description, hex color, footer, and image
- `/poll question option-1 option-2 ... duration-hours` — create a native Discord poll
- `/meme` — fetch a validated SFW meme

`/userinfo`, `/serverinfo`, and `/meme` are public. Creating announcements and
polls requires **Manage Messages**.

## Level behavior and defaults

The level system starts **disabled** so existing deployments do not begin
tracking activity unexpectedly. Run `/level enable` once after deployment.

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

1. Confirm the new slash commands appear and assign Sofra only the moderation
   permissions you plan to use.
2. Test `/userinfo`, `/serverinfo`, `/poll`, and `/meme`.
3. Run `/modlog setup`, add any non-administrator staff roles to the private
   category, then verify `/modlog status` and `/modlog test`.
4. Use a private test channel and trusted test account for moderation commands;
   confirm each successful action appears once in `#staff-logs`.
5. Confirm `/lockdown` blocks typing and `/unlock` restores the original state.
6. Run `/autorole status`, `/level status`, and `/welcome status` to confirm the
   existing systems remain valid.

For welcomes, run `/welcome channel`, `/welcome enable`, `/welcome status`, and
`/welcome test`, then verify a real join with a test account or trusted member.

## Known limitations

- XP is based on eligible messages, not message quality or length, because
  message content is intentionally not inspected.
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
