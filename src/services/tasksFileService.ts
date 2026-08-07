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

	/**
	 * Reads all tasks from .vscode/tasks.json.
	 * Returns an empty array when the file is missing or cannot be parsed,
	 * so read-only consumers (e.g. the tasks tree view) stay stable.
	 */
	public static async getTasks(workspaceFolder: vscode.WorkspaceFolder): Promise<VscodeTask[]> {
		const tasksJsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'tasks.json');
		if (!fs.existsSync(tasksJsonPath)) {
			return [];
		}

		const content = fs.readFileSync(tasksJsonPath, 'utf8');
		const errors: jsonc.ParseError[] = [];
		const rootNode = jsonc.parseTree(content, errors);
		if (errors.length > 0 || !rootNode) {
			return [];
		}

		const tasksNode = jsonc.findNodeAtLocation(rootNode, ['tasks']);
		if (!tasksNode) {
			return [];
		}

		const tasks = jsonc.getNodeValue(tasksNode);
		return Array.isArray(tasks) ? tasks as VscodeTask[] : [];
	}

	/**
	 * Surgically updates a single task in .vscode/tasks.json, preserving all
	 * other tasks, comments, and unmanaged fields of the task itself.
	 * Only the given fields are touched; passing cwd as undefined removes it.
	 *
	 * @param expectedLabel Label the task had when editing started; the update
	 * fails if the task at taskIndex no longer carries it (file was edited meanwhile)
	 */
	public static async updateTaskInTasksJson(
		workspaceFolder: vscode.WorkspaceFolder,
		taskIndex: number,
		expectedLabel: string,
		updates: { label?: string; args?: VscodeTask['args']; cwd?: string }
	): Promise<void> {
		const tasksJsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'tasks.json');
		if (!fs.existsSync(tasksJsonPath)) {
			throw new Error(`tasks.json not found at ${tasksJsonPath}`);
		}

		const modificationOptions: jsonc.ModificationOptions = { formattingOptions: { insertSpaces: true, tabSize: 4 } };
		let content = fs.readFileSync(tasksJsonPath, 'utf8');

		const errors: jsonc.ParseError[] = [];
		const rootNode = jsonc.parseTree(content, errors);
		if (errors.length > 0 || !rootNode) {
			throw new Error(`Invalid tasks.json file at ${tasksJsonPath}`);
		}

		const tasksNode = jsonc.findNodeAtLocation(rootNode, ['tasks']);
		const tasks = tasksNode ? jsonc.getNodeValue(tasksNode) : undefined;
		const current: VscodeTask | undefined = Array.isArray(tasks) ? tasks[taskIndex] : undefined;
		if (!current || current.label !== expectedLabel) {
			throw new Error(`Task "${expectedLabel}" was not found at its previous position in tasks.json. The file may have been edited; please try again.`);
		}

		if (updates.label !== undefined && updates.label !== current.label) {
			content = jsonc.applyEdits(content, jsonc.modify(content, ['tasks', taskIndex, 'label'], updates.label, modificationOptions));
		}
		if (updates.args) {
			content = jsonc.applyEdits(content, jsonc.modify(content, ['tasks', taskIndex, 'args'], updates.args, modificationOptions));
		}
		if (updates.cwd) {
			content = jsonc.applyEdits(content, jsonc.modify(content, ['tasks', taskIndex, 'options', 'cwd'], updates.cwd, modificationOptions));
		} else if (current.options && 'cwd' in current.options) {
			// undefined value removes the property
			content = jsonc.applyEdits(content, jsonc.modify(content, ['tasks', taskIndex, 'options', 'cwd'], undefined, modificationOptions));
		}

		fs.writeFileSync(tasksJsonPath, content, 'utf8');
	}
}
