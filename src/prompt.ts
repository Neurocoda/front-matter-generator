import {getContentModeLabel} from "./content";
import {getDescriptionLanguageLabel} from "./content";
import {normalizeTagsForPrompt} from "./tags";
import {AutoFrontMatterPromptInput, DescriptionLanguage, NamingStyle, TagPolicy} from "./types";

function buildSystemPrompt(): string {
	return [
		"You generate structured metadata for an Obsidian note.",
		"Return exactly one JSON object.",
		"Use concise, literal, note-faithful language.",
		"Do not include markdown fences, prose outside JSON, or extra keys beyond the requested schema.",
	].join(" ");
}

function tagPolicyInstruction(policy: TagPolicy): string {
	switch (policy) {
		case "prefer-existing":
			return "Prefer existing vault tags from the provided context. Create a new tag only when no existing tag clearly fits.";
		case "existing-only":
			return "Only use tags that already exist in the provided vault tag context.";
		case "allow-new":
			return "You may propose new tags, but keep them conservative and reusable.";
	}
}

function namingStyleInstruction(style: NamingStyle): string {
	return `The filename candidate names must already fit ${style}.`;
}

function descriptionLanguageLabel(language: DescriptionLanguage): string {
	return getDescriptionLanguageLabel(language);
}

export function buildUserPrompt(input: AutoFrontMatterPromptInput): string {
	const currentTags = input.currentTags.length > 0 ? input.currentTags.join(", ") : "(none)";
	const existingTags = normalizeTagsForPrompt(input.existingTags, input.existingTags.length);
	const customProperties = input.customProperties.length > 0
		? input.customProperties.map((rule) => `- ${rule.name}: ${rule.instruction}`).join("\n")
		: "(none)";
	const existingCustomProperties = Object.entries(input.existingCustomProperties)
		.map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
		.join("\n") || "(none)";

	return [
		"Generate filename candidates, tags, description, and selected frontmatter properties for this Obsidian note.",
		"",
		"Context:",
		`- Vault-relative path: ${input.relativePath}`,
		`- Folder path: ${input.folderPath || "(vault root)"}`,
		`- Current basename: ${input.currentBasename}`,
		`- Naming style: ${input.namingStyle}`,
		`- Description language: ${descriptionLanguageLabel(input.descriptionLanguage)}`,
		`- Content mode: ${getContentModeLabel(input.contentMode)}`,
		`- Tag policy: ${input.tagPolicy}`,
		`- Max generated tags: ${input.maxGeneratedTags}`,
		"",
		"Current note context:",
		`- Current tags: ${currentTags}`,
		`- Existing description: ${input.existingDescription || "(none)"}`,
		"",
		"Vault tag context:",
		existingTags || "(none)",
		"",
		"Custom properties to generate:",
		customProperties,
		"",
		"Existing custom property values on the note:",
		existingCustomProperties,
		"",
		"Guidance:",
		"- Treat the folder path as context, not as text to copy blindly.",
		"- Keep filenames short, specific, and useful in a personal knowledge vault.",
		"- Return exactly three filename candidates.",
		"- For tags, prefer existing vault tags when possible and avoid tag explosion.",
		"- Use the requested description language only.",
		"- For custom properties, return only the configured property names and keep values compact.",
		namingStyleInstruction(input.namingStyle),
		tagPolicyInstruction(input.tagPolicy),
		"",
		"Return JSON only using this schema:",
		`{"filenameCandidates":[{"name":"candidate-one","reason":"short reason"},{"name":"candidate-two","reason":"short reason"},{"name":"candidate-three","reason":"short reason"}],"tags":["tag-one"],"description":"concise description","properties":{"status":"evergreen"}}`,
		"",
		"Markdown content:",
		"---",
		input.content || "(empty content)",
		"---",
	].join("\n");
}

export function buildSystemPromptForFrontMatter(): string {
	return buildSystemPrompt();
}

