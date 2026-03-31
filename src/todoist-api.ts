const API_BASE = "https://api.todoist.com/api/v1";

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

  // ─── Helper: unwrap paginated results ───
  // New API v1 returns { results: [...], next_cursor: ... }
  // This fetches all pages and returns the flat array.
  private async getAllResults(url: string, params?: Record<string, string>): Promise<unknown[]> {
    const allResults: unknown[] = [];
    let cursor: string | null = null;

    do {
      const qs = new URLSearchParams(params || {});
      if (cursor) qs.set("cursor", cursor);
      const qsStr = qs.toString();
      const fullUrl = qsStr ? `${url}?${qsStr}` : url;

      const data = (await this.request(fullUrl)) as Record<string, unknown>;
      const results = data.results as unknown[] | undefined;
      if (results) {
        allResults.push(...results);
      }
      cursor = (data.next_cursor as string) || null;
    } while (cursor);

    return allResults;
  }

  // ─── Tasks ───

  async getTasks(params?: Record<string, string>): Promise<unknown[]> {
    return this.getAllResults(`${API_BASE}/tasks`, params);
  }

  async getTask(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/tasks/${id}`);
  }

  async createTask(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/tasks/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async moveTask(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/tasks/${id}/move`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async closeTask(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/tasks/${id}/close`, { method: "POST" });
  }

  async reopenTask(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/tasks/${id}/reopen`, { method: "POST" });
  }

  async deleteTask(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
  }

  async getCompletedTasks(params?: Record<string, string>): Promise<unknown> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`${API_BASE}/tasks/completed${qs}`);
  }

  async getCompletedStats(): Promise<unknown> {
    return this.request(`${API_BASE}/tasks/completed/stats`);
  }

  // ─── Projects ───

  async getProjects(): Promise<unknown[]> {
    return this.getAllResults(`${API_BASE}/projects`);
  }

  async getProject(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/projects/${id}`);
  }

  async createProject(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/projects/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/projects/${id}`, { method: "DELETE" });
  }

  async getProjectCollaborators(projectId: string): Promise<unknown[]> {
    return this.getAllResults(`${API_BASE}/projects/${projectId}/collaborators`);
  }

  // ─── Sections ───

  async getSections(projectId?: string): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (projectId) params.project_id = projectId;
    return this.getAllResults(`${API_BASE}/sections`, params);
  }

  async getSection(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/sections/${id}`);
  }

  async createSection(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/sections`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSection(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/sections/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteSection(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/sections/${id}`, { method: "DELETE" });
  }

  // ─── Comments ───

  async getComments(params: Record<string, string>): Promise<unknown[]> {
    return this.getAllResults(`${API_BASE}/comments`, params);
  }

  async getComment(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/comments/${id}`);
  }

  async createComment(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateComment(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/comments/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteComment(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/comments/${id}`, { method: "DELETE" });
  }

  // ─── Labels ───

  async getLabels(): Promise<unknown[]> {
    return this.getAllResults(`${API_BASE}/labels`);
  }

  async getLabel(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/labels/${id}`);
  }

  async createLabel(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/labels`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateLabel(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/labels/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteLabel(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/labels/${id}`, { method: "DELETE" });
  }

  async getSharedLabels(): Promise<unknown[]> {
    return this.getAllResults(`${API_BASE}/labels/shared`);
  }

  // ─── Reminders ───

  async getReminders(): Promise<unknown[]> {
    return this.getAllResults(`${API_BASE}/reminders`);
  }

  async getReminder(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/reminders/${id}`);
  }

  async createReminder(data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/reminders`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateReminder(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`${API_BASE}/reminders/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteReminder(id: string): Promise<unknown> {
    return this.request(`${API_BASE}/reminders/${id}`, { method: "DELETE" });
  }

  // ─── User ───

  async getUserInfo(): Promise<unknown> {
    return this.request(`${API_BASE}/user`);
  }

  // ─── Generic fetch ───

  async fetchUrl(url: string, method = "GET", body?: unknown): Promise<unknown> {
    const opts: RequestInit = { method };
    if (body) opts.body = JSON.stringify(body);
    return this.request(url, opts);
  }
}
