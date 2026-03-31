#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TodoistAPI } from "./todoist-api.js";

const token = process.env.TODOIST_API_TOKEN;
if (!token) {
  console.error("TODOIST_API_TOKEN environment variable is required");
  process.exit(1);
}

const api = new TodoistAPI(token);

const server = new McpServer({
  name: "todoist-mcp-server",
  version: "1.0.0",
});

// ═══════════════════════════════════════════
// INTERACTIVE TOOLS (1)
// ═══════════════════════════════════════════

server.tool(
  "find-tasks-by-date",
  "Find tasks filtered by due date range. Returns tasks due within the specified date range.",
  {
    filter: z.string().optional().describe("Todoist filter query (e.g. 'today', 'overdue', 'due before: Jan 1')"),
    due_date: z.string().optional().describe("Specific due date (YYYY-MM-DD)"),
    due_before: z.string().optional().describe("Tasks due before this date (YYYY-MM-DD)"),
    due_after: z.string().optional().describe("Tasks due after this date (YYYY-MM-DD)"),
    project_id: z.string().optional().describe("Filter by project ID"),
  },
  async (params) => {
    const queryParams: Record<string, string> = {};
    if (params.filter) queryParams.filter = params.filter;
    if (params.project_id) queryParams.project_id = params.project_id;

    // Build a filter string if date params provided
    if (!params.filter) {
      const parts: string[] = [];
      if (params.due_date) parts.push(`due: ${params.due_date}`);
      if (params.due_before) parts.push(`due before: ${params.due_before}`);
      if (params.due_after) parts.push(`due after: ${params.due_after}`);
      if (parts.length > 0) queryParams.filter = parts.join(" & ");
    }

    if (!queryParams.filter) queryParams.filter = "today | overdue";
    const result = await api.getTasks(queryParams);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ═══════════════════════════════════════════
// READ-ONLY TOOLS (21)
// ═══════════════════════════════════════════

server.tool(
  "fetch",
  "Fetch any Todoist API URL directly. Useful for accessing endpoints not covered by other tools.",
  {
    url: z.string().describe("Full Todoist API URL to fetch"),
    method: z.enum(["GET", "POST"]).optional().describe("HTTP method (default: GET)"),
    body: z.record(z.unknown()).optional().describe("Request body for POST requests"),
  },
  async (params) => {
    const result = await api.fetchUrl(params.url, params.method || "GET", params.body);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "fetch-object",
  "Fetch a specific Todoist object by type and ID.",
  {
    object_type: z.enum(["task", "project", "section", "comment", "label"]).describe("Type of object to fetch"),
    id: z.string().describe("Object ID"),
  },
  async (params) => {
    let result: unknown;
    switch (params.object_type) {
      case "task": result = await api.getTask(params.id); break;
      case "project": result = await api.getProject(params.id); break;
      case "section": result = await api.getSection(params.id); break;
      case "comment": result = await api.getComment(params.id); break;
      case "label": result = await api.getLabel(params.id); break;
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-activity",
  "Find activity log events. Shows task completions, additions, updates, and other events.",
  {
    object_type: z.string().optional().describe("Filter by object type (e.g. 'item', 'note', 'project')"),
    object_id: z.string().optional().describe("Filter by specific object ID"),
    event_type: z.string().optional().describe("Filter by event type (e.g. 'added', 'updated', 'completed', 'deleted')"),
    parent_project_id: z.string().optional().describe("Filter by parent project ID"),
    parent_item_id: z.string().optional().describe("Filter by parent item ID"),
    page: z.number().optional().describe("Page number for pagination"),
    limit: z.number().optional().describe("Number of events per page (max 100)"),
    since: z.string().optional().describe("Return events since this date (YYYY-MM-DDTHH:MM)"),
    until: z.string().optional().describe("Return events until this date (YYYY-MM-DDTHH:MM)"),
  },
  async (params) => {
    const result = await api.getActivity(params);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-comments",
  "Find comments on a task or project.",
  {
    task_id: z.string().optional().describe("Task ID to get comments for"),
    project_id: z.string().optional().describe("Project ID to get comments for"),
  },
  async (params) => {
    const queryParams: Record<string, string> = {};
    if (params.task_id) queryParams.task_id = params.task_id;
    if (params.project_id) queryParams.project_id = params.project_id;
    const result = await api.getComments(queryParams);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-completed-tasks",
  "Find completed tasks, optionally filtered by project or date range.",
  {
    project_id: z.string().optional().describe("Filter by project ID"),
    section_id: z.string().optional().describe("Filter by section ID"),
    since: z.string().optional().describe("Return tasks completed since this date (YYYY-MM-DDTHH:MM)"),
    until: z.string().optional().describe("Return tasks completed until this date (YYYY-MM-DDTHH:MM)"),
    limit: z.number().optional().describe("Max number of results (default 30, max 200)"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async (params) => {
    const result = await api.getCompletedTasks(params);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-filters",
  "Find all user-defined filters.",
  {},
  async () => {
    const result = await api.sync(["filters"]);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-labels",
  "Find all personal labels.",
  {},
  async () => {
    const result = await api.getLabels();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-project-collaborators",
  "Find collaborators on a shared project.",
  {
    project_id: z.string().describe("Project ID to get collaborators for"),
  },
  async (params) => {
    const result = await api.getProjectCollaborators(params.project_id);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-projects",
  "Find all projects, optionally filtered.",
  {},
  async () => {
    const result = await api.getProjects();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-reminders",
  "Find all reminders.",
  {},
  async () => {
    const result = await api.sync(["reminders"]);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-sections",
  "Find sections, optionally filtered by project.",
  {
    project_id: z.string().optional().describe("Filter by project ID"),
  },
  async (params) => {
    const result = await api.getSections(params.project_id);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "find-tasks",
  "Find active tasks with optional filtering.",
  {
    project_id: z.string().optional().describe("Filter by project ID"),
    section_id: z.string().optional().describe("Filter by section ID"),
    label: z.string().optional().describe("Filter by label name"),
    filter: z.string().optional().describe("Todoist filter query string"),
    ids: z.array(z.string()).optional().describe("Array of specific task IDs to fetch"),
    parent_id: z.string().optional().describe("Filter by parent task ID (for subtasks)"),
  },
  async (params) => {
    const queryParams: Record<string, string> = {};
    if (params.project_id) queryParams.project_id = params.project_id;
    if (params.section_id) queryParams.section_id = params.section_id;
    if (params.label) queryParams.label = params.label;
    if (params.filter) queryParams.filter = params.filter;
    if (params.ids) queryParams.ids = params.ids.join(",");
    if (params.parent_id) queryParams.parent_id = params.parent_id;
    const result = await api.getTasks(queryParams);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get-overview",
  "Get a high-level overview of your Todoist workspace: projects, task counts, and upcoming items.",
  {},
  async () => {
    const [projects, tasks, labels] = await Promise.all([
      api.getProjects() as Promise<unknown[]>,
      api.getTasks({ filter: "all" }) as Promise<unknown[]>,
      api.getLabels() as Promise<unknown[]>,
    ]);

    const tasksByProject: Record<string, number> = {};
    const overdueTasks: unknown[] = [];
    const todayTasks: unknown[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    for (const task of tasks) {
      const t = task as Record<string, unknown>;
      const projectId = String(t.project_id || "none");
      tasksByProject[projectId] = (tasksByProject[projectId] || 0) + 1;

      const due = t.due as Record<string, string> | null;
      if (due?.date) {
        if (due.date < todayStr) overdueTasks.push(task);
        else if (due.date === todayStr) todayTasks.push(task);
      }
    }

    const overview = {
      total_projects: projects.length,
      total_active_tasks: tasks.length,
      total_labels: labels.length,
      overdue_count: overdueTasks.length,
      today_count: todayTasks.length,
      tasks_by_project: tasksByProject,
      overdue_tasks: overdueTasks.slice(0, 10),
      today_tasks: todayTasks.slice(0, 10),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(overview, null, 2) }] };
  }
);

server.tool(
  "get-productivity-stats",
  "Get productivity statistics: completed tasks, karma, streaks, goals, and daily/weekly trends.",
  {},
  async () => {
    const result = await api.getProductivityStats();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get-project-activity-stats",
  "Get activity statistics for a specific project.",
  {
    project_id: z.string().describe("Project ID to get activity stats for"),
    event_type: z.string().optional().describe("Filter by event type"),
    since: z.string().optional().describe("Since date (YYYY-MM-DDTHH:MM)"),
    until: z.string().optional().describe("Until date (YYYY-MM-DDTHH:MM)"),
    limit: z.number().optional().describe("Max events to return"),
  },
  async (params) => {
    const result = await api.getActivity({
      parent_project_id: params.project_id,
      event_type: params.event_type,
      since: params.since,
      until: params.until,
      limit: params.limit || 50,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get-project-health",
  "Analyze the health of a project: task distribution, overdue items, completion rate, and stale tasks.",
  {
    project_id: z.string().describe("Project ID to analyze"),
  },
  async (params) => {
    const [tasks, sections, completedData] = await Promise.all([
      api.getTasks({ project_id: params.project_id }) as Promise<unknown[]>,
      api.getSections(params.project_id) as Promise<unknown[]>,
      api.getCompletedTasks({ project_id: params.project_id, limit: 50 }),
    ]);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    let overdue = 0;
    let dueToday = 0;
    let noDue = 0;
    let highPriority = 0;
    const tasksBySection: Record<string, number> = {};

    for (const task of tasks) {
      const t = task as Record<string, unknown>;
      const due = t.due as Record<string, string> | null;
      if (!due) { noDue++; }
      else if (due.date < todayStr) { overdue++; }
      else if (due.date === todayStr) { dueToday++; }

      if ((t.priority as number) >= 3) highPriority++;
      const sid = String(t.section_id || "unsectioned");
      tasksBySection[sid] = (tasksBySection[sid] || 0) + 1;
    }

    const completed = completedData as Record<string, unknown>;
    const completedItems = (completed.items || []) as unknown[];

    const health = {
      project_id: params.project_id,
      active_tasks: tasks.length,
      sections: sections.length,
      recently_completed: completedItems.length,
      overdue_tasks: overdue,
      due_today: dueToday,
      no_due_date: noDue,
      high_priority_tasks: highPriority,
      tasks_by_section: tasksBySection,
      health_score:
        overdue === 0 && noDue < tasks.length * 0.3
          ? "healthy"
          : overdue > tasks.length * 0.5
            ? "critical"
            : "needs_attention",
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(health, null, 2) }] };
  }
);

server.tool(
  "get-workspace-insights",
  "Get insights across the entire workspace: task distribution, label usage, priority breakdown.",
  {},
  async () => {
    const [projects, tasks, labels] = await Promise.all([
      api.getProjects() as Promise<unknown[]>,
      api.getTasks({ filter: "all" }) as Promise<unknown[]>,
      api.getLabels() as Promise<unknown[]>,
    ]);

    const priorityBreakdown: Record<string, number> = { p1: 0, p2: 0, p3: 0, p4: 0 };
    const labelUsage: Record<string, number> = {};
    const projectSizes: Array<{ name: string; id: string; count: number }> = [];

    const tasksByProject: Record<string, number> = {};
    for (const task of tasks) {
      const t = task as Record<string, unknown>;
      const p = t.priority as number;
      priorityBreakdown[`p${p}`] = (priorityBreakdown[`p${p}`] || 0) + 1;

      const taskLabels = t.labels as string[] | undefined;
      if (taskLabels) {
        for (const l of taskLabels) {
          labelUsage[l] = (labelUsage[l] || 0) + 1;
        }
      }

      const pid = String(t.project_id);
      tasksByProject[pid] = (tasksByProject[pid] || 0) + 1;
    }

    for (const proj of projects) {
      const p = proj as Record<string, unknown>;
      projectSizes.push({
        name: String(p.name),
        id: String(p.id),
        count: tasksByProject[String(p.id)] || 0,
      });
    }
    projectSizes.sort((a, b) => b.count - a.count);

    const insights = {
      total_projects: projects.length,
      total_tasks: tasks.length,
      total_labels: labels.length,
      priority_breakdown: priorityBreakdown,
      label_usage: labelUsage,
      projects_by_size: projectSizes.slice(0, 20),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(insights, null, 2) }] };
  }
);

server.tool(
  "list-workspaces",
  "List all available workspaces (for Todoist Business/Team accounts).",
  {},
  async () => {
    // Personal accounts have a single implicit workspace.
    // For team accounts, this comes from the sync API user data.
    const result = await api.sync(["user", "collaborators"]);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "search",
  "Search across tasks using Todoist's filter query language.",
  {
    query: z.string().describe("Search query — can be a text search or Todoist filter syntax (e.g. 'search: meeting', '#ProjectName', '@label', 'p1')"),
  },
  async (params) => {
    // Todoist filter API is the search mechanism
    const result = await api.getTasks({ filter: params.query });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "user-info",
  "Get information about the authenticated user: name, email, timezone, karma, plan.",
  {},
  async () => {
    const result = await api.sync(["user"]);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "view-attachment",
  "View attachment details from a comment.",
  {
    comment_id: z.string().describe("Comment ID containing the attachment"),
  },
  async (params) => {
    const comment = (await api.getComment(params.comment_id)) as Record<string, unknown>;
    const attachment = comment.attachment || null;
    return {
      content: [{
        type: "text" as const,
        text: attachment
          ? JSON.stringify(attachment, null, 2)
          : "No attachment found on this comment.",
      }],
    };
  }
);

// ═══════════════════════════════════════════
// WRITE/DELETE TOOLS (22)
// ═══════════════════════════════════════════

server.tool(
  "add-comments",
  "Add one or more comments to tasks or projects.",
  {
    comments: z.array(z.object({
      task_id: z.string().optional().describe("Task ID to comment on"),
      project_id: z.string().optional().describe("Project ID to comment on"),
      content: z.string().describe("Comment text (supports Markdown)"),
    })).describe("Array of comments to add"),
  },
  async (params) => {
    const results = [];
    for (const c of params.comments) {
      const data: Record<string, unknown> = { content: c.content };
      if (c.task_id) data.task_id = c.task_id;
      if (c.project_id) data.project_id = c.project_id;
      results.push(await api.createComment(data));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "add-filters",
  "Add one or more custom filters.",
  {
    filters: z.array(z.object({
      name: z.string().describe("Filter name"),
      query: z.string().describe("Filter query string"),
      color: z.string().optional().describe("Filter color"),
      is_favorite: z.boolean().optional().describe("Whether filter is a favorite"),
    })).describe("Array of filters to create"),
  },
  async (params) => {
    const commands = params.filters.map((f) => ({
      type: "filter_add",
      args: {
        name: f.name,
        query: f.query,
        ...(f.color && { color: f.color }),
        ...(f.is_favorite !== undefined && { is_favorite: f.is_favorite }),
      },
    }));
    const result = await api.syncWriteCommands(commands);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "add-labels",
  "Add one or more personal labels.",
  {
    labels: z.array(z.object({
      name: z.string().describe("Label name"),
      color: z.string().optional().describe("Label color"),
      order: z.number().optional().describe("Label order"),
      is_favorite: z.boolean().optional().describe("Whether label is a favorite"),
    })).describe("Array of labels to create"),
  },
  async (params) => {
    const results = [];
    for (const l of params.labels) {
      results.push(await api.createLabel(l));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "add-projects",
  "Add one or more projects.",
  {
    projects: z.array(z.object({
      name: z.string().describe("Project name"),
      parent_id: z.string().optional().describe("Parent project ID (for sub-projects)"),
      color: z.string().optional().describe("Project color"),
      is_favorite: z.boolean().optional().describe("Whether project is a favorite"),
      view_style: z.enum(["list", "board"]).optional().describe("View style"),
    })).describe("Array of projects to create"),
  },
  async (params) => {
    const results = [];
    for (const p of params.projects) {
      results.push(await api.createProject(p));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "add-reminders",
  "Add reminders to tasks.",
  {
    reminders: z.array(z.object({
      item_id: z.string().describe("Task ID to add reminder to"),
      type: z.enum(["relative", "absolute", "location"]).optional().describe("Reminder type"),
      due: z.object({
        date: z.string().optional().describe("Due date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"),
        timezone: z.string().optional().describe("Timezone"),
        string: z.string().optional().describe("Natural language due string"),
        lang: z.string().optional().describe("Language for due string"),
      }).optional().describe("Due specification for absolute reminders"),
      minute_offset: z.number().optional().describe("Minutes before due date for relative reminders"),
    })).describe("Array of reminders to add"),
  },
  async (params) => {
    const commands = params.reminders.map((r) => ({
      type: "reminder_add",
      args: r,
    }));
    const result = await api.syncWriteCommands(commands);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "add-sections",
  "Add one or more sections to a project.",
  {
    sections: z.array(z.object({
      name: z.string().describe("Section name"),
      project_id: z.string().describe("Project ID to add section to"),
      order: z.number().optional().describe("Section order"),
    })).describe("Array of sections to create"),
  },
  async (params) => {
    const results = [];
    for (const s of params.sections) {
      results.push(await api.createSection(s));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "add-tasks",
  "Add one or more tasks.",
  {
    tasks: z.array(z.object({
      content: z.string().describe("Task title/content"),
      description: z.string().optional().describe("Task description"),
      project_id: z.string().optional().describe("Project ID"),
      section_id: z.string().optional().describe("Section ID"),
      parent_id: z.string().optional().describe("Parent task ID (for subtasks)"),
      order: z.number().optional().describe("Task order"),
      labels: z.array(z.string()).optional().describe("Array of label names"),
      priority: z.number().optional().describe("Priority (1=normal, 2=medium, 3=high, 4=urgent)"),
      due_string: z.string().optional().describe("Natural language due date (e.g. 'tomorrow', 'every monday')"),
      due_date: z.string().optional().describe("Specific due date (YYYY-MM-DD)"),
      due_datetime: z.string().optional().describe("Specific due datetime (YYYY-MM-DDTHH:MM:SSZ)"),
      due_lang: z.string().optional().describe("Language for due_string"),
      assignee_id: z.string().optional().describe("User ID to assign the task to"),
      duration: z.number().optional().describe("Task duration amount"),
      duration_unit: z.enum(["minute", "day"]).optional().describe("Task duration unit"),
    })).describe("Array of tasks to create"),
  },
  async (params) => {
    const results = [];
    for (const t of params.tasks) {
      results.push(await api.createTask(t as Record<string, unknown>));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "analyze-project-health",
  "Run a health analysis on a project and return actionable insights.",
  {
    project_id: z.string().describe("Project ID to analyze"),
    include_suggestions: z.boolean().optional().describe("Include improvement suggestions (default true)"),
  },
  async (params) => {
    const [tasks, sections, project, completedData, activity] = await Promise.all([
      api.getTasks({ project_id: params.project_id }) as Promise<unknown[]>,
      api.getSections(params.project_id) as Promise<unknown[]>,
      api.getProject(params.project_id) as Promise<Record<string, unknown>>,
      api.getCompletedTasks({ project_id: params.project_id, limit: 100 }),
      api.getActivity({ parent_project_id: params.project_id, limit: 50 }),
    ]);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];

    let overdue = 0, dueToday = 0, noDue = 0, p1Count = 0, p2Count = 0;
    const staleTasks: unknown[] = [];

    for (const task of tasks) {
      const t = task as Record<string, unknown>;
      const due = t.due as Record<string, string> | null;
      if (!due) { noDue++; }
      else if (due.date < todayStr) { overdue++; }
      else if (due.date === todayStr) { dueToday++; }

      const priority = t.priority as number;
      if (priority === 4) p1Count++;
      if (priority === 3) p2Count++;

      if (!due && t.created_at && (t.created_at as string) < sevenDaysAgo) {
        staleTasks.push(task);
      }
    }

    const completed = completedData as Record<string, unknown>;
    const completedItems = (completed.items || []) as unknown[];

    const suggestions: string[] = [];
    if (params.include_suggestions !== false) {
      if (overdue > 0) suggestions.push(`${overdue} overdue tasks need attention — reschedule or complete them.`);
      if (noDue > tasks.length * 0.5) suggestions.push("Over half your tasks have no due date. Consider adding dates to improve planning.");
      if (staleTasks.length > 0) suggestions.push(`${staleTasks.length} tasks are over a week old with no due date — review and prioritize or archive.`);
      if (completedItems.length === 0) suggestions.push("No recently completed tasks — the project may be stalled.");
      if (p1Count > 3) suggestions.push("Many urgent (p1) tasks — consider if all truly need urgent priority.");
    }

    const analysis = {
      project: { name: project.name, id: project.id },
      active_tasks: tasks.length,
      sections: sections.length,
      recently_completed: completedItems.length,
      metrics: { overdue, due_today: dueToday, no_due_date: noDue, p1_urgent: p1Count, p2_high: p2Count, stale_tasks: staleTasks.length },
      health_score: overdue === 0 && staleTasks.length < 3 ? "healthy" : overdue > tasks.length * 0.3 ? "critical" : "needs_attention",
      suggestions,
      activity_summary: activity,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(analysis, null, 2) }] };
  }
);

server.tool(
  "complete-tasks",
  "Mark one or more tasks as complete.",
  {
    ids: z.array(z.string()).describe("Array of task IDs to complete"),
  },
  async (params) => {
    const results = [];
    for (const id of params.ids) {
      results.push(await api.closeTask(id));
    }
    return { content: [{ type: "text" as const, text: `Completed ${params.ids.length} task(s).` }] };
  }
);

server.tool(
  "delete-object",
  "Delete a Todoist object (task, project, section, comment, label).",
  {
    object_type: z.enum(["task", "project", "section", "comment", "label"]).describe("Type of object to delete"),
    id: z.string().describe("Object ID to delete"),
  },
  async (params) => {
    switch (params.object_type) {
      case "task": await api.deleteTask(params.id); break;
      case "project": await api.deleteProject(params.id); break;
      case "section": await api.deleteSection(params.id); break;
      case "comment": await api.deleteComment(params.id); break;
      case "label": await api.deleteLabel(params.id); break;
    }
    return { content: [{ type: "text" as const, text: `Deleted ${params.object_type} ${params.id}.` }] };
  }
);

server.tool(
  "manage-assignments",
  "Assign or unassign tasks to collaborators in shared projects.",
  {
    assignments: z.array(z.object({
      task_id: z.string().describe("Task ID to assign"),
      assignee_id: z.string().nullable().describe("User ID to assign to, or null to unassign"),
    })).describe("Array of assignment changes"),
  },
  async (params) => {
    const results = [];
    for (const a of params.assignments) {
      const data: Record<string, unknown> = {};
      if (a.assignee_id) {
        data.assignee_id = a.assignee_id;
      } else {
        data.assignee_id = null;
      }
      results.push(await api.updateTask(a.task_id, data));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "project-management",
  "Perform bulk project management operations: archive, unarchive, or update multiple projects.",
  {
    operations: z.array(z.object({
      project_id: z.string().describe("Project ID"),
      action: z.enum(["archive", "unarchive", "update", "delete"]).describe("Action to perform"),
      data: z.record(z.unknown()).optional().describe("Update data (for 'update' action)"),
    })).describe("Array of project operations"),
  },
  async (params) => {
    const results = [];
    for (const op of params.operations) {
      switch (op.action) {
        case "archive":
          results.push(await api.syncWriteCommands([{ type: "project_archive", args: { id: op.project_id } }]));
          break;
        case "unarchive":
          results.push(await api.syncWriteCommands([{ type: "project_unarchive", args: { id: op.project_id } }]));
          break;
        case "update":
          results.push(await api.updateProject(op.project_id, op.data || {}));
          break;
        case "delete":
          results.push(await api.deleteProject(op.project_id));
          break;
      }
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "project-move",
  "Move a project to become a child of another project or to the root level.",
  {
    project_id: z.string().describe("Project ID to move"),
    parent_id: z.string().nullable().optional().describe("New parent project ID, or null to move to root"),
  },
  async (params) => {
    const commands = [{
      type: "project_move",
      args: {
        id: params.project_id,
        parent_id: params.parent_id || null,
      },
    }];
    const result = await api.syncWriteCommands(commands);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "reorder-objects",
  "Reorder tasks, projects, or sections.",
  {
    object_type: z.enum(["task", "project", "section"]).describe("Type of objects to reorder"),
    items: z.array(z.object({
      id: z.string().describe("Object ID"),
      child_order: z.number().describe("New order position"),
    })).describe("Array of items with their new order"),
  },
  async (params) => {
    const typeMap: Record<string, string> = {
      task: "item_reorder",
      project: "project_reorder",
      section: "section_reorder",
    };
    const commands = [{
      type: typeMap[params.object_type],
      args: {
        items: params.items,
      },
    }];
    const result = await api.syncWriteCommands(commands);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "reschedule-tasks",
  "Reschedule one or more tasks with new due dates.",
  {
    tasks: z.array(z.object({
      id: z.string().describe("Task ID"),
      due_string: z.string().optional().describe("Natural language due date"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      due_datetime: z.string().optional().describe("Due datetime (YYYY-MM-DDTHH:MM:SSZ)"),
    })).describe("Array of tasks to reschedule"),
  },
  async (params) => {
    const results = [];
    for (const t of params.tasks) {
      const data: Record<string, unknown> = {};
      if (t.due_string) data.due_string = t.due_string;
      if (t.due_date) data.due_date = t.due_date;
      if (t.due_datetime) data.due_datetime = t.due_datetime;
      results.push(await api.updateTask(t.id, data));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "uncomplete-tasks",
  "Reopen one or more completed tasks.",
  {
    ids: z.array(z.string()).describe("Array of task IDs to reopen"),
  },
  async (params) => {
    const results = [];
    for (const id of params.ids) {
      results.push(await api.reopenTask(id));
    }
    return { content: [{ type: "text" as const, text: `Reopened ${params.ids.length} task(s).` }] };
  }
);

server.tool(
  "update-comments",
  "Update one or more existing comments.",
  {
    comments: z.array(z.object({
      id: z.string().describe("Comment ID to update"),
      content: z.string().describe("New comment content"),
    })).describe("Array of comments to update"),
  },
  async (params) => {
    const results = [];
    for (const c of params.comments) {
      results.push(await api.updateComment(c.id, { content: c.content }));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "update-filters",
  "Update one or more custom filters.",
  {
    filters: z.array(z.object({
      id: z.string().describe("Filter ID to update"),
      name: z.string().optional().describe("New filter name"),
      query: z.string().optional().describe("New filter query"),
      color: z.string().optional().describe("New filter color"),
      is_favorite: z.boolean().optional().describe("Favorite status"),
    })).describe("Array of filters to update"),
  },
  async (params) => {
    const commands = params.filters.map((f) => ({
      type: "filter_update",
      args: {
        id: f.id,
        ...(f.name && { name: f.name }),
        ...(f.query && { query: f.query }),
        ...(f.color && { color: f.color }),
        ...(f.is_favorite !== undefined && { is_favorite: f.is_favorite }),
      },
    }));
    const result = await api.syncWriteCommands(commands);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "update-projects",
  "Update one or more projects.",
  {
    projects: z.array(z.object({
      id: z.string().describe("Project ID to update"),
      name: z.string().optional().describe("New project name"),
      color: z.string().optional().describe("New project color"),
      is_favorite: z.boolean().optional().describe("Favorite status"),
      view_style: z.enum(["list", "board"]).optional().describe("View style"),
    })).describe("Array of projects to update"),
  },
  async (params) => {
    const results = [];
    for (const p of params.projects) {
      const { id, ...data } = p;
      results.push(await api.updateProject(id, data));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "update-reminders",
  "Update one or more reminders.",
  {
    reminders: z.array(z.object({
      id: z.string().describe("Reminder ID to update"),
      due: z.object({
        date: z.string().optional().describe("Due date"),
        timezone: z.string().optional().describe("Timezone"),
        string: z.string().optional().describe("Natural language due string"),
      }).optional().describe("New due specification"),
      minute_offset: z.number().optional().describe("New minute offset for relative reminders"),
    })).describe("Array of reminders to update"),
  },
  async (params) => {
    const commands = params.reminders.map((r) => ({
      type: "reminder_update",
      args: r,
    }));
    const result = await api.syncWriteCommands(commands);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "update-sections",
  "Update one or more sections.",
  {
    sections: z.array(z.object({
      id: z.string().describe("Section ID to update"),
      name: z.string().optional().describe("New section name"),
    })).describe("Array of sections to update"),
  },
  async (params) => {
    const results = [];
    for (const s of params.sections) {
      const { id, ...data } = s;
      results.push(await api.updateSection(id, data));
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  "update-tasks",
  "Update one or more tasks.",
  {
    tasks: z.array(z.object({
      id: z.string().describe("Task ID to update"),
      content: z.string().optional().describe("New task title"),
      description: z.string().optional().describe("New description"),
      labels: z.array(z.string()).optional().describe("New label names"),
      priority: z.number().optional().describe("New priority (1-4)"),
      due_string: z.string().optional().describe("Natural language due date"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      due_datetime: z.string().optional().describe("Due datetime (YYYY-MM-DDTHH:MM:SSZ)"),
      assignee_id: z.string().optional().describe("User ID to assign to"),
      section_id: z.string().optional().describe("Move task to this section"),
      parent_id: z.string().optional().describe("New parent task ID"),
      order: z.number().optional().describe("Task order"),
      duration: z.number().optional().describe("Duration amount"),
      duration_unit: z.enum(["minute", "day"]).optional().describe("Duration unit"),
    })).describe("Array of tasks to update"),
  },
  async (params) => {
    const results = [];
    for (const t of params.tasks) {
      const { id, ...data } = t;
      // section_id and parent_id need the sync API for moving
      if (data.section_id || data.parent_id !== undefined) {
        // Use sync API for move operations
        const moveArgs: Record<string, unknown> = { id };
        if (data.section_id) moveArgs.section_id = data.section_id;
        if (data.parent_id !== undefined) moveArgs.parent_id = data.parent_id;
        await api.syncWriteCommands([{ type: "item_move", args: moveArgs }]);

        // Then update remaining fields via REST if any
        const restData = { ...data };
        delete restData.section_id;
        delete restData.parent_id;
        if (Object.keys(restData).length > 0) {
          results.push(await api.updateTask(id, restData as Record<string, unknown>));
        } else {
          results.push(await api.getTask(id));
        }
      } else {
        results.push(await api.updateTask(id, data as Record<string, unknown>));
      }
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }
);

// ─── Start server ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
