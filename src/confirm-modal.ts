import {App, ButtonComponent, Modal, Setting} from "obsidian";
import {cleanNameToStyle} from "./naming";
import {getContentModeLabel, getDescriptionLanguageLabel} from "./content";
import {getExtension, getFolderPath} from "./path";
import {FileAutoFrontMatterSettings, FilenameCandidate, FrontMatterPropertyValue} from "./types";

interface FrontMatterConfirmModalOptions {
	filePath: string;
	contentMode: string;
	descriptionLanguage: string;
	tagPolicy: string;
	settings: Pick<FileAutoFrontMatterSettings, "namingStyle">;
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
		contentEl.addClass("auto-front-matter-modal");

		contentEl.createEl("h2", {text: "Auto front matter"});

		const summaryEl = contentEl.createDiv({cls: "auto-front-matter-summary"});
		summaryEl.createSpan({text: "Current path: "});
		summaryEl.createSpan({text: this.options.filePath, cls: "auto-front-matter-path"});
		summaryEl.createEl("br");
		summaryEl.createSpan({text: `Content mode: ${getContentModeLabel(this.options.contentMode as any)}`});
		summaryEl.createEl("br");
		summaryEl.createSpan({text: `Description language: ${getDescriptionLanguageLabel(this.options.descriptionLanguage as any)}`});
		summaryEl.createEl("br");
		summaryEl.createSpan({text: `Tag policy: ${this.options.tagPolicy}`});

		const candidateWrap = contentEl.createDiv({cls: "auto-front-matter-candidates"});
		for (const candidate of this.options.filenameCandidates) {
			const button = candidateWrap.createEl("button", {cls: "auto-front-matter-candidate", type: "button"});
			const body = button.createDiv();
			body.createDiv({text: candidate.name, cls: "auto-front-matter-candidate-name"});
			body.createDiv({text: candidate.reason, cls: "auto-front-matter-candidate-reason"});
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

		const frontmatterEl = contentEl.createDiv({cls: "auto-front-matter-preview"});
		frontmatterEl.createEl("h3", {text: "Generated frontmatter"});
		frontmatterEl.createEl("div", {text: `tags: ${this.options.generatedTags.length > 0 ? this.options.generatedTags.join(", ") : "(none)"}`});
		frontmatterEl.createEl("div", {text: `description: ${this.options.generatedDescription || "(none)"}`});
		const propertiesEl = frontmatterEl.createDiv();
		propertiesEl.createEl("div", {text: "properties:"});
		const propertyLines = Object.entries(this.options.generatedProperties);
		if (propertyLines.length === 0) {
			propertiesEl.createEl("div", {text: "(none)", cls: "auto-front-matter-muted"});
		} else {
			for (const [key, value] of propertyLines) {
				propertiesEl.createEl("div", {text: `${key}: ${stringifyValue(value)}`});
			}
		}

		this.previewEl = contentEl.createDiv({cls: "auto-front-matter-final-preview"});
		this.updatePreview();

		const actionsEl = contentEl.createDiv({cls: "auto-front-matter-actions"});
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

	private getFilename(): string {
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
			this.previewEl.setText(filename ? `Final path preview: ${this.getPreviewPath(filename)}` : "Enter a valid filename to continue.");
		}
		this.applyButton?.setDisabled(!filename || this.isSubmitting);
	}

	private async submit(): Promise<void> {
		const filename = this.getFilename();
		if (!filename || this.isSubmitting) {
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
