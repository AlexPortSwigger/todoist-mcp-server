import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool, listTools } from "./helpers.js";

test("rename-shared-label is registered", () => {
  assert.ok(listTools(createServer(new TodoistAPI("t"))).includes("rename-shared-label"));
});

test("rename-shared-label POSTs to /labels/shared/rename with name + new_name", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/labels\/shared\/rename$/, "POST", () => ({ status: 204, body: { success: true } }));
    const result = await callTool(createServer(new TodoistAPI("t")), "rename-shared-label", {
      name: "work", new_name: "office",
    });
    assert.equal(fm.calls.length, 1);
    assert.equal(fm.calls[0].method, "POST");
    assert.deepEqual(fm.calls[0].body, { name: "work", new_name: "office" });
    assert.match(result.content[0].text, /work.*office/);
  } finally { fm.restore(); }
});

test("delete-object shared-label POSTs /labels/shared/remove with name", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/labels\/shared\/remove$/, "POST", () => ({ status: 204, body: { success: true } }));
    const result = await callTool(createServer(new TodoistAPI("t")), "delete-object", {
      object_type: "shared-label", id: "work",
    });
    assert.equal(fm.calls.length, 1);
    assert.equal(fm.calls[0].method, "POST");
    assert.deepEqual(fm.calls[0].body, { name: "work" });
    assert.match(result.content[0].text, /Deleted shared-label work/);
  } finally { fm.restore(); }
});
