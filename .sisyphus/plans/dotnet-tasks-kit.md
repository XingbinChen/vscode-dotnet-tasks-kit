# .NET Tasks Kit — VS Code Extension

## TL;DR

> **Quick Summary**: 从零搭建一个 VS Code 扩展，让用户通过 Webview 表单面板快速创建 `dotnet publish` 和 `dotnet build` task 并写入 `.vscode/tasks.json`。使用 `@vscode-elements/elements` 构建原生风格表单，支持 Command Palette 和右键菜单双入口。
> 
> **Deliverables**:
> - VS Code 扩展完整项目结构（TypeScript + esbuild）
> - 两个命令: Create Publish Task / Create Build Task
> - Webview 表单面板（@vscode-elements/elements 组件）
> - 自动扫描 .csproj/.fsproj 项目文件
> - tasks.json 读写服务（支持追加/覆盖/JSONC）
> - 自动化测试套件
> - 可打包的 .vsix 文件
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10

---

## Context

### Original Request
创建一个 VS Code 扩展，用于快速创建和管理 .NET 项目的 VS Code task。首要实现 publish task，触发后可选择 task 名称、项目、发布位置、配置、目标框架等参数，然后自动创建对应的 task 到 tasks.json。

### Interview Summary
**Key Discussions**:
- **交互入口**: Command Palette + Explorer 右键菜单（双入口）
- **命令范围**: dotnet publish + dotnet build（第一版）
- **参数选择 UI**: Webview 表单面板（一览式，@vscode-elements/elements）
- **Task 生成**: 直接写入 .vscode/tasks.json 文件
- **已有 tasks.json**: 让用户选择追加还是覆盖
- **项目检测**: 扫描 workspace 中的 .csproj/.fsproj 文件
- **Task 管理**: 第一版仅创建，不含编辑/删除
- **Task label**: 自动生成默认建议 + 用户可自定义覆盖
- **开发语言**: TypeScript
- **打包工具**: esbuild
- **测试**: 有自动化测试

### Research Findings
- **@vscode/webview-ui-toolkit 已停维**: 2025年1月归档，社区替代为 `@vscode-elements/elements` v2.5.0（Lit-based，425 stars）
- **VS Code Task API**: 使用 `ShellExecution` + `args` 数组格式，task type 为 `shell`
- **dotnet publish 参数**: 分三优先级共 20+ 参数，含参数依赖关系（self-contained→runtime, arch⊕runtime 互斥）
- **esbuild 双配置**: 扩展主机（Node）和 webview（browser）需要分开打包
- **tasks.json**: 支持 JSONC 格式（含注释），需用 `jsonc-parser` 解析
- **NPM 内置扩展**: 提供了 TaskProvider + FileSystemWatcher 的参考实现

### Metis Review
**Identified Gaps** (addressed):
- 🔴 Webview UI Toolkit 已停维 → 切换到 @vscode-elements/elements
- Task label 命名 → 自动生成默认值 + 用户可覆盖
- JSONC 解析 → 使用 jsonc-parser
- .vscode 目录可能不存在 → 自动创建
- Webview 并发打开 → 单例模式 panel.reveal()
- BOM 处理 → 自动 strip
- 重复 label 检测 → 警告用户

---

## Work Objectives

### Core Objective
创建一个完整的 VS Code 扩展，让 .NET 开发者通过 Webview 表单面板快速配置并生成 `dotnet publish` / `dotnet build` task 到 `.vscode/tasks.json`。

### Concrete Deliverables
- `package.json` — 扩展清单，含 commands、menus、activationEvents
- `src/extension.ts` — 扩展入口
- `src/commands/` — createPublishTask / createBuildTask 命令处理器
- `src/webview/TaskFormPanel.ts` — Webview 面板管理器（单例）
- `src/webview/html/` — Webview HTML/CSS/JS 资源
- `src/models/` — TypeScript 接口和参数定义
- `src/services/projectScanner.ts` — 项目文件扫描
- `src/services/taskGenerator.ts` — 表单数据 → task JSON 转换
- `src/services/tasksFileService.ts` — tasks.json 读写
- `src/test/` — 自动化测试
- `esbuild.mjs` — 双目标打包配置
- `.vsix` — 可安装的扩展包

### Definition of Done
- [ ] `npm run compile` — 零错误
- [ ] `npm run lint` — 零警告
- [ ] `npm test` — 全部通过
- [ ] `npx @vscode/vsce package --no-dependencies` — 成功生成 .vsix
- [ ] 安装 .vsix 后，Command Palette 可找到两个命令
- [ ] 右键 .csproj 文件可看到创建 task 的菜单项
- [ ] 填写表单后生成正确的 tasks.json 内容

### Must Have
- Command Palette 命令: `dotnetTasksKit.createPublishTask` / `dotnetTasksKit.createBuildTask`
- Explorer 右键菜单在 .csproj/.fsproj 文件上显示创建 task 选项
- Webview 表单面板展示所有可选参数（分优先级分组）
- 表单参数约束验证（self-contained 需要 runtime 等）
- 自动扫描 workspace 中的 .csproj/.fsproj 文件
- tasks.json 追加/覆盖选择
- 自动生成 task label 建议
- 生成的 task 使用 `args` 数组格式（非命令字符串拼接）

### Must NOT Have (Guardrails)
- ❌ 不使用 `@vscode/webview-ui-toolkit`（已停维）
- ❌ 不添加 task 编辑/删除功能（v1 仅创建）
- ❌ 不支持 dotnet run / test / watch / pack 等其他命令
- ❌ 不解析 .sln 文件
- ❌ 不使用 React/Vue 等前端框架
- ❌ 不添加扩展设置（configuration contribution point）
- ❌ 不添加遥测/崩溃分析
- ❌ 不动态查询 dotnet CLI 获取可用运行时/SDK
- ❌ 不验证参数值本身（只验证参数约束关系）
- ❌ 不添加 sidebar view、tree view、status bar item
- ❌ 不生成 launch.json、settings.json 或其他配置文件
- ❌ 不添加国际化 (i18n) 基础设施

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion MUST be verifiable by running a command or using a tool.

### Test Decision
- **Infrastructure exists**: NO (greenfield project)
- **Automated tests**: YES (Tests-after — 先实现核心逻辑，再补测试)
- **Framework**: @vscode/test-cli + Mocha + assert
- **Test setup**: Task 2 包含测试基础设施搭建

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| **TypeScript 编译** | Bash (`npm run compile`) | 零错误退出码 |
| **ESLint** | Bash (`npm run lint`) | 零警告退出码 |
| **单元测试** | Bash (`npm test`) | 全部通过 |
| **扩展打包** | Bash (`npx @vscode/vsce package`) | 生成 .vsix 文件 |
| **扩展功能验证** | Playwright (playwright skill) | 在 VS Code 中操作验证 |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: 项目脚手架搭建 (package.json, tsconfig, esbuild, .gitignore)
└── Task 2: 测试基础设施搭建 (@vscode/test-cli + Mocha)

Wave 2 (After Wave 1):
├── Task 3: 数据模型和参数定义 (models/)
├── Task 4: 项目文件扫描器 (projectScanner)
└── (Task 3 & 4 can run in parallel)

Wave 3 (After Wave 2):
├── Task 5: Task JSON 生成器 (taskGenerator) [depends: 3]
├── Task 6: tasks.json 文件服务 (tasksFileService) [depends: 3]
└── (Task 5 & 6 can run in parallel)

Wave 4 (After Wave 3):
├── Task 7: Webview 面板管理器 (TaskFormPanel) [depends: 3]
└── Task 8: Webview HTML/CSS/JS 表单 [depends: 3, 7]

Wave 5 (After Wave 4):
├── Task 9: 命令处理器和扩展入口 [depends: 4, 5, 6, 7, 8]
└── Task 10: 单元测试和集成验证 [depends: all]

Critical Path: 1 → 3 → 5 → 7 → 8 → 9 → 10
Parallel Speedup: ~35% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4, 5, 6, 7, 8, 9 | 2 |
| 2 | None | 10 | 1 |
| 3 | 1 | 5, 6, 7, 8 | 4 |
| 4 | 1 | 9 | 3 |
| 5 | 3 | 9 | 6 |
| 6 | 3 | 9 | 5 |
| 7 | 3 | 8, 9 | 5, 6 |
| 8 | 3, 7 | 9 | None |
| 9 | 4, 5, 6, 7, 8 | 10 | None |
| 10 | All | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | task(category="unspecified-high", ...) parallel |
| 2 | 3, 4 | task(category="quick", ...) parallel |
| 3 | 5, 6 | task(category="unspecified-high", ...) parallel |
| 4 | 7, 8 | task(category="visual-engineering", ...) sequential |
| 5 | 9, 10 | task(category="unspecified-high", ...) sequential |

---

## TODOs

- [ ] 1. 项目脚手架搭建

  **What to do**:
  - 初始化 npm 项目 (`npm init`)
  - 创建 `package.json` 扩展清单，包含:
    - `name`: `vscode-dotnet-tasks-kit`
    - `displayName`: `.NET Tasks Kit`
    - `description`: `Quickly generate and manage .NET build/publish tasks (tasks.json)`
    - `publisher`: `dotnet-tasks-kit` (占位符)
    - `engines.vscode`: `^1.85.0`
    - `categories`: `["Other"]`
    - `activationEvents`: `["onStartupFinished"]`
    - `main`: `./dist/extension.js`
    - `contributes.commands`: 两个命令 (createPublishTask, createBuildTask)
    - `contributes.menus.explorer/context`: 右键菜单项，when 条件 `resourceExtname == .csproj || resourceExtname == .fsproj`
    - `contributes.menus.commandPalette`: 两个命令
  - 安装开发依赖:
    - `@types/vscode` (匹配 engines.vscode)
    - `@types/node`
    - `typescript`
    - `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` + `eslint`
    - `esbuild`
    - `@vscode/vsce`
    - `@vscode-elements/elements` (v2.5.0+)
    - `jsonc-parser`
  - 创建 `tsconfig.json`:
    - `target`: `ES2022`
    - `module`: `Node16`
    - `moduleResolution`: `Node16`
    - `outDir`: `./out`
    - `rootDir`: `./src`
    - `strict`: `true`
    - `esModuleInterop`: `true`
    - `skipLibCheck`: `true`
  - 创建 `esbuild.mjs` 双目标打包脚本:
    - **Extension host** (Node): 入口 `src/extension.ts` → `dist/extension.js`, platform=node, external=vscode
    - **Webview** (Browser): 入口 `src/webview/html/main.ts` → `dist/webview/main.js`, platform=browser, bundle @vscode-elements
  - 创建 `.eslintrc.json` (TypeScript + VS Code 扩展规则)
  - 创建 `.gitignore` (node_modules, out, dist, *.vsix)
  - 创建 `.vscode/` 开发配置:
    - `launch.json` — Extension Development Host 调试配置
    - `tasks.json` — npm compile/watch tasks
    - `settings.json` — 编辑器设置
  - 创建 `src/extension.ts` 骨架 (activate + deactivate)
  - 配置 npm scripts:
    - `compile`: `tsc -p ./`
    - `watch`: `tsc -watch -p ./`
    - `lint`: `eslint src --ext ts`
    - `package`: `node esbuild.mjs --production`
    - `vscode:prepublish`: `npm run package`

  **Must NOT do**:
  - 不安装 React/Vue/Angular
  - 不安装 @vscode/webview-ui-toolkit
  - 不添加 webpack 配置
  - 不创建 extension settings (contributes.configuration)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 全新项目搭建涉及多个配置文件的精确协调
  - **Skills**: []
    - 不需要特殊技能，标准 Node.js/TypeScript 项目搭建

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 6, 7, 8, 9
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - 无（greenfield 项目）

  **Documentation References**:
  - VS Code Extension Manifest: https://code.visualstudio.com/api/references/extension-manifest
  - VS Code Extension Commands: https://code.visualstudio.com/api/extension-guides/command
  - VS Code Menus API: https://code.visualstudio.com/api/references/contribution-points#contributes.menus

  **External References**:
  - `@vscode-elements/elements` npm: https://www.npmjs.com/package/@vscode-elements/elements
  - `jsonc-parser` npm: https://www.npmjs.com/package/jsonc-parser
  - esbuild VS Code 扩展打包: https://code.visualstudio.com/api/working-with-extensions/bundling-extension

  **Acceptance Criteria**:

  ```
  Scenario: npm install succeeds
    Tool: Bash
    Steps:
      1. npm install
      2. Assert: exit code 0
      3. Assert: node_modules/ directory exists
    Expected Result: All dependencies installed
    Evidence: Terminal output captured

  Scenario: TypeScript compilation succeeds
    Tool: Bash
    Steps:
      1. npx tsc -p ./ --noEmit
      2. Assert: exit code 0, zero errors
    Expected Result: src/extension.ts compiles without errors
    Evidence: Terminal output captured

  Scenario: esbuild produces bundles
    Tool: Bash
    Steps:
      1. node esbuild.mjs
      2. Assert: dist/extension.js exists
      3. Assert: dist/webview/main.js exists
    Expected Result: Both extension and webview bundles generated
    Evidence: ls -la dist/ output

  Scenario: ESLint passes
    Tool: Bash
    Steps:
      1. npm run lint
      2. Assert: exit code 0
    Expected Result: Zero lint errors
    Evidence: Terminal output captured

  Scenario: package.json has correct contributes
    Tool: Bash
    Steps:
      1. node -e "const p=require('./package.json'); console.log(JSON.stringify(p.contributes.commands))"
      2. Assert: output contains "dotnetTasksKit.createPublishTask"
      3. Assert: output contains "dotnetTasksKit.createBuildTask"
    Expected Result: Both commands registered
    Evidence: JSON output captured
  ```

  **Commit**: YES
  - Message: `feat: scaffold VS Code extension project structure`
  - Files: `package.json, tsconfig.json, esbuild.mjs, .eslintrc.json, .gitignore, .vscode/*, src/extension.ts`
  - Pre-commit: `npm run compile && npm run lint`

---

- [ ] 2. 测试基础设施搭建

  **What to do**:
  - 安装测试依赖:
    - `@vscode/test-cli`
    - `@vscode/test-electron`
    - `mocha`
    - `@types/mocha`
  - 创建 `.vscode-test.mjs` 测试配置文件:
    ```javascript
    import { defineConfig } from '@vscode/test-cli';
    export default defineConfig({
      files: 'out/test/**/*.test.js',
      mocha: { timeout: 20000 }
    });
    ```
  - 创建 `src/test/` 目录结构:
    - `src/test/suite/index.ts` — Mocha test runner 入口
    - `src/test/suite/extension.test.ts` — 基础冒烟测试（扩展可激活）
  - 更新 `package.json` scripts:
    - `test`: `vscode-test`
    - `pretest`: `npm run compile`
  - 验证测试框架可以运行

  **Must NOT do**:
  - 不写业务逻辑测试（那是 Task 10 的工作）
  - 不安装 Jest/Vitest（使用 Mocha）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 测试基础设施搭建是标准配置任务
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 10
  - **Blocked By**: None (can start immediately, but Task 1 should finish first for package.json)

  **References**:

  **Documentation References**:
  - VS Code Extension Testing: https://code.visualstudio.com/api/working-with-extensions/testing-extension
  - @vscode/test-cli: https://github.com/microsoft/vscode-test-cli

  **Acceptance Criteria**:

  ```
  Scenario: Test framework runs successfully
    Tool: Bash
    Steps:
      1. npm run compile
      2. npm test
      3. Assert: exit code 0
      4. Assert: output contains "passing"
    Expected Result: Smoke test passes
    Evidence: Terminal output captured

  Scenario: Test config file is valid
    Tool: Bash
    Steps:
      1. node -e "import('./.vscode-test.mjs').then(c => console.log('VALID'))"
      2. Assert: output contains "VALID"
    Expected Result: Config parses without errors
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat: add test infrastructure with @vscode/test-cli and mocha`
  - Files: `.vscode-test.mjs, src/test/**`
  - Pre-commit: `npm run compile`

---

- [ ] 3. 数据模型和参数定义

  **What to do**:
  - 创建 `src/models/taskDefinition.ts`:
    - `DotnetCommand` 枚举: `'publish' | 'build'`
    - `PublishTaskParams` 接口:
      - `taskLabel: string` — task 显示名称
      - `project: string` — .csproj/.fsproj 路径
      - `configuration?: string` — Debug/Release
      - `framework?: string` — net6.0/net7.0/net8.0/net9.0
      - `runtime?: string` — RID (win-x64, linux-x64, etc.)
      - `output?: string` — 输出目录
      - `selfContained?: boolean`
      - `noBuild?: boolean`
      - `noRestore?: boolean`
      - `arch?: string` — x86/x64/arm/arm64
      - `os?: string` — win/linux/osx
      - `useCurrentRuntime?: boolean`
      - `source?: string` — NuGet 源
      - `force?: boolean`
      - `verbosity?: string` — quiet/minimal/normal/detailed/diagnostic
      - `versionSuffix?: string`
      - `publishSingleFile?: boolean` (MSBuild property)
      - `publishTrimmed?: boolean` (MSBuild property)
      - `publishReadyToRun?: boolean` (MSBuild property)
      - `publishAot?: boolean` (MSBuild property)
    - `BuildTaskParams` 接口（publish 的子集）:
      - `taskLabel`, `project`, `configuration`, `framework`, `runtime`, `output`, `noRestore`
      - `noIncremental?: boolean`, `noDependencies?: boolean`, `verbosity?: string`
      - `arch?: string`, `os?: string`
    - `VscodeTask` 接口（tasks.json 中单个 task 的结构）
    - `TasksFile` 接口（tasks.json 整体结构: version + tasks[]）
  - 创建 `src/models/dotnetParameters.ts`:
    - 每个参数的元数据定义:
      ```typescript
      interface ParameterMeta {
        name: string;          // CLI flag name (e.g., "--configuration")
        shortName?: string;    // Short flag (e.g., "-c")
        label: string;         // Display label for form
        description: string;   // Help text
        type: 'select' | 'text' | 'boolean';
        options?: string[];    // Valid values for select
        defaultValue?: string | boolean;
        tier: 1 | 2 | 3;      // Priority tier for form display
        group: string;         // Form section grouping
      }
      ```
    - `PUBLISH_PARAMETERS: ParameterMeta[]` — publish 所有参数定义
    - `BUILD_PARAMETERS: ParameterMeta[]` — build 所有参数定义
    - `CONFIGURATIONS` — `['Debug', 'Release']`
    - `FRAMEWORKS` — `['net6.0', 'net7.0', 'net8.0', 'net9.0']`
    - `RUNTIME_IDENTIFIERS` — 常用 RIDs（按 OS 分组）
    - `ARCHITECTURES` — `['x86', 'x64', 'arm', 'arm64']`
    - `OPERATING_SYSTEMS` — `['win', 'linux', 'osx']`
    - `VERBOSITY_LEVELS` — `['quiet', 'minimal', 'normal', 'detailed', 'diagnostic']`
    - `PARAMETER_CONSTRAINTS` — 参数约束规则:
      - `selfContained` 需要 `runtime` (或 `arch`/`os`)
      - `arch` 与 `runtime` 互斥
      - `os` 与 `runtime` 互斥
      - `noBuild` 隐含 `noRestore`
      - `publishSingleFile` 隐含 `selfContained`（.NET 8+）
      - `publishTrimmed` 隐含 `selfContained`（.NET 8+）
  - 创建 `src/models/messageProtocol.ts`:
    - Webview ↔ Extension 消息协议接口:
      ```typescript
      // Extension → Webview
      type ExtensionMessage =
        | { type: 'init'; command: DotnetCommand; projects: string[]; parameters: ParameterMeta[] }
        | { type: 'validationError'; field: string; message: string };
      
      // Webview → Extension
      type WebviewMessage =
        | { type: 'submit'; data: PublishTaskParams | BuildTaskParams }
        | { type: 'cancel' }
        | { type: 'requestProjects' };
      ```

  **Must NOT do**:
  - 不在参数定义中硬编码所有可能的 runtime（只列举最常用的）
  - 不动态获取 dotnet CLI 信息
  - 不添加 v2 预留的命令参数（run, test 等）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 纯数据模型定义，无复杂逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Tasks 5, 6, 7, 8
  - **Blocked By**: Task 1

  **References**:

  **Documentation References**:
  - dotnet publish CLI options: https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-publish
  - dotnet build CLI options: https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-build
  - .NET RID catalog: https://learn.microsoft.com/en-us/dotnet/core/rid-catalog
  - Target frameworks: https://learn.microsoft.com/en-us/dotnet/standard/frameworks
  - VS Code tasks.json schema: https://code.visualstudio.com/docs/editor/tasks-appendix

  **Acceptance Criteria**:

  ```
  Scenario: TypeScript compiles with models
    Tool: Bash
    Steps:
      1. npx tsc -p ./ --noEmit
      2. Assert: exit code 0
    Expected Result: All model files compile without errors
    Evidence: Terminal output

  Scenario: Parameter metadata is complete
    Tool: Bash
    Steps:
      1. node -e "const p=require('./out/models/dotnetParameters'); console.log('publish:', p.PUBLISH_PARAMETERS.length, 'build:', p.BUILD_PARAMETERS.length)"
      2. Assert: publish parameter count >= 15
      3. Assert: build parameter count >= 8
    Expected Result: All parameters defined
    Evidence: Terminal output

  Scenario: Constraints are defined
    Tool: Bash
    Steps:
      1. node -e "const p=require('./out/models/dotnetParameters'); console.log(JSON.stringify(p.PARAMETER_CONSTRAINTS))"
      2. Assert: output contains "selfContained" constraint
      3. Assert: output contains "arch" constraint
    Expected Result: Key constraints are present
    Evidence: JSON output
  ```

  **Commit**: YES
  - Message: `feat: add data models and dotnet parameter definitions`
  - Files: `src/models/*`
  - Pre-commit: `npm run compile && npm run lint`

---

- [ ] 4. 项目文件扫描器

  **What to do**:
  - 创建 `src/services/projectScanner.ts`:
    - `scanProjects(workspaceFolders: readonly WorkspaceFolder[]): Promise<ProjectInfo[]>`
      - 使用 `workspace.findFiles()` 扫描 `**/*.csproj` 和 `**/*.fsproj`
      - 排除 `**/bin/**`, `**/obj/**`, `**/node_modules/**`
      - 返回 `ProjectInfo[]`:
        ```typescript
        interface ProjectInfo {
          name: string;        // 项目名（文件名去扩展名）
          filePath: string;    // 完整路径
          relativePath: string; // 相对于 workspace 的路径
          type: 'csproj' | 'fsproj';
          workspaceFolder: string;
        }
        ```
    - 处理边界情况:
      - 无工作区文件夹打开 → 返回空数组
      - 多根工作区 → 扫描所有文件夹
      - 无 .NET 项目文件 → 返回空数组
    - `createFileWatcher(): Disposable` — 监听 .csproj/.fsproj 文件变化

  **Must NOT do**:
  - 不解析 .csproj XML 内容
  - 不解析 .sln 文件
  - 不检测 .NET SDK 版本

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单一功能模块，使用标准 VS Code API
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 9
  - **Blocked By**: Task 1

  **References**:

  **Documentation References**:
  - workspace.findFiles: https://code.visualstudio.com/api/references/vscode-api#workspace.findFiles
  - FileSystemWatcher: https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher
  - RelativePattern: https://code.visualstudio.com/api/references/vscode-api#RelativePattern

  **Acceptance Criteria**:

  ```
  Scenario: TypeScript compiles
    Tool: Bash
    Steps:
      1. npx tsc -p ./ --noEmit
      2. Assert: exit code 0
    Expected Result: projectScanner.ts compiles without errors
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat: add project file scanner for csproj/fsproj detection`
  - Files: `src/services/projectScanner.ts`
  - Pre-commit: `npm run compile && npm run lint`

---

- [ ] 5. Task JSON 生成器

  **What to do**:
  - 创建 `src/services/taskGenerator.ts`:
    - `generatePublishTask(params: PublishTaskParams): VscodeTask`
      - 将表单参数转换为 tasks.json 中的 task 对象
      - task 结构:
        ```json
        {
          "label": "用户自定义的 label",
          "type": "shell",
          "command": "dotnet",
          "args": ["publish", "${workspaceFolder}/path/to/project.csproj", "-c", "Release", ...],
          "group": "build",
          "problemMatcher": "$msCompile"
        }
        ```
      - 参数映射规则:
        - `configuration` → `["-c", value]`
        - `framework` → `["-f", value]`
        - `runtime` → `["-r", value]`
        - `output` → `["-o", value]`
        - `selfContained: true` → `["--self-contained"]`
        - `selfContained: false` → `["--no-self-contained"]`
        - `noBuild: true` → `["--no-build"]`
        - `noRestore: true` → `["--no-restore"]`
        - `arch` → `["-a", value]`
        - `os` → `["--os", value]`
        - `publishSingleFile: true` → `["-p:PublishSingleFile=true"]`
        - `publishTrimmed: true` → `["-p:PublishTrimmed=true"]`
        - 其他 MSBuild 属性类似
      - 项目路径使用 `${workspaceFolder}` 变量使其可移植
      - 只添加用户选择的参数（未选择的不出现在 args 中）
    - `generateBuildTask(params: BuildTaskParams): VscodeTask`
      - 类似 publish 但 command 是 `"build"`
      - 参数是 publish 的子集
    - `generateDefaultLabel(command: DotnetCommand, params: Partial<PublishTaskParams | BuildTaskParams>): string`
      - 自动生成 label 建议:
        - `"dotnet publish - {project} - {configuration}"` (最小)
        - `"dotnet publish - {project} - {configuration} - {runtime}"` (含 runtime)
    - `validateConstraints(params: PublishTaskParams): ValidationError[]`
      - 检查参数约束:
        - selfContained 设为 true 但未指定 runtime → 错误
        - 同时指定 arch 和 runtime → 错误
        - 同时指定 os 和 runtime → 错误
      - 返回 `{ field: string; message: string }[]`

  **Must NOT do**:
  - 不验证参数值是否有效（如 "xyz" 作为 configuration）
  - 不调用 dotnet CLI
  - 不依赖 VS Code API（纯逻辑，完全可单元测试）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 核心业务逻辑，需要精确的参数映射和约束验证
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Task 9
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `src/models/taskDefinition.ts` — VscodeTask 接口定义（Task 3 产出）
  - `src/models/dotnetParameters.ts` — 参数元数据和约束规则（Task 3 产出）

  **Documentation References**:
  - VS Code tasks.json schema: https://code.visualstudio.com/docs/editor/tasks-appendix
  - dotnet publish CLI: https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-publish
  - VS Code task variables: https://code.visualstudio.com/docs/editor/variables-reference

  **Acceptance Criteria**:

  ```
  Scenario: Publish task generation with full params
    Tool: Bash
    Steps:
      1. npm run compile
      2. node -e "
        const g = require('./out/services/taskGenerator');
        const task = g.generatePublishTask({
          taskLabel: 'Publish Linux',
          project: 'src/MyApp/MyApp.csproj',
          configuration: 'Release',
          framework: 'net8.0',
          runtime: 'linux-x64',
          selfContained: true,
          output: './publish'
        });
        console.log(JSON.stringify(task, null, 2));
      "
      3. Assert: output contains "dotnet"
      4. Assert: output contains "publish"
      5. Assert: args array contains "-c" followed by "Release"
      6. Assert: args array contains "-r" followed by "linux-x64"
      7. Assert: args array contains "--self-contained"
      8. Assert: args array contains "-o" followed by "./publish"
    Expected Result: Complete task JSON with all specified args
    Evidence: JSON output captured

  Scenario: Build task generation
    Tool: Bash
    Steps:
      1. node -e "
        const g = require('./out/services/taskGenerator');
        const task = g.generateBuildTask({
          taskLabel: 'Build Debug',
          project: 'src/MyApp/MyApp.csproj',
          configuration: 'Debug'
        });
        console.log(JSON.stringify(task, null, 2));
      "
      2. Assert: command is "dotnet", first arg is "build"
      3. Assert: args contains "-c" followed by "Debug"
    Expected Result: Correct build task JSON
    Evidence: JSON output captured

  Scenario: Default label generation
    Tool: Bash
    Steps:
      1. node -e "
        const g = require('./out/services/taskGenerator');
        console.log(g.generateDefaultLabel('publish', {
          project: 'src/MyApp/MyApp.csproj',
          configuration: 'Release',
          runtime: 'linux-x64'
        }));
      "
      2. Assert: output contains "publish" and "MyApp" and "Release" and "linux-x64"
    Expected Result: Descriptive auto-generated label
    Evidence: Terminal output

  Scenario: Constraint validation catches errors
    Tool: Bash
    Steps:
      1. node -e "
        const g = require('./out/services/taskGenerator');
        const errors = g.validateConstraints({ selfContained: true });
        console.log(JSON.stringify(errors));
      "
      2. Assert: errors array is non-empty
      3. Assert: error message mentions "runtime"
    Expected Result: Validation error for selfContained without runtime
    Evidence: JSON output

  Scenario: Mutual exclusion validation
    Tool: Bash
    Steps:
      1. node -e "
        const g = require('./out/services/taskGenerator');
        const errors = g.validateConstraints({ runtime: 'linux-x64', arch: 'x64' });
        console.log(JSON.stringify(errors));
      "
      2. Assert: errors array is non-empty
      3. Assert: error mentions mutual exclusion
    Expected Result: Validation error for arch + runtime conflict
    Evidence: JSON output
  ```

  **Commit**: YES
  - Message: `feat: add task JSON generator with constraint validation`
  - Files: `src/services/taskGenerator.ts`
  - Pre-commit: `npm run compile && npm run lint`

---

- [ ] 6. tasks.json 文件服务

  **What to do**:
  - 创建 `src/services/tasksFileService.ts`:
    - `readTasksFile(workspaceFolder: WorkspaceFolder): Promise<TasksFile | null>`
      - 读取 `.vscode/tasks.json`
      - 使用 `jsonc-parser` 解析（支持注释和尾逗号）
      - 文件不存在 → 返回 null
      - 文件格式错误 → 抛出描述性错误
      - 处理 BOM (Byte Order Mark)
    - `writeTasksFile(workspaceFolder: WorkspaceFolder, tasksFile: TasksFile): Promise<void>`
      - 如果 `.vscode/` 目录不存在，先创建
      - 使用 `workspace.fs` API 写入文件
      - 格式化输出（2 空格缩进）
      - 始终包含 `"version": "2.0.0"`
    - `addTaskToFile(workspaceFolder: WorkspaceFolder, task: VscodeTask, mode: 'append' | 'overwrite'): Promise<void>`
      - `append` 模式: 读取现有文件，添加 task 到 tasks 数组末尾
      - `overwrite` 模式: 创建新文件，只包含新 task
      - 检测重复 label → 如果存在相同 label，通过 `vscode.window.showWarningMessage` 警告用户
    - `promptWriteMode(existingFile: TasksFile): Promise<'append' | 'overwrite' | undefined>`
      - 如果 tasks.json 已有内容，弹出选择框让用户选择追加还是覆盖
      - 用户取消 → 返回 undefined

  **Must NOT do**:
  - 不使用 Node.js `fs` 模块（使用 `workspace.fs`）
  - 不使用 `JSON.parse()`（使用 `jsonc-parser`）
  - 不修改已有 task
  - 不支持 task 删除

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 文件 I/O 操作需要仔细处理边界情况（JSONC、BOM、目录创建等）
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: Task 9
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `src/models/taskDefinition.ts` — TasksFile, VscodeTask 接口（Task 3 产出）

  **Documentation References**:
  - workspace.fs API: https://code.visualstudio.com/api/references/vscode-api#FileSystem
  - jsonc-parser: https://github.com/microsoft/node-jsonc-parser
  - VS Code tasks.json schema: https://code.visualstudio.com/docs/editor/tasks-appendix

  **Acceptance Criteria**:

  ```
  Scenario: TypeScript compiles
    Tool: Bash
    Steps:
      1. npx tsc -p ./ --noEmit
      2. Assert: exit code 0
    Expected Result: tasksFileService.ts compiles without errors
    Evidence: Terminal output

  Scenario: Module exports exist
    Tool: Bash
    Steps:
      1. npm run compile
      2. node -e "
        const s = require('./out/services/tasksFileService');
        console.log(typeof s.readTasksFile, typeof s.writeTasksFile, typeof s.addTaskToFile);
      "
      3. Assert: all types are "function"
    Expected Result: All public functions exported
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat: add tasks.json file service with JSONC support`
  - Files: `src/services/tasksFileService.ts`
  - Pre-commit: `npm run compile && npm run lint`

---

- [ ] 7. Webview 面板管理器

  **What to do**:
  - 创建 `src/webview/TaskFormPanel.ts`:
    - **单例模式**: 静态 `currentPanel` 引用，已打开时调用 `panel.reveal()`
    - `static createOrShow(extensionUri: Uri, command: DotnetCommand, projects: ProjectInfo[]): TaskFormPanel`
      - 创建 WebviewPanel:
        ```typescript
        vscode.window.createWebviewPanel(
          'dotnetTaskForm',
          command === 'publish' ? 'Create Publish Task' : 'Create Build Task',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
              vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
            ]
          }
        );
        ```
    - `getWebviewContent(): string`
      - 生成 HTML 内容
      - 引用打包后的 webview JS/CSS 文件（通过 `webview.asWebviewUri()`）
      - 引用 `@vscode-elements/elements` 打包后的组件
      - 设置 Content Security Policy (CSP)
    - **消息处理**:
      - 监听 `webview.onDidReceiveMessage`:
        - `submit` → 调用 taskGenerator + tasksFileService 生成 task
        - `cancel` → 关闭面板
        - `requestProjects` → 重新扫描项目
      - 发送 `postMessage` 到 webview:
        - `init` → 初始化数据（命令类型、项目列表、参数定义）
        - `validationError` → 约束验证错误
    - **生命周期**:
      - `panel.onDidDispose` → 清理引用
      - `panel.onDidChangeViewState` → 可选

  **Must NOT do**:
  - 不在这个文件写 HTML 模板内容（HTML 在 Task 8 中创建）
  - 不直接操作 tasks.json（通过 tasksFileService）
  - 不实现表单逻辑（在 webview 端 main.ts 中）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Webview 面板管理涉及多个 VS Code API 交互和消息协议
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential: Task 7 → Task 8)
  - **Blocks**: Task 8, Task 9
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `src/models/messageProtocol.ts` — 消息协议接口（Task 3 产出）
  - `src/models/dotnetParameters.ts` — 参数元数据（Task 3 产出）

  **Documentation References**:
  - Webview API: https://code.visualstudio.com/api/extension-guides/webview
  - Webview security: https://code.visualstudio.com/api/extension-guides/webview#content-security-policy

  **External References**:
  - @vscode-elements/elements 使用示例: https://github.com/nicedoc/vscode-ibmi-renderer (bundled.js 引用模式)

  **Acceptance Criteria**:

  ```
  Scenario: TypeScript compiles
    Tool: Bash
    Steps:
      1. npx tsc -p ./ --noEmit
      2. Assert: exit code 0
    Expected Result: TaskFormPanel.ts compiles without errors
    Evidence: Terminal output

  Scenario: Module exports correct class
    Tool: Bash
    Steps:
      1. npm run compile
      2. node -e "const p = require('./out/webview/TaskFormPanel'); console.log(typeof p.TaskFormPanel)"
      3. Assert: output is "function"
    Expected Result: TaskFormPanel class exported
    Evidence: Terminal output
  ```

  **Commit**: YES (group with Task 8)
  - Message: `feat: add webview panel manager with message protocol`
  - Files: `src/webview/TaskFormPanel.ts`
  - Pre-commit: `npm run compile && npm run lint`

---

- [ ] 8. Webview 表单 HTML/CSS/JS

  **What to do**:
  - 创建 `src/webview/html/main.ts` (webview 端入口):
    - 导入 `@vscode-elements/elements` 组件:
      ```typescript
      import '@vscode-elements/elements/dist/vscode-button/index.js';
      import '@vscode-elements/elements/dist/vscode-textfield/index.js';
      import '@vscode-elements/elements/dist/vscode-single-select/index.js';
      import '@vscode-elements/elements/dist/vscode-checkbox/index.js';
      import '@vscode-elements/elements/dist/vscode-form-group/index.js';
      import '@vscode-elements/elements/dist/vscode-label/index.js';
      import '@vscode-elements/elements/dist/vscode-radio-group/index.js';
      import '@vscode-elements/elements/dist/vscode-radio/index.js';
      ```
    - 获取 VS Code API: `const vscode = acquireVsCodeApi();`
    - **消息监听**: `window.addEventListener('message', ...)` 处理 `init` 和 `validationError`
    - **表单动态生成**:
      - 接收 `init` 消息后，根据 `command` 类型和 `parameters` 数组动态渲染表单字段
      - 参数按 `tier` 分组显示（Tier 1 默认展开，Tier 2/3 可折叠）
    - **表单交互逻辑**:
      - Task label 输入框：提供自动生成的默认值，用户可覆盖
      - 项目选择：下拉列表显示扫描到的项目
      - 参数约束实时反馈:
        - 选择 `selfContained` 时，高亮 `runtime` 字段为必填
        - 选择 `arch` 时，禁用 `runtime`（互斥）
        - 选择 `os` 时，禁用 `runtime`（互斥）
        - 选择 `noBuild` 时，自动勾选 `noRestore`
      - Label 自动更新：当关键参数变化时，如果用户没有手动修改过 label，则自动更新默认建议
    - **提交/取消**:
      - Submit 按钮 → 收集表单数据，`vscode.postMessage({ type: 'submit', data: {...} })`
      - Cancel 按钮 → `vscode.postMessage({ type: 'cancel' })`
  
  - 创建 `src/webview/html/styles.css`:
    - 使用 VS Code CSS 变量确保主题一致性
    - 表单布局: 响应式网格/flex 布局
    - 参数分组视觉分隔
    - Tier 2/3 折叠区域样式
    - 错误状态高亮
    - 按钮组布局（Submit/Cancel 底部固定）

  - 更新 `esbuild.mjs` webview 打包配置:
    - 入口: `src/webview/html/main.ts`
    - 输出: `dist/webview/main.js`
    - 处理 CSS: 内联或单独输出
    - 打包 `@vscode-elements/elements` web components

  **Must NOT do**:
  - 不使用 React/Vue/Angular
  - 不使用 @vscode/webview-ui-toolkit
  - 不内联 HTML 到 TypeScript 字符串中（保持 HTML 结构清晰）
  - 不在 webview 中直接访问 Node.js API
  - 不在 webview 中直接操作文件系统

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Webview UI 构建，需要良好的表单布局和交互体验
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 表单 UI 设计和交互体验优化

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Task 7)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 3, 7

  **References**:

  **Pattern References**:
  - `src/models/messageProtocol.ts` — 消息协议（Task 3 产出）
  - `src/models/dotnetParameters.ts` — 参数元数据和约束规则（Task 3 产出）
  - `src/webview/TaskFormPanel.ts` — 面板管理器的 getWebviewContent 方法（Task 7 产出）

  **External References**:
  - @vscode-elements/elements 文档: https://vscode-elements.github.io/
  - @vscode-elements/elements 组件列表: https://github.com/vscode-elements/elements
  - VS Code CSS 变量: https://code.visualstudio.com/api/references/theme-color
  - VS Code Webview 最佳实践: https://code.visualstudio.com/api/extension-guides/webview#scripts-and-message-passing

  **Acceptance Criteria**:

  ```
  Scenario: Webview bundle generates
    Tool: Bash
    Steps:
      1. node esbuild.mjs
      2. Assert: dist/webview/main.js exists
      3. Assert: file size > 0
    Expected Result: Webview bundle created successfully
    Evidence: ls -la dist/webview/ output

  Scenario: Extension compiles with webview integration
    Tool: Bash
    Steps:
      1. npx tsc -p ./ --noEmit
      2. Assert: exit code 0
    Expected Result: All webview TypeScript compiles
    Evidence: Terminal output

  Scenario: @vscode-elements components are bundled
    Tool: Bash (using grep on bundle)
    Steps:
      1. node esbuild.mjs
      2. Search dist/webview/main.js for "vscode-button"
      3. Assert: found (component registered in bundle)
    Expected Result: Web components are included in bundle
    Evidence: grep output
  ```

  **Commit**: YES (group with Task 7)
  - Message: `feat: add webview form UI with @vscode-elements/elements`
  - Files: `src/webview/html/*, esbuild.mjs (updated)`
  - Pre-commit: `npm run compile && npm run lint && node esbuild.mjs`

---

- [ ] 9. 命令处理器和扩展入口集成

  **What to do**:
  - 创建 `src/commands/createPublishTask.ts`:
    - 导出 `createPublishTaskCommand(context: ExtensionContext): (...args: any[]) => Promise<void>`
    - 实现流程:
      1. 扫描项目 (`projectScanner.scanProjects`)
      2. 如果无项目 → `showInformationMessage("No .NET project files found")`
      3. 如果有右键菜单上下文 URI → 预选该项目
      4. 打开 Webview 面板 (`TaskFormPanel.createOrShow`), 传入 `'publish'`
      5. 等待 webview 提交:
         - 验证约束 (`taskGenerator.validateConstraints`)
         - 如有错误 → 发送 `validationError` 消息
         - 如无错误 → 生成 task (`taskGenerator.generatePublishTask`)
         - 读取现有 tasks.json → 如有内容，询问追加/覆盖
         - 写入 task (`tasksFileService.addTaskToFile`)
         - `showInformationMessage("Task created successfully!")`
         - 关闭 Webview 面板

  - 创建 `src/commands/createBuildTask.ts`:
    - 类似 publish，但使用 `'build'` 命令和 `generateBuildTask`

  - 更新 `src/extension.ts`:
    - `activate(context: ExtensionContext)`:
      ```typescript
      // Register commands
      context.subscriptions.push(
        vscode.commands.registerCommand(
          'dotnetTasksKit.createPublishTask',
          createPublishTaskCommand(context)
        ),
        vscode.commands.registerCommand(
          'dotnetTasksKit.createBuildTask',
          createBuildTaskCommand(context)
        )
      );
      ```
    - `deactivate()`: 清理资源

  **Must NOT do**:
  - 不添加 dotnet run/test/watch 命令
  - 不添加 task 编辑/删除命令
  - 不添加 extension settings 读取
  - 不添加 TaskProvider（用户决定直接写 tasks.json）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 整合所有模块的核心集成任务
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (sequential)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 4, 5, 6, 7, 8

  **References**:

  **Pattern References**:
  - `src/services/projectScanner.ts` — 项目扫描（Task 4 产出）
  - `src/services/taskGenerator.ts` — Task 生成和约束验证（Task 5 产出）
  - `src/services/tasksFileService.ts` — tasks.json 读写（Task 6 产出）
  - `src/webview/TaskFormPanel.ts` — Webview 面板管理（Task 7 产出）
  - `src/models/messageProtocol.ts` — 消息协议（Task 3 产出）

  **Documentation References**:
  - VS Code Commands API: https://code.visualstudio.com/api/references/vscode-api#commands.registerCommand
  - VS Code Extension Context: https://code.visualstudio.com/api/references/vscode-api#ExtensionContext

  **Acceptance Criteria**:

  ```
  Scenario: Extension compiles with all modules
    Tool: Bash
    Steps:
      1. npm run compile
      2. Assert: exit code 0, zero errors
    Expected Result: All source files compile
    Evidence: Terminal output

  Scenario: ESLint passes on full codebase
    Tool: Bash
    Steps:
      1. npm run lint
      2. Assert: exit code 0
    Expected Result: Zero lint errors
    Evidence: Terminal output

  Scenario: esbuild produces complete bundles
    Tool: Bash
    Steps:
      1. node esbuild.mjs --production
      2. Assert: dist/extension.js exists
      3. Assert: dist/webview/main.js exists
      4. Assert: dist/extension.js size < 512000 bytes
    Expected Result: Production bundles generated
    Evidence: ls -la dist/ output

  Scenario: Extension packages into .vsix
    Tool: Bash
    Steps:
      1. npx @vscode/vsce package --no-dependencies
      2. Assert: exit code 0
      3. Assert: *.vsix file exists
    Expected Result: .vsix package created
    Evidence: ls *.vsix output

  Scenario: package.json commands are complete
    Tool: Bash
    Steps:
      1. node -e "
        const p = require('./package.json');
        const cmds = p.contributes.commands.map(c => c.command);
        console.log(cmds.includes('dotnetTasksKit.createPublishTask'));
        console.log(cmds.includes('dotnetTasksKit.createBuildTask'));
        const menus = p.contributes.menus['explorer/context'];
        console.log(menus && menus.length >= 2);
      "
      2. Assert: all outputs are "true"
    Expected Result: Commands and menus properly registered
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat: integrate commands, webview, and task generation pipeline`
  - Files: `src/commands/*, src/extension.ts`
  - Pre-commit: `npm run compile && npm run lint`

---

- [ ] 10. 单元测试和集成验证

  **What to do**:
  - 创建 `src/test/suite/taskGenerator.test.ts`:
    - publish task 生成:
      - 最小参数（仅 project） → 正确的基础 task 结构
      - 全参数 → 所有 args 正确映射
      - MSBuild properties → `-p:` 格式正确
      - 空可选参数 → 不出现在 args 中
    - build task 生成:
      - 最小参数 → 正确结构
      - build 特有参数 (noIncremental, noDependencies)
    - 默认 label 生成:
      - 仅 project → 包含项目名
      - project + config + runtime → 包含所有关键信息
    - 约束验证:
      - selfContained 无 runtime → 报错
      - arch + runtime 互斥 → 报错
      - os + runtime 互斥 → 报错
      - noBuild → noRestore 自动设置
      - 合法参数组合 → 无错误

  - 创建 `src/test/suite/tasksFileService.test.ts`:
    - 需要 mock `workspace.fs` API
    - 创建新 tasks.json → 正确结构（version 2.0.0 + tasks 数组）
    - 追加到已有 tasks.json → 保留已有 task + 新增
    - 处理 JSONC 格式 → 正确解析带注释的文件
    - 文件不存在 → 返回 null
    - 检测重复 label → 返回警告

  - 创建 `src/test/suite/projectScanner.test.ts`:
    - 需要 mock `workspace.findFiles`
    - 扫描到 .csproj → 返回正确的 ProjectInfo
    - 扫描到 .fsproj → 返回正确的 ProjectInfo
    - 无工作区 → 返回空数组
    - 多根工作区 → 合并结果

  - 创建 `src/test/suite/extension.test.ts`:
    - 扩展可激活
    - 命令已注册 (dotnetTasksKit.createPublishTask, dotnetTasksKit.createBuildTask)

  - 运行全部测试并确保通过
  - 最终验证: 编译 + lint + 测试 + 打包全部通过

  **Must NOT do**:
  - 不写 E2E 测试（在 webview 中操作 DOM）
  - 不追求 100% 覆盖率（核心逻辑 >90% 即可）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 测试代码需要精确覆盖核心逻辑和边界情况
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (after Task 9)
  - **Blocks**: None (final task)
  - **Blocked By**: All previous tasks

  **References**:

  **Pattern References**:
  - `src/services/taskGenerator.ts` — 被测试的核心逻辑（Task 5 产出）
  - `src/services/tasksFileService.ts` — 被测试的文件服务（Task 6 产出）
  - `src/services/projectScanner.ts` — 被测试的扫描器（Task 4 产出）
  - `src/models/taskDefinition.ts` — 类型定义（Task 3 产出）
  - `src/test/suite/index.ts` — Mocha runner 入口（Task 2 产出）
  - `.vscode-test.mjs` — 测试配置（Task 2 产出）

  **Documentation References**:
  - VS Code Extension Testing: https://code.visualstudio.com/api/working-with-extensions/testing-extension
  - Mocha assertions: https://mochajs.org/#assertions
  - @vscode/test-cli: https://github.com/microsoft/vscode-test-cli

  **Acceptance Criteria**:

  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. npm run compile
      2. npm test
      3. Assert: exit code 0
      4. Assert: output contains "passing"
      5. Assert: output does NOT contain "failing"
    Expected Result: All test suites pass
    Evidence: Terminal output captured

  Scenario: Task generator tests cover core cases
    Tool: Bash
    Steps:
      1. npm test 2>&1 | grep -c "taskGenerator"
      2. Assert: count >= 5 (at least 5 test cases)
    Expected Result: Adequate test coverage for core logic
    Evidence: Test count output

  Scenario: Full build pipeline succeeds
    Tool: Bash
    Steps:
      1. npm run compile && npm run lint && npm test && node esbuild.mjs --production && npx @vscode/vsce package --no-dependencies
      2. Assert: exit code 0 at each step
      3. Assert: *.vsix file exists
    Expected Result: Complete build pipeline passes
    Evidence: Terminal output + .vsix file present

  Scenario: Extension smoke test
    Tool: Bash
    Steps:
      1. npm test 2>&1 | grep "extension"
      2. Assert: output contains "activate" or "Extension" test
    Expected Result: Extension activation test exists and passes
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `test: add unit tests for task generator, file service, and project scanner`
  - Files: `src/test/suite/*`
  - Pre-commit: `npm run compile && npm run lint && npm test`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `feat: scaffold VS Code extension project structure` | package.json, tsconfig.json, esbuild.mjs | `npm run compile && npm run lint` |
| 2 | `feat: add test infrastructure with @vscode/test-cli and mocha` | .vscode-test.mjs, src/test/** | `npm run compile` |
| 3 | `feat: add data models and dotnet parameter definitions` | src/models/* | `npm run compile && npm run lint` |
| 4 | `feat: add project file scanner for csproj/fsproj detection` | src/services/projectScanner.ts | `npm run compile && npm run lint` |
| 5 | `feat: add task JSON generator with constraint validation` | src/services/taskGenerator.ts | `npm run compile && npm run lint` |
| 6 | `feat: add tasks.json file service with JSONC support` | src/services/tasksFileService.ts | `npm run compile && npm run lint` |
| 7+8 | `feat: add webview form UI with @vscode-elements/elements` | src/webview/** | `npm run compile && npm run lint && node esbuild.mjs` |
| 9 | `feat: integrate commands, webview, and task generation pipeline` | src/commands/*, src/extension.ts | `npm run compile && npm run lint && npx @vscode/vsce package` |
| 10 | `test: add unit tests for task generator, file service, and project scanner` | src/test/suite/* | `npm run compile && npm run lint && npm test` |

---

## Success Criteria

### Verification Commands
```bash
# 1. TypeScript compilation — zero errors
npm run compile
# Expected: exit code 0

# 2. ESLint — zero warnings
npm run lint
# Expected: exit code 0

# 3. All tests pass
npm test
# Expected: "X passing", exit code 0

# 4. Production bundle
node esbuild.mjs --production
# Expected: dist/extension.js + dist/webview/main.js exist

# 5. VSIX packaging
npx @vscode/vsce package --no-dependencies
# Expected: vscode-dotnet-tasks-kit-0.0.1.vsix generated

# 6. Bundle size check
node -e "const s=require('fs').statSync('dist/extension.js');console.log(s.size<512000?'PASS':'FAIL',s.size+'B')"
# Expected: PASS
```

### Final Checklist
- [ ] 两个命令在 Command Palette 中可见
- [ ] 右键 .csproj/.fsproj 文件时菜单项可见
- [ ] Webview 表单可打开并显示所有参数
- [ ] 参数约束验证正常工作
- [ ] 生成的 tasks.json 格式正确
- [ ] 已有 tasks.json 时追加/覆盖选择正常
- [ ] 所有测试通过
- [ ] .vsix 打包成功
