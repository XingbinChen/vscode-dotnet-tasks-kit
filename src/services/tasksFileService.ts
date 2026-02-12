import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { VscodeTask } from '../models/taskDefinition';

export class TasksFileService {
	
	/**
	 * Adds a task to the .vscode/tasks.json file in the workspace
	 * @param task The task object to add
	 * @param workspaceFolder The workspace folder where tasks.json should be located
	 */
	public static async addTaskToTasksJson(task: VscodeTask, workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
		const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
		const tasksJsonPath = path.join(vscodeDir, 'tasks.json');

		// ensure .vscode directory exists
		if (!fs.existsSync(vscodeDir)) {
			fs.mkdirSync(vscodeDir, { recursive: true });
		}

		let fileContent = '{\n\t"version": "2.0.0",\n\t"tasks": []\n}';
		const modificationOptions: jsonc.ModificationOptions = { formattingOptions: { insertSpaces: true, tabSize: 4 } };

		if (fs.existsSync(tasksJsonPath)) {
			fileContent = fs.readFileSync(tasksJsonPath, 'utf8');
		}

		// Check if file is empty
		if (!fileContent.trim()) {
			fileContent = '{\n\t"version": "2.0.0",\n\t"tasks": []\n}';
		}

		const errors: jsonc.ParseError[] = [];
		const rootNode = jsonc.parseTree(fileContent, errors);
		if (errors.length > 0) {
			throw new Error(`Invalid tasks.json file at ${tasksJsonPath}`);
		}
		if (!rootNode) {
			throw new Error(`Unable to parse tasks.json file at ${tasksJsonPath}`);
		}

		const tasksNode = jsonc.findNodeAtLocation(rootNode, ['tasks']);
		
		let edits: jsonc.Edit[] = [];

		if (!tasksNode) {
			// 'tasks' array doesn't exist, insert it
			edits = jsonc.modify(fileContent, ['tasks'], [task], modificationOptions);
		} else {
			// 'tasks' array exists, append to it
			// We insert at the end of the array
			// -1 as index means append
			edits = jsonc.modify(fileContent, ['tasks', -1], task, modificationOptions);
		}

		const newContent = jsonc.applyEdits(fileContent, edits);
		fs.writeFileSync(tasksJsonPath, newContent, 'utf8');
	}

	/**
	 * Checks if a task with the same label already exists
	 */
	public static async hasTaskWithLabel(label: string, workspaceFolder: vscode.WorkspaceFolder): Promise<boolean> {
		const tasksJsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'tasks.json');
		if (!fs.existsSync(tasksJsonPath)) {
			return false;
		}

		const content = fs.readFileSync(tasksJsonPath, 'utf8');
		const tasks = jsonc.parse(content);

		if (!tasks || !tasks.tasks || !Array.isArray(tasks.tasks)) {
			return false;
		}

		return tasks.tasks.some((t: VscodeTask) => t.label === label);
	}
}
