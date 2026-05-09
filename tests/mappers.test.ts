import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTask, mapReminder } from "../src/mappers.js";

test("mapTask: priority 4 (API urgent) becomes 'p1'", () => {
  const out = mapTask({ id: "1", content: "x", priority: 4 });
  assert.equal(out.priority, "p1");
});

test("mapTask: priority 1 (API normal) becomes 'p4'", () => {
  const out = mapTask({ id: "1", content: "x", priority: 1 });
  assert.equal(out.priority, "p4");
});

test("mapTask: priority mapping covers all four levels", () => {
  assert.equal(mapTask({ priority: 4 }).priority, "p1");
  assert.equal(mapTask({ priority: 3 }).priority, "p2");
  assert.equal(mapTask({ priority: 2 }).priority, "p3");
  assert.equal(mapTask({ priority: 1 }).priority, "p4");
});

test("mapTask: flattens due.date to dueDate", () => {
  const out = mapTask({ id: "1", due: { date: "2026-05-15", string: "may 15" } });
  assert.equal(out.dueDate, "2026-05-15");
  assert.equal(out.dueString, "may 15");
});

test("mapTask: flattens due.datetime to dueDatetime", () => {
  const out = mapTask({ id: "1", due: { datetime: "2026-05-15T09:00:00Z" } });
  assert.equal(out.dueDatetime, "2026-05-15T09:00:00Z");
});

test("mapTask: recurring is false when not recurring", () => {
  const out = mapTask({ id: "1", due: { date: "2026-05-15", is_recurring: false } });
  assert.equal(out.recurring, false);
});

test("mapTask: recurring is the string when is_recurring=true", () => {
  const out = mapTask({ id: "1", due: { date: "2026-05-15", string: "every weekday", is_recurring: true } });
  assert.equal(out.recurring, "every weekday");
});

test("mapTask: recurring is false when due is null", () => {
  const out = mapTask({ id: "1", due: null });
  assert.equal(out.recurring, false);
  assert.equal(out.dueDate, undefined);
});

test("mapTask: duration in minutes becomes '90m' / '2h30m'", () => {
  assert.equal(mapTask({ duration: { amount: 90, unit: "minute" } }).duration, "1h30m");
  assert.equal(mapTask({ duration: { amount: 30, unit: "minute" } }).duration, "30m");
  assert.equal(mapTask({ duration: { amount: 120, unit: "minute" } }).duration, "2h");
  assert.equal(mapTask({ duration: { amount: 150, unit: "minute" } }).duration, "2h30m");
});

test("mapTask: duration in days becomes '3d'", () => {
  assert.equal(mapTask({ duration: { amount: 3, unit: "day" } }).duration, "3d");
});

test("mapTask: missing duration is undefined", () => {
  assert.equal(mapTask({ id: "1" }).duration, undefined);
});

test("mapTask: preserves id, content, description, labels, project_id", () => {
  const out = mapTask({
    id: "T1", content: "Buy milk", description: "from corner shop",
    labels: ["errands"], project_id: "P1", section_id: "S1", parent_id: null,
  });
  assert.equal(out.id, "T1");
  assert.equal(out.content, "Buy milk");
  assert.equal(out.description, "from corner shop");
  assert.deepEqual(out.labels, ["errands"]);
  assert.equal(out.project_id, "P1");
  assert.equal(out.section_id, "S1");
});

test("mapReminder: itemId renamed to taskId", () => {
  const out = mapReminder({ id: "R1", item_id: "T1", minute_offset: 30 });
  assert.equal(out.taskId, "T1");
  assert.equal(out.id, "R1");
  assert.equal(out.minute_offset, 30);
  assert.ok(!("item_id" in out));
});
