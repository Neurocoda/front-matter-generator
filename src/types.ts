export const API_TYPES = ["chat-completions", "responses"] as const;
export type ApiType = typeof API_TYPES[number];

export const CONTENT_MODES = ["full-text", "first-lines", "headings-only"] as const;
export type ContentMode = typeof CONTENT_MODES[number];

export const OUTPUT_LANGUAGES = ["chinese", "english", "spanish"] as const;
export type OutputLanguage = typeof OUTPUT_LANGUAGES[number];

export const NAMING_STYLES = ["kebab-case", "camelCase", "PascalCase", "snake_case", "Title Case"] as const;
export type NamingStyle = typeof NAMING_STYLES[number];

export const TAG_POLICIES = ["prefer-existing", "existing-only", "allow-new"] as const;
export type TagPolicy = typeof TAG_POLICIES[number];

export const TAG_WRITE_MODES = ["replace", "merge"] as const;
export type TagWriteMode = typeof TAG_WRITE_MODES[number];

export type FrontMatterPropertyValue = string | number | boolean | string[] | number[] | boolean[] | null;

export interface CustomPropertyRule {
	name: string;
	instruction: string;
}

export interface FrontMatterGeneratorSettings {
	apiBaseUrl: string;
	apiKey: string;
	model: string;
	apiType: ApiType;
	enableFileName: boolean;
	enableTitle: boolean;
	enableTags: boolean;
	enableDescription: boolean;
	namingStyle: NamingStyle;
	outputLanguage: OutputLanguage;
	contentMode: ContentMode;
	lineLimit: number;
	excludedPaths: string;
	tagPolicy: TagPolicy;
	maxGeneratedTags: number;
	tagContextLimit: number;
	tagWriteMode: TagWriteMode;
	customProperties: CustomPropertyRule[];
}

export interface FilenameCandidate {
	name: string;
	reason: string;
}

export interface ExistingTag {
	tag: string;
	count: number;
}

export interface AutoFrontMatterPromptInput {
	enableFileName: boolean;
	enableTitle: boolean;
	enableTags: boolean;
	enableDescription: boolean;
	relativePath: string;
	folderPath: string;
	currentBasename: string;
	namingStyle: NamingStyle;
	outputLanguage: OutputLanguage;
	contentMode: ContentMode;
	content: string;
	currentTags: string[];
	existingTitle: string;
	existingDescription: string;
	existingTags: ExistingTag[];
	tagPolicy: TagPolicy;
	maxGeneratedTags: number;
	customProperties: CustomPropertyRule[];
	existingCustomProperties: Record<string, unknown>;
}

export interface AutoFrontMatterResult {
	filenameCandidates: FilenameCandidate[];
	title: string;
	tags: string[];
	description: string;
	properties: Record<string, FrontMatterPropertyValue>;
}

export interface AutoFrontMatterProviderRequest extends AutoFrontMatterPromptInput {
	apiBaseUrl: string;
	apiKey: string;
	model: string;
}

export interface AutoFrontMatterProvider {
	generateFrontMatter(request: AutoFrontMatterProviderRequest): Promise<AutoFrontMatterResult>;
	testConnection(request: Pick<AutoFrontMatterProviderRequest, "apiBaseUrl" | "apiKey" | "model">): Promise<void>;
}

export const DEFAULT_SETTINGS: FrontMatterGeneratorSettings = {
	apiBaseUrl: "https://api.openai.com/v1",
	apiKey: "",
	model: "gpt-4o-mini",
	apiType: "chat-completions",
	enableFileName: false,
	enableTitle: true,
	enableTags: true,
	enableDescription: true,
	namingStyle: "kebab-case",
	outputLanguage: "chinese",
	contentMode: "first-lines",
	lineLimit: 200,
	excludedPaths: "templates",
	tagPolicy: "prefer-existing",
	maxGeneratedTags: 5,
	tagContextLimit: 300,
	tagWriteMode: "replace",
	customProperties: [],
};

export type LegacySettings = Partial<Omit<FrontMatterGeneratorSettings, "customProperties">> & {
	customProperties?: string | CustomPropertyRule[];
	descriptionLanguage?: OutputLanguage;
};
