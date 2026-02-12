import * as vscode from 'vscode';
import * as path from 'path';
import type { PublishProfile } from '../models/messageProtocol';

/**
 * Represents metadata for a discovered .NET project file
 */
export interface ProjectInfo {
	/** Project name (filename without extension) */
	name: string;
	/** Absolute file path (fsPath) */
	filePath: string;
	/** Workspace-relative path */
	relativePath: string;
	/** Project file type */
	type: 'csproj' | 'fsproj';
	/** Workspace folder name containing this project */
	workspaceFolder: string;
}

export interface ProjectMetadata {
	frameworks: string[];
	runtimeIdentifiers: string[];
	platforms: string[];
	configurations: string[];
	publishProfiles: PublishProfile[];
}

export interface ProjectWithMetadata extends ProjectInfo {
	metadata: ProjectMetadata;
}

/**
 * Scans workspace folders for .NET project files (.csproj, .fsproj)
 * @param workspaceFolders Array of workspace folders to scan
 * @returns Promise resolving to array of discovered projects
 */
export async function scanProjects(
	workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined
): Promise<ProjectInfo[]> {
	// Handle undefined or empty workspace folders
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return [];
	}

	const projects: ProjectInfo[] = [];

	// Scan each workspace folder
	for (const folder of workspaceFolders) {
		try {
			// Find all project files in this workspace folder
			const projectUris = await vscode.workspace.findFiles(
				new vscode.RelativePattern(folder, '**/*.{csproj,fsproj}'),
				new vscode.RelativePattern(folder, '**/bin/**')
			);

			// Additionally exclude obj and node_modules directories
			const filteredUris = projectUris.filter((uri) => {
				const fsPath = uri.fsPath;
				return !fsPath.includes(`${path.sep}obj${path.sep}`) &&
					!fsPath.includes(`${path.sep}node_modules${path.sep}`);
			});

			// Map each URI to ProjectInfo
			for (const uri of filteredUris) {
				const fsPath = uri.fsPath;
				const fileName = path.basename(fsPath);
				const ext = path.extname(fileName).slice(1); // Remove leading dot

				// Determine project type
				const type = ext === 'csproj' ? 'csproj' : 'fsproj';

				// Calculate workspace-relative path
				const relativePath = path.relative(folder.uri.fsPath, fsPath);

				// Project name is filename without extension
				const name = path.basename(fsPath, path.extname(fsPath));

				projects.push({
					name,
					filePath: fsPath,
					relativePath,
					type,
					workspaceFolder: folder.name,
				});
			}
		} catch (error) {
			console.error(`Error scanning workspace folder ${folder.name}:`, error);
		}
	}

	return projects;
}

export async function scanProjectsWithMetadata(
	workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined
): Promise<ProjectWithMetadata[]> {
	const projects = await scanProjects(workspaceFolders);
	const results: ProjectWithMetadata[] = [];
	for (const project of projects) {
		const metadata = await readProjectMetadata(project.filePath);
		results.push({
			...project,
			metadata
		});
	}
	return results;
}

async function readProjectMetadata(filePath: string): Promise<ProjectMetadata> {
	try {
		const contentBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
		const content = Buffer.from(contentBuffer).toString('utf8');
		const frameworks = extractFrameworks(content);
		const runtimeIdentifiers = extractRuntimeIdentifiers(content);
		const platforms = extractPlatforms(content);
		const configurations = await extractConfigurations(content, filePath);
		const publishProfiles = await extractPublishProfiles(filePath);
		return {
			frameworks,
			runtimeIdentifiers,
			platforms,
			configurations,
			publishProfiles
		};
	} catch {
		return {
			frameworks: ['net8.0'],
			runtimeIdentifiers: [],
			platforms: ['Any CPU', 'x64', 'x86', 'arm64'],
			configurations: ['Debug', 'Release'],
			publishProfiles: []
		};
	}
}

function extractFrameworks(content: string): string[] {
	const single = firstTagValue(content, 'TargetFramework');
	const multi = firstTagValue(content, 'TargetFrameworks');
	const values = single ? [single] : splitBySemicolon(multi);
	return values.length > 0 ? unique(values) : ['net8.0'];
}

function extractRuntimeIdentifiers(content: string): string[] {
	const single = firstTagValue(content, 'RuntimeIdentifier');
	const multi = firstTagValue(content, 'RuntimeIdentifiers');
	const values = single ? [single] : splitBySemicolon(multi);
	return unique(values);
}

function extractPlatforms(content: string): string[] {
	const platformTarget = firstTagValue(content, 'PlatformTarget');
	const platforms = firstTagValue(content, 'Platforms');
	const values = unique([
		...splitBySemicolon(platforms),
		...(platformTarget ? [platformTarget] : [])
	]);
	if (!values.some((v) => normalizePlatform(v) === 'any cpu')) {
		values.unshift('Any CPU');
	}
	return values.length > 0 ? values : ['Any CPU', 'x64', 'x86', 'arm64'];
}

async function extractConfigurations(content: string, projectPath: string): Promise<string[]> {
	const projectConfigurations = splitBySemicolon(firstTagValue(content, 'Configurations'));
	if (projectConfigurations.length > 0) {
		return unique(projectConfigurations);
	}

	const propsConfigurations = await readConfigurationsFromDirectoryProps(projectPath);
	if (propsConfigurations.length > 0) {
		return propsConfigurations;
	}

	return ['Debug', 'Release'];
}

async function readConfigurationsFromDirectoryProps(projectPath: string): Promise<string[]> {
	let currentDir = path.dirname(projectPath);
	const root = path.parse(currentDir).root;
	while (currentDir.length > 0) {
		const propsPath = path.join(currentDir, 'Directory.Build.props');
		try {
			const data = await vscode.workspace.fs.readFile(vscode.Uri.file(propsPath));
			const content = Buffer.from(data).toString('utf8');
			const values = splitBySemicolon(firstTagValue(content, 'Configurations'));
			if (values.length > 0) {
				return unique(values);
			}
		} catch (error) {
			void error;
		}

		if (currentDir === root) {
			break;
		}
		const parent = path.dirname(currentDir);
		if (parent === currentDir) {
			break;
		}
		currentDir = parent;
	}
	return [];
}

async function extractPublishProfiles(projectPath: string): Promise<PublishProfile[]> {
	const projectDir = path.dirname(projectPath);
	const profilesDir = path.join(projectDir, 'Properties', 'PublishProfiles');
	try {
		const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(profilesDir));
		const files = entries.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.pubxml'));
		const profiles: PublishProfile[] = [];
		for (const [name] of files) {
			const filePath = path.join(profilesDir, name);
			const data = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
			const content = Buffer.from(data).toString('utf8');
			profiles.push({
				name: path.basename(name, '.pubxml'),
				configuration: firstTagValue(content, 'Configuration') || undefined,
				framework: firstTagValue(content, 'TargetFramework') || undefined,
				runtimeIdentifier: firstTagValue(content, 'RuntimeIdentifier') || undefined,
				selfContained: parseBool(firstTagValue(content, 'SelfContained')),
				publishSingleFile: parseBool(firstTagValue(content, 'PublishSingleFile')),
				publishReadyToRun: parseBool(firstTagValue(content, 'PublishReadyToRun')),
				publishTrimmed: parseBool(firstTagValue(content, 'PublishTrimmed')),
				publishAot: parseBool(firstTagValue(content, 'PublishAot')),
				publishDir: firstTagValue(content, 'PublishDir') || undefined
			});
		}
		return profiles;
	} catch {
		return [];
	}
}

function firstTagValue(content: string, tagName: string): string {
	const regex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i');
	const match = content.match(regex);
	return match && match[1] ? match[1].trim() : '';
}

function splitBySemicolon(value: string): string[] {
	if (!value) {
		return [];
	}
	return value
		.split(';')
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

function normalizePlatform(value: string): string {
	return value.toLowerCase().replace(/\s+/g, ' ');
}

function parseBool(value: string): boolean | undefined {
	if (!value) {
		return undefined;
	}
	const v = value.trim().toLowerCase();
	if (v === 'true') {
		return true;
	}
	if (v === 'false') {
		return false;
	}
	return undefined;
}

/**
 * Creates a file system watcher for .NET project files
 * @returns File system watcher instance
 */
export function createFileWatcher(): vscode.FileSystemWatcher {
	// Watch for .csproj and .fsproj files
	const watcher = vscode.workspace.createFileSystemWatcher(
		'**/*.{csproj,fsproj}',
		false, // Watch creation events
		true, // Ignore change events
		false  // Watch deletion events
	);

	return watcher;
}
