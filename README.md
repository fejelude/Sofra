# Sofra — Welcome System

A lightweight, production-ready Discord welcome system for Sofra. The bot is
designed to run continuously on Wispbyte and does work only when a member joins
or an administrator uses `/welcome`.

## Features

- Admin-only `/welcome` configuration directly inside Discord
- 64 polished, pre-written Sofra welcome messages
- Soft pink, blush, lavender, and cream embed styling
- Persistent per-server channel and enabled state
- Permission and stale-channel diagnostics through `/welcome status`
- Graceful handling for deleted channels, missing permissions, storage errors,
  duplicate join events, and Discord API failures
- No dashboard, web server, image generation, event history, or avatar downloads

## Discord setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select Sofra, open **Bot**, and enable **Server Members Intent** under
   **Privileged Gateway Intents**. This is required for member-join events.
3. Invite Sofra with the `bot` and `applications.commands` scopes.
4. Give Sofra these permissions in the chosen welcome channel:
   - View Channel
   - Send Messages
   - Embed Links

Sofra does **not** need Message Content Intent or Presence Intent.

## Wispbyte deployment

Use Node.js 20.12 or newer. Wispbyte's Node.js 24 runtime is compatible.

1. Set the Wispbyte startup file to `index.js`.
2. Add the required environment variable `DISCORD_TOKEN`.
3. Optionally add `DISCORD_GUILD_ID` with your server ID. This registers the
   command instantly in that server; without it, `/welcome` is registered
   globally and Discord may take time to display an update.
4. Deploy the repository. Wispbyte can run either `npm start` or
   `node index.js`; both use the same entry point.

Wispbyte's existing install step can install dependencies from `package-lock.json`.
For a manual installation, run:

```bash
npm ci --omit=dev
npm start
```

Startup and runtime failures are printed clearly in the Wispbyte console.

## Commands

- `/welcome channel channel:#channel` — choose and validate the welcome channel
- `/welcome enable` — enable welcomes after validating the saved channel
- `/welcome disable` — disable welcomes without deleting the saved channel
- `/welcome test` — send a real preview using the administrator who ran it
- `/welcome status` — show enabled state, channel, permissions, storage health,
  and overall validity

Every subcommand is limited to members with **Manage Server** (Manage Guild) or
Administrator permission. Commands cannot be used in DMs.

## Persistence

Configuration is stored atomically in `data/welcome-config.json` by default.
Only the server ID, enabled state, and welcome channel ID are saved. The file is
ignored by Git so deployments do not commit server-specific data.

Normal Sofra/Wispbyte process restarts reload this file automatically. If you
move Sofra to a different Wispbyte server or fully erase/reinstall its files,
copy the `data` directory as part of that migration.

Set `WELCOME_CONFIG_PATH` only if you want the file in a different persistent
location. Relative paths resolve from the process working directory.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Sofra's bot token |
| `DISCORD_GUILD_ID` | No | Registers `/welcome` immediately in one server |
| `WELCOME_CONFIG_PATH` | No | Overrides the JSON configuration path |

No database, database migration, port, or web URL is required.

## Supported placeholders

The built-in message renderer supports:

- `{user.mention}`
- `{user.name}`
- `{user.avatar}`
- `{server.name}`
- `{server.member_count}`
- `{server.icon}`

Names are escaped before rendering, avatar/icon URLs are used directly from
Discord, and allowed mentions are restricted to the joining member.

## Testing

```bash
npm test
npm run check
```

After deployment, run `/welcome channel`, `/welcome enable`, `/welcome status`,
and `/welcome test`. To verify the real event, join with a test account or ask a
trusted person to leave and rejoin.
