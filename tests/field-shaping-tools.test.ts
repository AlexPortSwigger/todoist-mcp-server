import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

const RAW_TASK = {
  id: "T1",
  content: "Daily standup",
  priority: 4,
  due: { date: "2026-05-15", string: "every weekday", is_recurring: true },
  duration: { amount: 30, unit: "minute" },
  project_id: "P1",
};

test("find-tasks output is shaped: priority p1, dueDate, recurring", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/api\/v1\/tasks(\?|$)/, "GET", [RAW_TASK]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-tasks", { project_id: "P1" });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].priority, "p1");
    assert.equal(arr[0].dueDate, "2026-05-15");
    assert.equal(arr[0].recurring, "every weekday");
    assert.equal(arr[0].duration, "30m");
  } finally { fm.restore(); }
});

test("find-tasks via filter_query is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter/, "GET", [RAW_TASK]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-tasks", { filter_query: "today" });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].priority, "p1");
  } finally { fm.restore(); }
});

test("find-tasks-by-date output is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/tasks\/filter|\/api\/v1\/tasks(\?|$)/, "GET", [RAW_TASK]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-tasks-by-date", { due_date: "2026-05-15" });
    const arr = JSON.parse(result.content[0].text);
    if (arr.length > 0) assert.equal(arr[0].priority, "p1");
  } finally { fm.restore(); }
});

test("search output is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/api\/v1\/tasks/, "GET", [RAW_TASK]);
    const result = await callTool(createServer(new TodoistAPI("t")), "search", { query: "standup" });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].priority, "p1");
    assert.equal(arr[0].dueDate, "2026-05-15");
  } finally { fm.restore(); }
});

test("add-tasks output is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/tasks$/, "POST", () => ({ body: RAW_TASK }));
    const result = await callTool(createServer(new TodoistAPI("t")), "add-tasks", {
      tasks: [{ content: "Daily standup", priority: 4 }],
    });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].priority, "p1");
    assert.equal(arr[0].recurring, "every weekday");
  } finally { fm.restore(); }
});

test("update-tasks output is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/tasks\/T1$/, "POST", () => ({ body: RAW_TASK }));
    const result = await callTool(createServer(new TodoistAPI("t")), "update-tasks", {
      tasks: [{ id: "T1", priority: 4 }],
    });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].priority, "p1");
  } finally { fm.restore(); }
});

test("reschedule-tasks output is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/sync$/, "POST", () => ({ body: { sync_status: {} } }));
    fm.on(/\/tasks\/T1$/, "GET", () => ({ body: RAW_TASK }));
    const result = await callTool(createServer(new TodoistAPI("t")), "reschedule-tasks", {
      tasks: [{ id: "T1", due_string: "next monday" }],
    });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].priority, "p1");
    assert.equal(arr[0].recurring, "every weekday");
  } finally { fm.restore(); }
});

test("fetch-object task is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/tasks\/T1$/, "GET", () => ({ body: RAW_TASK }));
    const result = await callTool(createServer(new TodoistAPI("t")), "fetch-object", { object_type: "task", id: "T1" });
    const obj = JSON.parse(result.content[0].text);
    assert.equal(obj.priority, "p1");
    assert.equal(obj.dueDate, "2026-05-15");
  } finally { fm.restore(); }
});

test("quick-add-task output is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/quick_add$/, "POST", () => ({ body: RAW_TASK }));
    const result = await callTool(createServer(new TodoistAPI("t")), "quick-add-task", { text: "Daily standup p1 every weekday" });
    const obj = JSON.parse(result.content[0].text);
    assert.equal(obj.priority, "p1");
  } finally { fm.restore(); }
});

test("find-completed-tasks by_completion_date output is shaped", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/by_completion_date/, "GET", [RAW_TASK]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-completed-tasks", {
      by: "completion_date", since: "2026-05-01T00:00:00", until: "2026-05-09T00:00:00",
    });
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].priority, "p1");
  } finally { fm.restore(); }
});

test("find-reminders renames item_id to taskId", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/reminders(\?|$)/, "GET", [{ id: "R1", item_id: "T1", minute_offset: 30 }]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-reminders");
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].taskId, "T1");
    assert.ok(!("item_id" in arr[0]));
  } finally { fm.restore(); }
});

test("fetch-object reminder renames item_id to taskId", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/reminders\/R1$/, "GET", () => ({ body: { id: "R1", item_id: "T1" } }));
    const result = await callTool(createServer(new TodoistAPI("t")), "fetch-object", { object_type: "reminder", id: "R1" });
    const obj = JSON.parse(result.content[0].text);
    assert.equal(obj.taskId, "T1");
  } finally { fm.restore(); }
});
