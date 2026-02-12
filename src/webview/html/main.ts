import '@vscode-elements/elements';
import {
	ExtensionMessage,
	ProjectProfile,
	WebviewMessage
} from '../../models/messageProtocol';
import {
	BuildTaskParams,
	DotnetCommand,
	PublishTaskParams
} from '../../models/taskDefinition';

declare function acquireVsCodeApi(): {
	postMessage(message: WebviewMessage): void;
	getState(): unknown;
	setState(state: unknown): void;
};

type DeploymentMode = 'framework-dependent' | 'self-contained';

type FormModel = Partial<PublishTaskParams & BuildTaskParams> & {
	deploymentMode?: DeploymentMode;
	runtimeSelection?: string;
	platform?: string;
	publishProfileName?: string;
};

interface UiState {
	command: DotnetCommand;
	projects: ProjectProfile[];
	form: FormModel;
	outputTouched: boolean;
	runtimeCatalog: string[];
	verbosityCatalog: string[];
	pathSeparator: '/' | '\\';
}

const vscode = acquireVsCodeApi();
const portableRuntime = 'Portable';

const state: UiState = {
	command: DotnetCommand.publish,
	projects: [],
	form: {},
	outputTouched: false,
	runtimeCatalog: [],
	verbosityCatalog: ['quiet', 'minimal', 'normal', 'detailed', 'diagnostic'],
	pathSeparator: '/'
};

window.addEventListener('message', (event: MessageEvent) => {
	const message = event.data as ExtensionMessage;
	if (message.type !== 'init') {
		return;
	}

	state.command = message.command;
	state.projects = message.projectProfiles;
	state.pathSeparator = message.pathSeparator;
	state.runtimeCatalog = parameterOptions(message, '--runtime');
	state.verbosityCatalog = parameterOptions(message, '--verbosity', state.verbosityCatalog);

	const firstProject = state.projects[0];
	const framework = firstProject?.frameworks[0] || 'net8.0';
	const configs = firstProject?.configurations?.length ? firstProject.configurations : parameterOptions(message, '--configuration', ['Debug', 'Release']);
	const configuration = configs.includes('Release') ? 'Release' : configs[0] || 'Release';
	const platform = firstProject?.platforms[0] || 'Any CPU';

	state.form = {
		taskLabel: '',
		project: firstProject?.path || '',
		framework,
		configuration,
		platform,
		publishProfileName: '',
		deploymentMode: 'framework-dependent',
		runtimeSelection: portableRuntime,
		verbosity: state.verbosityCatalog[2] || state.verbosityCatalog[0] || 'normal',
		output: buildDefaultOutputPath(
			message.command,
			configuration,
			framework,
			portableRuntime,
			'framework-dependent'
		)
	};
	state.outputTouched = false;
	applyPublishConstraints();
	render();
});

vscode.postMessage({ type: 'requestProjects' });

function parameterOptions(message: Extract<ExtensionMessage, { type: 'init' }>, name: string, fallback: string[] = []): string[] {
	const item = message.parameters.find((p) => p.name === name);
	if (item?.options && item.options.length > 0) {
		return item.options;
	}
	return fallback;
}

function selectedProject(): ProjectProfile | undefined {
	return state.projects.find((p) => p.path === state.form.project) || state.projects[0];
}

function runtimeOptions(): string[] {
	const project = selectedProject();
	const merged = [...(project?.runtimeIdentifiers || []), ...state.runtimeCatalog];
	const unique = Array.from(new Set(merged));
	if (state.form.deploymentMode === 'self-contained') {
		return unique;
	}
	return [portableRuntime, ...unique];
}

function frameworkOptions(): string[] {
	const project = selectedProject();
	return project?.frameworks?.length ? project.frameworks : ['net8.0'];
}

function platformOptions(): string[] {
	const project = selectedProject();
	return project?.platforms?.length ? project.platforms : ['Any CPU', 'x64', 'x86', 'arm64'];
}

function configurationOptions(): string[] {
	const project = selectedProject();
	return project?.configurations?.length ? project.configurations : ['Debug', 'Release'];
}

function publishProfiles(): ProjectProfile['publishProfiles'] {
	return selectedProject()?.publishProfiles || [];
}

function buildDefaultOutputPath(
	command: DotnetCommand,
	configuration?: string,
	framework?: string,
	runtimeSelection?: string,
	deploymentMode?: DeploymentMode
): string {
	const c = configuration || 'Release';
	const f = framework || 'net8.0';
	const sep = state.pathSeparator;
	if (command === DotnetCommand.build) {
		if (runtimeSelection && runtimeSelection !== portableRuntime) {
			return `bin${sep}${c}${sep}${f}${sep}${runtimeSelection}${sep}`;
		}
		return `bin${sep}${c}${sep}${f}${sep}`;
	}
	const hasRuntime = runtimeSelection && !(deploymentMode === 'framework-dependent' && runtimeSelection === portableRuntime);
	if (hasRuntime) {
		return `bin${sep}${c}${sep}${f}${sep}publish${sep}${runtimeSelection}${sep}`;
	}
	return `bin${sep}${c}${sep}${f}${sep}publish${sep}`;
}

function applyPublishConstraints(): void {
	if (state.command === DotnetCommand.publish) {
		if (!state.form.deploymentMode) {
			state.form.deploymentMode = 'framework-dependent';
		}

		if (state.form.deploymentMode === 'self-contained') {
			state.form.selfContained = true;
			if (!state.form.runtimeSelection || state.form.runtimeSelection === portableRuntime) {
				state.form.runtimeSelection = runtimeOptions()[0] || '';
			}
		} else {
			state.form.selfContained = false;
			if (!state.form.runtimeSelection) {
				state.form.runtimeSelection = portableRuntime;
			}
		}

		const isPortable = state.form.deploymentMode === 'framework-dependent' && state.form.runtimeSelection === portableRuntime;
		if (isPortable) {
			state.form.publishSingleFile = false;
			state.form.publishReadyToRun = false;
		}
	}

	if (!state.outputTouched) {
		state.form.output = buildDefaultOutputPath(
			state.command,
			state.form.configuration,
			state.form.framework,
			state.form.runtimeSelection,
			state.form.deploymentMode
		);
	}
}

function render(): void {
	const app = document.getElementById('app');
	if (!app) {
		return;
	}

	app.innerHTML = '';
	app.appendChild(styles());

	const shell = node('div', 'shell');
	const header = node('div', 'header');
	header.appendChild(node('h1', 'title', state.command === DotnetCommand.publish ? 'Create Publish Task' : 'Create Build Task'));
	header.appendChild(node('p', 'subtitle', 'Visual Studio style options with project-aware defaults'));
	shell.appendChild(header);

	const layout = node('div', 'layout');
	layout.appendChild(primaryPanel());
	layout.appendChild(sidePanel());
	shell.appendChild(layout);

	const actions = node('div', 'actions');
	const submit = document.createElement('vscode-button');
	submit.textContent = 'Create Task';
	submit.addEventListener('click', submitForm);
	actions.appendChild(submit);

	const cancel = document.createElement('vscode-button');
	cancel.textContent = 'Cancel';
	cancel.setAttribute('secondary', '');
	cancel.addEventListener('click', () => vscode.postMessage({ type: 'cancel' }));
	actions.appendChild(cancel);
	shell.appendChild(actions);

	app.appendChild(shell);
}

function primaryPanel(): HTMLElement {
	const panel = node('div', 'panel');
	panel.appendChild(section('Basics', 'Task and project'));
	panel.appendChild(textField('Task Label', state.form.taskLabel || '', 'e.g. publish: MyProject - Release', (value) => {
		state.form.taskLabel = value;
	}));
	panel.appendChild(selectField('Project', state.projects.map((p) => p.path), state.form.project || '', (value) => {
		state.form.project = value;
		const frameworks = frameworkOptions();
		const platforms = platformOptions();
		const configs = configurationOptions();
		state.form.framework = frameworks[0] || 'net8.0';
		state.form.platform = platforms[0] || 'Any CPU';
		state.form.configuration = configs.includes('Release') ? 'Release' : (configs[0] || 'Release');
		state.form.publishProfileName = '';
		state.form.runtimeSelection = state.form.deploymentMode === 'self-contained' ? runtimeOptions()[0] || '' : portableRuntime;
		state.outputTouched = false;
		applyPublishConstraints();
		render();
	}));

	panel.appendChild(section('Build Target', 'Configuration and framework'));
	panel.appendChild(selectField('Configuration', configurationOptions(), state.form.configuration || 'Release', (value) => {
		state.form.configuration = value;
		applyPublishConstraints();
		render();
	}));
	panel.appendChild(selectField('Framework', frameworkOptions(), state.form.framework || frameworkOptions()[0] || 'net8.0', (value) => {
		state.form.framework = value;
		applyPublishConstraints();
		render();
	}));
	panel.appendChild(selectField('Platform', platformOptions(), state.form.platform || platformOptions()[0], (value) => {
		state.form.platform = value;
	}));

	if (state.command === DotnetCommand.publish) {
		panel.appendChild(section('Publish', 'Deployment and runtime'));
		const profiles = publishProfiles();
		if (profiles.length > 0) {
			panel.appendChild(selectField('Publish Profile', ['', ...profiles.map((p) => p.name)], state.form.publishProfileName || '', (value) => {
				state.form.publishProfileName = value;
				applyPublishProfile(value);
				applyPublishConstraints();
				render();
			}, {
				labelMap: new Map<string, string>([['', '(None)']])
			}));
		}
		panel.appendChild(selectField('Deployment Mode', ['framework-dependent', 'self-contained'], state.form.deploymentMode || 'framework-dependent', (value) => {
			state.form.deploymentMode = value as DeploymentMode;
			applyPublishConstraints();
			render();
		}, {
			labelMap: new Map<string, string>([
				['framework-dependent', 'Framework-dependent'],
				['self-contained', 'Self-contained']
			])
		}));
		panel.appendChild(selectField('Target Runtime', runtimeOptions(), state.form.runtimeSelection || portableRuntime, (value) => {
			state.form.runtimeSelection = value;
			applyPublishConstraints();
			render();
		}));

		const portable = state.form.deploymentMode === 'framework-dependent' && state.form.runtimeSelection === portableRuntime;
		panel.appendChild(toggleField('Generate single file', !!state.form.publishSingleFile, (value) => {
			state.form.publishSingleFile = value;
		}, portable));
		panel.appendChild(toggleField('ReadyToRun', !!state.form.publishReadyToRun, (value) => {
			state.form.publishReadyToRun = value;
		}, portable));
		panel.appendChild(toggleField('Trimmed', !!state.form.publishTrimmed, (value) => {
			state.form.publishTrimmed = value;
		}));
		panel.appendChild(toggleField('AOT', !!state.form.publishAot, (value) => {
			state.form.publishAot = value;
		}));
	}

	panel.appendChild(section('Output', 'Default follows Visual Studio publish folder'));
	panel.appendChild(textField('Output Path', state.form.output || '', outputPlaceholder(), (value) => {
		state.form.output = value;
		state.outputTouched = true;
	}));

	return panel;
}

function applyPublishProfile(profileName: string): void {
	if (!profileName) {
		return;
	}
	const profile = publishProfiles().find((p) => p.name === profileName);
	if (!profile) {
		return;
	}
	if (profile.configuration) {
		state.form.configuration = profile.configuration;
	}
	if (profile.framework) {
		state.form.framework = profile.framework;
	}
	if (profile.runtimeIdentifier) {
		state.form.runtimeSelection = profile.runtimeIdentifier;
	}
	if (typeof profile.selfContained === 'boolean') {
		state.form.deploymentMode = profile.selfContained ? 'self-contained' : 'framework-dependent';
	}
	if (typeof profile.publishSingleFile === 'boolean') {
		state.form.publishSingleFile = profile.publishSingleFile;
	}
	if (typeof profile.publishReadyToRun === 'boolean') {
		state.form.publishReadyToRun = profile.publishReadyToRun;
	}
	if (typeof profile.publishTrimmed === 'boolean') {
		state.form.publishTrimmed = profile.publishTrimmed;
	}
	if (typeof profile.publishAot === 'boolean') {
		state.form.publishAot = profile.publishAot;
	}
	if (profile.publishDir) {
		state.form.output = normalizePath(profile.publishDir);
		state.outputTouched = true;
	}
}

function sidePanel(): HTMLElement {
	const panel = node('div', 'panel side');

	const advancedBody = node('div', 'collapse-body');
	advancedBody.appendChild(selectField('Verbosity', state.verbosityCatalog, state.form.verbosity || state.verbosityCatalog[2] || 'normal', (value) => {
		state.form.verbosity = value;
	}));
	advancedBody.appendChild(toggleField('No build', !!state.form.noBuild, (value) => {
		state.form.noBuild = value;
	}, state.command !== DotnetCommand.publish));
	advancedBody.appendChild(toggleField('No restore', !!state.form.noRestore, (value) => {
		state.form.noRestore = value;
	}));
	if (state.command === DotnetCommand.build) {
		advancedBody.appendChild(toggleField('No incremental', !!state.form.noIncremental, (value) => {
			state.form.noIncremental = value;
		}));
		advancedBody.appendChild(toggleField('No dependencies', !!state.form.noDependencies, (value) => {
			state.form.noDependencies = value;
		}));
	}
	if (state.command === DotnetCommand.publish) {
		advancedBody.appendChild(textField('Version suffix', state.form.versionSuffix || '', 'optional', (value) => {
			state.form.versionSuffix = value;
		}));
	}
	panel.appendChild(collapsible('Advanced', 'Optional command flags', advancedBody, false));

	const previewBody = node('div', 'collapse-body');
	previewBody.appendChild(node(
		'div',
		'preview',
		state.form.output || buildDefaultOutputPath(state.command, state.form.configuration, state.form.framework, state.form.runtimeSelection, state.form.deploymentMode)
	));
	panel.appendChild(collapsible('Preview', 'Task arguments will use these values', previewBody, false));
	return panel;
}

function collapsible(title: string, subtitle: string, body: HTMLElement, open: boolean): HTMLElement {
	const details = document.createElement('details');
	details.className = 'collapse';
	details.open = open;
	const summary = document.createElement('summary');
	summary.className = 'collapse-summary';
	const textBox = node('div', 'collapse-text');
	textBox.appendChild(node('div', 'collapse-title', title));
	textBox.appendChild(node('div', 'collapse-subtitle', subtitle));
	summary.appendChild(textBox);
	details.appendChild(summary);
	details.appendChild(body);
	return details;
}

function submitForm(): void {
	vscode.postMessage({
		type: 'submit',
		data: toPayload()
	});
}

function toPayload(): PublishTaskParams | BuildTaskParams {
	const archFromPlatform = mapPlatformToArch(state.form.platform);
	const runtime = state.form.runtimeSelection && state.form.runtimeSelection !== portableRuntime ? state.form.runtimeSelection : undefined;

	if (state.command === DotnetCommand.publish) {
		return {
			taskLabel: state.form.taskLabel || '',
			project: state.form.project || '',
			configuration: state.form.configuration,
			framework: state.form.framework,
			runtime,
			output: state.form.output,
			selfContained: state.form.deploymentMode === 'self-contained',
			noBuild: state.form.noBuild,
			noRestore: state.form.noRestore,
			arch: archFromPlatform,
			verbosity: state.form.verbosity,
			versionSuffix: state.form.versionSuffix,
			publishSingleFile: state.form.publishSingleFile,
			publishTrimmed: state.form.publishTrimmed,
			publishReadyToRun: state.form.publishReadyToRun,
			publishAot: state.form.publishAot
		};
	}

	return {
		taskLabel: state.form.taskLabel || '',
		project: state.form.project || '',
		configuration: state.form.configuration,
		framework: state.form.framework,
		runtime,
		output: state.form.output,
		noRestore: state.form.noRestore,
		noIncremental: state.form.noIncremental,
		noDependencies: state.form.noDependencies,
		verbosity: state.form.verbosity,
		arch: archFromPlatform
	};
}

function mapPlatformToArch(platform: string | undefined): string | undefined {
	if (!platform) {
		return undefined;
	}
	const v = platform.toLowerCase().replace(/\s+/g, '');
	if (v === 'anycpu') {
		return undefined;
	}
	if (v === 'x64' || v === 'x86' || v === 'arm' || v === 'arm64') {
		return v;
	}
	return undefined;
}

function normalizePath(value: string): string {
	if (state.pathSeparator === '\\') {
		return value.replace(/\//g, '\\');
	}
	return value.replace(/\\/g, '/');
}

function outputPlaceholder(): string {
	const sep = state.pathSeparator;
	if (state.command === DotnetCommand.build) {
		return `bin${sep}Release${sep}net8.0${sep}`;
	}
	return `bin${sep}Release${sep}net8.0${sep}publish${sep}`;
}

function section(title: string, subtitle: string): HTMLElement {
	const box = node('div', 'section-title');
	box.appendChild(node('h2', 'section-name', title));
	box.appendChild(node('p', 'section-sub', subtitle));
	return box;
}

function textField(label: string, value: string, placeholder: string, onChange: (value: string) => void): HTMLElement {
	const row = node('label', 'field');
	row.appendChild(node('span', 'field-label', label));
	const input = document.createElement('input');
	input.className = 'input';
	input.value = value;
	input.placeholder = placeholder;
	input.addEventListener('input', (event) => {
		onChange((event.target as HTMLInputElement).value);
	});
	row.appendChild(input);
	return row;
}

function selectField(
	label: string,
	options: string[],
	value: string,
	onChange: (value: string) => void,
	config?: { labelMap?: Map<string, string> }
): HTMLElement {
	const row = node('label', 'field');
	row.appendChild(node('span', 'field-label', label));
	const select = document.createElement('select');
	select.className = 'input';
	for (const item of options) {
		const option = document.createElement('option');
		option.value = item;
		option.textContent = config?.labelMap?.get(item) || item;
		option.selected = item === value;
		select.appendChild(option);
	}
	select.addEventListener('change', (event) => {
		onChange((event.target as HTMLSelectElement).value);
	});
	row.appendChild(select);
	return row;
}

function toggleField(label: string, checked: boolean, onChange: (value: boolean) => void, disabled = false): HTMLElement {
	const row = node('label', 'toggle');
	const box = document.createElement('input');
	box.type = 'checkbox';
	box.checked = checked;
	box.disabled = disabled;
	box.addEventListener('change', (event) => {
		onChange((event.target as HTMLInputElement).checked);
	});
	row.appendChild(box);
	row.appendChild(node('span', `toggle-label${disabled ? ' disabled' : ''}`, label));
	return row;
}

function node(tag: string, className: string, text?: string): HTMLElement {
	const n = document.createElement(tag);
	n.className = className;
	if (text) {
		n.textContent = text;
	}
	return n;
}

function styles(): HTMLStyleElement {
	const style = document.createElement('style');
	style.textContent = `
		:root {
			--bg: var(--vscode-editor-background);
			--card: var(--vscode-sideBar-background);
			--text: var(--vscode-editor-foreground);
			--muted: var(--vscode-descriptionForeground);
			--border: var(--vscode-panel-border);
			--accent: var(--vscode-focusBorder);
		}
		body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--vscode-font-family); }
		.shell { padding: 16px; display: grid; gap: 14px; }
		.header { padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--card) 92%, white 8%), var(--card)); }
		.title { margin: 0; font-size: 18px; }
		.subtitle { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
		.layout { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; align-items: start; }
		.panel { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); }
		.panel.side { align-self: start; }
		.section-title { padding: 6px 8px; border-left: 3px solid var(--accent); background: color-mix(in srgb, var(--bg) 70%, black 30%); border-radius: 6px; }
		.section-name { margin: 0; font-size: 13px; }
		.section-sub { margin: 2px 0 0; font-size: 11px; color: var(--muted); }
		.field { display: grid; gap: 6px; }
		.field-label { font-size: 12px; color: var(--muted); }
		.input { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); }
		.toggle { display: flex; align-items: center; gap: 8px; padding: 6px 2px; }
		.toggle-label { font-size: 13px; }
		.toggle-label.disabled { color: var(--muted); }
		.preview { font-family: var(--vscode-editor-font-family); font-size: 12px; padding: 8px; border: 1px dashed var(--border); border-radius: 6px; word-break: break-all; }
		.collapse { border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--bg) 70%, black 30%); }
		.collapse-summary { cursor: pointer; list-style: none; padding: 8px 10px; }
		.collapse-summary::-webkit-details-marker { display: none; }
		.collapse-text { display: grid; gap: 2px; }
		.collapse-title { font-size: 13px; font-weight: 600; }
		.collapse-subtitle { font-size: 11px; color: var(--muted); }
		.collapse-body { padding: 0 10px 10px; display: grid; gap: 8px; }
		.actions { display: flex; gap: 8px; justify-content: flex-end; }
		@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
	`;
	return style;
}
