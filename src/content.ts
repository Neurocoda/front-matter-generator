import {ContentMode} from "./types";

export function getContentModeLabel(mode: ContentMode): string {
	switch (mode) {
		case "full-text":
			return "Full text";
		case "first-lines":
			return "First N lines";
		case "headings-only":
			return "Headings only";
	}
}

export function extractPromptContent(markdown: string, mode: ContentMode, lineLimit: number): string {
	switch (mode) {
		case "full-text":
			return markdown.trim();
		case "first-lines":
			return markdown.split(/\r?\n/).slice(0, Math.max(1, Math.floor(lineLimit))).join("\n").trim();
		case "headings-only":
			return markdown
				.split(/\r?\n/)
				.filter((line) => /^#{1,6}\s+\S/.test(line.trim()))
				.join("\n")
				.trim();
	}
}

export function getDescriptionLanguageLabel(language: string): string {
	switch (language) {
		case "chinese":
			return "Chinese";
		case "english":
			return "English";
		case "spanish":
			return "Spanish";
		default:
			return language;
	}
}
