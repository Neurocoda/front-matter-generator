import {App, ButtonComponent, PluginSettingTab, Setting} from "obsidian";
import AutoFrontMatterPlugin from "./main";
import {ApiType, ContentMode, DescriptionLanguage, NamingStyle, TagPolicy, TagWriteMode} from "./types";

const API_TYPE_LABELS: Record<ApiType, string> = {
	"chat-completions": "Chat Completions",
	responses: "Responses API",
};

const CONTENT_MODE_LABELS: Record<ContentMode, string> = {
	"full-text": "Full text",
	"first-lines": "First N lines",
	"headings-only": "Headings only",
};

const DESCRIPTION_LANGUAGE_LABELS: Record<DescriptionLanguage, string> = {
	chinese: "Chinese",
	english: "English",
	spanish: "Spanish",
};

const NAMING_STYLE_LABELS: Record<NamingStyle, string> = {
	"kebab-case": "kebab-case",
	camelCase: "camelCase",
	PascalCase: "PascalCase",
	snake_case: "snake_case",
	"Title Case": "Title Case",
};

const TAG_POLICY_LABELS: Record<TagPolicy, string> = {
	"prefer-existing": "Prefer existing",
	"existing-only": "Existing only",
	"allow-new": "Allow new",
};

const TAG_WRITE_MODE_LABELS: Record<TagWriteMode, string> = {
	replace: "Replace existing tags",
	merge: "Merge with existing tags",
};

export class AutoFrontMatterSettingTab extends PluginSettingTab {
	plugin: AutoFrontMatterPlugin;

	constructor(app: App, plugin: AutoFrontMatterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl).setName("AI provider").setHeading();

		new Setting(containerEl)
			.setName("API base URL")
			.setDesc("Base URL for the selected OpenAI-compatible API.")
			.addText((text) => text
				.setPlaceholder("https://api.openai.com/v1")
				.setValue(this.plugin.settings.apiBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiBaseUrl = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("API key")
			.setDesc("Stored locally in this plugin's data.")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Model name sent to the selected API.")
			.addText((text) => text
				.setPlaceholder("gpt-4o-mini")
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("API type")
			.setDesc("Choose which OpenAI-compatible endpoint shape to use.")
			.addDropdown((dropdown) => dropdown
				.addOptions(API_TYPE_LABELS)
				.setValue(this.plugin.settings.apiType)
				.onChange(async (value) => {
					this.plugin.settings.apiType = value as ApiType;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Test API provider")
			.setDesc("Send a tiny request with the current API settings.")
			.addButton((button: ButtonComponent) => button
				.setButtonText("Test")
				.setIcon("plug")
				.onClick(async () => {
					await this.plugin.testProviderConnection();
				}));

		new Setting(containerEl).setName("Generation behavior").setHeading();

		new Setting(containerEl)
			.setName("Naming style")
			.setDesc("The selected style is enforced in both the AI prompt and local cleanup.")
			.addDropdown((dropdown) => dropdown
				.addOptions(NAMING_STYLE_LABELS)
				.setValue(this.plugin.settings.namingStyle)
				.onChange(async (value) => {
					this.plugin.settings.namingStyle = value as NamingStyle;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Description language")
			.setDesc("Choose the language used for the frontmatter description.")
			.addDropdown((dropdown) => dropdown
				.addOptions(DESCRIPTION_LANGUAGE_LABELS)
				.setValue(this.plugin.settings.descriptionLanguage)
				.onChange(async (value) => {
					this.plugin.settings.descriptionLanguage = value as DescriptionLanguage;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Content mode")
			.setDesc("Controls how much note content is sent to the AI provider.")
			.addDropdown((dropdown) => dropdown
				.addOptions(CONTENT_MODE_LABELS)
				.setValue(this.plugin.settings.contentMode)
				.onChange(async (value) => {
					this.plugin.settings.contentMode = value as ContentMode;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.contentMode === "first-lines") {
			new Setting(containerEl)
				.setName("Line limit")
				.setDesc("Number of leading lines to send to the AI provider.")
				.addText((text) => {
					text.inputEl.type = "number";
					text.inputEl.min = "1";
					text.inputEl.step = "1";
					text
						.setPlaceholder("200")
						.setValue(String(this.plugin.settings.lineLimit))
						.onChange(async (value) => {
							const parsed = Number.parseInt(value, 10);
							this.plugin.settings.lineLimit = Number.isFinite(parsed) ? Math.max(1, parsed) : 200;
							await this.plugin.saveSettings();
						});
				});
		}

		new Setting(containerEl).setName("Tags").setHeading();

		new Setting(containerEl)
			.setName("Tag policy")
			.setDesc("Controls whether generated tags may create new vault tags.")
			.addDropdown((dropdown) => dropdown
				.addOptions(TAG_POLICY_LABELS)
				.setValue(this.plugin.settings.tagPolicy)
				.onChange(async (value) => {
					this.plugin.settings.tagPolicy = value as TagPolicy;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Tag write mode")
			.setDesc("Replace the note's tags or merge generated tags with existing tags.")
			.addDropdown((dropdown) => dropdown
				.addOptions(TAG_WRITE_MODE_LABELS)
				.setValue(this.plugin.settings.tagWriteMode)
				.onChange(async (value) => {
					this.plugin.settings.tagWriteMode = value as TagWriteMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Max generated tags")
			.setDesc("Maximum number of tags to write.")
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.inputEl.step = "1";
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.maxGeneratedTags))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.maxGeneratedTags = Number.isFinite(parsed) ? Math.max(1, parsed) : 5;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Tag context limit")
			.setDesc("Maximum number of existing vault tags sent as context.")
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.step = "1";
				text
					.setPlaceholder("300")
					.setValue(String(this.plugin.settings.tagContextLimit))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.tagContextLimit = Number.isFinite(parsed) ? Math.max(0, parsed) : 300;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName("Custom properties").setHeading();

		new Setting(containerEl)
			.setName("Custom properties")
			.setDesc("One property per line: propertyName: generation instruction. tags and description are reserved.")
			.addTextArea((text) => {
				text.inputEl.rows = 6;
				text
					.setPlaceholder("status: Choose one of seedling, evergreen, archived")
					.setValue(this.plugin.settings.customProperties)
					.onChange(async (value) => {
						this.plugin.settings.customProperties = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName("Safety").setHeading();

		new Setting(containerEl)
			.setName("Excluded paths")
			.setDesc("One rule per line. Use folder prefixes like templates, /regex/ rules, or regex:^archive/.")
			.addTextArea((text) => {
				text.inputEl.rows = 5;
				text
					.setPlaceholder("templates")
					.setValue(this.plugin.settings.excludedPaths)
					.onChange(async (value) => {
						this.plugin.settings.excludedPaths = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
