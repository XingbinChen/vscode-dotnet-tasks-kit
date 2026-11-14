import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';
import { EditTaskContext, TaskPanel } from "./webview/TaskPanel";
import {
  DotnetCommand,
  PublishTaskParams,
  BuildTaskParams,
} from "./models/taskDefinition";
import { TaskGenerator } from "./services/taskGenerator";
import { TaskParser } from "./services/taskParser";
import { TasksFileService } from "./services/tasksFileService";
import { DotnetTaskItem, TasksTreeProvider } from "./views/tasksTreeProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log(".NET Tasks Kit extension is now active");

  const tasksTreeProvider = new TasksTreeProvider();
  const tasksTreeView = vscode.window.registerTreeDataProvider(
    "dotnetTasksKit.tasksView",
    tasksTreeProvider,
  );

  const tasksJsonWatcher = vscode.workspace.createFileSystemWatcher(
    "**/.vscode/tasks.json",
  );
  tasksJsonWatcher.onDidChange(() => tasksTreeProvider.refresh());
  tasksJsonWatcher.onDidCreate(() => tasksTreeProvider.refresh());
  tasksJsonWatcher.onDidDelete(() => tasksTreeProvider.refresh());

  const workspaceFoldersListener = vscode.workspace.onDidChangeWorkspaceFolders(
    () => tasksTreeProvider.refresh(),
  );

  const createPublishTaskCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.createPublishTask",
    async (uri?: vscode.Uri) => {
      TaskPanel.createOrShow(context.extensionUri, DotnetCommand.publish, uri);
    },
  );

  const createBuildTaskCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.createBuildTask",
    async (uri?: vscode.Uri) => {
      TaskPanel.createOrShow(context.extensionUri, DotnetCommand.build, uri);
    },
  );

  const refreshTasksCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.refreshTasks",
    () => tasksTreeProvider.refresh(),
  );

  const runTaskCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.runTask",
    async (item?: DotnetTaskItem) => {
      if (!item) {
        return;
      }
      await vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        item.task.label,
      );
    },
  );

  const revealTaskOutputCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.revealTaskOutput",
    async (item?: DotnetTaskItem) => {
      if (!item?.outputUri) {
        return;
      }
      if (!fs.existsSync(item.outputUri.fsPath)) {
        vscode.window.showWarningMessage(
          `Output folder does not exist yet: ${item.outputUri.fsPath}`,
        );
        return;
      }
      await vscode.commands.executeCommand("revealFileInOS", item.outputUri);
    },
  );

  const editTaskCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.editTask",
    async (item?: DotnetTaskItem) => {
      if (!item) {
        return;
      }
      const parsed = TaskParser.parse(item.task, item.folder);
      if (!parsed) {
        vscode.window.showWarningMessage(
          `Task "${item.task.label}" cannot be edited in the form (unrecognized argument layout).`,
        );
        return;
      }
      TaskPanel.createOrShow(context.extensionUri, parsed.command, undefined, {
        folder: item.folder,
        taskIndex: item.taskIndex,
        originalLabel: item.task.label,
        existingParams: parsed.params,
      });
    },
  );

  const onTaskSubmitCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.internal.onTaskSubmit",
    async (
      data: PublishTaskParams | BuildTaskParams,
      command: DotnetCommand,
      editContext?: EditTaskContext,
    ) => {
      try {
        // 1. Find Workspace Folder
        // data.project is a relative path like "src/MyProject.csproj"
        let workspaceFolder: vscode.WorkspaceFolder | undefined;

        if (editContext) {
          workspaceFolder = editContext.folder;
        } else if (vscode.workspace.workspaceFolders) {
          if (vscode.workspace.workspaceFolders.length === 1) {
            workspaceFolder = vscode.workspace.workspaceFolders[0];
          } else {
            // Multi-root: try to find the workspace folder that contains the project
            for (const folder of vscode.workspace.workspaceFolders) {
              const projectPath = path.join(folder.uri.fsPath, data.project);
              try {
                if (fs.existsSync(projectPath)) {
                  workspaceFolder = folder;
                  break;
                }
              } catch {
                // Continue to next folder
              }
            }
            if (!workspaceFolder) {
              workspaceFolder = vscode.workspace.workspaceFolders[0];
            }
          }
        }

        if (!workspaceFolder) {
          vscode.window.showErrorMessage("No workspace folder found.");
          return;
        }

        // 2. Calculate project directory relative to workspace
        // and convert project path to be relative to that directory
        const fullProjectPath = path.join(workspaceFolder.uri.fsPath, data.project);
        const projectDir = path.dirname(fullProjectPath);
        const projectFileName = path.basename(data.project);
        // Get relative path from workspace folder to project directory
        const relativeProjectDir = path.relative(workspaceFolder.uri.fsPath, projectDir).replace(/\\/g, '/');

        // 3. Generate Task with projectDir for cwd option
        // Create params with project path relative to projectDir (just filename)
        const projectParams = { ...data, project: projectFileName };
        let task;
        if (command === DotnetCommand.publish) {
          task = TaskGenerator.generatePublishTask(projectParams as PublishTaskParams, relativeProjectDir);
        } else {
          task = TaskGenerator.generateBuildTask(projectParams as BuildTaskParams, relativeProjectDir);
        }

        // 4. Write to tasks.json
        if (editContext) {
          await updateExistingTask(workspaceFolder, editContext, task);
          vscode.window.showInformationMessage(
            `Task "${task.label}" updated successfully!`,
          );
        } else {
          await TasksFileService.addTaskToTasksJson(task, workspaceFolder);
          vscode.window.showInformationMessage(
            `Task "${task.label}" created successfully!`,
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to save task: ${error}`);
        console.error(error);
      }
    },
  );

  context.subscriptions.push(tasksTreeView);
  context.subscriptions.push(tasksJsonWatcher);
  context.subscriptions.push(workspaceFoldersListener);
  context.subscriptions.push(createPublishTaskCommand);
  context.subscriptions.push(createBuildTaskCommand);
  context.subscriptions.push(refreshTasksCommand);
  context.subscriptions.push(runTaskCommand);
  context.subscriptions.push(revealTaskOutputCommand);
  context.subscriptions.push(editTaskCommand);
  context.subscriptions.push(onTaskSubmitCommand);
}

/**
 * Applies an edited task to its original position in tasks.json.
 * Arguments the form cannot represent (e.g. `--os`, custom MSBuild
 * properties) are re-parsed from the existing task and re-appended.
 */
async function updateExistingTask(
  workspaceFolder: vscode.WorkspaceFolder,
  editContext: EditTaskContext,
  task: ReturnType<typeof TaskGenerator.generatePublishTask>,
) {
  let args = task.args ?? [];
  const currentTasks = await TasksFileService.getTasks(workspaceFolder);
  const original = currentTasks[editContext.taskIndex];
  if (original) {
    const parsedOriginal = TaskParser.parse(original, workspaceFolder);
    if (parsedOriginal && parsedOriginal.extraArgs.length > 0) {
      args = [...args, ...parsedOriginal.extraArgs];
    }
  }

  await TasksFileService.updateTaskInTasksJson(
    workspaceFolder,
    editContext.taskIndex,
    editContext.originalLabel,
    {
      label: task.label,
      args,
      cwd: task.options?.cwd,
    },
  );
}

export function deactivate() {
  console.log(".NET Tasks Kit extension is now deactivated");
}
