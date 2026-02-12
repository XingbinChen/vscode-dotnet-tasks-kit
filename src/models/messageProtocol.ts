import { DotnetCommand, PublishTaskParams, BuildTaskParams } from './taskDefinition';
import { ParameterMeta } from './dotnetParameters';

export interface ProjectProfile {
	path: string;
	frameworks: string[];
	runtimeIdentifiers: string[];
	platforms: string[];
	configurations: string[];
	publishProfiles: PublishProfile[];
}

export interface PublishProfile {
	name: string;
	configuration?: string;
	framework?: string;
	runtimeIdentifier?: string;
	selfContained?: boolean;
	publishSingleFile?: boolean;
	publishReadyToRun?: boolean;
	publishTrimmed?: boolean;
	publishAot?: boolean;
	publishDir?: string;
}

export type ExtensionMessage =
	| {
		type: 'init';
		command: DotnetCommand;
		projects: string[];
		projectProfiles: ProjectProfile[];
		pathSeparator: '/' | '\\';
		parameters: ParameterMeta[];
	}
	| {
		type: 'validationError';
		field: string;
		message: string;
	};

export type WebviewMessage =
	| {
		type: 'submit';
		data: PublishTaskParams | BuildTaskParams;
	}
	| {
		type: 'cancel';
	}
	| {
		type: 'requestProjects';
	};
