import * as assert from 'assert';
import { TaskGenerator } from '../../services/taskGenerator';
import { PublishTaskParams, DotnetCommand, BuildTaskParams } from '../../models/taskDefinition';

suite('TaskGenerator Test Suite', () => {
	test('generatePublishTask should include standard parameters', () => {
		const params: PublishTaskParams = {
			taskLabel: 'Test Publish',
			project: 'TestProject.csproj',
			configuration: 'Release',
			framework: 'net8.0',
			runtime: 'win-x64',
			selfContained: true
		};

		const task = TaskGenerator.generatePublishTask(params);

		assert.strictEqual(task.label, 'Test Publish');
		assert.strictEqual(task.command, 'dotnet');
		assert.deepStrictEqual(task.args, [
			'publish',
			'TestProject.csproj',
			'--configuration', 'Release',
			'--framework', 'net8.0',
			'--runtime', 'win-x64',
			'--self-contained'
		]);
	});

	test('generatePublishTask should handle MSBuild properties', () => {
		const params: PublishTaskParams = {
			taskLabel: 'Test AOT',
			project: 'TestProject.csproj',
			publishAot: true,
			publishSingleFile: true
		};

		const task = TaskGenerator.generatePublishTask(params);

		// Check for presence of args
		assert.ok(task.args?.includes('-p:PublishAot=true'));
		assert.ok(task.args?.includes('-p:PublishSingleFile=true'));
	});

	test('generateBuildTask should generate correct args', () => {
		const params: BuildTaskParams = {
			taskLabel: 'Test Build',
			project: 'TestProject.csproj',
			noRestore: true
		};

		const task = TaskGenerator.generateBuildTask(params);

		assert.strictEqual(task.label, 'Test Build');
		assert.deepStrictEqual(task.args, [
			'build',
			'TestProject.csproj',
			'--no-restore'
		]);
	});

	test('generateDefaultLabel should format correctly', () => {
		const params: PublishTaskParams = {
			taskLabel: '',
			project: 'src/MyProject.csproj',
			configuration: 'Release',
			framework: 'net6.0'
		};

		const label = TaskGenerator.generateDefaultLabel(params, DotnetCommand.publish);
		assert.strictEqual(label, 'publish: MyProject - Release - net6.0');
	});

	test('validateConstraints should detect conflicts', () => {
		const params: PublishTaskParams = {
			taskLabel: 'Invalid',
			project: 'P',
			selfContained: true,
			// Missing runtime/arch/os
		};

		const errors = TaskGenerator.validateConstraints(params);
		assert.ok(errors.length > 0);
		assert.ok(errors[0].includes('Self-contained requires'));
	});
});
