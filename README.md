# Todoist MCP Server

A Model Context Protocol (MCP) server for the Todoist API v1. Provides 44 tools with read-only/write annotations so Claude Desktop groups them correctly.

## Setup

```bash
npm install
npm run build
```

Create a `.env` file:
```
TODOIST_API_TOKEN=your_todoist_api_token_here
```

Get your API token from: https://app.todoist.com/app/settings/integrations/developer

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/path/to/todoist-mcp-server/dist/index.js"],
      "env": {
        "TODOIST_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Tools (44 total)

### Read-only (22)

| Tool | Description |
|------|-------------|
| `find-tasks-by-date` | Find tasks by due date range |
| `fetch` | Fetch any Todoist API URL directly |
| `fetch-object` | Get a specific object by type and ID |
| `find-activity` | Recent activity (completed tasks) |
| `find-comments` | Comments on tasks or projects |
| `find-completed-tasks` | Completed tasks with date filtering |
| `find-filters` | User-defined filters (guidance — managed via app) |
| `find-labels` | Personal labels |
| `find-project-collaborators` | Project collaborators |
| `find-projects` | All projects |
| `find-reminders` | All reminders |
| `find-sections` | Sections (optionally by project) |
| `find-tasks` | Active tasks with filtering |
| `get-overview` | Workspace overview with task counts |
| `get-productivity-stats` | Karma, streaks, daily/weekly trends |
| `get-project-activity-stats` | Completed tasks for a project |
| `get-project-health` | Project health analysis |
| `get-workspace-insights` | Cross-workspace analytics |
| `list-workspaces` | User account and workspace info |
| `search` | Search tasks by content, description, or label |
| `user-info` | Authenticated user details |
| `view-attachment` | View comment attachments |
| `analyze-project-health` | Deep project health analysis with suggestions |

### Write (19)

| Tool | Description |
|------|-------------|
| `add-comments` | Add comments to tasks/projects |
| `add-filters` | Create filters (guidance — managed via app) |
| `add-labels` | Create personal labels |
| `add-projects` | Create projects |
| `add-reminders` | Add task reminders (requires Pro) |
| `add-sections` | Create project sections |
| `add-tasks` | Create tasks with subtasks, labels, priorities, due dates |
| `complete-tasks` | Mark tasks complete |
| `manage-assignments` | Assign/unassign tasks in shared projects |
| `project-management` | Bulk project update/delete |
| `project-move` | Reposition a project by order |
| `reorder-objects` | Reorder tasks, projects, or sections |
| `reschedule-tasks` | Bulk reschedule task due dates |
| `uncomplete-tasks` | Reopen completed tasks |
| `update-comments` | Update comment content |
| `update-filters` | Update filters (guidance — managed via app) |
| `update-projects` | Update project properties |
| `update-reminders` | Update reminder settings |
| `update-sections` | Update section names |
| `update-tasks` | Update tasks (including move between sections/projects) |

### Destructive (1)

| Tool | Description |
|------|-------------|
| `delete-object` | Delete any object (task, project, section, comment, label) |

## API Coverage

Uses the **Todoist API v1** (`https://api.todoist.com/api/v1/`). Handles paginated responses automatically.

| Resource | Read | Create | Update | Delete | Move |
|----------|------|--------|--------|--------|------|
| Tasks | Yes | Yes | Yes | Yes | Yes |
| Projects | Yes | Yes | Yes | Yes | Yes (reorder) |
| Sections | Yes | Yes | Yes | Yes | — |
| Comments | Yes | Yes | Yes | Yes | — |
| Labels | Yes | Yes | Yes | Yes | — |
| Reminders | Yes | Yes | Yes | — | — |
| Completed tasks | Yes | — | — | — | — |
| Productivity stats | Yes | — | — | — | — |
| User info | Yes | — | — | — | — |
| Collaborators | Yes | — | — | — | — |

## Notes

- **Filters**: The Todoist API v1 does not expose filter CRUD. The `add-filters`/`update-filters` tools return guidance to use the Todoist app. Use `find-tasks` with parameters for filter-like behavior.
- **Reminders**: Require Todoist Pro plan. The tools work correctly but will return HTTP 403 on free accounts.
- **Tool annotations**: All tools include `readOnlyHint`/`destructiveHint` so Claude Desktop groups them into read-only, write, and destructive categories.
