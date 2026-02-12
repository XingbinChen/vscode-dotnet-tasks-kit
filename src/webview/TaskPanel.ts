import * as vscode from 'vscode';
import * as path from 'path';
import { DotnetCommand } from '../models/taskDefinition';
import { ExtensionMessage, ProjectProfile, WebviewMessage } from '../models/messageProtocol';
import { PUBLISH_PARAMETERS, BUILD_PARAMETERS } from '../models/dotnetParameters';
import { scanProjectsWithMetadata } from '../services/projectScanner';

export class TaskPanel {
	public static currentPanel: TaskPanel | undefined;
	public static readonly viewType = 'dotnetTasksKit';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _currentCommand: DotnetCommand;

	public static createOrShow(extensionUri: vscode.Uri, command: DotnetCommand) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (TaskPanel.currentPanel) {
			TaskPanel.currentPanel._panel.reveal(column);
			TaskPanel.currentPanel._updateCommand(command);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			TaskPanel.viewType,
			`Create .NET ${command === DotnetCommand.publish ? 'Publish' : 'Build'} Task`,
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [extensionUri]
			}
		);

		TaskPanel.currentPanel = new TaskPanel(panel, extensionUri, command);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, command: DotnetCommand) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._currentCommand = command;

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
						// Handle submit (will be implemented later via command handler injection or event)
						// For now just log
						console.log('Received submit:', message.data);
						// TODO: Trigger generation and file writing
						vscode.commands.executeCommand('dotnetTasksKit.internal.onTaskSubmit', message.data, this._currentCommand);
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

	private _updateCommand(command: DotnetCommand) {
		this._currentCommand = command;
		this._panel.title = `Create .NET ${command === DotnetCommand.publish ? 'Publish' : 'Build'} Task`;
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
			parameters: parameters
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
