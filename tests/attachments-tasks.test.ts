import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

const ATTACHMENT = {
  resource_type: "file", file_url: "https://x/a.txt", file_type: "text/plain",
  file_name: "a.txt", file_size: 1, upload_state: "completed",
};

async function withTempFile<T>(content: string, name: string, fn: (path: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "todoist-test-"));
  const path = join(dir, name);
  await writeFile(path, content);
  try { return await fn(path); }
  finally { try { await unlink(path); } catch {} }
}

test("add-tasks with attachment_paths creates task then one comment per file", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/tasks$/, "POST", () => ({ body: { id: "T1", content: "Bug report" } }));
    fm.on(/\/api\/v1\/uploads$/, "POST", () => ({ body: ATTACHMENT }));
    fm.on(/\/api\/v1\/comments$/, "POST", () => ({ body: { id: "C1" } }));
    await withTempFile("a", "a.txt", async (p1) => {
      await withTempFile("b", "b.txt", async (p2) => {
        await callTool(createServer(new TodoistAPI("t")), "add-tasks", {
          tasks: [{ content: "Bug report", attachment_paths: [p1, p2] }],
        });
      });
    });
    assert.equal(fm.calls.filter((c) => /\/tasks$/.test(c.url) && c.method === "POST").length, 1);
    assert.equal(fm.calls.filter((c) => /\/uploads$/.test(c.url)).length, 2);
    const commentCalls = fm.calls.filter((c) => /\/comments$/.test(c.url));
    assert.equal(commentCalls.length, 2);
    for (const cc of commentCalls) {
      const body = cc.body as { task_id: string; file_attachment: typeof ATTACHMENT };
      assert.equal(body.task_id, "T1");
      assert.deepEqual(body.file_attachment, ATTACHMENT);
    }
  } finally { fm.restore(); }
});

test("add-tasks without attachment_paths skips uploads and comments", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/tasks$/, "POST", () => ({ body: { id: "T1" } }));
    await callTool(createServer(new TodoistAPI("t")), "add-tasks", {
      tasks: [{ content: "Plain task" }],
    });
    assert.equal(fm.calls.filter((c) => /\/uploads/.test(c.url)).length, 0);
    assert.equal(fm.calls.filter((c) => /\/comments/.test(c.url)).length, 0);
  } finally { fm.restore(); }
});
