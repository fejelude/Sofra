# Sofra — Welcome, Level & Auto-Role Systems

Sofra is a lightweight Discord bot designed to run continuously on Wispbyte.
It includes a polished welcome system, an opt-in activity level system, and an
automatic role for new members.

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

### Auto-role system

- Instantly gives one configured role to each new human member
- Admin-only setup through `/autorole`
- Validates Manage Roles, role hierarchy, managed roles, and deleted roles
- Persistent per-server role and enabled state
- Duplicate join protection and failure isolation from welcomes and levels

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

The level system uses the normal **Guild Messages** gateway intent, which is
requested by the code automatically. Sofra does **not** need Message Content
Intent or Presence Intent. The level system deliberately ignores message text.

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

No new package dependency is required for the level system. Startup and
runtime failures are logged clearly in the Wispbyte console. If level storage
cannot start, that feature pauses safely while the welcome system remains
available.

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

## Level behavior and defaults

The level system starts **disabled** so existing deployments do not begin
tracking activity unexpectedly. Run `/level enable` once after deployment.

By default, each member can earn **15–25 XP once every 60 seconds**. The
cooldown is per member and per server and survives restarts. XP requirements
increase gradually at each level. Bots, webhook messages, system messages,
DMs, and duplicate events do not earn XP.

If no dedicated level channel is configured, a level-up appears in the channel
where XP was earned. If a configured channel is later deleted or loses access,
Sofra logs the problem and safely tries that activity channel instead.

Role rewards are cumulative. A member above several configured thresholds gets
every eligible missing role after their next XP award. Discord prevents Sofra
from assigning managed roles or roles above Sofra's highest role.

## Persistence and privacy

Welcome configuration is stored atomically in `data/welcome-config.json`.
Level configuration, XP, cooldown state, reward mappings, and auto-role
configuration are stored in `data/levels.sqlite`. Both paths are ignored by Git.

The level database stores only the data needed for the feature: server and user
IDs, total XP, eligible-message count, last award timestamp/message ID, level
settings, channel ID, reward role IDs, and the configured auto-role ID. It does
not store message text, avatars, full message history, join history, or a
permanent event log.

Normal Wispbyte restarts reload both files automatically. If you fully erase or
move the server, back up and restore the `data` directory to keep settings and
levels.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Sofra's bot token |
| `DISCORD_GUILD_ID` | No | Registers `/welcome`, `/level`, and `/autorole` immediately in one server |
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

1. Run `/autorole role` and select a role below Sofra's highest role.
2. Run `/autorole status`, `/autorole enable`, and `/autorole test`.
3. Verify a real join with a trusted test account.
4. Run `/level status`, optionally configure its channel/rewards, and enable it.
5. Send messages at least one cooldown apart, then check `/level rank` and
   `/level leaderboard`.

For welcomes, run `/welcome channel`, `/welcome enable`, `/welcome status`, and
`/welcome test`, then verify a real join with a test account or trusted member.

## Known limitations

- XP is based on eligible messages, not message quality or length, because
  message content is intentionally not inspected.
- Users who leave remain on the leaderboard so their progress survives a
  rejoin. There is no reset command in this focused implementation.
- Members already above a new reward threshold receive the role after their
  next eligible XP award rather than through a background scan.
