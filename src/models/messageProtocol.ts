import { DotnetCommand, PublishTaskParams, BuildTaskParams } from './taskDefinition';
import { ParameterMeta } from './dotnetParameters';

export type ExtensionMessage =
	| {
		type: 'init';
		command: DotnetCommand;
		projects: string[];
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
