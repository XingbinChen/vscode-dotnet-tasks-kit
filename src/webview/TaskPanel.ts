import * as vscode from 'vscode';
import * as path from 'path';
import { BuildTaskParams, DotnetCommand, PublishTaskParams } from '../models/taskDefinition';
import { ExtensionMessage, ProjectProfile, WebviewMessage } from '../models/messageProtocol';
import { PUBLISH_PARAMETERS, BUILD_PARAMETERS } from '../models/dotnetParameters';
import { scanProjectsWithMetadata } from '../services/projectScanner';

/**
 * Identifies an existing task in tasks.json that is being edited
 */
export interface EditTaskContext {
	folder: vscode.WorkspaceFolder;
	taskIndex: number;
	originalLabel: string;
	existingParams: PublishTaskParams | BuildTaskParams;
}

export class TaskPanel {
	public static currentPanel: TaskPanel | undefined;
	public static readonly viewType = 'dotnetTasksKit';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _currentCommand: DotnetCommand;
	private _editContext: EditTaskContext | undefined;

	private _selectedUri: vscode.Uri | undefined;

	public static createOrShow(extensionUri: vscode.Uri, command: DotnetCommand, uri?: vscode.Uri, editContext?: EditTaskContext) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (TaskPanel.currentPanel) {
			TaskPanel.currentPanel._panel.reveal(column);
			TaskPanel.currentPanel._updateCommand(command, uri, editContext);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			TaskPanel.viewType,
			TaskPanel._titleFor(command, editContext),
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [extensionUri]
			}
		);

		TaskPanel.currentPanel = new TaskPanel(panel, extensionUri, command, uri, editContext);
	}

	private static _titleFor(command: DotnetCommand, editContext?: EditTaskContext): string {
		const kind = command === DotnetCommand.publish ? 'Publish' : 'Build';
		return `${editContext ? 'Edit' : 'Create'} .NET ${kind} Task`;
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, command: DotnetCommand, uri?: vscode.Uri, editContext?: EditTaskContext) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._currentCommand = command;
		this._selectedUri = uri;
		this._editContext = editContext;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			(message: WebviewMessage) => {
				switch (message.type) {
					case 'submit':
						vscode.commands.executeCommand('dotnetTasksKit.internal.onTaskSubmit', message.data, this._currentCommand, this._editContext);
						this.dispose();
						return;
					case 'cancel':
						this.dispose();
						return;
					case 'requestProjects':
						this._sendInitData();
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		TaskPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _updateCommand(command: DotnetCommand, uri?: vscode.Uri, editContext?: EditTaskContext) {
		this._currentCommand = command;
		this._editContext = editContext;
		this._panel.title = TaskPanel._titleFor(command, editContext);
		if (uri) {
			this._selectedUri = uri;
		}
		this._update();
		this._sendInitData();
	}

	private _update() {
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
	}

	private async _sendInitData() {
		const projectInfos = await scanProjectsWithMetadata(vscode.workspace.workspaceFolders);
		const projectProfiles: ProjectProfile[] = projectInfos.map((p) => ({
			path: vscode.workspace.asRelativePath(p.filePath),
			frameworks: p.metadata.frameworks,
			runtimeIdentifiers: p.metadata.runtimeIdentifiers,
			platforms: p.metadata.platforms,
			configurations: p.metadata.configurations,
			publishProfiles: p.metadata.publishProfiles
		}));
		const projects = projectProfiles.map((p) => p.path);
		
		const parameters = this._currentCommand === DotnetCommand.publish 
			? PUBLISH_PARAMETERS 
			: BUILD_PARAMETERS;

		const message: ExtensionMessage = {
			type: 'init',
			command: this._currentCommand,
			projects: projects,
			projectProfiles,
			pathSeparator: path.sep === '\\' ? '\\' : '/',
			parameters: parameters,
			selectedUri: this._selectedUri?.fsPath,
			existingParams: this._editContext?.existingParams
		};

		this._panel.webview.postMessage(message);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>.NET Tasks</title>
			</head>
			<body>
				<div id="app"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
