import test from "node:test";
import assert from "node:assert/strict";
import { AutomodService } from "../src/automod/service.js";
import { LevelStore } from "../src/level/store.js";
const logger = { error() {}, warn() {}, info() {} };

test("new safety defaults are opt-in and persist per server", async () => {
  const store = new LevelStore({ filePath: ":memory:", logger }); await store.init();
  const id = "12345678901234567";
  assert.equal(store.getAutomodConfig(id).dryRun, false);
  store.setAutomodConfig(id, { dryRun: true, spamEnabled: true, messageLimit: 5 });
  assert.equal(store.getAutomodConfig(id).messageLimit, 5);
  assert.equal(store.getAutomodConfig("22345678901234567").spamEnabled, false);
  assert.throws(() => store.setAutomodConfig(id, { mentionLimit: 1 }));
  store.close();
});

for (const mode of ["dry-run", "log"]) {
  test(`${mode} never deletes, warns, escalates, or records strikes`, async () => {
    let logs = 0;
    const forbidden = () => { assert.fail("unexpected punishment"); };
    const config = { enabled: true, dryRun: mode === "dry-run", linksEnabled: mode === "dry-run", invitesEnabled: false, roles: [], channels: [], words: [{ term: "testphrase", category: "custom", severity: 4, actionOverride: "log", normalized: true }], categories: {}, mildAction: "delete", timeoutMinutes: 1, escalationThreshold: 2, strikesEnabled: true };
    const service = new AutomodService({ client: { user: { id: "bot" } }, logger, store: { getHealth: () => ({ ok: true }), getAutomodConfig: () => config, addWarning: forbidden }, modLogService: { logAction: async () => { logs++; } } });
    for (let n = 0; n < 4; n++) {
      const message = { id: String(n), guild: { id: "a", ownerId: "owner" }, author: { id: "member" }, content: mode === "dry-run" ? "https://example.com" : "testphrase", member: { moderatable: true, timeout: forbidden }, deletable: true, delete: forbidden, channel: { send: forbidden } };
      assert.equal(await service.handleMessage(message), false);
    }
    assert.equal(logs, 4);
    assert.equal(service.violations.size, 0);
  });
}
