import * as assert from 'assert';
import { TaskParser } from '../../services/taskParser';
import { TaskGenerator } from '../../services/taskGenerator';
import {
	BuildTaskParams,
	DotnetCommand,
	PublishTaskParams,
	VscodeTask
} from '../../models/taskDefinition';

suite('TaskParser Test Suite', () => {

	test('getDotnetCommand should identify publish and build tasks', () => {
		const publishTask = TaskGenerator.generatePublishTask({ taskLabel: 'p', project: 'A.csproj' });
		const buildTask = TaskGenerator.generateBuildTask({ taskLabel: 'b', project: 'A.csproj' });

		assert.strictEqual(TaskParser.getDotnetCommand(publishTask), DotnetCommand.publish);
		assert.strictEqual(TaskParser.getDotnetCommand(buildTask), DotnetCommand.build);
	});

	test('getDotnetCommand should reject non-dotnet or other subcommands', () => {
		const echoTask: VscodeTask = { label: 'x', type: 'shell', command: 'echo', args: ['publish'] };
		const testTask: VscodeTask = { label: 'x', type: 'shell', command: 'dotnet', args: ['test', 'A.csproj'] };

		assert.strictEqual(TaskParser.getDotnetCommand(echoTask), undefined);
		assert.strictEqual(TaskParser.getDotnetCommand(testTask), undefined);
	});

	test('getDotnetCommand should accept dotnet.exe and full paths', () => {
		const exeTask: VscodeTask = { label: 'x', type: 'shell', command: 'dotnet.exe', args: ['build', 'A.csproj'] };
		const pathTask: VscodeTask = { label: 'x', type: 'shell', command: 'C:\\Program Files\\dotnet\\dotnet.exe', args: ['build', 'A.csproj'] };

		assert.strictEqual(TaskParser.getDotnetCommand(exeTask), DotnetCommand.build);
		assert.strictEqual(TaskParser.getDotnetCommand(pathTask), DotnetCommand.build);
	});

	test('parse should round-trip a generated publish task', () => {
		const params: PublishTaskParams = {
			taskLabel: 'Pub Quarry win64',
			project: 'Quarry.csproj',
			configuration: 'Release',
			framework: 'net8.0',
			runtime: 'win-x64',
			output: 'bin\\Publish\\net8.0\\win-x64\\',
			verbosity: 'normal',
			selfContained: true,
			publishSingleFile: true,
			publishAot: true,
			includeNativeLibrariesForSelfExtract: true
		};
		const task = TaskGenerator.generatePublishTask(params, 'src/Quarry');

		const parsed = TaskParser.parse(task);

		assert.ok(parsed);
		assert.strictEqual(parsed.command, DotnetCommand.publish);
		const parsedParams = parsed.params as PublishTaskParams;
		assert.strictEqual(parsedParams.taskLabel, 'Pub Quarry win64');
		assert.strictEqual(parsedParams.project, 'src/Quarry/Quarry.csproj');
		assert.strictEqual(parsedParams.configuration, 'Release');
		assert.strictEqual(parsedParams.framework, 'net8.0');
		assert.strictEqual(parsedParams.runtime, 'win-x64');
		assert.strictEqual(parsedParams.output, 'bin\\Publish\\net8.0\\win-x64\\');
		assert.strictEqual(parsedParams.verbosity, 'normal');
		assert.strictEqual(parsedParams.selfContained, true);
		assert.strictEqual(parsedParams.publishSingleFile, true);
		assert.strictEqual(parsedParams.publishAot, true);
		assert.strictEqual(parsedParams.includeNativeLibrariesForSelfExtract, true);
		assert.deepStrictEqual(parsed.extraArgs, []);
	});

	test('parse should round-trip a generated build task', () => {
		const params: BuildTaskParams = {
			taskLabel: 'Build App',
			project: 'App.csproj',
			configuration: 'Debug',
			framework: 'net9.0',
			noRestore: true,
			noIncremental: true,
			verbosity: 'minimal'
		};
		const task = TaskGenerator.generateBuildTask(params, '');

		const parsed = TaskParser.parse(task);

		assert.ok(parsed);
		assert.strictEqual(parsed.command, DotnetCommand.build);
		const parsedParams = parsed.params as BuildTaskParams;
		assert.strictEqual(parsedParams.project, 'App.csproj');
		assert.strictEqual(parsedParams.configuration, 'Debug');
		assert.strictEqual(parsedParams.framework, 'net9.0');
		assert.strictEqual(parsedParams.noRestore, true);
		assert.strictEqual(parsedParams.noIncremental, true);
		assert.strictEqual(parsedParams.verbosity, 'minimal');
		assert.deepStrictEqual(parsed.extraArgs, []);
	});

	test('parse should preserve unrecognized args as extraArgs', () => {
		const task: VscodeTask = {
			label: 'custom',
			type: 'shell',
			command: 'dotnet',
			args: [
				'publish', 'App.csproj',
				'--runtime', 'win-x64',
				'--os', 'win',
				'--disable-build-servers',
				'-p:CustomProp=1'
			]
		};

		const parsed = TaskParser.parse(task);

		assert.ok(parsed);
		assert.strictEqual((parsed.params as PublishTaskParams).runtime, 'win-x64');
		assert.deepStrictEqual(parsed.extraArgs, ['--os', 'win', '--disable-build-servers', '-p:CustomProp=1']);
	});

	test('parse should handle --flag=value syntax and short option names', () => {
		const task: VscodeTask = {
			label: 'eq',
			type: 'shell',
			command: 'dotnet',
			args: ['publish', 'App.csproj', '--runtime=linux-x64', '-c', 'Release', '-f=net8.0']
		};

		const parsed = TaskParser.parse(task);

		assert.ok(parsed);
		const parsedParams = parsed.params as PublishTaskParams;
		assert.strictEqual(parsedParams.runtime, 'linux-x64');
		assert.strictEqual(parsedParams.configuration, 'Release');
		assert.strictEqual(parsedParams.framework, 'net8.0');
		assert.deepStrictEqual(parsed.extraArgs, []);
	});

	test('parse should handle boolean flags with explicit values', () => {
		const task: VscodeTask = {
			label: 'bool',
			type: 'shell',
			command: 'dotnet',
			args: ['publish', 'App.csproj', '--self-contained', 'true', '--no-restore=false']
		};

		const parsed = TaskParser.parse(task);

		assert.ok(parsed);
		const parsedParams = parsed.params as PublishTaskParams;
		assert.strictEqual(parsedParams.selfContained, true);
		assert.strictEqual(parsedParams.noRestore, undefined);
	});

	test('parse should handle quoted-arg objects', () => {
		const task: VscodeTask = {
			label: 'quoted',
			type: 'shell',
			command: 'dotnet',
			args: ['build', { value: 'My App.csproj', quoting: 'strong' }, '--configuration', 'Debug']
		};

		const parsed = TaskParser.parse(task);

		assert.ok(parsed);
		assert.strictEqual(parsed.params.project, 'My App.csproj');
		assert.strictEqual((parsed.params as BuildTaskParams).configuration, 'Debug');
	});

	test('parse should return undefined when the project argument is missing', () => {
		const task: VscodeTask = {
			label: 'noproject',
			type: 'shell',
			command: 'dotnet',
			args: ['publish', '--configuration', 'Release']
		};

		assert.strictEqual(TaskParser.parse(task), undefined);
	});

	test('parse should return undefined for unsupported cwd variables', () => {
		const task: VscodeTask = {
			label: 'multiroot',
			type: 'shell',
			command: 'dotnet',
			args: ['build', 'App.csproj'],
			options: { cwd: '${workspaceFolder:App}/src' }
		};

		assert.strictEqual(TaskParser.parse(task), undefined);
	});

	test('parse should resolve project path from cwd without workspace variable', () => {
		const task: VscodeTask = {
			label: 'relcwd',
			type: 'shell',
			command: 'dotnet',
			args: ['build', 'App.csproj'],
			options: { cwd: 'src\\App' }
		};

		const parsed = TaskParser.parse(task);

		assert.ok(parsed);
		assert.strictEqual(parsed.params.project, 'src/App/App.csproj');
	});
});
