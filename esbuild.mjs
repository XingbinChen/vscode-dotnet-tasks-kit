import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {esbuild.Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode', 'jsonc-parser'],
    logLevel: 'silent',
    plugins: [
      esbuildProblemMatcherPlugin,
    ],
  });

  const webviewCtx = await esbuild.context({
    entryPoints: ['src/webview/html/main.ts'],
    bundle: true,
    format: 'iife',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'browser',
    outfile: 'dist/webview/main.js',
    logLevel: 'silent',
    plugins: [
      esbuildProblemMatcherPlugin,
    ],
  });

  if (watch) {
    await ctx.watch();
    await webviewCtx.watch();
  } else {
    await ctx.rebuild();
    await webviewCtx.rebuild();
    await ctx.dispose();
    await webviewCtx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
