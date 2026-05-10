import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

function queryOf(url: string): string {
  return new URL(url).searchParams.get("query") ?? "";
}

test("find-tasks with label routes to /tasks/filter and uses @label", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks", { label: "urgent" });
    assert.equal(fm.calls.length, 1);
    assert.match(fm.calls[0].url, /\/tasks\/filter\?/);
    const q = queryOf(fm.calls[0].url);
    assert.match(q, /@urgent/);
  } finally { fm.restore(); }
});

test("find-tasks with filter_query default-wraps with (no assignee | assigned to: me)", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks", { filter_query: "today" });
    const q = queryOf(fm.calls[0].url);
    assert.equal(q, "(no assignee | assigned to: me) & (today)");
  } finally { fm.restore(); }
});

test("find-tasks responsible_user=all skips the wrapper", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks", {
      filter_query: "today", responsible_user: "all",
    });
    assert.equal(queryOf(fm.calls[0].url), "today");
  } finally { fm.restore(); }
});

test("find-tasks responsible_user=me wraps with 'assigned to: me'", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks", {
      filter_query: "today", responsible_user: "me",
    });
    assert.equal(queryOf(fm.calls[0].url), "assigned to: me & (today)");
  } finally { fm.restore(); }
});

test("find-tasks with project_id only still routes to /tasks (container)", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/api\/v1\/tasks(\?|$)/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks", { project_id: "P1" });
    assert.equal(fm.calls.length, 1);
    assert.match(fm.calls[0].url, /\/api\/v1\/tasks\?/);
    assert.doesNotMatch(fm.calls[0].url, /\/tasks\/filter/);
  } finally { fm.restore(); }
});

test("find-tasks-by-date applies responsibleUserFiltering by default", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { due_date: "2026-05-15" });
    const q = queryOf(fm.calls[0].url);
    assert.equal(q, "(no assignee | assigned to: me) & (due: 2026-05-15)");
  } finally { fm.restore(); }
});

test("find-tasks-by-date responsible_user=all skips wrapper", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", {
      due_date: "2026-05-15", responsible_user: "all",
    });
    assert.equal(queryOf(fm.calls[0].url), "due: 2026-05-15");
  } finally { fm.restore(); }
});
