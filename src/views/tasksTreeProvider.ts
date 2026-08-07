import * as vscode from 'vscode';
import { DotnetCommand, VscodeTask } from '../models/taskDefinition';
import { TaskParser } from '../services/taskParser';
import { TasksFileService } from '../services/tasksFileService';

/**
 * A single dotnet publish/build task found in a workspace folder's tasks.json
 */
export class DotnetTaskItem extends vscode.TreeItem {
	constructor(
		public readonly folder: vscode.WorkspaceFolder,
		public readonly taskIndex: number,
		public readonly task: VscodeTask,
		public readonly dotnetCommand: DotnetCommand
	) {
		super(task.label, vscode.TreeItemCollapsibleState.None);
		this.description = dotnetCommand;
		this.contextValue = 'dotnetTask';
		this.iconPath = new vscode.ThemeIcon(dotnetCommand === DotnetCommand.publish ? 'package' : 'tools');
		const args = (task.args || []).map((a) => String(a)).join(' ');
		this.tooltip = `${folder.name}: dotnet ${args}`;
	}
}

/**
 * Grouping node shown in multi-root workspaces
 */
class WorkspaceFolderItem extends vscode.TreeItem {
	constructor(public readonly folder: vscode.WorkspaceFolder) {
		super(folder.name, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = 'dotnetTasksFolder';
		this.iconPath = vscode.ThemeIcon.Folder;
	}
}

/**
 * Tree data provider listing dotnet publish/build tasks from the
 * .vscode/tasks.json files of all workspace folders.
 */
export class TasksTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
	public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	public refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	public async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		if (element instanceof WorkspaceFolderItem) {
			return this.getTaskItems(element.folder);
		}
		if (element) {
			return [];
		}

		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length > 1) {
			return folders.map((f) => new WorkspaceFolderItem(f));
		}
		if (folders.length === 1) {
			return this.getTaskItems(folders[0]);
		}
		return [];
	}

	private async getTaskItems(folder: vscode.WorkspaceFolder): Promise<DotnetTaskItem[]> {
		const tasks = await TasksFileService.getTasks(folder);
		const items: DotnetTaskItem[] = [];
		tasks.forEach((task, index) => {
			const dotnetCommand = TaskParser.getDotnetCommand(task);
			if (dotnetCommand) {
				items.push(new DotnetTaskItem(folder, index, task, dotnetCommand));
			}
		});
		return items;
	}
}
