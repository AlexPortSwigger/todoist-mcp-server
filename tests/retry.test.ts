import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { FetchMock } from "./helpers.js";

test("retries on 503 then succeeds", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    let n = 0;
    fm.on(/\/user$/, "GET", () => {
      n += 1;
      if (n < 2) return { status: 503, body: { error: "Service Unavailable" } };
      return { body: { id: "U1" } };
    });
    const api = new TodoistAPI("t", { retryDelaysMs: [1, 1] });
    const user = await api.getUserInfo() as { id: string };
    assert.equal(user.id, "U1");
    assert.equal(n, 2, "should have retried once");
  } finally { fm.restore(); }
});

test("retries up to 2 times on 502 then surfaces error", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    let n = 0;
    fm.on(/\/user$/, "GET", () => {
      n += 1;
      return { status: 502, body: { error: "Bad Gateway" } };
    });
    const api = new TodoistAPI("t", { retryDelaysMs: [1, 1] });
    await assert.rejects(() => api.getUserInfo(), /502/);
    assert.equal(n, 3, "initial + 2 retries = 3 total attempts");
  } finally { fm.restore(); }
});

test("does NOT retry on 400 / 401 / 403 / 404", async () => {
  for (const status of [400, 401, 403, 404]) {
    const fm = new FetchMock();
    fm.install();
    try {
      let n = 0;
      fm.on(/\/user$/, "GET", () => {
        n += 1;
        return { status, body: { error: "client error" } };
      });
      const api = new TodoistAPI("t", { retryDelaysMs: [1, 1] });
      await assert.rejects(() => api.getUserInfo(), new RegExp(String(status)));
      assert.equal(n, 1, `status ${status} should not be retried`);
    } finally { fm.restore(); }
  }
});

test("does NOT retry on 500", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    let n = 0;
    fm.on(/\/user$/, "GET", () => {
      n += 1;
      return { status: 500, body: { error: "Internal" } };
    });
    const api = new TodoistAPI("t", { retryDelaysMs: [1, 1] });
    await assert.rejects(() => api.getUserInfo(), /500/);
    assert.equal(n, 1, "500 (not 502/503/504) should not be retried");
  } finally { fm.restore(); }
});

test("retries on 504 then succeeds", async () => {
  const fm = new FetchMock();
  fm.install();
  try {
    let n = 0;
    fm.on(/\/user$/, "GET", () => {
      n += 1;
      if (n === 1) return { status: 504, body: { error: "Gateway Timeout" } };
      return { body: { ok: true } };
    });
    const api = new TodoistAPI("t", { retryDelaysMs: [1, 1] });
    await api.getUserInfo();
    assert.equal(n, 2);
  } finally { fm.restore(); }
});
