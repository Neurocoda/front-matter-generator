import {Notice, Plugin, TAbstractFile, TFile, normalizePath} from "obsidian";
import {FrontMatterConfirmModal} from "./confirm-modal";
import {extractPromptContent} from "./content";
import {cleanNameToStyle} from "./naming";
import {getBasename, getExtension, getFolderPath, isPathExcluded} from "./path";
import {parseCustomPropertyRules} from "./properties";
import {ChatCompletionsProvider, ResponsesProvider} from "./providers";
import {AutoFrontMatterSettingTab} from "./settings";
import {collectCurrentFileTags, collectVaultTags, filterSuggestedTags, mergeTags} from "./tags";
import {AutoFrontMatterProvider, AutoFrontMatterResult, DEFAULT_SETTINGS, FileAutoFrontMatterSettings, FilenameCandidate, FrontMatterPropertyValue} from "./types";

export default class AutoFrontMatterPlugin extends Plugin {
	settings: FileAutoFrontMatterSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new AutoFrontMatterSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
			if (!this.isEligibleMarkdownFile(file)) {
				return;
			}

			menu.addItem((item) => {
				item
					.setTitle("Auto: front matter")
					.setIcon("sparkles")
					.onClick(async () => {
						await this.generateForFile(file);
					});
			});
		}));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FileAutoFrontMatterSettings>);
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

		new Notice("Auto Front Matter: testing API provider...");
		try {
			await this.getProvider().testConnection({
				apiBaseUrl: this.settings.apiBaseUrl,
				apiKey: this.settings.apiKey,
				model: this.settings.model,
			});
			new Notice("Auto Front Matter: API provider test succeeded.");
		} catch (error) {
			console.error("Auto Front Matter provider test failed", error);
			new Notice(`Auto Front Matter: provider test failed. ${this.errorMessage(error)}`);
		}
	}

	private validateSettings(): boolean {
		if (!this.settings.apiBaseUrl.trim()) {
			new Notice("Auto Front Matter: API base URL is required.");
			return false;
		}
		if (!this.settings.apiKey.trim()) {
			new Notice("Auto Front Matter: API key is required.");
			return false;
		}
		if (!this.settings.model.trim()) {
			new Notice("Auto Front Matter: Model is required.");
			return false;
		}
		return true;
	}

	private async generateForFile(file: TFile): Promise<void> {
		if (!this.validateSettings()) {
			return;
		}

		if (isPathExcluded(file.path, this.settings.excludedPaths)) {
			new Notice("Auto Front Matter: This file is in an excluded path.");
			return;
		}

		new Notice("Auto Front Matter: generating metadata...");

		try {
			const markdown = await this.app.vault.cachedRead(file);
			const content = extractPromptContent(markdown, this.settings.contentMode, this.settings.lineLimit);
			const folderPath = getFolderPath(file.path);
			const currentBasename = getBasename(file.path);
			const fileCache = this.app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			const currentTags = collectCurrentFileTags(frontmatter, fileCache?.tags?.map((tag) => tag.tag));
			const existingDescription = typeof frontmatter?.description === "string" ? frontmatter.description : "";
			const customProperties = parseCustomPropertyRules(this.settings.customProperties);
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
				relativePath: file.path,
				folderPath,
				currentBasename,
				namingStyle: this.settings.namingStyle,
				descriptionLanguage: this.settings.descriptionLanguage,
				contentMode: this.settings.contentMode,
				content,
				currentTags,
				existingDescription,
				existingTags,
				tagPolicy: this.settings.tagPolicy,
				maxGeneratedTags: this.settings.maxGeneratedTags,
				customProperties,
				existingCustomProperties,
			});

			const filenameCandidates = this.normalizeFilenameCandidates(result.filenameCandidates, currentBasename);
			if (filenameCandidates.length === 0) {
				new Notice("Auto Front Matter: No valid filename candidates were returned.");
				return;
			}

			const generatedTags = filterSuggestedTags(
				result.tags,
				existingTags,
				this.settings.tagPolicy,
				this.settings.maxGeneratedTags,
			);
			const finalTags = mergeTags(currentTags, generatedTags, this.settings.tagWriteMode);

			new FrontMatterConfirmModal(this.app, {
				filePath: file.path,
				contentMode: this.settings.contentMode,
				descriptionLanguage: this.settings.descriptionLanguage,
				tagPolicy: this.settings.tagPolicy,
				settings: {namingStyle: this.settings.namingStyle},
				filenameCandidates,
				generatedTags: finalTags,
				generatedDescription: result.description,
				generatedProperties: result.properties,
				onSubmit: async (finalBasename) => {
					await this.applyResult(file, finalBasename, {
						...result,
						tags: finalTags,
					});
				},
			}).open();
		} catch (error) {
			console.error("Auto Front Matter failed", error);
			new Notice(`Auto Front Matter: ${this.errorMessage(error)}`);
		}
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
		const description = result.description.trim();
		const properties = result.properties;

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (result.tags.length > 0) {
				frontmatter.tags = result.tags;
			}
			if (description) {
				frontmatter.description = description;
			}
			for (const [key, value] of Object.entries(properties)) {
				this.writePropertyValue(frontmatter, key, value);
			}
		});

		const targetPath = this.nextAvailablePath(file.path, finalBasename);
		if (targetPath !== file.path) {
			await this.app.fileManager.renameFile(file, targetPath);
			new Notice(`Auto Front Matter: updated frontmatter and renamed to ${targetPath}.`);
			return;
		}

		new Notice("Auto Front Matter: frontmatter updated.");
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
