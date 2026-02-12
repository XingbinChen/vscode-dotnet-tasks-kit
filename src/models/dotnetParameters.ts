/**
 * Metadata for a single dotnet CLI parameter
 */
export interface ParameterMeta {
	name: string;
	shortName?: string;
	label: string;
	description: string;
	type: 'select' | 'text' | 'boolean' | 'checkbox';
	options?: string[];
	defaultValue?: string | boolean;
	tier: 1 | 2 | 3;
	group: string;
}

export const CONFIGURATIONS = ['Debug', 'Release'];

export const FRAMEWORKS = ['net6.0', 'net7.0', 'net8.0', 'net9.0'];

export const ARCHITECTURES = ['x86', 'x64', 'arm', 'arm64'];

export const OPERATING_SYSTEMS = ['win', 'linux', 'osx'];

export const VERBOSITY_LEVELS = ['quiet', 'minimal', 'normal', 'detailed', 'diagnostic'];

export const RUNTIME_IDENTIFIERS = [
	'win-x86',
	'win-x64',
	'win-arm',
	'win-arm64',
	'linux-x64',
	'linux-arm',
	'linux-arm64',
	'linux-musl-x64',
	'linux-musl-arm64',
	'osx-x64',
	'osx-arm64',
];

/**
 * Publish command parameters, organized by priority tier
 * Tier 1: Most commonly used
 * Tier 2: Advanced but important
 * Tier 3: Niche/specialized
 */
export const PUBLISH_PARAMETERS: ParameterMeta[] = [
	{
		name: '--configuration',
		shortName: '-c',
		label: 'Configuration',
		description: 'Build configuration (Debug/Release)',
		type: 'select',
		options: CONFIGURATIONS,
		defaultValue: 'Release',
		tier: 1,
		group: 'Basic',
	},
	{
		name: '--framework',
		shortName: '-f',
		label: 'Framework',
		description: 'Target framework (e.g., net8.0)',
		type: 'select',
		options: FRAMEWORKS,
		tier: 1,
		group: 'Basic',
	},
	{
		name: '--runtime',
		shortName: '-r',
		label: 'Runtime',
		description: 'Runtime identifier (RID) for self-contained deployment',
		type: 'select',
		options: RUNTIME_IDENTIFIERS,
		tier: 1,
		group: 'Basic',
	},
	{
		name: '--output',
		shortName: '-o',
		label: 'Output Directory',
		description: 'Output directory path',
		type: 'text',
		tier: 1,
		group: 'Basic',
	},
	{
		name: '--self-contained',
		label: 'Self-Contained',
		description: 'Include .NET runtime in publication',
		type: 'boolean',
		tier: 1,
		group: 'Deployment',
	},
	{
		name: '--no-build',
		label: 'No Build',
		description: 'Skip build step, use pre-built binaries',
		type: 'boolean',
		tier: 2,
		group: 'Advanced',
	},
	{
		name: '--no-restore',
		label: 'No Restore',
		description: 'Skip NuGet restore step',
		type: 'boolean',
		tier: 2,
		group: 'Advanced',
	},
	{
		name: '--arch',
		shortName: '-a',
		label: 'Architecture',
		description: 'Target architecture (x86, x64, arm, arm64)',
		type: 'select',
		options: ARCHITECTURES,
		tier: 2,
		group: 'Deployment',
	},
	{
		name: '--os',
		label: 'Operating System',
		description: 'Target operating system (win, linux, osx)',
		type: 'select',
		options: OPERATING_SYSTEMS,
		tier: 2,
		group: 'Deployment',
	},
	{
		name: '--use-current-runtime',
		label: 'Use Current Runtime',
		description: 'Use runtime from current machine',
		type: 'boolean',
		tier: 2,
		group: 'Deployment',
	},
	{
		name: '--source',
		shortName: '-s',
		label: 'NuGet Source',
		description: 'NuGet package source URL',
		type: 'text',
		tier: 3,
		group: 'Advanced',
	},
	{
		name: '--force',
		label: 'Force',
		description: 'Force restoration even if dependencies resolved',
		type: 'boolean',
		tier: 3,
		group: 'Advanced',
	},
	{
		name: '--verbosity',
		shortName: '-v',
		label: 'Verbosity',
		description: 'Set logging level',
		type: 'select',
		options: VERBOSITY_LEVELS,
		tier: 2,
		group: 'Advanced',
	},
	{
		name: '--version-suffix',
		label: 'Version Suffix',
		description: 'Suffix for assembly version',
		type: 'text',
		tier: 3,
		group: 'Advanced',
	},
	{
		name: 'PublishSingleFile',
		label: 'Publish Single File',
		description: 'Package app as single executable (MSBuild property)',
		type: 'boolean',
		tier: 2,
		group: 'Deployment',
	},
	{
		name: 'PublishTrimmed',
		label: 'Publish Trimmed',
		description: 'Trim unused assemblies (MSBuild property)',
		type: 'boolean',
		tier: 3,
		group: 'Deployment',
	},
	{
		name: 'PublishReadyToRun',
		label: 'Publish Ready-To-Run',
		description: 'Compile IL to native (MSBuild property)',
		type: 'boolean',
		tier: 3,
		group: 'Deployment',
	},
	{
		name: 'PublishAot',
		label: 'Publish AOT',
		description: 'Ahead-of-time compilation (MSBuild property)',
		type: 'boolean',
		tier: 3,
		group: 'Deployment',
	},
];

/**
 * Build command parameters (subset of publish)
 * Tier 1 and 2 only, no deployment-specific options
 */
export const BUILD_PARAMETERS: ParameterMeta[] = [
	{
		name: '--configuration',
		shortName: '-c',
		label: 'Configuration',
		description: 'Build configuration (Debug/Release)',
		type: 'select',
		options: CONFIGURATIONS,
		defaultValue: 'Debug',
		tier: 1,
		group: 'Basic',
	},
	{
		name: '--framework',
		shortName: '-f',
		label: 'Framework',
		description: 'Target framework (e.g., net8.0)',
		type: 'select',
		options: FRAMEWORKS,
		tier: 1,
		group: 'Basic',
	},
	{
		name: '--output',
		shortName: '-o',
		label: 'Output Directory',
		description: 'Output directory path',
		type: 'text',
		tier: 1,
		group: 'Basic',
	},
	{
		name: '--no-restore',
		label: 'No Restore',
		description: 'Skip NuGet restore step',
		type: 'boolean',
		tier: 2,
		group: 'Advanced',
	},
	{
		name: '--no-incremental',
		label: 'No Incremental',
		description: 'Force clean build',
		type: 'boolean',
		tier: 2,
		group: 'Advanced',
	},
	{
		name: '--no-dependencies',
		label: 'No Dependencies',
		description: 'Build only specified project',
		type: 'boolean',
		tier: 2,
		group: 'Advanced',
	},
	{
		name: '--verbosity',
		shortName: '-v',
		label: 'Verbosity',
		description: 'Set logging level',
		type: 'select',
		options: VERBOSITY_LEVELS,
		tier: 2,
		group: 'Advanced',
	},
	{
		name: '--arch',
		shortName: '-a',
		label: 'Architecture',
		description: 'Target architecture (x86, x64, arm, arm64)',
		type: 'select',
		options: ARCHITECTURES,
		tier: 2,
		group: 'Basic',
	},
	{
		name: '--runtime',
		shortName: '-r',
		label: 'Runtime',
		description: 'Runtime identifier (RID)',
		type: 'select',
		options: RUNTIME_IDENTIFIERS,
		tier: 2,
		group: 'Basic',
	},
];

/**
 * Parameter constraints and dependencies
 * Defines which parameters influence each other
 */
export const PARAMETER_CONSTRAINTS = {
	selfContained: {
		requiresOneOf: ['runtime', 'arch', 'os'],
		description: 'Self-contained requires runtime, architecture, or OS specification',
	},
	arch: {
		mutuallyExclusiveWith: ['runtime'],
		description: 'Architecture and runtime are mutually exclusive',
	},
	os: {
		mutuallyExclusiveWith: ['runtime'],
		description: 'OS and runtime are mutually exclusive',
	},
	noBuild: {
		impliesTrue: ['noRestore'],
		description: 'No build implies no restore',
	},
	publishSingleFile: {
		requiresTrue: ['selfContained'],
		minFramework: 'net6.0',
		description: 'Publish single file requires self-contained',
	},
	publishTrimmed: {
		requiresTrue: ['selfContained'],
		minFramework: 'net6.0',
		description: 'Publish trimmed requires self-contained',
	},
	publishReadyToRun: {
		minFramework: 'net6.0',
		description: 'Ready-to-run available in .NET 6.0+',
	},
	publishAot: {
		minFramework: 'net8.0',
		description: 'AOT available in .NET 8.0+',
	},
};
