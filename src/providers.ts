import {requestUrl} from "obsidian";
import {buildSystemPromptForFrontMatter, buildUserPrompt} from "./prompt";
import {pickConfiguredProperties} from "./properties";
import {AutoFrontMatterProvider, AutoFrontMatterProviderRequest, AutoFrontMatterResult, FilenameCandidate} from "./types";

const TEMPERATURE = 0.2;
const MAX_OUTPUT_TOKENS = 700;

function trimTrailingSlash(value: string): string {
	return value.trim().replace(/\/+$/g, "");
}

function endpointUrl(baseUrl: string, endpoint: string): string {
	const normalized = trimTrailingSlash(baseUrl);
	if (normalized.endsWith(endpoint)) {
		return normalized;
	}
	return `${normalized}${endpoint}`;
}

function extractChatText(responseJson: unknown): string {
	const response = responseJson as {
		choices?: Array<{
			message?: {
				content?: string | Array<{type?: string; text?: string}>;
			};
			text?: string;
		}>;
	};

	const firstChoice = response.choices?.[0];
	const content = firstChoice?.message?.content;
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		return content.map((part) => part.text ?? "").join("\n");
	}
	return firstChoice?.text ?? "";
}

function extractResponsesText(responseJson: unknown): string {
	const response = responseJson as {
		output_text?: string;
		output?: Array<{
			content?: Array<{type?: string; text?: string}>;
		}>;
	};

	if (typeof response.output_text === "string") {
		return response.output_text;
	}

	return response.output
		?.flatMap((item) => item.content ?? [])
		.map((content) => content.text ?? "")
		.join("\n") ?? "";
}

function extractJsonText(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		return fenced[1].trim();
	}
	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1);
	}
	return trimmed;
}

function toString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function parseFilenameCandidate(value: unknown): FilenameCandidate | null {
	if (typeof value === "string") {
		const name = value.trim();
		return name ? {name, reason: "Suggested by the model."} : null;
	}
	if (typeof value !== "object" || value === null) {
		return null;
	}
	const record = value as Record<string, unknown>;
	const name = toString(record.name);
	if (!name) {
		return null;
	}
	return {
		name,
		reason: toString(record.reason) || "Suggested by the model.",
	};
}

function parseTags(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((item) => toString(item))
		.filter((item) => item.length > 0);
}

export function parseAutoFrontMatterResult(text: string, request: Pick<AutoFrontMatterProviderRequest, "customProperties">): AutoFrontMatterResult {
	const extracted = extractJsonText(text);
	let parsed: unknown;
	try {
		parsed = JSON.parse(extracted);
	} catch {
		throw new Error("The API returned invalid JSON.");
	}

	if (typeof parsed !== "object" || parsed === null) {
		throw new Error("The API returned an unexpected response.");
	}

	const record = parsed as Record<string, unknown>;
	const candidatesValue = record.filenameCandidates ?? record.candidates;
	const filenameCandidates = Array.isArray(candidatesValue)
		? candidatesValue.map(parseFilenameCandidate).filter((candidate): candidate is FilenameCandidate => candidate !== null)
		: [];
	const description = toString(record.description);
	const propertiesValue = typeof record.properties === "object" && record.properties !== null
		? record.properties as Record<string, unknown>
		: {};

	return {
		filenameCandidates,
		tags: parseTags(record.tags),
		description,
		properties: pickConfiguredProperties(propertiesValue, request.customProperties),
	};
}

export class ChatCompletionsProvider implements AutoFrontMatterProvider {
	async testConnection(request: Pick<AutoFrontMatterProviderRequest, "apiBaseUrl" | "apiKey" | "model">): Promise<void> {
		const response = await requestUrl({
			url: endpointUrl(request.apiBaseUrl, "/chat/completions"),
			method: "POST",
			contentType: "application/json",
			headers: {
				Authorization: `Bearer ${request.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				messages: [{role: "user", content: "Reply with exactly: ok"}],
				temperature: 0,
				max_tokens: 8,
			}),
		});

		if (!extractChatText(response.json).trim()) {
			throw new Error("The API returned an empty response.");
		}
	}

	async generateFrontMatter(request: AutoFrontMatterProviderRequest): Promise<AutoFrontMatterResult> {
		const response = await requestUrl({
			url: endpointUrl(request.apiBaseUrl, "/chat/completions"),
			method: "POST",
			contentType: "application/json",
			headers: {
				Authorization: `Bearer ${request.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				messages: [
					{role: "system", content: buildSystemPromptForFrontMatter()},
					{role: "user", content: buildUserPrompt(request)},
				],
				temperature: TEMPERATURE,
				max_tokens: MAX_OUTPUT_TOKENS,
			}),
		});

		return parseAutoFrontMatterResult(extractChatText(response.json), request);
	}
}

export class ResponsesProvider implements AutoFrontMatterProvider {
	async testConnection(request: Pick<AutoFrontMatterProviderRequest, "apiBaseUrl" | "apiKey" | "model">): Promise<void> {
		const response = await requestUrl({
			url: endpointUrl(request.apiBaseUrl, "/responses"),
			method: "POST",
			contentType: "application/json",
			headers: {
				Authorization: `Bearer ${request.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				input: "Reply with exactly: ok",
				temperature: 0,
				max_output_tokens: 8,
			}),
		});

		if (!extractResponsesText(response.json).trim()) {
			throw new Error("The API returned an empty response.");
		}
	}

	async generateFrontMatter(request: AutoFrontMatterProviderRequest): Promise<AutoFrontMatterResult> {
		const response = await requestUrl({
			url: endpointUrl(request.apiBaseUrl, "/responses"),
			method: "POST",
			contentType: "application/json",
			headers: {
				Authorization: `Bearer ${request.apiKey}`,
			},
			body: JSON.stringify({
				model: request.model,
				input: [
					{role: "system", content: buildSystemPromptForFrontMatter()},
					{role: "user", content: buildUserPrompt(request)},
				],
				temperature: TEMPERATURE,
				max_output_tokens: MAX_OUTPUT_TOKENS,
			}),
		});

		return parseAutoFrontMatterResult(extractResponsesText(response.json), request);
	}
}
