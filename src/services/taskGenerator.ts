import * as path from 'path';
import {
	PublishTaskParams,
	BuildTaskParams,
	VscodeTask,
	DotnetCommand
} from '../models/taskDefinition';
import {
	PARAMETER_CONSTRAINTS
} from '../models/dotnetParameters';

export class TaskGenerator {

	/**
	 * Generates a VS Code task for dotnet publish
	 */
	public static generatePublishTask(params: PublishTaskParams): VscodeTask {
		const args: string[] = ['publish', params.project];
		
		// Add standard parameters
		if (params.configuration) { args.push('--configuration', params.configuration); }
		if (params.framework) { args.push('--framework', params.framework); }
		if (params.runtime) { args.push('--runtime', params.runtime); }
		if (params.output) { args.push('--output', params.output); }
		if (params.arch) { args.push('--arch', params.arch); }
		if (params.os) { args.push('--os', params.os); }
		if (params.source) { args.push('--source', params.source); }
		if (params.verbosity) { args.push('--verbosity', params.verbosity); }
		if (params.versionSuffix) { args.push('--version-suffix', params.versionSuffix); }

		// Add boolean flags
		if (params.selfContained) { args.push('--self-contained'); }
		if (params.noBuild) { args.push('--no-build'); }
		if (params.noRestore) { args.push('--no-restore'); }
		if (params.useCurrentRuntime) { args.push('--use-current-runtime'); }
		if (params.force) { args.push('--force'); }

		// Add MSBuild properties
		if (params.publishSingleFile) { args.push('-p:PublishSingleFile=true'); }
		if (params.publishTrimmed) { args.push('-p:PublishTrimmed=true'); }
		if (params.publishReadyToRun) { args.push('-p:PublishReadyToRun=true'); }
		if (params.publishAot) { args.push('-p:PublishAot=true'); }

		return {
			label: params.taskLabel || this.generateDefaultLabel(params, DotnetCommand.publish),
			type: 'shell',
			command: 'dotnet',
			args: args,
			problemMatcher: '$msCompile',
			group: 'build'
		};
	}

	/**
	 * Generates a VS Code task for dotnet build
	 */
	public static generateBuildTask(params: BuildTaskParams): VscodeTask {
		const args: string[] = ['build', params.project];

		// Add standard parameters
		if (params.configuration) { args.push('--configuration', params.configuration); }
		if (params.framework) { args.push('--framework', params.framework); }
		if (params.runtime) { args.push('--runtime', params.runtime); }
		if (params.output) { args.push('--output', params.output); }
		if (params.arch) { args.push('--arch', params.arch); }
		if (params.os) { args.push('--os', params.os); }
		if (params.verbosity) { args.push('--verbosity', params.verbosity); }

		// Add boolean flags
		if (params.noRestore) { args.push('--no-restore'); }
		if (params.noIncremental) { args.push('--no-incremental'); }
		if (params.noDependencies) { args.push('--no-dependencies'); }

		return {
			label: params.taskLabel || this.generateDefaultLabel(params, DotnetCommand.build),
			type: 'shell',
			command: 'dotnet',
			args: args,
			problemMatcher: '$msCompile',
			group: {
				kind: 'build',
				isDefault: true
			}
		};
	}

	/**
	 * Generates a default label for the task
	 */
	public static generateDefaultLabel(params: PublishTaskParams | BuildTaskParams, type: DotnetCommand): string {
		const projectName = path.basename(params.project, path.extname(params.project));
		const config = params.configuration ? ` - ${params.configuration}` : '';
		const framework = params.framework ? ` - ${params.framework}` : '';
		
		// e.g. "publish: MyProject - Release - net8.0"
		return `${type}: ${projectName}${config}${framework}`;
	}

	/**
	 * Validates parameters against constraints
	 * Returns an array of error messages, empty if valid
	 */
	public static validateConstraints(params: PublishTaskParams): string[] {
		const errors: string[] = [];
		const constraints = PARAMETER_CONSTRAINTS;

		// Constraint: selfContained requires runtime, arch, or os
		if (params.selfContained) {
			if (!params.runtime && !params.arch && !params.os) {
				errors.push(constraints.selfContained.description);
			}
		}

		// Constraint: arch vs runtime (mutually exclusive in UI usually, but CLI can technically mix but it's weird. 
		// The constraints model says mutuallyExclusiveWith)
		if (params.arch && params.runtime) {
			errors.push(constraints.arch.description);
		}

		// Constraint: os vs runtime
		if (params.os && params.runtime) {
			errors.push(constraints.os.description);
		}

		// Constraint: PublishSingleFile requires SelfContained
		if (params.publishSingleFile && !params.selfContained) {
			errors.push(constraints.publishSingleFile.description);
		}

		// Constraint: PublishTrimmed requires SelfContained
		if (params.publishTrimmed && !params.selfContained) {
			errors.push(constraints.publishTrimmed.description);
		}

		return errors;
	}
}
