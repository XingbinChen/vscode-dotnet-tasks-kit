import * as vscode from "vscode";
import { TaskPanel } from "./webview/TaskPanel";
import {
  DotnetCommand,
  PublishTaskParams,
  BuildTaskParams,
} from "./models/taskDefinition";
import { TaskGenerator } from "./services/taskGenerator";
import { TasksFileService } from "./services/tasksFileService";

export function activate(context: vscode.ExtensionContext) {
  console.log(".NET Tasks Kit extension is now active");

  const createPublishTaskCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.createPublishTask",
    async () => {
      TaskPanel.createOrShow(context.extensionUri, DotnetCommand.publish);
    },
  );

  const createBuildTaskCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.createBuildTask",
    async () => {
      TaskPanel.createOrShow(context.extensionUri, DotnetCommand.build);
    },
  );

  const onTaskSubmitCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.internal.onTaskSubmit",
    async (
      data: PublishTaskParams | BuildTaskParams,
      command: DotnetCommand,
    ) => {
      try {
        // 1. Validate (Optional, UI should handle most)
        // TaskGenerator.validateConstraints(data) ...

        // 2. Generate Task
        let task;
        if (command === DotnetCommand.publish) {
          task = TaskGenerator.generatePublishTask(data as PublishTaskParams);
        } else {
          task = TaskGenerator.generateBuildTask(data as BuildTaskParams);
        }

        // 3. Find Workspace Folder
        // data.project is a relative path like "src/MyProject.csproj"
        // We need to find which workspace folder it belongs to.
        // If single root, it's easy. If multi-root, we check each.
        let workspaceFolder: vscode.WorkspaceFolder | undefined;

        if (vscode.workspace.workspaceFolders) {
          // Default to first folder if single root
          if (vscode.workspace.workspaceFolders.length === 1) {
            workspaceFolder = vscode.workspace.workspaceFolders[0];
          } else {
            // Multi-root handling logic
            // In multi-root, vscode.workspace.asRelativePath returns "FolderName/path/to/file"
            // We can try to parse the FolderName from the start of data.project
            // for (const folder of vscode.workspace.workspaceFolders) { ... }

            // For MVP, we will assume single root or first root.
            // TODO: Improve multi-root resolution
            workspaceFolder = vscode.workspace.workspaceFolders[0];
          }
        }

        if (!workspaceFolder) {
          vscode.window.showErrorMessage("No workspace folder found.");
          return;
        }

        // 4. Write to tasks.json
        await TasksFileService.addTaskToTasksJson(task, workspaceFolder);

        vscode.window.showInformationMessage(
          `Task "${task.label}" created successfully!`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error}`);
        console.error(error);
      }
    },
  );

  context.subscriptions.push(createPublishTaskCommand);
  context.subscriptions.push(createBuildTaskCommand);
  context.subscriptions.push(onTaskSubmitCommand);
}

export function deactivate() {
  console.log(".NET Tasks Kit extension is now deactivated");
}
