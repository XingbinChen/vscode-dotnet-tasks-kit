import * as path from 'path';
import Mocha from 'mocha';
import * as glob from 'glob';

export async function run(): Promise<void> {
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 20000
	});

	const testsRoot = path.join(__dirname, '..');
	const files = glob.sync('**/**.test.js', { cwd: testsRoot });

	for (const file of files) {
		mocha.addFile(path.join(testsRoot, file));
	}

	return new Promise((c, e) => {
		mocha.run((failures: number) => {
			if (failures > 0) {
				e(new Error(`${failures} tests failed`));
			} else {
				c();
			}
		});
	});
}
