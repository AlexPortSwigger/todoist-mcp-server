# Todoist MCP Server

A Model Context Protocol (MCP) server that provides full Todoist API access for Claude Desktop and other MCP clients. Implements 44 tools covering all Todoist operations.

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

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### Interactive (1)
| Tool | Description |
|------|-------------|
| `find-tasks-by-date` | Find tasks by due date range or filter |

### Read-only (21)
| Tool | Description |
|------|-------------|
| `fetch` | Fetch any Todoist API URL directly |
| `fetch-object` | Get a specific object by type and ID |
| `find-activity` | Activity log events |
| `find-comments` | Comments on tasks or projects |
| `find-completed-tasks` | Completed tasks with date filtering |
| `find-filters` | User-defined filters |
| `find-labels` | Personal labels |
| `find-project-collaborators` | Project collaborators |
| `find-projects` | All projects |
| `find-reminders` | All reminders |
| `find-sections` | Sections (optionally by project) |
| `find-tasks` | Active tasks with filtering |
| `get-overview` | Workspace overview with task counts |
| `get-productivity-stats` | Karma, streaks, daily/weekly trends |
| `get-project-activity-stats` | Activity for a specific project |
| `get-project-health` | Project health analysis |
| `get-workspace-insights` | Cross-workspace analytics |
| `list-workspaces` | Available workspaces |
| `search` | Search tasks using filter syntax |
| `user-info` | Authenticated user details |
| `view-attachment` | View comment attachments |

### Write/Delete (22)
| Tool | Description |
|------|-------------|
| `add-comments` | Add comments to tasks/projects |
| `add-filters` | Create custom filters |
| `add-labels` | Create personal labels |
| `add-projects` | Create projects |
| `add-reminders` | Add task reminders |
| `add-sections` | Create project sections |
| `add-tasks` | Create tasks (with subtasks, labels, priorities) |
| `analyze-project-health` | Deep project health analysis with suggestions |
| `complete-tasks` | Mark tasks complete |
| `delete-object` | Delete any object type |
| `manage-assignments` | Assign/unassign tasks |
| `project-management` | Bulk project operations |
| `project-move` | Move projects in hierarchy |
| `reorder-objects` | Reorder tasks, projects, or sections |
| `reschedule-tasks` | Bulk reschedule tasks |
| `uncomplete-tasks` | Reopen completed tasks |
| `update-comments` | Update comment content |
| `update-filters` | Update filter definitions |
| `update-projects` | Update project properties |
| `update-reminders` | Update reminder settings |
| `update-sections` | Update section names |
| `update-tasks` | Update tasks (including move between sections) |

## API Coverage

- **REST API v2**: Tasks, Projects, Sections, Comments, Labels (full CRUD)
- **Sync API v9**: Filters, Reminders, Activity logs, Completed tasks, Productivity stats, Reordering, Project archival
