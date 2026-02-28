# Draft: VS Code .NET Tasks Kit Extension

## Requirements (confirmed)
- **核心功能**: VS Code 扩展，用于快速创建和管理 .NET 项目的 VS Code tasks
- **首要任务**: 实现 `dotnet publish` task 的创建流程
- **交互流程**: 触发插件 → 选择 task 名称 → 选择项目 → 选择发布参数（位置、配置、目标框架等）→ 自动生成 tasks.json

## Technical Decisions
- ✅ 开发语言: TypeScript
- ✅ 打包工具: esbuild (双配置: node + browser)
- ✅ 扩展激活方式: Command Palette + Explorer 右键菜单
- ✅ 命令范围: publish + build (第一版)
- ✅ tasks.json 处理: 已有文件时让用户选择追加还是覆盖
- ✅ Task 生成方式: 直接写入 .vscode/tasks.json 文件
- ✅ 参数选择 UI: Webview 表单面板 (@vscode-elements/elements，原 webview-ui-toolkit 已停维)
- ✅ 测试: 有测试，使用 @vscode/test-cli + Mocha
- ✅ 第一版范围: 仅创建 task，不含编辑/删除
- ✅ Task label: 自动生成默认建议 + 用户可自定义覆盖
- ✅ task type: shell (更灵活)
- ✅ 多根工作区: 扫描所有工作区文件夹
- ✅ 包管理器: npm

## Research Findings

### VS Code Extension API
- **Task Provider API**: `vscode.tasks.registerTaskProvider()` 注册自定义 TaskProvider
- **taskDefinitions**: 在 package.json contributes 中声明 task 类型和属性 schema
- **ShellExecution**: 用于创建 shell 命令执行的 task
- **Multi-step QuickPick**: 使用 `window.createQuickPick()` 实现多步选择流程，支持返回按钮
- **workspace.findFiles()**: 使用 glob pattern 扫描工作区文件，支持排除 bin/obj 等目录
- **FileSystemWatcher**: 监听 .csproj/.fsproj 变化，自动失效缓存

### dotnet publish 参数 (分优先级)
- **Tier 1 常用**: --configuration, --framework, --runtime, --output, --self-contained, --no-build, --no-restore
- **Tier 2 进阶**: --arch, --os, --property (MSBuild), --source, --use-current-runtime
- **Tier 3 高级**: --force, --verbosity, --version-suffix, --artifacts-path, --nologo 等
- **MSBuild 属性**: PublishSingleFile, PublishTrimmed, PublishReadyToRun, PublishAot
- **参数依赖**: --self-contained 需配合 --runtime; --arch 和 --runtime 互斥; --no-build 隐含 --no-restore

### dotnet build 参数 (与 publish 重叠大部分)
- 核心: --configuration, --framework, --runtime, --output, --no-restore
- 额外: --no-incremental, --no-dependencies

### 参考扩展
- **VS Code NPM 内置扩展**: TaskProvider 实现范例，含 cache、watcher、ShellExecution
- **vscode-solution-explorer**: .sln 文件扫描和展示

## Open Questions
- 打包工具偏好: esbuild / webpack?
- 扩展发布者 ID?
- 测试策略?

## Confirmed Decisions (Round 2)
- ✅ 第一版仅创建 task，不做编辑/删除
- ✅ 参数选择: 自由选参模式 — 列出所有可选参数，用户勾选需要设置的，逐一填值
- ✅ 项目检测: 扫描 workspace 中的 .csproj / .fsproj 文件
- ✅ 扩展显示名称: ".NET Tasks Kit"

## Scope Boundaries
- INCLUDE: dotnet publish task 创建
- INCLUDE: dotnet build task 创建
- INCLUDE: 参数选择 UI (QuickPick multi-step) — Command Palette + 右键菜单双入口
- INCLUDE: 自动生成/更新 tasks.json (追加或覆盖由用户选择)
- INCLUDE: 自动扫描 .csproj/.fsproj 文件
- EXCLUDE: task 编辑/删除 (后续版本)
- EXCLUDE: .sln 解析 (后续版本)
- EXCLUDE: dotnet run / test / watch 等其他命令 (后续版本)
