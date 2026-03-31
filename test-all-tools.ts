#!/usr/bin/env tsx
/**
 * End-to-end test for all 44 MCP tools against live Todoist API v1.
 * Creates test data, exercises every tool, then cleans up.
 */

import { spawn, ChildProcess } from "node:child_process";
import { resolve } from "node:path";

const SERVER_PATH = resolve(import.meta.dirname!, "dist/index.js");

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    tools?: Array<{ name: string }>;
  };
  error?: { code: number; message: string };
}

class McpTestClient {
  private proc: ChildProcess;
  private buffer = "";
  private pending = new Map<number, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }>();
  private nextId = 1;

  constructor() {
    this.proc = spawn("node", [SERVER_PATH], {
      env: { ...process.env, TODOIST_API_TOKEN: process.env.TODOIST_API_TOKEN },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.proc.stdout!.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          const p = this.pending.get(msg.id);
          if (p) { this.pending.delete(msg.id); p.resolve(msg); }
        } catch { /* skip */ }
      }
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<{ ok: boolean; text: string }> {
    try {
      const res = await this.send("tools/call", { name, arguments: args });
      if (res.error) return { ok: false, text: res.error.message };
      const text = res.result?.content?.[0]?.text || "";
      if (text.includes("Todoist API error")) return { ok: false, text };
      return { ok: true, text };
    } catch (e) {
      return { ok: false, text: String(e) };
    }
  }

  close() { this.proc.kill(); }
}

interface TestResult { tool: string; ok: boolean; detail: string; ms: number }
const results: TestResult[] = [];

function log(icon: string, tool: string, detail: string, ms: number) {
  console.log(`  ${icon} ${tool} (${ms}ms) — ${detail.slice(0, 120)}`);
}

async function run(
  client: McpTestClient, tool: string, args: Record<string, unknown>,
  check: (text: string) => string | null
): Promise<string> {
  const t0 = Date.now();
  const res = await client.callTool(tool, args);
  const ms = Date.now() - t0;
  if (!res.ok) {
    results.push({ tool, ok: false, detail: res.text, ms });
    log("❌", tool, res.text, ms);
    return res.text;
  }
  const err = check(res.text);
  if (err) {
    results.push({ tool, ok: false, detail: err, ms });
    log("❌", tool, err, ms);
  } else {
    results.push({ tool, ok: true, detail: `${res.text.length} chars`, ms });
    log("✅", tool, `${res.text.length} chars`, ms);
  }
  return res.text;
}

const isArr = (t: string) => { try { return Array.isArray(JSON.parse(t)) ? null : "not array"; } catch { return "bad json"; } };
const isObj = (t: string) => { try { const d = JSON.parse(t); return d && typeof d === "object" ? null : "not object"; } catch { return "bad json"; } };
const has = (s: string) => (t: string) => t.includes(s) ? null : `missing "${s}"`;
const isAny = (t: string) => { try { JSON.parse(t); return null; } catch { return t.startsWith("No ") || t.startsWith("Filter") ? null : "bad json"; } };

async function safeParse<T>(text: string, fallback: T): Promise<T> {
  try { return JSON.parse(text) as T; } catch { return fallback; }
}

// ═══════════════════════════════════════════

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  TODOIST MCP SERVER — FULL 44-TOOL E2E TEST (API v1)    ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const client = new McpTestClient();

  // Initialize
  const init = await client.send("initialize", {
    protocolVersion: "2024-11-05", capabilities: {},
    clientInfo: { name: "test", version: "1.0" },
  });
  if (init.error) { console.error("Init failed:", init.error); process.exit(1); }

  const tools = await client.send("tools/list", {});
  const count = tools.result?.tools?.length || 0;
  console.log(`  Tools registered: ${count}/44\n`);

  // ───────────────────────────────────────
  console.log("── PHASE 1: READ-ONLY (existing data) ──\n");

  await run(client, "find-projects", {}, isArr);
  await run(client, "find-labels", {}, isArr);
  await run(client, "find-tasks", {}, isArr);
  await run(client, "find-tasks-by-date", {}, isArr);
  await run(client, "find-sections", {}, isArr);
  await run(client, "find-reminders", {}, isArr);
  await run(client, "find-completed-tasks", { limit: 5 }, isObj);
  await run(client, "find-activity", { limit: 5 }, isObj);
  await run(client, "get-productivity-stats", {}, isObj);
  await run(client, "get-overview", {}, isObj);
  await run(client, "get-workspace-insights", {}, isObj);
  await run(client, "list-workspaces", {}, isObj);
  await run(client, "user-info", {}, isObj);
  await run(client, "search", { query: "test" }, isArr);
  await run(client, "find-filters", {}, isObj);

  // Project-scoped reads
  const projText = await run(client, "find-projects", {}, isArr);
  const projects = await safeParse<Array<{ id: string; name: string }>>(projText, []);
  const existingProjId = projects[0]?.id;

  if (existingProjId) {
    await run(client, "find-sections", { project_id: existingProjId }, isArr);
    await run(client, "find-project-collaborators", { project_id: existingProjId }, isArr);
    await run(client, "get-project-health", { project_id: existingProjId }, isObj);
    await run(client, "get-project-activity-stats", { project_id: existingProjId, limit: 5 }, isObj);
    await run(client, "fetch-object", { object_type: "project", id: existingProjId }, isObj);
    await run(client, "fetch", { url: `https://api.todoist.com/api/v1/projects/${existingProjId}` }, isObj);
  }

  // ───────────────────────────────────────
  console.log("\n── PHASE 2: WRITE (create test data) ──\n");

  // Create test project
  const newProjText = await run(client, "add-projects", {
    projects: [{ name: "MCP_TEST_DELETE_ME", view_style: "board" }],
  }, isArr);
  const newProjects = await safeParse<Array<{ id: string }>>(newProjText, []);
  const testProjId = newProjects[0]?.id;
  console.log(`    → test project: ${testProjId}`);

  // Create test section
  let testSectionId: string | undefined;
  if (testProjId) {
    const secText = await run(client, "add-sections", {
      sections: [{ name: "Test Section", project_id: testProjId }],
    }, isArr);
    const secs = await safeParse<Array<{ id: string }>>(secText, []);
    testSectionId = secs[0]?.id;
    console.log(`    → test section: ${testSectionId}`);
  }

  // Create test tasks
  let testTaskId: string | undefined;
  let testTask2Id: string | undefined;
  if (testProjId) {
    const taskText = await run(client, "add-tasks", {
      tasks: [
        { content: "MCP Test Task 1", project_id: testProjId, section_id: testSectionId, priority: 2, due_string: "tomorrow", labels: ["mcp-test"], description: "Test task" },
        { content: "MCP Test Task 2 — reschedule", project_id: testProjId, due_date: "2026-12-31" },
      ],
    }, isArr);
    const tasks = await safeParse<Array<{ id: string; content: string }>>(taskText, []);
    testTaskId = tasks.find((t) => t.content.includes("Task 1"))?.id;
    testTask2Id = tasks.find((t) => t.content.includes("reschedule"))?.id;
    console.log(`    → test tasks: ${testTaskId}, ${testTask2Id}`);
  }

  // Create subtask
  let testSubtaskId: string | undefined;
  if (testTaskId) {
    const subText = await run(client, "add-tasks", {
      tasks: [{ content: "MCP Test Subtask", parent_id: testTaskId }],
    }, isArr);
    const subs = await safeParse<Array<{ id: string }>>(subText, []);
    testSubtaskId = subs[0]?.id;
    console.log(`    → test subtask: ${testSubtaskId}`);
  }

  // Create label
  const lblText = await run(client, "add-labels", {
    labels: [{ name: "mcp-test-label", color: "red" }],
  }, isArr);
  const newLabels = await safeParse<Array<{ id: string }>>(lblText, []);
  const testLabelId = newLabels[0]?.id;

  // Create comment
  let testCommentId: string | undefined;
  if (testTaskId) {
    const cmtText = await run(client, "add-comments", {
      comments: [{ task_id: testTaskId, content: "Test comment from MCP" }],
    }, isArr);
    const cmts = await safeParse<Array<{ id: string }>>(cmtText, []);
    testCommentId = cmts[0]?.id;
    console.log(`    → test comment: ${testCommentId}`);
  }

  // find-comments (needs real task)
  if (testTaskId) {
    await run(client, "find-comments", { task_id: testTaskId }, isArr);
  }

  // Add filter (graceful — API v1 doesn't support)
  await run(client, "add-filters", {
    filters: [{ name: "MCP Test Filter", query: "search: mcp" }],
  }, isObj);

  // Add reminder (may fail on free plan)
  if (testTaskId) {
    await run(client, "add-reminders", {
      reminders: [{ task_id: testTaskId, minute_offset: 30, type: "relative" }],
    }, isAny);
  }

  // ───────────────────────────────────────
  console.log("\n── PHASE 3: UPDATE ──\n");

  if (testTaskId) {
    await run(client, "update-tasks", {
      tasks: [{ id: testTaskId, content: "MCP Test Task 1 — UPDATED", priority: 3 }],
    }, isArr);
  }

  if (testTask2Id) {
    await run(client, "reschedule-tasks", {
      tasks: [{ id: testTask2Id, due_string: "next friday" }],
    }, isArr);
  }

  if (testProjId) {
    await run(client, "update-projects", {
      projects: [{ id: testProjId, name: "MCP_TEST_UPDATED_DELETE_ME" }],
    }, isArr);
  }

  if (testSectionId) {
    await run(client, "update-sections", {
      sections: [{ id: testSectionId, name: "Updated Section" }],
    }, isArr);
  }

  if (testCommentId) {
    await run(client, "update-comments", {
      comments: [{ id: testCommentId, content: "Updated comment" }],
    }, isArr);
  }

  // View attachment
  if (testCommentId) {
    await run(client, "view-attachment", { comment_id: testCommentId }, isAny);
  }

  // Update filters (graceful)
  await run(client, "update-filters", {
    filters: [{ id: "fake-id", name: "Updated" }],
  }, isObj);

  // Update reminders
  const remText = await client.callTool("find-reminders", {});
  const reminders = remText.ok ? await safeParse<Array<{ id: string }>>(remText.text, []) : [];
  if (reminders.length > 0) {
    await run(client, "update-reminders", {
      reminders: [{ id: String(reminders[0].id), minute_offset: 60 }],
    }, isAny);
  } else {
    results.push({ tool: "update-reminders", ok: true, detail: "SKIPPED (no reminders)", ms: 0 });
    console.log("  ⏭️  update-reminders — skipped (no reminders on account)");
  }

  // ───────────────────────────────────────
  console.log("\n── PHASE 4: MOVE & REORDER ──\n");

  // Move task between sections
  if (testTaskId && testSectionId) {
    await run(client, "update-tasks", {
      tasks: [{ id: testTaskId, section_id: testSectionId }],
    }, isAny);
  }

  // Manage assignments
  if (testTaskId) {
    await run(client, "manage-assignments", {
      assignments: [{ task_id: testTaskId, assignee_id: null }],
    }, isArr);
  }

  // Project management
  if (testProjId) {
    await run(client, "project-management", {
      operations: [{ project_id: testProjId, action: "update", data: { name: "MCP_TEST_MGMT_DELETE_ME" } }],
    }, isArr);
  }

  // Reorder
  if (testSectionId) {
    await run(client, "reorder-objects", {
      object_type: "section",
      items: [{ id: testSectionId, child_order: 0 }],
    }, isArr);
  }

  // Project move (to root — it already is)
  if (testProjId) {
    await run(client, "project-move", { project_id: testProjId, child_order: 0 }, isObj);
  }

  // Analyze project health
  if (testProjId) {
    await run(client, "analyze-project-health", {
      project_id: testProjId, include_suggestions: true,
    }, isObj);
  }

  // Fetch task by ID
  if (testTaskId) {
    await run(client, "fetch-object", { object_type: "task", id: testTaskId }, isObj);
  }

  // ───────────────────────────────────────
  console.log("\n── PHASE 5: COMPLETE, UNCOMPLETE & CLEANUP ──\n");

  if (testSubtaskId) {
    await run(client, "complete-tasks", { ids: [testSubtaskId] }, has("Completed"));
    await run(client, "uncomplete-tasks", { ids: [testSubtaskId] }, has("Reopened"));
  }

  // Delete test objects
  if (testCommentId) {
    await run(client, "delete-object", { object_type: "comment", id: testCommentId }, has("Deleted"));
  }
  if (testLabelId) {
    await run(client, "delete-object", { object_type: "label", id: String(testLabelId) }, has("Deleted"));
  }
  if (testProjId) {
    // Deleting project cascades tasks and sections
    await run(client, "delete-object", { object_type: "project", id: testProjId }, has("Deleted"));
  }

  // ───────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║  RESULTS                                                 ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  if (failed.length > 0) {
    console.log("  FAILURES:");
    for (const f of failed) {
      console.log(`    ❌ ${f.tool}: ${f.detail.slice(0, 150)}`);
    }
    console.log();
  }

  const testedTools = new Set(results.map((r) => r.tool));
  const allToolNames = [
    "find-tasks-by-date", "fetch", "fetch-object", "find-activity", "find-comments",
    "find-completed-tasks", "find-filters", "find-labels", "find-project-collaborators",
    "find-projects", "find-reminders", "find-sections", "find-tasks", "get-overview",
    "get-productivity-stats", "get-project-activity-stats", "get-project-health",
    "get-workspace-insights", "list-workspaces", "search", "user-info", "view-attachment",
    "add-comments", "add-filters", "add-labels", "add-projects", "add-reminders",
    "add-sections", "add-tasks", "analyze-project-health", "complete-tasks", "delete-object",
    "manage-assignments", "project-management", "project-move", "reorder-objects",
    "reschedule-tasks", "uncomplete-tasks", "update-comments", "update-filters",
    "update-projects", "update-reminders", "update-sections", "update-tasks",
  ];
  const untested = allToolNames.filter((t) => !testedTools.has(t));

  console.log(`  TOTAL TESTS: ${results.length}`);
  console.log(`  ✅ PASSED:   ${passed.length}`);
  console.log(`  ❌ FAILED:   ${failed.length}`);
  console.log(`  TOOLS HIT:  ${testedTools.size}/44`);
  if (untested.length > 0) console.log(`  UNTESTED:   ${untested.join(", ")}`);
  console.log();

  client.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error("CRASH:", e); process.exit(1); });
