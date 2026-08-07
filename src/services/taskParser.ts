import * as path from 'path';
import {
	BuildTaskParams,
	DotnetCommand,
	PublishTaskParams,
	VscodeTask
} from '../models/taskDefinition';

/**
 * Result of reverse-parsing a tasks.json task into form parameters
 */
export interface ParsedTask {
	command: DotnetCommand;
	params: PublishTaskParams | BuildTaskParams;
	/** Arguments the form cannot represent, preserved verbatim to re-append on save */
	extraArgs: string[];
}

/** Minimal structural type so the parser stays free of the vscode API */
interface WorkspaceFolderLike {
	uri: { fsPath: string };
}

/* eslint-disable @typescript-eslint/naming-convention -- lookup keys are dotnet CLI flag names */
/** Value-taking CLI options that the webview form can edit */
const VALUE_OPTIONS: Record<string, 'configuration' | 'framework' | 'runtime' | 'output' | 'arch' | 'verbosity' | 'versionSuffix'> = {
	'--configuration': 'configuration',
	'-c': 'configuration',
	'--framework': 'framework',
	'-f': 'framework',
	'--runtime': 'runtime',
	'-r': 'runtime',
	'--output': 'output',
	'-o': 'output',
	'--arch': 'arch',
	'-a': 'arch',
	'--verbosity': 'verbosity',
	'-v': 'verbosity',
	'--version-suffix': 'versionSuffix'
};

/** Boolean CLI flags that the webview form can edit (publish only) */
const PUBLISH_BOOL_FLAGS: Record<string, keyof PublishTaskParams> = {
	'--self-contained': 'selfContained',
	'--no-build': 'noBuild',
	'--no-restore': 'noRestore'
};

/** Boolean CLI flags that the webview form can edit (build only) */
const BUILD_BOOL_FLAGS: Record<string, keyof BuildTaskParams> = {
	'--no-restore': 'noRestore',
	'--no-incremental': 'noIncremental',
	'--no-dependencies': 'noDependencies'
};

/** MSBuild properties (lowercase) that the webview form can edit */
const MSBUILD_BOOL_PROPS: Record<string, keyof PublishTaskParams> = {
	'publishsinglefile': 'publishSingleFile',
	'publishtrimmed': 'publishTrimmed',
	'publishreadytorun': 'publishReadyToRun',
	'publishaot': 'publishAot'
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Reverse-parses a `dotnet publish` / `dotnet build` task from tasks.json
 * back into the parameters the webview form can edit.
 *
 * Only options the form represents are mapped into params; anything else
 * (e.g. `--os`, `--source`, custom `-p:Foo=1`) is kept in extraArgs so it
 * can be re-appended verbatim when the task is saved again.
 */
export class TaskParser {

	/**
	 * Returns the dotnet subcommand if the task invokes `dotnet publish` or
	 * `dotnet build`, undefined otherwise. Cheap predicate for filtering.
	 */
	public static getDotnetCommand(task: VscodeTask): DotnetCommand | undefined {
		if (!TaskParser.isDotnetExecutable(task.command)) {
			return undefined;
		}
		const first = TaskParser.argValues(task)[0];
		if (first === DotnetCommand.publish || first === DotnetCommand.build) {
			return first;
		}
		return undefined;
	}

	/**
	 * Parses a task into form parameters. Returns undefined when the task is
	 * not a recognizable `dotnet publish`/`dotnet build` invocation or when
	 * the project path cannot be mapped back into the workspace.
	 */
	public static parse(task: VscodeTask, workspaceFolder?: WorkspaceFolderLike): ParsedTask | undefined {
		const command = TaskParser.getDotnetCommand(task);
		if (!command || !task.args) {
			return undefined;
		}

		const tokens = TaskParser.argValues(task);

		// The project argument (if present) directly follows the subcommand
		let projectToken: string | undefined;
		let index = 1;
		if (tokens[1] && !tokens[1].startsWith('-') && !tokens[1].startsWith('/')) {
			projectToken = tokens[1];
			index = 2;
		}
		if (!projectToken) {
			// The form is project-centric; a task without a project argument
			// (builds the cwd project implicitly) cannot be represented.
			return undefined;
		}

		const project = TaskParser.workspaceRelativeProject(task, projectToken, workspaceFolder);
		if (!project) {
			return undefined;
		}

		const params: Record<string, unknown> = { taskLabel: task.label, project };
		const extraArgs: string[] = [];
		const boolFlags: Record<string, string> = command === DotnetCommand.publish
			? PUBLISH_BOOL_FLAGS
			: BUILD_BOOL_FLAGS;

		for (; index < tokens.length; index++) {
			const raw = tokens[index];

			// MSBuild properties: -p:Name=Value, /p:Name=Value, --property:Name=Value
			const propMatch = /^(?:-p:|\/p:|--property:)([^=]+?)(?:=(.*))?$/i.exec(raw);
			if (propMatch) {
				const field = command === DotnetCommand.publish
					? MSBUILD_BOOL_PROPS[propMatch[1].trim().toLowerCase()]
					: undefined;
				if (field && (propMatch[2] ?? '').trim().toLowerCase() === 'true') {
					params[field] = true;
				} else {
					extraArgs.push(raw);
				}
				continue;
			}

			// Split --flag=value syntax
			let flag = raw;
			let inlineValue: string | undefined;
			const eq = raw.indexOf('=');
			if (raw.startsWith('-') && eq > 0) {
				flag = raw.slice(0, eq);
				inlineValue = raw.slice(eq + 1);
			}
			const lowerFlag = flag.toLowerCase();

			if (lowerFlag in VALUE_OPTIONS) {
				let value = inlineValue;
				if (value === undefined && index + 1 < tokens.length) {
					value = tokens[++index];
				}
				if (value !== undefined) {
					params[VALUE_OPTIONS[lowerFlag]] = value;
				}
				continue;
			}

			if (lowerFlag in boolFlags) {
				let value = inlineValue;
				if (value === undefined && index + 1 < tokens.length && /^(true|false)$/i.test(tokens[index + 1])) {
					value = tokens[++index];
				}
				// An explicit `false` equals the CLI default, so it is simply omitted
				if (value === undefined || value.toLowerCase() === 'true') {
					params[boolFlags[lowerFlag]] = true;
				}
				continue;
			}

			extraArgs.push(raw);
		}

		return {
			command,
			params: params as unknown as PublishTaskParams | BuildTaskParams,
			extraArgs
		};
	}

	private static isDotnetExecutable(command: string): boolean {
		if (!command) {
			return false;
		}
		const base = path.basename(command.replace(/\\/g, '/')).toLowerCase();
		return base === 'dotnet' || base === 'dotnet.exe';
	}

	/** Normalizes args elements (string | number | boolean | quoted-arg object) to plain strings */
	private static argValues(task: VscodeTask): string[] {
		return (task.args || []).map((arg) => {
			if (arg !== null && typeof arg === 'object' && 'value' in arg) {
				return String(arg.value);
			}
			return String(arg);
		});
	}

	/**
	 * Maps the project argument back to a workspace-relative path using the
	 * task's options.cwd. Returns undefined when the cwd cannot be resolved
	 * inside the workspace (e.g. named multi-root variables, outside paths).
	 */
	private static workspaceRelativeProject(
		task: VscodeTask,
		projectToken: string,
		workspaceFolder?: WorkspaceFolderLike
	): string | undefined {
		const cwd = task.options?.cwd;
		if (!cwd) {
			// No cwd: the project argument is already relative to the workspace root
			return projectToken;
		}

		let dir = cwd.replace(/\\/g, '/');
		const folderVariable = '${workspaceFolder}';
		if (dir.startsWith(folderVariable)) {
			dir = dir.slice(folderVariable.length).replace(/^\/+/, '');
		} else if (dir.startsWith('${workspaceFolder:')) {
			// Named workspace folder variable: cannot resolve without more context
			return undefined;
		} else if (path.isAbsolute(dir) || /^[a-zA-Z]:\//.test(dir)) {
			if (!workspaceFolder) {
				return undefined;
			}
			const relative = path.relative(workspaceFolder.uri.fsPath, cwd).replace(/\\/g, '/');
			if (relative.startsWith('..')) {
				return undefined;
			}
			dir = relative;
		}
		// Otherwise dir is already relative to the workspace root

		dir = dir.replace(/\/+$/, '');
		return dir ? `${dir}/${projectToken}` : projectToken;
	}
}
