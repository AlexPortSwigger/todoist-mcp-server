import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool, listTools } from "./helpers.js";

async function withTempFile<T>(content: string, name: string, fn: (path: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "todoist-test-"));
  const path = join(dir, name);
  await writeFile(path, content);
  try { return await fn(path); }
  finally { try { await unlink(path); } catch {} }
}

test("create-project-from-template and export-project-as-template are registered", () => {
  const tools = listTools(createServer(new TodoistAPI("t")));
  assert.ok(tools.includes("create-project-from-template"));
  assert.ok(tools.includes("export-project-as-template"));
});

test("create-project-from-template with project_id + csv_content imports into existing project", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/templates\/import_into_project\/P1$/, "POST", () => ({ body: { status: "ok" } }));
    await callTool(createServer(new TodoistAPI("t")), "create-project-from-template", {
      project_id: "P1", csv_content: "task,description\nBuy milk,from corner shop",
    });
    assert.equal(fm.calls.length, 1);
    assert.equal(fm.calls[0].method, "POST");
    assert.match(fm.calls[0].url, /\/templates\/import_into_project\/P1$/);
    assert.deepEqual(fm.calls[0].body, { file: "task,description\nBuy milk,from corner shop" });
  } finally { fm.restore(); }
});

test("create-project-from-template with project_id + csv_path uploads file via multipart", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/templates\/import_into_project_from_file/, "POST", () => ({ body: { status: "ok" } }));
    await withTempFile("task,description\nA,b", "tpl.csv", async (p) => {
      await callTool(createServer(new TodoistAPI("t")), "create-project-from-template", {
        project_id: "P1", csv_path: p,
      });
    });
    assert.equal(fm.calls.length, 1);
    assert.match(fm.calls[0].url, /\/templates\/import_into_project_from_file/);
    assert.match(fm.calls[0].url, /project_id=P1/);
  } finally { fm.restore(); }
});

test("create-project-from-template with name + csv_path creates a new project", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/templates\/create_project_from_file/, "POST", () => ({ body: { id: "P_NEW" } }));
    await withTempFile("task\nA", "tpl.csv", async (p) => {
      const result = await callTool(createServer(new TodoistAPI("t")), "create-project-from-template", {
        name: "Trip planning", csv_path: p,
      });
      const parsed = JSON.parse(result.content[0].text);
      assert.equal(parsed.id, "P_NEW");
    });
    assert.equal(fm.calls.length, 1);
    assert.match(fm.calls[0].url, /\/templates\/create_project_from_file/);
    assert.match(fm.calls[0].url, /name=Trip\+planning|name=Trip%20planning/);
  } finally { fm.restore(); }
});

test("export-project-as-template hits GET /templates/export with project_id", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/templates\/export/, "GET", () => ({ body: { template: "task,description\nA,b" } }));
    const result = await callTool(createServer(new TodoistAPI("t")), "export-project-as-template", {
      project_id: "P1",
    });
    assert.equal(fm.calls.length, 1);
    assert.equal(fm.calls[0].method, "GET");
    assert.match(fm.calls[0].url, /\/templates\/export/);
    assert.match(fm.calls[0].url, /project_id=P1/);
    const parsed = JSON.parse(result.content[0].text);
    assert.match(parsed.template, /task,description/);
  } finally { fm.restore(); }
});

test("export-project-as-template forwards format param", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/templates\/export/, "GET", () => ({ body: {} }));
    await callTool(createServer(new TodoistAPI("t")), "export-project-as-template", {
      project_id: "P1", format: "json",
    });
    assert.match(fm.calls[0].url, /format=json/);
  } finally { fm.restore(); }
});
