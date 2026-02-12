# .NET Tasks Kit for VS Code

Create `.NET` build and publish tasks in `.vscode/tasks.json` with a guided UI.

## Why this extension

Writing `tasks.json` by hand is repetitive and easy to get wrong. This extension provides a project-aware form for `dotnet publish` and `dotnet build`, then generates valid VS Code tasks automatically.

## Features

- Generate `dotnet publish` tasks from a form UI
- Generate `dotnet build` tasks from a form UI
- Entry points in both:
  - Command Palette
  - Explorer context menu (`.csproj` / `.fsproj`)
- Project-aware options:
  - Frameworks from project file (`TargetFramework` / `TargetFrameworks`)
  - Runtime identifiers from project metadata
  - Platforms (for example `Any CPU`, `x64`)
  - Configurations from project or `Directory.Build.props`
  - Publish profiles from `Properties/PublishProfiles/*.pubxml`
- Deployment mode and runtime dependency rules in the UI
- Default output path generation aligned with common .NET conventions

## Commands

- `.NET Tasks: Create Publish Task`
- `.NET Tasks: Create Build Task`

## Generated task style

- Task type: `shell`
- Command: `dotnet`
- Arguments are generated from selected options
- Tasks are written to `.vscode/tasks.json`

## Quick start

1. Open a workspace containing a `.csproj` or `.fsproj`.
2. Run one of the commands from Command Palette, or right-click a project file.
3. Select options in the UI.
4. Click `Create Task`.
5. Open `.vscode/tasks.json` and run your task.

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.85+

### Setup

```bash
npm install
```

### Build

```bash
npm run compile
```

### Run extension in dev host

- Press `F5` in VS Code

### Test

```bash
npm test
```

## Project structure

- `src/extension.ts` - command registration and orchestration
- `src/webview/` - webview panel and UI logic
- `src/services/` - scanner, generator, tasks file operations
- `src/models/` - data models and message protocol

## Current scope

- Create tasks only (no edit/delete workflow yet)

## License

ISC
