import crypto from "node:crypto";

const REST_BASE = "https://api.todoist.com/rest/v2";
const SYNC_BASE = "https://api.todoist.com/sync/v9";

export class TodoistAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request(
    url: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      ...((options.headers as Record<string, string>) || {}),
    };
    if (options.body && typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 204) return { success: true };

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Todoist API error ${res.status}: ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // ─── REST API v2 ───

  // Tasks
  async getTasks(params?: Record<string, string>): Promise<unknown> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`${REST_BASE}/tasks${qs}`);
  }

  async getTask(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/tasks/${id}`);
  }

  async createTask(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${REST_BASE}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(
    id: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`${REST_BASE}/tasks/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async closeTask(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/tasks/${id}/close`, { method: "POST" });
  }

  async reopenTask(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/tasks/${id}/reopen`, { method: "POST" });
  }

  async deleteTask(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/tasks/${id}`, { method: "DELETE" });
  }

  // Projects
  async getProjects(): Promise<unknown> {
    return this.request(`${REST_BASE}/projects`);
  }

  async getProject(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/projects/${id}`);
  }

  async createProject(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${REST_BASE}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProject(
    id: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`${REST_BASE}/projects/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/projects/${id}`, { method: "DELETE" });
  }

  async getProjectCollaborators(projectId: string): Promise<unknown> {
    return this.request(
      `${REST_BASE}/projects/${projectId}/collaborators`
    );
  }

  // Sections
  async getSections(projectId?: string): Promise<unknown> {
    const qs = projectId ? `?project_id=${projectId}` : "";
    return this.request(`${REST_BASE}/sections${qs}`);
  }

  async getSection(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/sections/${id}`);
  }

  async createSection(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${REST_BASE}/sections`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSection(
    id: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`${REST_BASE}/sections/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteSection(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/sections/${id}`, { method: "DELETE" });
  }

  // Comments
  async getComments(params: Record<string, string>): Promise<unknown> {
    const qs = new URLSearchParams(params).toString();
    return this.request(`${REST_BASE}/comments?${qs}`);
  }

  async getComment(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/comments/${id}`);
  }

  async createComment(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${REST_BASE}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateComment(
    id: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`${REST_BASE}/comments/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteComment(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/comments/${id}`, { method: "DELETE" });
  }

  // Labels
  async getLabels(): Promise<unknown> {
    return this.request(`${REST_BASE}/labels`);
  }

  async getLabel(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/labels/${id}`);
  }

  async createLabel(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${REST_BASE}/labels`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateLabel(
    id: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`${REST_BASE}/labels/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteLabel(id: string): Promise<unknown> {
    return this.request(`${REST_BASE}/labels/${id}`, { method: "DELETE" });
  }

  async getSharedLabels(): Promise<unknown> {
    return this.request(`${REST_BASE}/labels/shared`);
  }

  // ─── Sync API v9 ───

  async sync(
    resourceTypes: string[],
    syncToken = "*"
  ): Promise<unknown> {
    return this.request(`${SYNC_BASE}/sync`, {
      method: "POST",
      body: JSON.stringify({
        sync_token: syncToken,
        resource_types: resourceTypes,
      }),
    });
  }

  async syncWriteCommands(
    commands: Array<Record<string, unknown>>
  ): Promise<unknown> {
    return this.request(`${SYNC_BASE}/sync`, {
      method: "POST",
      body: JSON.stringify({
        commands: commands.map((cmd) => ({
          ...cmd,
          uuid: crypto.randomUUID(),
          temp_id: crypto.randomUUID(),
        })),
      }),
    });
  }

  async getActivity(params?: Record<string, unknown>): Promise<unknown> {
    return this.request(`${SYNC_BASE}/activity/get`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  }

  async getCompletedTasks(
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return this.request(`${SYNC_BASE}/completed/get_all${qs}`);
  }

  async getProductivityStats(): Promise<unknown> {
    return this.request(`${SYNC_BASE}/completed/get_stats`);
  }

  // Generic fetch for any Todoist URL
  async fetchUrl(url: string, method = "GET", body?: unknown): Promise<unknown> {
    const opts: RequestInit = { method };
    if (body) opts.body = JSON.stringify(body);
    return this.request(url, opts);
  }
}
