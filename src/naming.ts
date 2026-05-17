import {NamingStyle} from "./types";

function normalizeWords(value: string): string[] {
	return value
		.replace(/\.md$/i, "")
		.replace(/^["'`]+|["'`]+$/g, "")
		.replace(/^[\d\s).:-]+/, "")
		.trim()
		.split(/[\\/]/)
		.pop()
		?.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-eg-z]{2,})/g, "$1 $2")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter((part) => part.length > 0) ?? [];
}

function capitalize(value: string): string {
	if (value.length === 0) {
		return value;
	}
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function cleanNameToStyle(value: string, style: NamingStyle): string {
	const words = normalizeWords(value);
	if (words.length === 0) {
		return "";
	}

	switch (style) {
		case "kebab-case":
			return words.map((word) => word.toLowerCase()).join("-");
		case "camelCase":
			return `${(words[0] ?? "").toLowerCase()}${words.slice(1).map(capitalize).join("")}`;
		case "PascalCase":
			return words.map((word) => capitalize(word.toLowerCase())).join("");
		case "snake_case":
			return words.map((word) => word.toLowerCase()).join("_");
		case "Title Case":
			return words.map((word) => capitalize(word.toLowerCase())).join(" ");
	}
}

export function normalizeFilenameCandidate(value: string, style: NamingStyle): string {
	return cleanNameToStyle(value, style);
}
