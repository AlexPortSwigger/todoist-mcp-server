import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

const ATTACHMENT = {
  resource_type: "file",
  file_url: "https://example.com/x.txt",
  file_type: "text/plain",
  file_name: "x.txt",
  file_size: 5,
  upload_state: "completed",
};

async function withTempFile<T>(content: string, name: string, fn: (path: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "todoist-test-"));
  const path = join(dir, name);
  await writeFile(path, content);
  try { return await fn(path); }
  finally { try { await unlink(path); } catch {} }
}

test("add-comments with attachment_path uploads then attaches", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/uploads$/, "POST", () => ({ body: ATTACHMENT }));
    fm.on(/\/api\/v1\/comments$/, "POST", () => ({ body: { id: "C1" } }));
    await withTempFile("hello", "x.txt", async (p) => {
      await callTool(createServer(new TodoistAPI("t")), "add-comments", {
        comments: [{ task_id: "T1", content: "see attached", attachment_path: p }],
      });
    });
    const uploadCall = fm.calls.find((c) => /\/uploads$/.test(c.url));
    const commentCall = fm.calls.find((c) => /\/comments$/.test(c.url));
    assert.ok(uploadCall, "uploads endpoint hit");
    assert.equal(uploadCall.method, "POST");
    assert.ok(commentCall, "comments endpoint hit");
    const body = commentCall.body as { task_id: string; content: string; file_attachment: typeof ATTACHMENT };
    assert.equal(body.task_id, "T1");
    assert.equal(body.content, "see attached");
    assert.deepEqual(body.file_attachment, ATTACHMENT);
  } finally { fm.restore(); }
});

test("add-comments without attachment_path skips uploads endpoint", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    fm.on(/\/api\/v1\/comments$/, "POST", () => ({ body: { id: "C1" } }));
    await callTool(createServer(new TodoistAPI("t")), "add-comments", {
      comments: [{ task_id: "T1", content: "no attachment" }],
    });
    assert.equal(fm.calls.filter((c) => /\/uploads/.test(c.url)).length, 0);
  } finally { fm.restore(); }
});
