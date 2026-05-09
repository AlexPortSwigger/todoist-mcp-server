// Field-shaping helpers that match the output conventions of Doist's official MCP.

type Raw = Record<string, unknown>;

export function priorityToLabel(p: number | undefined): string | undefined {
  if (p === undefined || p === null) return undefined;
  switch (p) {
    case 4: return "p1";
    case 3: return "p2";
    case 2: return "p3";
    case 1: return "p4";
    default: return undefined;
  }
}

export function durationToString(d: unknown): string | undefined {
  if (!d || typeof d !== "object") return undefined;
  const obj = d as { amount?: number; unit?: string };
  if (typeof obj.amount !== "number" || typeof obj.unit !== "string") return undefined;
  if (obj.unit === "day") return `${obj.amount}d`;
  if (obj.unit === "minute") {
    const h = Math.floor(obj.amount / 60);
    const m = obj.amount % 60;
    if (h > 0 && m > 0) return `${h}h${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
  return undefined;
}

export interface MappedTask {
  id?: unknown;
  content?: unknown;
  description?: unknown;
  labels?: unknown;
  project_id?: unknown;
  section_id?: unknown;
  parent_id?: unknown;
  assignee_id?: unknown;
  assigner_id?: unknown;
  child_order?: unknown;
  is_completed?: unknown;
  added_at?: unknown;
  completed_at?: unknown;
  url?: unknown;
  comment_count?: unknown;
  priority?: string;
  duration?: string;
  dueDate?: string;
  dueDatetime?: string;
  dueString?: string;
  dueLang?: string;
  recurring: false | string;
  [key: string]: unknown;
}

export function mapTask(raw: Raw): MappedTask {
  const due = raw.due as Raw | null | undefined;
  const isRecurring = !!(due && due.is_recurring);
  const dueString = due ? (due.string as string | undefined) : undefined;

  return {
    ...raw,
    priority: priorityToLabel(raw.priority as number | undefined),
    duration: durationToString(raw.duration),
    dueDate: due ? (due.date as string | undefined) : undefined,
    dueDatetime: due ? (due.datetime as string | undefined) : undefined,
    dueString,
    dueLang: due ? (due.lang as string | undefined) : undefined,
    recurring: isRecurring && dueString ? dueString : false,
  };
}

export function mapTasks(rawList: unknown[]): MappedTask[] {
  return rawList.map((r) => mapTask(r as Raw));
}

export interface MappedReminder {
  id?: unknown;
  taskId?: unknown;
  type?: unknown;
  due?: unknown;
  minute_offset?: unknown;
  notify_uid?: unknown;
  is_deleted?: unknown;
  [key: string]: unknown;
}

export function mapReminder(raw: Raw): MappedReminder {
  const { item_id, ...rest } = raw;
  return { ...rest, taskId: item_id };
}

export function mapReminders(rawList: unknown[]): MappedReminder[] {
  return rawList.map((r) => mapReminder(r as Raw));
}
