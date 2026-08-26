import test from "node:test";
import assert from "node:assert/strict";
import { buildTicketInformation, buildTicketPanel } from "../src/ticket/service.js";
import { buildTicketLogEmbed } from "../src/modlog/service.js";

const ticket = {
  id: 1,
  creatorId: "1540628204333703198",
  type: "bug",
  status: "open",
  claimedBy: null,
  createdAt: 1_787_712_400_000,
};

test("ticket panel has the requested banner, descriptions, and three persistent buttons", () => {
  const panel = buildTicketPanel();
  assert.equal(panel.embeds.length, 2);
  assert.match(panel.embeds[0].toJSON().image.url, /cdn\.discordapp\.com/);
  assert.match(panel.embeds[1].toJSON().fields[0].value, /1,000–100,000 Robux/);
  assert.deepEqual(
    panel.components[0].toJSON().components.map((button) => button.custom_id),
    ["ticket:create:bug", "ticket:create:report", "ticket:create:other"],
  );
});

test("ticket information and Staff Logs include stable ticket metadata", () => {
  const information = buildTicketInformation(ticket).toJSON();
  assert.match(information.title, /#0001/);
  assert.equal(information.fields.find((field) => field.name === "☁️ Status").value, "Open");

  const log = buildTicketLogEmbed({
    event: "created",
    ticket,
    channel: { id: "1540628204333703200" },
  }).toJSON();
  assert.match(log.title, /Ticket Created/);
  assert.equal(log.fields.find((field) => field.name === "🎟️ Ticket ID").value, "#0001");
});
