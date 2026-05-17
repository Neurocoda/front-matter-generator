import {getAllTags, parseFrontMatterStringArray} from "obsidian";
import {ExistingTag, TagPolicy} from "./types";

function normalizeTagValue(value: string): string {
	return value.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
}

function isTagLike(value: string): boolean {
	return normalizeTagValue(value).length > 0;
}

export function collectCurrentFileTags(frontmatter: any | null | undefined, contentCacheTags: string[] | undefined): string[] {
	const tags = new Set<string>();
	for (const raw of parseFrontMatterStringArray(frontmatter, "tags") ?? []) {
		const normalized = normalizeTagValue(raw);
		if (normalized) {
			tags.add(normalized);
		}
	}

	for (const raw of contentCacheTags ?? []) {
		const normalized = normalizeTagValue(raw);
		if (normalized) {
			tags.add(normalized);
		}
	}

	return Array.from(tags);
}

export function collectVaultTags(app: {metadataCache: {getFileCache(file: any): any}; vault: {getMarkdownFiles(): any[]}}): ExistingTag[] {
	const counts = new Map<string, number>();
	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache) {
			continue;
		}
		for (const tag of getAllTags(cache) ?? []) {
			const normalized = normalizeTagValue(tag);
			if (!normalized) {
				continue;
			}
			counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
		}
	}

	return Array.from(counts.entries())
		.map(([tag, count]) => ({tag, count}))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function filterSuggestedTags(inputTags: string[], existingVaultTags: ExistingTag[], policy: TagPolicy, maxGeneratedTags: number): string[] {
	const existingSet = new Set(existingVaultTags.map((item) => item.tag.toLowerCase()));
	const seen = new Set<string>();
	const accepted: string[] = [];

	for (const tag of inputTags) {
		const normalized = normalizeTagValue(tag);
		if (!isTagLike(normalized) || seen.has(normalized)) {
			continue;
		}
		if (policy === "existing-only" && !existingSet.has(normalized)) {
			continue;
		}
		if (policy === "prefer-existing" && !existingSet.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		accepted.push(normalized);
		if (accepted.length >= maxGeneratedTags) {
			break;
		}
	}

	return accepted;
}

export function mergeTags(existingTags: string[], generatedTags: string[], writeMode: "replace" | "merge"): string[] {
	if (writeMode === "replace") {
		return generatedTags.length > 0 ? generatedTags : existingTags;
	}

	const seen = new Set<string>();
	const merged: string[] = [];
	for (const tag of [...existingTags, ...generatedTags]) {
		const normalized = normalizeTagValue(tag);
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		merged.push(normalized);
	}
	return merged;
}

export function normalizeTagsForPrompt(tags: ExistingTag[], limit: number): string {
	return tags
		.slice(0, Math.max(0, Math.floor(limit)))
		.map((item) => `- ${item.tag} (${item.count})`)
		.join("\n");
}
