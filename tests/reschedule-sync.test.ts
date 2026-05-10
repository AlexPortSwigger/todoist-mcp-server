import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("reschedule-tasks POSTs item_update commands to /sync, not /tasks/{id}", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/api\/v1\/sync$/, "POST", () => ({ body: { sync_status: { "u1": "ok" } } }));
    fetchMock.on(/\/tasks\/T1$/, "GET", () => ({ body: { id: "T1", content: "Daily standup", due: { date: "2026-05-15", string: "every weekday", is_recurring: true } } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "reschedule-tasks", {
      tasks: [{ id: "T1", due_string: "next monday" }],
    });
    const syncCalls = fetchMock.calls.filter((c) => c.url.endsWith("/sync"));
    assert.equal(syncCalls.length, 1, "should hit /sync exactly once");
    const body = syncCalls[0].body as { commands: Array<{ type: string; uuid: string; args: Record<string, unknown> }> };
    assert.ok(Array.isArray(body.commands));
    assert.equal(body.commands.length, 1);
    assert.equal(body.commands[0].type, "item_update");
    assert.ok(typeof body.commands[0].uuid === "string" && body.commands[0].uuid.length > 0, "uuid must be set");
    const args = body.commands[0].args as { id: string; due: { string?: string; date?: string } };
    assert.equal(args.id, "T1");
    assert.equal(args.due.string, "next monday");
    // Verify it does NOT hit REST POST /tasks/{id}
    const restUpdates = fetchMock.calls.filter((c) => /\/tasks\/T1$/.test(c.url) && c.method === "POST");
    assert.equal(restUpdates.length, 0, "must not POST /tasks/{id} (would lose recurrence)");
  } finally {
    fetchMock.restore();
  }
});

test("reschedule-tasks batches multiple tasks into one /sync call", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/sync$/, "POST", () => ({ body: { sync_status: {} } }));
    fetchMock.on(/\/tasks\/T1$/, "GET", () => ({ body: { id: "T1" } }));
    fetchMock.on(/\/tasks\/T2$/, "GET", () => ({ body: { id: "T2" } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "reschedule-tasks", {
      tasks: [
        { id: "T1", due_date: "2026-06-01" },
        { id: "T2", due_string: "tomorrow" },
      ],
    });
    const syncCalls = fetchMock.calls.filter((c) => c.url.endsWith("/sync"));
    assert.equal(syncCalls.length, 1, "all reschedules go in one batch");
    const body = syncCalls[0].body as { commands: Array<unknown> };
    assert.equal(body.commands.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test("reschedule-tasks supports due_datetime", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/sync$/, "POST", () => ({ body: { sync_status: {} } }));
    fetchMock.on(/\/tasks\//, "GET", () => ({ body: { id: "T1" } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "reschedule-tasks", {
      tasks: [{ id: "T1", due_datetime: "2026-06-01T15:00:00Z" }],
    });
    const syncCalls = fetchMock.calls.filter((c) => c.url.endsWith("/sync"));
    const body = syncCalls[0].body as { commands: Array<{ args: { due: { datetime?: string } } }> };
    assert.equal(body.commands[0].args.due.datetime, "2026-06-01T15:00:00Z");
  } finally {
    fetchMock.restore();
  }
});
