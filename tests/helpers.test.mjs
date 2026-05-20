import assert from "node:assert/strict";
import test from "node:test";
import esbuild from "esbuild";

const build = await esbuild.build({
	entryPoints: [
		"src/content.ts",
		"src/path.ts",
		"src/naming.ts",
		"src/tags.ts",
		"src/properties.ts",
		"src/providers.ts",
		"src/prompt.ts",
	],
	bundle: true,
	format: "esm",
	platform: "node",
	write: false,
	outdir: "test-build",
	external: ["obsidian"],
});

const obsidianStubSource = [
	"export function normalizePath(path) {",
	"  return path.replace(/\\\\/g, '/').replace(/\\/+/g, '/').replace(/^\\.\\//, '').replace(/\\/$/, '');",
	"}",
	"export function parseFrontMatterStringArray(frontmatter, key) {",
	"  const value = frontmatter?.[key];",
	"  if (Array.isArray(value)) return value.map(String);",
	"  if (typeof value === 'string') return value.split(/[ ,]+/).filter(Boolean);",
	"  return null;",
	"}",
	"export function getAllTags(cache) {",
	"  const tags = [];",
	"  for (const item of cache.tags ?? []) tags.push(item.tag);",
	"  const fmTags = cache.frontmatter?.tags;",
	"  if (Array.isArray(fmTags)) tags.push(...fmTags);",
	"  return tags;",
	"}",
	"export async function requestUrl() {",
	"  throw new Error('requestUrl is not available in tests');",
	"}",
].join("\n");
const obsidianStubUrl = `data:text/javascript;base64,${Buffer.from(obsidianStubSource).toString("base64")}`;

const modules = new Map();
for (const output of build.outputFiles) {
	const text = output.text.replace(/from "obsidian"/g, `from ${JSON.stringify(obsidianStubUrl)}`);
	const url = `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
	modules.set(output.path.split("/").pop(), await import(url));
}

const content = modules.get("content.js");
const path = modules.get("path.js");
const naming = modules.get("naming.js");
const tags = modules.get("tags.js");
const properties = modules.get("properties.js");
const providers = modules.get("providers.js");
const prompt = modules.get("prompt.js");

test("extractPromptContent supports first lines", () => {
	assert.equal(content.extractPromptContent("a\nb\nc", "first-lines", 2), "a\nb");
});

test("extractPromptContent supports headings only", () => {
	const markdown = "# Title\nbody\n## Detail\nnot # heading\n###### Fine\n";
	assert.equal(content.extractPromptContent(markdown, "headings-only", 200), "# Title\n## Detail\n###### Fine");
});

test("excluded paths support prefix and regex rules", () => {
	assert.equal(path.isPathExcluded("templates/daily.md", "templates"), true);
	assert.equal(path.isPathExcluded("templates/nested/daily.md", "/^templates\\//"), true);
	assert.equal(path.isPathExcluded("archive/old.md", "regex:^archive/.*\\.md$"), true);
	assert.equal(path.isPathExcluded("archive/old.canvas", "regex:^archive/.*\\.md$"), false);
});

test("cleanNameToStyle supports common naming styles", () => {
	assert.equal(naming.cleanNameToStyle("Learning Web Development.md", "kebab-case"), "learning-web-development");
	assert.equal(naming.cleanNameToStyle("Learning Web Development.md", "camelCase"), "learningWebDevelopment");
	assert.equal(naming.cleanNameToStyle("Learning Web Development.md", "PascalCase"), "LearningWebDevelopment");
	assert.equal(naming.cleanNameToStyle("Learning Web Development.md", "snake_case"), "learning_web_development");
	assert.equal(naming.cleanNameToStyle("Learning Web Development.md", "Title Case"), "Learning Web Development");
});

test("cleanNameToStyle preserves unicode words for global language output", () => {
	assert.equal(naming.cleanNameToStyle("知识 管理 方法.md", "kebab-case"), "知识-管理-方法");
	assert.equal(naming.cleanNameToStyle("gestión de conocimiento.md", "snake_case"), "gestion_de_conocimiento");
});

test("tag filtering enforces existing-only policy", () => {
	const existing = [{tag: "ai", count: 3}, {tag: "obsidian", count: 2}];
	assert.deepEqual(tags.filterSuggestedTags(["AI", "new-topic", "#obsidian"], existing, "existing-only", 5), ["ai", "obsidian"]);
});

test("tag filtering prefer-existing avoids new tags", () => {
	const existing = [{tag: "systems", count: 4}];
	assert.deepEqual(tags.filterSuggestedTags(["systems", "fresh-tag"], existing, "prefer-existing", 5), ["systems"]);
});

test("tag filtering allow-new admits new tags", () => {
	const existing = [{tag: "systems", count: 4}];
	assert.deepEqual(tags.filterSuggestedTags(["systems", "Fresh Tag"], existing, "allow-new", 5), ["systems", "fresh-tag"]);
});

test("mergeTags preserves existing tags when generated tags are empty", () => {
	assert.deepEqual(tags.mergeTags(["ai"], [], "replace"), ["ai"]);
	assert.deepEqual(tags.mergeTags(["ai"], ["obsidian"], "merge"), ["ai", "obsidian"]);
});

test("custom property parser skips reserved keys", () => {
	assert.deepEqual(properties.parseCustomPropertyRules("status: choose one\ntitle: bad\ntags: bad\ndescription: bad\nrating: 1-5"), [
		{name: "status", instruction: "choose one"},
		{name: "rating", instruction: "1-5"},
	]);
});

test("custom property rules migrate legacy text and structured rows", () => {
	assert.deepEqual(properties.normalizeCustomPropertyRules("status: choose one"), [
		{name: "status", instruction: "choose one"},
	]);
	assert.deepEqual(properties.normalizeCustomPropertyRules([
		{name: "status", instruction: "choose one"},
		{name: "title", instruction: "reserved"},
		{name: "tags", instruction: "reserved"},
		{name: "rating", instruction: "1-5"},
	]), [
		{name: "status", instruction: "choose one"},
		{name: "rating", instruction: "1-5"},
	]);
});

test("custom property rows preserve empty UI rows", () => {
	assert.deepEqual(properties.normalizeCustomPropertyRows([
		{name: "", instruction: ""},
		{name: "status", instruction: "choose one"},
	]), [
		{name: "", instruction: ""},
		{name: "status", instruction: "choose one"},
	]);
	assert.deepEqual(properties.normalizeCustomPropertyRules([
		{name: "", instruction: ""},
		{name: "status", instruction: "choose one"},
	]), [
		{name: "status", instruction: "choose one"},
	]);
});

test("parseAutoFrontMatterResult reads strict JSON", () => {
	const result = providers.parseAutoFrontMatterResult(JSON.stringify({
		filenameCandidates: [{name: "rest architecture", reason: "Fits the topic"}],
		title: "REST architecture",
		tags: ["api", "architecture"],
		description: "A concise note description",
		properties: {status: "evergreen", ignored: "nope"},
	}), {
		enableFileName: true,
		enableTitle: true,
		enableTags: true,
		enableDescription: true,
		customProperties: [{name: "status", instruction: "choose status"}],
	});
	assert.deepEqual(result.filenameCandidates, [{name: "rest architecture", reason: "Fits the topic"}]);
	assert.equal(result.title, "REST architecture");
	assert.deepEqual(result.tags, ["api", "architecture"]);
	assert.equal(result.description, "A concise note description");
	assert.deepEqual(result.properties, {status: "evergreen"});
});

test("parseAutoFrontMatterResult allows disabled filename, title, tags, and description to be absent", () => {
	const result = providers.parseAutoFrontMatterResult(JSON.stringify({
		properties: {status: "evergreen"},
	}), {
		enableFileName: false,
		enableTitle: false,
		enableTags: false,
		enableDescription: false,
		customProperties: [{name: "status", instruction: "choose status"}],
	});
	assert.deepEqual(result.filenameCandidates, []);
	assert.equal(result.title, "");
	assert.deepEqual(result.tags, []);
	assert.equal(result.description, "");
	assert.deepEqual(result.properties, {status: "evergreen"});
});

test("buildUserPrompt includes tag and path context", () => {
	const text = prompt.buildUserPrompt({
		enableFileName: true,
		enableTitle: true,
		enableTags: true,
		enableDescription: true,
		relativePath: "inbox/rest.md",
		folderPath: "inbox",
		currentBasename: "rest",
		namingStyle: "kebab-case",
		outputLanguage: "chinese",
		contentMode: "first-lines",
		content: "# REST\nBody",
		currentTags: ["api"],
		existingTitle: "Old title",
		existingDescription: "old description",
		existingTags: [{tag: "api", count: 3}],
		tagPolicy: "prefer-existing",
		maxGeneratedTags: 5,
		customProperties: [{name: "status", instruction: "choose one"}],
		existingCustomProperties: {status: "seedling"},
	});
	assert.match(text, /Vault-relative path: inbox\/rest\.md/);
	assert.match(text, /Existing title: Old title/);
	assert.match(text, /"title":"concise note title"/);
	assert.match(text, /Output language: Chinese/);
	assert.match(text, /api \(3\)/);
	assert.match(text, /status: choose one/);
	assert.match(text, /new tags in the requested output language/);
});

test("buildUserPrompt omits disabled tasks", () => {
	const text = prompt.buildUserPrompt({
		enableFileName: false,
		enableTitle: false,
		enableTags: false,
		enableDescription: false,
		relativePath: "inbox/rest.md",
		folderPath: "inbox",
		currentBasename: "rest",
		namingStyle: "kebab-case",
		outputLanguage: "chinese",
		contentMode: "first-lines",
		content: "# REST\nBody",
		currentTags: ["api"],
		existingTitle: "Old title",
		existingDescription: "old description",
		existingTags: [{tag: "api", count: 3}],
		tagPolicy: "prefer-existing",
		maxGeneratedTags: 5,
		customProperties: [{name: "status", instruction: "choose one"}],
		existingCustomProperties: {status: "seedling"},
	});
	assert.doesNotMatch(text, /filenameCandidates/);
	assert.doesNotMatch(text, /"title":/);
	assert.doesNotMatch(text, /Existing title:/);
	assert.doesNotMatch(text, /"tags":/);
	assert.doesNotMatch(text, /"description":/);
	assert.match(text, /"properties"/);
	assert.match(text, /Output language: Chinese/);
	assert.doesNotMatch(text, /Vault tag context:/);
});
