import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("add-tasks resolves project_id 'inbox' to user's inbox_project_id", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/user$/, "GET", () => ({ body: { id: "U1", inbox_project_id: "P_INBOX" } }));
    fm.on(/\/api\/v1\/tasks$/, "POST", () => ({ body: { id: "T1", content: "x", project_id: "P_INBOX" } }));
    await callTool(createServer(new TodoistAPI("t")), "add-tasks", {
      tasks: [{ content: "Buy milk", project_id: "inbox" }],
    });
    const taskCall = fm.calls.find((c) => c.method === "POST" && /\/api\/v1\/tasks$/.test(c.url));
    assert.ok(taskCall);
    const body = taskCall.body as { content: string; project_id: string };
    assert.equal(body.project_id, "P_INBOX");
  } finally { fm.restore(); }
});

test("add-tasks with non-inbox project_id passes through unchanged", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/tasks$/, "POST", () => ({ body: { id: "T1" } }));
    await callTool(createServer(new TodoistAPI("t")), "add-tasks", {
      tasks: [{ content: "Buy milk", project_id: "P_OTHER" }],
    });
    const taskCall = fm.calls.find((c) => c.method === "POST");
    const body = taskCall!.body as { project_id: string };
    assert.equal(body.project_id, "P_OTHER");
    // No /user call should have been made
    assert.equal(fm.calls.filter((c) => /\/api\/v1\/user$/.test(c.url)).length, 0);
  } finally { fm.restore(); }
});

test("find-tasks resolves project_id 'inbox' to user's inbox_project_id", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/user$/, "GET", () => ({ body: { inbox_project_id: "P_INBOX" } }));
    fm.onPaged(/\/api\/v1\/tasks(\?|$)/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks", { project_id: "inbox" });
    const taskCall = fm.calls.find((c) => c.method === "GET" && /\/api\/v1\/tasks\?/.test(c.url));
    assert.ok(taskCall);
    assert.match(taskCall.url, /project_id=P_INBOX/);
  } finally { fm.restore(); }
});

test("quick-add-task does NOT need inbox resolution (server handles it)", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/quick_add$/, "POST", () => ({ body: { id: "T1" } }));
    await callTool(createServer(new TodoistAPI("t")), "quick-add-task", { text: "Buy milk" });
    // Quick add doesn't take project_id; server parses the text. No /user call expected.
    assert.equal(fm.calls.filter((c) => /\/api\/v1\/user$/.test(c.url)).length, 0);
  } finally { fm.restore(); }
});
