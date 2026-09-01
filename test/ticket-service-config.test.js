import test from "node:test";
import assert from "node:assert/strict";
import { TicketService } from "../src/ticket/service.js";

const GUILD_ID = "123456789012345678";

function fixture(config) {
  let reply = null;
  let reservations = 0;
  const store = {
    getTicketConfig: () => config,
    createTicket: () => {
      reservations += 1;
      return { created: false, ticket: null };
    },
  };
  const service = new TicketService({
    client: { user: { id: "223456789012345678" } },
    store,
    logger: { error: () => undefined },
    modLogService: {},
  });
  const interaction = {
    guild: { id: GUILD_ID },
    editReply: async (value) => {
      reply = value;
    },
  };
  return { service, interaction, reply: () => reply, reservations: () => reservations };
}

test("disabled ticket system rejects stale create buttons before reserving a ticket", async () => {
  const { service, interaction, reply, reservations } = fixture({
    enabled: false,
    types: { bug: true, report: true, other: true },
  });
  await service.create(interaction, "bug");
  assert.match(reply(), /currently disabled/);
  assert.equal(reservations(), 0);
});

test("disabled ticket types reject stale buttons before reserving a ticket", async () => {
  const { service, interaction, reply, reservations } = fixture({
    enabled: true,
    types: { bug: true, report: false, other: true },
  });
  await service.create(interaction, "report");
  assert.match(reply(), /ticket type is currently disabled/);
  assert.equal(reservations(), 0);
});
