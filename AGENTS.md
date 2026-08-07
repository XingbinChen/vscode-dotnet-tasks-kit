# AGENTS.md

Guidance for AI coding agents working in this repository. The reader is assumed to know nothing about the project.

## Project overview

**.NET Tasks Kit** (`vscode-dotnet-tasks-kit`, publisher `XingbinChen`, MIT license) is a VS Code extension that generates `dotnet build` and `dotnet publish` tasks in a workspace's `.vscode/tasks.json` through a guided webview form, instead of making users hand-write task JSON.

Key behavior:

- Contributes two commands — `.NET Tasks: Create Publish Task` (`dotnetTasksKit.createPublishTask`) and `.NET Tasks: Create Build Task` (`dotnetTasksKit.createBuildTask`) — available from the Command Palette and from an Explorer context submenu shown on `.csproj` / `.fsproj` files.
- Scans the workspace for `.csproj` / `.fsproj` files and extracts project metadata (target frameworks, runtime identifiers, platforms, configurations, publish profiles) to pre-fill the form.
- The webview form applies deployment-mode/runtime rules and generates a default output path following common .NET conventions (`bin/<Configuration>/<Framework>/publish/...`).
- On submit, a `shell` task invoking `dotnet` with the selected arguments is appended to `.vscode/tasks.json`, preserving existing file content and comments.
- A `.NET Tasks` activity bar container hosts a tree view (`dotnetTasksKit.tasksView`) listing all `dotnet publish`/`dotnet build` tasks found in the workspace's tasks.json files (detected heuristically: `command` is `dotnet` and `args[0]` is `publish`/`build` — there is no marker property). Each item has inline **run** and **edit** buttons; the view refreshes automatically via a `**/.vscode/tasks.json` file watcher.
- Editing reuses the same webview form: `TaskParser` reverse-parses the task's args back into form params (arguments the form cannot represent, e.g. `--os` or custom `-p:` properties, are preserved as `extraArgs` and re-appended on save), and `TasksFileService.updateTaskInTasksJson` surgically updates only `label`/`args`/`options.cwd`, leaving other tasks, comments, and fields untouched. There is no delete workflow yet.

## Tech stack

- **Language**: TypeScript 5.9, strict mode (`strict: true`), target ES2022.
- **Extension host code**: `module`/`moduleResolution` Node16, runs on the VS Code extension host (`engines.vscode: ^1.85.0`).
- **Bundler**: esbuild (`esbuild.mjs`), producing two bundles:
  - `dist/extension.js` — CJS, `platform: 'node'`, entry `src/extension.ts`. `vscode` and `jsonc-parser` are **external**; `jsonc-parser` is therefore loaded from `node_modules` at runtime, which is why `.vscodeignore` does **not** exclude `node_modules` (only `node_modules/**/.cache`).
  - `dist/webview/main.js` — IIFE, `platform: 'browser'`, entry `src/webview/html/main.ts`. This bundle includes the `@vscode-elements/elements` web components used by the form UI.
- **Runtime dependency**: `jsonc-parser` (the only one) — used for non-destructive edits to `tasks.json`.
- **Testing**: Mocha (TDD interface: `suite`/`test`) run inside a real VS Code Extension Host via `@vscode/test-cli`.
- **Linting**: ESLint 8 with the legacy `.eslintrc.json` format plus `@typescript-eslint`.

## Repository layout

```
src/
  extension.ts               Activation + command registration; orchestrates task creation
  models/
    taskDefinition.ts        DotnetCommand enum, PublishTaskParams/BuildTaskParams,
                             VscodeTask/TasksFile types mirroring the VS Code tasks.json schema
    dotnetParameters.ts      ParameterMeta model, static option catalogs (frameworks, RIDs,
                             architectures...), PUBLISH_PARAMETERS / BUILD_PARAMETERS
                             (tiered 1-3, grouped), PARAMETER_CONSTRAINTS rules
    messageProtocol.ts       ExtensionMessage / WebviewMessage union types shared between
                             extension and webview; ProjectProfile, PublishProfile
  services/
    projectScanner.ts        Workspace scan for .csproj/.fsproj; regex-based XML metadata
                             extraction; Directory.Build.props walk-up; .pubxml parsing
    taskGenerator.ts         Static TaskGenerator: builds VscodeTask args, default labels,
                             validateConstraints()
    taskParser.ts            Static TaskParser: reverse-parses a tasks.json task back into
                             form params (getDotnetCommand filter, parse, extraArgs
                             preservation); no vscode import, unit-testable
    tasksFileService.ts      Reads/writes .vscode/tasks.json via jsonc-parser edits
                             (addTaskToTasksJson, getTasks, updateTaskInTasksJson)
  views/
    tasksTreeProvider.ts     TreeDataProvider for the .NET Tasks activity bar view;
                             DotnetTaskItem carries folder + task index for run/edit
  webview/
    TaskPanel.ts             Singleton WebviewPanel manager; init-data assembly; message
                             handling; edit mode via EditTaskContext
    html/main.ts             Webview UI (vanilla DOM + vscode-elements, no framework)
    html/tsconfig.json       Separate tsconfig for webview code (ESNext/Bundler, DOM lib)
  test/suite/                Mocha tests (run in Extension Host)
esbuild.mjs                  Build script (both bundles; --production / --watch flags)
.vscode-test.mjs             vscode-test config: runs out/test/**/*.test.js
images/activity-bar.svg      Icon of the .NET Tasks activity bar container
dist/                        Build output (gitignored)
out/                         tsc output used only for tests (gitignored)
```

### Architecture / data flow

1. A contributed command calls `TaskPanel.createOrShow(extensionUri, DotnetCommand, uri?)` (`src/extension.ts`).
2. The webview posts `requestProjects`; `TaskPanel` answers with an `init` message built from `scanProjectsWithMetadata()` plus the parameter metadata (`PUBLISH_PARAMETERS` or `BUILD_PARAMETERS`).
3. The user fills the form; the webview posts `submit` with `PublishTaskParams | BuildTaskParams`.
4. `TaskPanel` forwards this by executing the internal command `dotnetTasksKit.internal.onTaskSubmit` (registered in `extension.ts`, **not** declared in `package.json`). That handler:
   - resolves the owning workspace folder (multi-root aware, falls back to the first folder),
   - rewrites the project path to a bare filename and computes the project directory relative to the workspace root,
   - calls `TaskGenerator.generatePublishTask` / `generateBuildTask`,
   - calls `TasksFileService.addTaskToTasksJson`.

Edit flow (the `dotnetTasksKit.editTask` command, triggered from the tree view item):

1. `TaskParser.parse(task, folder)` reverse-parses args into params; `TaskPanel.createOrShow(..., editContext)` opens the form with `existingParams` in the `init` message so the webview pre-fills (and shows "Edit"/"Save Changes" instead of "Create").
2. On submit, `onTaskSubmit` receives the `EditTaskContext` (folder, task index, original label) as a third argument: it regenerates args via `TaskGenerator`, re-parses the current task at that index to re-append its `extraArgs`, then calls `TasksFileService.updateTaskInTasksJson`.
3. The update verifies the task at `taskIndex` still carries `originalLabel` (guard against concurrent manual edits) and modifies only `label`, `args`, and `options.cwd` in place.

The run button (`dotnetTasksKit.runTask`) delegates to the built-in `workbench.action.tasks.runTask` command with the task label.
5. Generated tasks use `type: 'shell'`, `command: 'dotnet'`, `problemMatcher: '$msCompile'`, and `options.cwd: ${workspaceFolder}/<relativeProjectDir>` with forward slashes. Build tasks get `group: { kind: 'build', isDefault: true }`; publish tasks get `group: 'build'`.

### Parameter model conventions

`dotnetParameters.ts` is the single source of truth for CLI options. Each `ParameterMeta` has a `tier` (1 = common, 2 = advanced, 3 = niche) and a `group` (`Basic`, `Deployment`, `Advanced`) that drive UI organization. `PARAMETER_CONSTRAINTS` documents cross-parameter rules (e.g. `--self-contained` requires runtime/arch/os; arch and os are mutually exclusive with runtime; `noBuild` implies `noRestore`; single-file/trimmed require self-contained; AOT needs net8.0+). Some rules are enforced in the webview UI (deployment mode logic in `main.ts`), and `TaskGenerator.validateConstraints()` validates publish params server-side (covered by tests).

## Build and development commands

Prerequisites: Node.js 18+ and VS Code 1.85+. Setup: `npm install`.

| Command | Effect |
| --- | --- |
| `npm run compile` | Type-check (`tsc --noEmit`) + lint + esbuild to `dist/` (with sourcemaps) |
| `npm run watch` | Same as compile, then esbuild watch mode |
| `npm run package` | Type-check + lint + esbuild `--production` (minified, no sourcemaps) |
| `npm run check-types` | `tsc --noEmit -p ./` only |
| `npm run lint` | `eslint src --ext ts` |
| `npm test` | `vscode-test` (see Testing below) |

Debug loop: press **F5** in VS Code — the `Run Extension` launch config starts an Extension Development Host with the repo as the extension under development. Its `preLaunchTask` is the default build task, which runs `npm run watch` (see `.vscode/tasks.json`).

Verified: `npm run compile` passes cleanly on the current tree.

## Testing instructions

- Test files live in `src/test/suite/*.test.ts` and use Mocha's **TDD** interface (`suite(...)` / `test(...)`), 20 s timeout, with Node's `assert`.
- Tests are designed to execute inside a VS Code Extension Host via `@vscode/test-cli` (`npm test`, config in `.vscode-test.mjs`). The first successful run downloads a VS Code build into `.vscode-test/`, so it needs network access and takes a while.
- **Broken right now**: `@vscode/test-cli` is not declared in `package.json`, not in `package-lock.json`, and not installed in `node_modules`, so `npm test` currently fails with `vscode-test: command not found` after `pretest` compiles. To make the suite runnable, add `@vscode/test-cli` as a devDependency (`npm install -D @vscode/test-cli`).
- **Important gotcha**: tests are loaded from `out/test/**/*.test.js`, but the npm `compile`/`pretest` pipeline uses `tsc --noEmit` and esbuild (which writes to `dist/`, not `out/`). Nothing in the npm scripts emits `out/`. On a fresh checkout you must run `npx tsc -p ./` (which honors `outDir: ./out`) before `npm test`, or the test runner finds no tests.
- `src/test/suite/extension.test.ts` is a placeholder sample; the meaningful coverage is `taskGenerator.test.ts` (arg generation, MSBuild properties, default labels, constraint validation) and `taskParser.test.ts` (round-trip parse of generated tasks, `--flag=value` syntax, boolean flag values, quoted-arg objects, `extraArgs` preservation, unsupported-cwd rejection). Add tests there for task-generation/parsing logic; UI/webview code is currently untested.
- Both suites are pure (no `vscode` import), so they can also run directly without the Extension Host: `npx tsc -p ./ && npx mocha --ui tdd out/test/suite/taskParser.test.js out/test/suite/taskGenerator.test.js`.

## Code style guidelines

- All source, comments, commit messages, and docs are in **English**. Match that.
- TypeScript strict mode is on; `tsc --noEmit` and ESLint must both pass (they run as part of `compile`, `watch`, and `package`).
- ESLint rules (all at `warn` level): `@typescript-eslint/naming-convention`, `curly`, `eqeqeq`, `no-throw-literal`, and `semi: always`. Always terminate statements with semicolons, use `===`/`!==`, and always use braces on control statements.
- Indentation is inconsistent historically: `src/extension.ts` uses 2 spaces, while most other files use **tabs**. Follow the convention of the file you are editing.
- The repo's VS Code settings enable `formatOnSave` and `source.fixAll.eslint` on save, and point the editor at the workspace TypeScript (`node_modules/typescript/lib`).
- Naming: services are exported static classes (`TaskGenerator`, `TasksFileService`) or plain async functions (`scanProjects`); the webview panel follows the VS Code `XxxPanel` singleton pattern; interfaces use PascalCase.
- Keep edits minimal and match surrounding style; do not reformat unrelated code.

## Security considerations

- The extension's only write target is `.vscode/tasks.json` inside the user's workspace folder (it creates the `.vscode` directory if missing). It never writes outside the workspace.
- `TasksFileService` uses `jsonc-parser` to apply surgical edits, so existing tasks and comments are preserved. If the existing `tasks.json` fails to parse, it throws instead of overwriting — keep that fail-safe behavior.
- The webview HTML sets a per-load **nonce** on the `<script>` tag, restricts `localResourceRoots` to the extension URI, and loads only the bundled `dist/webview/main.js`. Preserve the nonce and do not inject unsanitized strings into the HTML.
- Project metadata is parsed from `.csproj`/`.pubxml` files with simple regexes (`firstTagValue`), not a full XML parser — fine for well-formed SDK-style files, but don't feed it assumptions beyond first-match tag extraction.
- No secrets, telemetry, or network calls exist in the extension code.

## Packaging and release

- `npm run package` produces the minified `dist/` used for publishing. `vscode:prepublish` hooks this automatically for `vsce`.
- `@vscode/vsce` is a devDependency but there is no npm script for it; run `npx vsce package` (builds a `.vsix`, gitignored) or `npx vsce publish`.
- `.vscodeignore` excludes `src/`, `out/`, config files, `.git`/`.github`/`.vscode`/`.sisyphus`, and `node_modules/**/.cache` — everything else (including `node_modules/jsonc-parser` and `dist/`) ships in the package.
- There is **no CI/CD configuration** in the repo (no `.github/` directory); validation is local only: `npm run compile` + `npm test`.
