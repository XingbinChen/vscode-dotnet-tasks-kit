/**
 * .NET command types for task generation
 */
export enum DotnetCommand {
	publish = 'publish',
	build = 'build',
}

/**
 * Parameters for dotnet publish task
 */
export interface PublishTaskParams {
	taskLabel: string;
	project: string;
	configuration?: string;
	framework?: string;
	runtime?: string;
	output?: string;
	selfContained?: boolean;
	noBuild?: boolean;
	noRestore?: boolean;
	arch?: string;
	os?: string;
	useCurrentRuntime?: boolean;
	source?: string;
	force?: boolean;
	verbosity?: string;
	versionSuffix?: string;
	publishSingleFile?: boolean;
	publishTrimmed?: boolean;
	publishReadyToRun?: boolean;
	publishAot?: boolean;
}

/**
 * Parameters for dotnet build task (subset of publish)
 */
export interface BuildTaskParams {
	taskLabel: string;
	project: string;
	configuration?: string;
	framework?: string;
	runtime?: string;
	output?: string;
	noRestore?: boolean;
	noIncremental?: boolean;
	noDependencies?: boolean;
	verbosity?: string;
	arch?: string;
	os?: string;
}

/**
 * Single task in VS Code tasks.json
 * Corresponds to VS Code tasks.json schema
 */
export interface VscodeTask {
	label: string;
	type: 'shell' | 'process';
	command: string;
	args?: (string | number | boolean)[];
	group?: {
		kind: 'build' | 'test' | 'run';
		isDefault?: boolean;
	} | string;
	problemMatcher?: string | string[];
	presentation?: {
		echo?: boolean;
		reveal?: 'always' | 'silent' | 'never';
		focus?: boolean;
		panel?: 'shared' | 'dedicated' | 'new';
		showReuseMessage?: boolean;
		clear?: boolean;
		close?: boolean;
	};
	runOptions?: {
		runOn?: 'folderOpen' | 'default';
	};
	isBackground?: boolean;
	promptOnClose?: boolean;
	options?: {
		cwd?: string;
		env?: Record<string, string>;
		shell?: {
			executable?: string;
			args?: string[];
		};
	};
	dependsOn?: string | string[];
	dependsOrder?: 'sequence' | 'parallel';
}

/**
 * Structure of tasks.json file
 */
export interface TasksFile {
	version: string;
	tasks: VscodeTask[];
}
