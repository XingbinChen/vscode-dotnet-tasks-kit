import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as ts from 'typescript';
import * as taskDefinition from '../../models/taskDefinition';
import { DotnetCommand } from '../../models/taskDefinition';
import { ExtensionMessage, WebviewMessage } from '../../models/messageProtocol';

// The form uses native DOM nodes; only the browser and VS Code message boundaries are replaced.
class Element {
	children: Element[] = [];
	textContent = '';
	value = '';
	selected = false;
	listeners = new Map<string, (event: { target: Element }) => void>();
	constructor(readonly tag: string) { }
	set innerHTML(_value: string) { this.children = []; }
	appendChild(child: Element): void { this.children.push(child); }
	setAttribute(): void { }
	addEventListener(name: string, handler: (event: { target: Element }) => void): void {
		this.listeners.set(name, handler);
	}
	change(value: string): void {
		this.value = value;
		this.listeners.get('change')!({ target: this });
	}
	find(predicate: (element: Element) => boolean): Element | undefined {
		if (predicate(this)) { return this; }
		for (const child of this.children) {
			const result = child.find(predicate);
			if (result) { return result; }
		}
		return undefined;
	}
}

function openForm(frameworks = ['net10.0', 'net8.0']) {
	const app = new Element('div');
	const messages: WebviewMessage[] = [];
	let onMessage: (event: { data: ExtensionMessage }) => void = () => { };
	const source = fs.readFileSync(path.resolve(__dirname, '../../../src/webview/html/main.ts'), 'utf8');
	const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	vm.runInNewContext(script, {
		exports: {},
		require: (id: string) => {
			if (id === '@vscode-elements/elements') { return {}; }
			if (id === '../../models/taskDefinition') { return taskDefinition; }
			throw new Error(`Unexpected webview dependency: ${id}`);
		},
		acquireVsCodeApi: () => ({ postMessage: (message: WebviewMessage) => messages.push(message) }),
		window: { addEventListener: (_name: string, handler: typeof onMessage) => { onMessage = handler; } },
		document: { getElementById: () => app, createElement: (tag: string) => new Element(tag) }
	});
	onMessage({ data: {
		type: 'init', command: DotnetCommand.publish, projects: ['App.csproj'], pathSeparator: '/', parameters: [],
		projectProfiles: [{ path: 'App.csproj', frameworks, runtimeIdentifiers: ['win-x64'],
			platforms: ['Any CPU'], configurations: ['Release'], publishProfiles: [] }]
	} });
	return {
		app,
		select: (label: string) => app.find(e => e.tag === 'label' && e.children[0]?.textContent === label)!.children[1],
		submit: () => {
			const button = app.find(e => e.tag === 'vscode-button' && e.textContent === 'Create Task')!;
			button.listeners.get('click')!({ target: button });
			return messages[messages.length - 1];
		}
	};
}

suite('Webview Test Suite', () => {
	test('deployment mode should control self-contained independently of the project framework', () => {
		const form = openForm();
		const preview = () => form.app.find(e => e.textContent.startsWith('dotnet publish'))!.textContent;
		assert.ok(preview().includes('--framework net10.0'));
		assert.ok(preview().includes('--self-contained false'));
		form.select('Deployment Mode').change('self-contained');
		assert.ok(preview().includes('--self-contained true'));
		assert.ok(preview().includes('--framework net10.0'));
		form.select('Deployment Mode').change('framework-dependent');
		assert.ok(preview().includes('--self-contained false'));
		const message = form.submit();
		assert.strictEqual(message.type, 'submit');
		if (message.type === 'submit') {
			assert.strictEqual(message.data.framework, 'net10.0');
			assert.strictEqual((message.data as { selfContained?: boolean }).selfContained, false);
		}
	});

	test('framework choices should come from the selected project', () => {
		const form = openForm();
		assert.deepStrictEqual(form.select('Framework').children.map(e => e.value), ['net10.0', 'net8.0']);
		form.select('Framework').change('net8.0');
		const message = form.submit();
		assert.strictEqual(message.type, 'submit');
		if (message.type === 'submit') { assert.strictEqual(message.data.framework, 'net8.0'); }
	});

	test('unknown project frameworks should use the project default without inventing net8.0', () => {
		const form = openForm([]);
		const message = form.submit();
		assert.strictEqual(message.type, 'submit');
		if (message.type === 'submit') { assert.ok(!message.data.framework); }
	});
});
