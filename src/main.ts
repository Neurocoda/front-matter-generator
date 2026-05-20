import {Notice, Plugin, TAbstractFile, TFile, normalizePath} from "obsidian";
import {FrontMatterConfirmModal} from "./confirm-modal";
import {extractPromptContent} from "./content";
import {cleanNameToStyle} from "./naming";
import {getBasename, getExtension, getFolderPath, isPathExcluded} from "./path";
import {normalizeCustomPropertyRules} from "./properties";
import {ChatCompletionsProvider, ResponsesProvider} from "./providers";
import {AutoFrontMatterSettingTab} from "./settings";
import {collectCurrentFileTags, collectVaultTags, filterSuggestedTags, mergeTags} from "./tags";
import {AutoFrontMatterProvider, AutoFrontMatterResult, DEFAULT_SETTINGS, FrontMatterGeneratorSettings, FilenameCandidate, FrontMatterPropertyValue, LegacySettings} from "./types";

export default class FrontMatterGeneratorPlugin extends Plugin {
	settings: FrontMatterGeneratorSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new AutoFrontMatterSettingTab(this.app, this));
		this.addCommand({
			id: "generate-front-matter-for-current-file",
			name: "Generate front matter for current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !this.isEligibleMarkdownFile(file)) {
					return false;
				}
				if (!checking) {
					void this.generateForFile(file);
				}
				return true;
			},
		});

		this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
			if (!this.isEligibleMarkdownFile(file)) {
				return;
			}

			menu.addItem((item) => {
				item
					.setTitle("Generate front matter")
					.setIcon("sparkles")
					.onClick(async () => {
						await this.generateForFile(file);
					});
			});
		}));
	}

	async loadSettings(): Promise<void> {
		const loaded = await this.loadData() as LegacySettings | null;
		const {
			descriptionLanguage: legacyDescriptionLanguage,
			...loadedSettings
		} = loaded ?? {};
		const outputLanguage = loadedSettings.outputLanguage ?? legacyDescriptionLanguage ?? DEFAULT_SETTINGS.outputLanguage;
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedSettings,
			outputLanguage,
			customProperties: normalizeCustomPropertyRules(loaded?.customProperties),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private isEligibleMarkdownFile(file: TAbstractFile): file is TFile {
		return file instanceof TFile
			&& file.extension.toLowerCase() === "md"
			&& !isPathExcluded(file.path, this.settings.excludedPaths);
	}

	private getProvider(): AutoFrontMatterProvider {
		return this.settings.apiType === "responses" ? new ResponsesProvider() : new ChatCompletionsProvider();
	}

	async testProviderConnection(): Promise<void> {
		if (!this.validateSettings()) {
			return;
		}

		new Notice("Front Matter Generator: testing API provider...");
		try {
			await this.getProvider().testConnection({
				apiBaseUrl: this.settings.apiBaseUrl,
				apiKey: this.settings.apiKey,
				model: this.settings.model,
			});
			new Notice("Front Matter Generator: API provider test succeeded.");
		} catch (error) {
			console.error("Front Matter Generator provider test failed", error);
			new Notice(`Front Matter Generator: provider test failed. ${this.errorMessage(error)}`);
		}
	}

	private validateSettings(): boolean {
		if (!this.settings.apiBaseUrl.trim()) {
			new Notice("Front Matter Generator: API base URL is required.");
			return false;
		}
		if (!this.settings.apiKey.trim()) {
			new Notice("Front Matter Generator: API key is required.");
			return false;
		}
		if (!this.settings.model.trim()) {
			new Notice("Front Matter Generator: Model is required.");
			return false;
		}
		return true;
	}

	private async generateForFile(file: TFile): Promise<void> {
		if (!this.validateSettings()) {
			return;
		}
		if (!this.hasEnabledWork()) {
			new Notice("Front Matter Generator: enable at least one generation feature or custom property.");
			return;
		}

		if (isPathExcluded(file.path, this.settings.excludedPaths)) {
			new Notice("Front Matter Generator: This file is in an excluded path.");
			return;
		}

		new Notice("Front Matter Generator: generating metadata...");

		try {
			const markdown = await this.app.vault.cachedRead(file);
			const content = extractPromptContent(markdown, this.settings.contentMode, this.settings.lineLimit);
			const folderPath = getFolderPath(file.path);
			const currentBasename = getBasename(file.path);
			const fileCache = this.app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			const currentTags = collectCurrentFileTags(frontmatter, fileCache?.tags?.map((tag) => tag.tag));
			const existingTitle = typeof frontmatter?.title === "string" ? frontmatter.title : "";
			const existingDescription = typeof frontmatter?.description === "string" ? frontmatter.description : "";
			const customProperties = normalizeCustomPropertyRules(this.settings.customProperties);
			const existingCustomProperties: Record<string, unknown> = {};
			for (const rule of customProperties) {
				if (frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, rule.name)) {
					existingCustomProperties[rule.name] = frontmatter[rule.name];
				}
			}
			const existingTags = collectVaultTags(this.app).slice(0, Math.max(0, Math.floor(this.settings.tagContextLimit)));

			const result = await this.getProvider().generateFrontMatter({
				apiBaseUrl: this.settings.apiBaseUrl,
				apiKey: this.settings.apiKey,
				model: this.settings.model,
				enableFileName: this.settings.enableFileName,
				enableTitle: this.settings.enableTitle,
				enableTags: this.settings.enableTags,
				enableDescription: this.settings.enableDescription,
				relativePath: file.path,
				folderPath,
				currentBasename,
				namingStyle: this.settings.namingStyle,
				outputLanguage: this.settings.outputLanguage,
				contentMode: this.settings.contentMode,
				content,
				currentTags,
				existingTitle,
				existingDescription,
				existingTags,
				tagPolicy: this.settings.tagPolicy,
				maxGeneratedTags: this.settings.maxGeneratedTags,
				customProperties,
				existingCustomProperties,
			});

			const filenameCandidates = this.settings.enableFileName
				? this.normalizeFilenameCandidates(result.filenameCandidates, currentBasename)
				: [];
			if (this.settings.enableFileName && filenameCandidates.length === 0) {
				new Notice("Front Matter Generator: No valid filename candidates were returned.");
				return;
			}

			const generatedTags = this.settings.enableTags
				? filterSuggestedTags(
					result.tags,
					existingTags,
					this.settings.tagPolicy,
					this.settings.maxGeneratedTags,
				)
				: [];
			const finalTags = this.settings.enableTags ? mergeTags(currentTags, generatedTags, this.settings.tagWriteMode) : currentTags;

			new FrontMatterConfirmModal(this.app, {
				filePath: file.path,
				contentMode: this.settings.contentMode,
				outputLanguage: this.settings.outputLanguage,
				tagPolicy: this.settings.tagPolicy,
				settings: {
					enableFileName: this.settings.enableFileName,
					enableTitle: this.settings.enableTitle,
					enableTags: this.settings.enableTags,
					enableDescription: this.settings.enableDescription,
					namingStyle: this.settings.namingStyle,
				},
				filenameCandidates,
				generatedTitle: this.settings.enableTitle ? result.title : "",
				generatedTags: this.settings.enableTags ? finalTags : [],
				generatedDescription: this.settings.enableDescription ? result.description : "",
				generatedProperties: result.properties,
				onSubmit: async (finalBasename) => {
					await this.applyResult(file, finalBasename, {
						...result,
						title: this.settings.enableTitle ? result.title : "",
						tags: this.settings.enableTags ? finalTags : [],
						description: this.settings.enableDescription ? result.description : "",
					});
				},
			}).open();
		} catch (error) {
			console.error("Front Matter Generator failed", error);
			new Notice(`Front Matter Generator: ${this.errorMessage(error)}`);
		}
	}

	private hasEnabledWork(): boolean {
		return this.settings.enableFileName
			|| this.settings.enableTitle
			|| this.settings.enableTags
			|| this.settings.enableDescription
			|| normalizeCustomPropertyRules(this.settings.customProperties).length > 0;
	}

	private normalizeFilenameCandidates(candidates: FilenameCandidate[], currentBasename: string): FilenameCandidate[] {
		const seen = new Set<string>();
		const output: FilenameCandidate[] = [];
		for (const candidate of candidates) {
			const name = cleanNameToStyle(candidate.name, this.settings.namingStyle);
			if (!name || seen.has(name.toLowerCase())) {
				continue;
			}
			seen.add(name.toLowerCase());
			output.push({
				name,
				reason: candidate.reason.trim() || "Suggested by the model.",
			});
			if (output.length >= 3) {
				break;
			}
		}

		if (output.length === 0) {
			const fallback = cleanNameToStyle(currentBasename, this.settings.namingStyle);
			if (fallback) {
				output.push({name: fallback, reason: "Fallback based on the current filename."});
			}
		}

		return output;
	}

	private async applyResult(file: TFile, finalBasename: string, result: AutoFrontMatterResult): Promise<void> {
		const title = result.title.trim();
		const description = result.description.trim();
		const properties = result.properties;

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (this.settings.enableTitle && title) {
				frontmatter.title = title;
			}
			if (this.settings.enableTags && result.tags.length > 0) {
				frontmatter.tags = result.tags;
			}
			if (this.settings.enableDescription && description) {
				frontmatter.description = description;
			}
			for (const [key, value] of Object.entries(properties)) {
				this.writePropertyValue(frontmatter, key, value);
			}
		});

		const targetPath = this.settings.enableFileName && finalBasename
			? this.nextAvailablePath(file.path, finalBasename)
			: file.path;
		if (this.settings.enableFileName && targetPath !== file.path) {
			await this.app.fileManager.renameFile(file, targetPath);
			new Notice(`Front Matter Generator: updated frontmatter and renamed to ${targetPath}.`);
			return;
		}

		new Notice("Front Matter Generator: frontmatter updated.");
	}

	private writePropertyValue(frontmatter: any, key: string, value: FrontMatterPropertyValue): void {
		if (value === null) {
			delete frontmatter[key];
			return;
		}
		frontmatter[key] = value;
	}

	private nextAvailablePath(currentPath: string, basename: string): string {
		const folder = getFolderPath(currentPath);
		const extension = getExtension(currentPath) || "md";
		const currentNormalized = normalizePath(currentPath);
		const firstPath = normalizePath(folder ? `${folder}/${basename}.${extension}` : `${basename}.${extension}`);
		if (firstPath === currentNormalized || this.app.vault.getAbstractFileByPath(firstPath) === null) {
			return firstPath;
		}

		for (let index = 2; index < 1000; index += 1) {
			const candidate = normalizePath(folder ? `${folder}/${basename}-${index}.${extension}` : `${basename}-${index}.${extension}`);
			if (this.app.vault.getAbstractFileByPath(candidate) === null) {
				return candidate;
			}
		}

		throw new Error("Could not find an available filename.");
	}

	private errorMessage(error: unknown): string {
		if (error instanceof Error && error.message) {
			return error.message;
		}
		return "Request failed.";
	}
}
