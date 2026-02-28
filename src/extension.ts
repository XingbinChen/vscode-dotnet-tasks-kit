import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';
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

  const onTaskSubmitCommand = vscode.commands.registerCommand(
    "dotnetTasksKit.internal.onTaskSubmit",
    async (
      data: PublishTaskParams | BuildTaskParams,
      command: DotnetCommand,
    ) => {
      try {
        // 1. Find Workspace Folder
        // data.project is a relative path like "src/MyProject.csproj"
        let workspaceFolder: vscode.WorkspaceFolder | undefined;

        if (vscode.workspace.workspaceFolders) {
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
