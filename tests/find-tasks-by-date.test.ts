import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

function queryOf(url: string): string {
  const u = new URL(url);
  return u.searchParams.get("query") ?? "";
}

test("find-tasks-by-date with due_date uses /tasks/filter with 'due:' query", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { responsible_user: "all",due_date: "2026-05-15" });
    assert.equal(fm.calls.length, 1);
    assert.match(fm.calls[0].url, /\/tasks\/filter\?/);
    assert.equal(queryOf(fm.calls[0].url), "due: 2026-05-15");
  } finally { fm.restore(); }
});

test("find-tasks-by-date with due_after and due_before uses inclusive range", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", {
      responsible_user: "all",
      due_after: "2026-05-01",
      due_before: "2026-05-09",
    });
    const q = queryOf(fm.calls[0].url);
    assert.equal(q, "(due after: 2026-05-01 | due: 2026-05-01) & due before: 2026-05-09");
  } finally { fm.restore(); }
});

test("find-tasks-by-date with only due_after uses 'due after:' query", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { responsible_user: "all",due_after: "2026-05-01" });
    assert.equal(queryOf(fm.calls[0].url), "due after: 2026-05-01 | due: 2026-05-01");
  } finally { fm.restore(); }
});

test("find-tasks-by-date with only due_before uses 'due before:' query", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { responsible_user: "all",due_before: "2026-05-09" });
    assert.equal(queryOf(fm.calls[0].url), "due before: 2026-05-09");
  } finally { fm.restore(); }
});

test("find-tasks-by-date with no params defaults to 'today | overdue'", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { responsible_user: "all" });
    assert.equal(queryOf(fm.calls[0].url), "today | overdue");
  } finally { fm.restore(); }
});

test("find-tasks-by-date overdue_mode=exclude drops overdue from default", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { responsible_user: "all",overdue_mode: "exclude" });
    assert.equal(queryOf(fm.calls[0].url), "today");
  } finally { fm.restore(); }
});

test("find-tasks-by-date overdue_mode=only narrows to 'overdue'", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", []);
    await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { responsible_user: "all",overdue_mode: "only" });
    assert.equal(queryOf(fm.calls[0].url), "overdue");
  } finally { fm.restore(); }
});

test("find-tasks-by-date with project_id filters client-side after /tasks/filter", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", [
      { id: "T1", project_id: "P1", priority: 1 },
      { id: "T2", project_id: "P2", priority: 1 },
    ]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", {
      due_date: "2026-05-15", project_id: "P1",
    });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr.length, 1);
    assert.equal(arr[0].id, "T1");
  } finally { fm.restore(); }
});
