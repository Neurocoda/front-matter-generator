import {normalizePath} from "obsidian";

export function getFolderPath(path: string): string {
	const normalized = normalizePath(path);
	const index = normalized.lastIndexOf("/");
	return index === -1 ? "" : normalized.slice(0, index);
}

export function getBasename(path: string): string {
	const name = path.split("/").pop() ?? path;
	const index = name.lastIndexOf(".");
	return index === -1 ? name : name.slice(0, index);
}

export function getExtension(path: string): string {
	const name = path.split("/").pop() ?? path;
	const index = name.lastIndexOf(".");
	return index === -1 ? "" : name.slice(index + 1);
}

function parseRegexRule(value: string): RegExp | null {
	const trimmed = value.trim();
	const prefixed = trimmed.match(/^regex:(.+)$/i);
	if (prefixed?.[1]) {
		return new RegExp(prefixed[1].trim());
	}
	const wrapped = trimmed.match(/^\/(.+)\/([dgimsuvy]*)$/);
	if (wrapped?.[1]) {
		return new RegExp(wrapped[1], wrapped[2] ?? "");
	}
	return null;
}

export function isPathExcluded(filePath: string, rulesText: string): boolean {
	const normalizedPath = normalizePath(filePath).replace(/^\/+/, "");
	return rulesText
		.split(/\r?\n/)
		.map((rule) => rule.trim())
		.filter((rule) => rule.length > 0 && !rule.startsWith("#"))
		.some((rule) => {
			try {
				const regex = parseRegexRule(rule);
				if (regex) {
					return regex.test(normalizedPath);
				}
			} catch {
				return false;
			}

			const folder = normalizePath(rule).replace(/^\/+|\/+$/g, "");
			return normalizedPath === folder || normalizedPath.startsWith(`${folder}/`);
		});
}
