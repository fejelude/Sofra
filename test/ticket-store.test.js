import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LevelStore } from "../src/level/store.js";

const GUILD_ID = "1540617362477162506";
const CREATOR_ID = "1540628204333703198";
const MODERATOR_ID = "1540628204333703199";
const PANEL_CHANNEL_ID = "1540628204333703200";
const PANEL_MESSAGE_ID = "1540628204333703201";
const CATEGORY_ID = "1540628204333703202";
const STAFF_ROLE_ID = "1540628204333703203";
const TICKET_CHANNEL_ID = "1540628204333703204";
const CONTROL_MESSAGE_ID = "1540628204333703205";

const logger = { info() {}, warn() {}, error() {} };

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "sofra-ticket-test-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "levels.sqlite");
  const store = new LevelStore({ filePath, logger });
  await store.init();
  return { store, filePath };
}

test("ticket configuration and increasing IDs persist across restarts", async (t) => {
  const current = await fixture(t);
  current.store.setTicketConfig({
    guildId: GUILD_ID,
    panelChannelId: PANEL_CHANNEL_ID,
    panelMessageId: PANEL_MESSAGE_ID,
    categoryId: CATEGORY_ID,
    staffRoleIds: [STAFF_ROLE_ID],
  });
  const first = current.store.createTicket({
    guildId: GUILD_ID,
    creatorId: CREATOR_ID,
    type: "bug",
    createdAt: 1_000,
  });
  current.store.activateTicket(GUILD_ID, first.ticket.id, TICKET_CHANNEL_ID);
  current.store.setTicketControlMessage(GUILD_ID, first.ticket.id, CONTROL_MESSAGE_ID);
  current.store.close();

  const restarted = new LevelStore({ filePath: current.filePath, logger });
  await restarted.init();
  assert.deepEqual(restarted.getTicketConfig(GUILD_ID), {
    guildId: GUILD_ID,
    panelChannelId: PANEL_CHANNEL_ID,
    panelMessageId: PANEL_MESSAGE_ID,
    categoryId: CATEGORY_ID,
    staffRoleIds: [STAFF_ROLE_ID],
  });
  const second = restarted.createTicket({
    guildId: GUILD_ID,
    creatorId: CREATOR_ID,
    type: "report",
    createdAt: 2_000,
  });
  assert.ok(second.ticket.id > first.ticket.id);
  restarted.close();
});

test("one open ticket per member and type is enforced through state changes", async (t) => {
  const { store } = await fixture(t);
  const first = store.createTicket({
    guildId: GUILD_ID,
    creatorId: CREATOR_ID,
    type: "bug",
  });
  const duplicate = store.createTicket({
    guildId: GUILD_ID,
    creatorId: CREATOR_ID,
    type: "bug",
  });
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.ticket.id, first.ticket.id);

  let ticket = store.activateTicket(GUILD_ID, first.ticket.id, TICKET_CHANNEL_ID);
  ticket = store.claimTicket(GUILD_ID, ticket.id, MODERATOR_ID);
  assert.equal(ticket.claimedBy, MODERATOR_ID);
  ticket = store.closeTicket(GUILD_ID, ticket.id, MODERATOR_ID, 5_000);
  assert.equal(ticket.status, "closed");

  const replacement = store.createTicket({
    guildId: GUILD_ID,
    creatorId: CREATOR_ID,
    type: "bug",
  });
  assert.equal(replacement.created, true);
  assert.equal(store.reopenTicket(GUILD_ID, ticket.id), null);
  store.deleteTicket(GUILD_ID, replacement.ticket.id);
  assert.equal(store.reopenTicket(GUILD_ID, ticket.id).status, "open");
  store.close();
});
