import {CustomPropertyRule, FrontMatterPropertyValue} from "./types";

const RESERVED_PROPERTY_NAMES = new Set(["title", "tags", "description"]);

export function parseCustomPropertyRules(text: string): CustomPropertyRule[] {
	const seen = new Set<string>();
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) => {
			const index = line.indexOf(":");
			if (index === -1) {
				return null;
			}
			const name = line.slice(0, index).trim();
			const instruction = line.slice(index + 1).trim();
			const normalizedName = name.trim();
			const lowerName = normalizedName.toLowerCase();
			if (!normalizedName || !instruction || RESERVED_PROPERTY_NAMES.has(lowerName) || seen.has(lowerName)) {
				return null;
			}
			seen.add(lowerName);
			return {name: normalizedName, instruction};
		})
		.filter((value): value is CustomPropertyRule => value !== null);
}

export function normalizeCustomPropertyRules(value: unknown): CustomPropertyRule[] {
	if (typeof value === "string") {
		return parseCustomPropertyRules(value);
	}
	if (!Array.isArray(value)) {
		return [];
	}

	const seen = new Set<string>();
	const output: CustomPropertyRule[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null) {
			continue;
		}
		const record = item as Record<string, unknown>;
		const name = typeof record.name === "string" ? record.name.trim() : "";
		const instruction = typeof record.instruction === "string" ? record.instruction.trim() : "";
		const lowerName = name.toLowerCase();
		if (!name || !instruction || RESERVED_PROPERTY_NAMES.has(lowerName) || seen.has(lowerName)) {
			continue;
		}
		seen.add(lowerName);
		output.push({name, instruction});
	}
	return output;
}

export function normalizeCustomPropertyRows(value: unknown): CustomPropertyRule[] {
	if (typeof value === "string") {
		return parseCustomPropertyRules(value);
	}
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => {
			if (typeof item !== "object" || item === null) {
				return null;
			}
			const record = item as Record<string, unknown>;
			return {
				name: typeof record.name === "string" ? record.name : "",
				instruction: typeof record.instruction === "string" ? record.instruction : "",
			};
		})
		.filter((item): item is CustomPropertyRule => item !== null);
}

export function normalizePropertyValue(value: unknown): FrontMatterPropertyValue {
	if (value === null) {
		return null;
	}
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	if (Array.isArray(value)) {
		if (value.every((item): item is string => typeof item === "string")) {
			return value;
		}
		if (value.every((item): item is number => typeof item === "number")) {
			return value;
		}
		if (value.every((item): item is boolean => typeof item === "boolean")) {
			return value;
		}
		return null;
	}
	return null;
}

export function pickConfiguredProperties(raw: Record<string, unknown>, configured: CustomPropertyRule[]): Record<string, FrontMatterPropertyValue> {
	const output: Record<string, FrontMatterPropertyValue> = {};
	for (const rule of configured) {
		if (Object.prototype.hasOwnProperty.call(raw, rule.name)) {
			output[rule.name] = normalizePropertyValue(raw[rule.name]);
		}
	}
	return output;
}
