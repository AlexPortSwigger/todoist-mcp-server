import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("find-projects default hits /projects (active only)", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/api\/v1\/projects(\?|$)/, "GET", [{ id: "P1", name: "Active" }]);
    await callTool(createServer(new TodoistAPI("t")), "find-projects");
    assert.equal(fm.calls.length, 1);
    assert.match(fm.calls[0].url, /\/api\/v1\/projects(\?|$)/);
    assert.doesNotMatch(fm.calls[0].url, /\/archived/);
  } finally { fm.restore(); }
});

test("find-projects with include_archived=true hits both endpoints and merges", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/api\/v1\/projects\/archived/, "GET", [{ id: "P2", name: "Old" }]);
    fm.onPaged(/\/api\/v1\/projects(\?|$)/, "GET", [{ id: "P1", name: "Active" }]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-projects", { include_archived: true });
    const arr = JSON.parse(result.content[0].text);
    const ids = arr.map((p: { id: string }) => p.id).sort();
    assert.deepEqual(ids, ["P1", "P2"]);
  } finally { fm.restore(); }
});

test("find-projects with include_archived='only' hits only /projects/archived", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.onPaged(/\/api\/v1\/projects\/archived/, "GET", [{ id: "P2", name: "Old" }]);
    const result = await callTool(createServer(new TodoistAPI("t")), "find-projects", { include_archived: "only" });
    assert.equal(fm.calls.length, 1);
    assert.match(fm.calls[0].url, /\/projects\/archived/);
    const arr = JSON.parse(result.content[0].text);
    assert.equal(arr[0].id, "P2");
  } finally { fm.restore(); }
});
