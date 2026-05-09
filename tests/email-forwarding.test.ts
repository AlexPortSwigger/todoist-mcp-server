import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool, listTools } from "./helpers.js";

test("manage-email-forwarding is registered", () => {
  assert.ok(listTools(createServer(new TodoistAPI("t"))).includes("manage-email-forwarding"));
});

test("get_or_create for project hits PUT /emails", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/emails$/, "PUT", () => ({ body: { email: "project.abc+x@todoist.net" } }));
    const result = await callTool(createServer(new TodoistAPI("t")), "manage-email-forwarding", {
      action: "get_or_create", target: "project", id: "P1",
    });
    assert.equal(fm.calls.length, 1);
    assert.equal(fm.calls[0].method, "PUT");
    assert.deepEqual(fm.calls[0].body, { obj_type: "project", obj_id: "P1" });
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.email, "project.abc+x@todoist.net");
  } finally { fm.restore(); }
});

test("get_or_create for task hits PUT /emails with obj_type=task", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/emails$/, "PUT", () => ({ body: { email: "task.abc+x@todoist.net" } }));
    await callTool(createServer(new TodoistAPI("t")), "manage-email-forwarding", {
      action: "get_or_create", target: "task", id: "T1",
    });
    assert.deepEqual(fm.calls[0].body, { obj_type: "task", obj_id: "T1" });
  } finally { fm.restore(); }
});

test("disable hits DELETE /emails with obj_type and obj_id query", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/emails(\?|$)/, "DELETE", () => ({ status: 204, body: { success: true } }));
    const result = await callTool(createServer(new TodoistAPI("t")), "manage-email-forwarding", {
      action: "disable", target: "project", id: "P1",
    });
    assert.equal(fm.calls.length, 1);
    assert.equal(fm.calls[0].method, "DELETE");
    assert.match(fm.calls[0].url, /obj_type=project/);
    assert.match(fm.calls[0].url, /obj_id=P1/);
    assert.match(result.content[0].text, /Disabled.*project.*P1/);
  } finally { fm.restore(); }
});
