import {App, ButtonComponent, Modal, Setting} from "obsidian";
import {cleanNameToStyle} from "./naming";
import {getContentModeLabel, getDescriptionLanguageLabel} from "./content";
import {getExtension, getFolderPath} from "./path";
import {FilenameCandidate, FrontMatterGeneratorSettings, FrontMatterPropertyValue} from "./types";

interface FrontMatterConfirmModalOptions {
	filePath: string;
	contentMode: string;
	descriptionLanguage: string;
	tagPolicy: string;
	settings: Pick<FrontMatterGeneratorSettings, "enableFileName" | "enableTags" | "enableDescription" | "namingStyle">;
	filenameCandidates: FilenameCandidate[];
	generatedTags: string[];
	generatedDescription: string;
	generatedProperties: Record<string, FrontMatterPropertyValue>;
	onSubmit: (filename: string) => Promise<void>;
}

function stringifyValue(value: FrontMatterPropertyValue): string {
	if (value === null) {
		return "null";
	}
	if (Array.isArray(value)) {
		return JSON.stringify(value);
	}
	if (typeof value === "string") {
		return value;
	}
	return String(value);
}

export class FrontMatterConfirmModal extends Modal {
	private readonly options: FrontMatterConfirmModalOptions;
	private inputEl: HTMLInputElement | null = null;
	private previewEl: HTMLElement | null = null;
	private applyButton: ButtonComponent | null = null;
	private isSubmitting = false;

	constructor(app: App, options: FrontMatterConfirmModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass("front-matter-generator-modal");

		contentEl.createEl("h2", {text: "Front Matter Generator"});

		const summaryEl = contentEl.createDiv({cls: "front-matter-generator-summary"});
		summaryEl.createSpan({text: "Current path: "});
		summaryEl.createSpan({text: this.options.filePath, cls: "front-matter-generator-path"});
		summaryEl.createEl("br");
		summaryEl.createSpan({text: `Content mode: ${getContentModeLabel(this.options.contentMode as any)}`});
		if (this.options.settings.enableDescription) {
			summaryEl.createEl("br");
			summaryEl.createSpan({text: `Description language: ${getDescriptionLanguageLabel(this.options.descriptionLanguage as any)}`});
		}
		if (this.options.settings.enableTags) {
			summaryEl.createEl("br");
			summaryEl.createSpan({text: `Tag policy: ${this.options.tagPolicy}`});
		}

		if (this.options.settings.enableFileName) {
			this.renderFilenameControls(contentEl);
		}

		this.renderFrontmatterPreview(contentEl);

		this.previewEl = contentEl.createDiv({cls: "front-matter-generator-final-preview"});
		this.updatePreview();

		const actionsEl = contentEl.createDiv({cls: "front-matter-generator-actions"});
		new ButtonComponent(actionsEl)
			.setButtonText("Cancel")
			.onClick(() => this.close());

		this.applyButton = new ButtonComponent(actionsEl)
			.setButtonText("Apply")
			.setCta()
			.onClick(async () => {
				await this.submit();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderFilenameControls(contentEl: HTMLElement): void {
		const candidateWrap = contentEl.createDiv({cls: "front-matter-generator-candidates"});
		for (const candidate of this.options.filenameCandidates) {
			const button = candidateWrap.createEl("button", {cls: "front-matter-generator-candidate", type: "button"});
			const body = button.createDiv();
			body.createDiv({text: candidate.name, cls: "front-matter-generator-candidate-name"});
			body.createDiv({text: candidate.reason, cls: "front-matter-generator-candidate-reason"});
			button.addEventListener("click", () => {
				if (this.inputEl) {
					this.inputEl.value = candidate.name;
				}
				this.updatePreview();
			});
		}

		new Setting(contentEl)
			.setName("Custom filename")
			.setDesc("The plugin keeps the current folder and .md extension.")
			.addText((text) => {
				this.inputEl = text.inputEl;
				text
					.setPlaceholder("new-file-name")
					.setValue(this.options.filenameCandidates[0]?.name ?? "")
					.onChange(() => this.updatePreview());
			});
	}

	private renderFrontmatterPreview(contentEl: HTMLElement): void {
		const frontmatterEl = contentEl.createDiv({cls: "front-matter-generator-preview"});
		frontmatterEl.createEl("h3", {text: "Generated frontmatter"});

		if (this.options.settings.enableTags) {
			frontmatterEl.createEl("div", {text: `tags: ${this.options.generatedTags.length > 0 ? this.options.generatedTags.join(", ") : "(unchanged)"}`});
		}
		if (this.options.settings.enableDescription) {
			frontmatterEl.createEl("div", {text: `description: ${this.options.generatedDescription || "(unchanged)"}`});
		}

		const propertyLines = Object.entries(this.options.generatedProperties);
		if (propertyLines.length > 0) {
			const propertiesEl = frontmatterEl.createDiv();
			propertiesEl.createEl("div", {text: "properties:"});
			for (const [key, value] of propertyLines) {
				propertiesEl.createEl("div", {text: `${key}: ${stringifyValue(value)}`});
			}
		}

		if (!this.options.settings.enableTags && !this.options.settings.enableDescription && propertyLines.length === 0) {
			frontmatterEl.createEl("div", {text: "(no frontmatter fields will be changed)", cls: "front-matter-generator-muted"});
		}
	}

	private getFilename(): string {
		if (!this.options.settings.enableFileName) {
			return "";
		}
		return cleanNameToStyle(this.inputEl?.value ?? "", this.options.settings.namingStyle);
	}

	private getPreviewPath(filename: string): string {
		const folder = getFolderPath(this.options.filePath);
		const extension = getExtension(this.options.filePath) || "md";
		return folder ? `${folder}/${filename}.${extension}` : `${filename}.${extension}`;
	}

	private updatePreview(): void {
		const filename = this.getFilename();
		if (this.previewEl) {
			if (this.options.settings.enableFileName) {
				this.previewEl.setText(filename ? `Final path preview: ${this.getPreviewPath(filename)}` : "Enter a valid filename to continue.");
			} else {
				this.previewEl.setText("File name generation is disabled.");
			}
		}
		this.applyButton?.setDisabled((this.options.settings.enableFileName && !filename) || this.isSubmitting);
	}

	private async submit(): Promise<void> {
		const filename = this.getFilename();
		if ((this.options.settings.enableFileName && !filename) || this.isSubmitting) {
			return;
		}

		this.isSubmitting = true;
		this.updatePreview();
		try {
			await this.options.onSubmit(filename);
			this.close();
		} finally {
			this.isSubmitting = false;
			this.updatePreview();
		}
	}
}
