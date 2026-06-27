import {App, ButtonComponent, PluginSettingTab, Setting} from "obsidian";
import FrontMatterGeneratorPlugin from "./main";
import {normalizeCustomPropertyRows} from "./properties";
import {ApiType, ContentMode, NamingStyle, OutputLanguage, TagPolicy, TagWriteMode} from "./types";

const API_TYPE_LABELS: Record<ApiType, string> = {
	"chat-completions": "Chat Completions",
	responses: "Responses API",
};

const CONTENT_MODE_LABELS: Record<ContentMode, string> = {
	"full-text": "Full text",
	"first-lines": "First N lines",
	"headings-only": "Headings only",
};

const OUTPUT_LANGUAGE_LABELS: Record<OutputLanguage, string> = {
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
	plugin: FrontMatterGeneratorPlugin;

	constructor(app: App, plugin: FrontMatterGeneratorPlugin) {
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

		new Setting(containerEl).setName("Generation").setHeading();

		new Setting(containerEl)
			.setName("Output language")
			.setDesc("Controls generated titles, descriptions, new tags, custom text values, and filename words.")
			.addDropdown((dropdown) => dropdown
				.addOptions(OUTPUT_LANGUAGE_LABELS)
				.setValue(this.plugin.settings.outputLanguage)
				.onChange(async (value) => {
					this.plugin.settings.outputLanguage = value as OutputLanguage;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName("Content").setHeading();

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

		new Setting(containerEl).setName("File name").setHeading();

		new Setting(containerEl)
			.setName("Enable file name generation")
			.setDesc("Generate filename candidates and rename the note after confirmation.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enableFileName)
				.onChange(async (value) => {
					this.plugin.settings.enableFileName = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableFileName) {
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
		}

		new Setting(containerEl).setName("Front matter").setHeading();

		new Setting(containerEl)
			.setName("Enable title generation")
			.setDesc("Generate and overwrite the frontmatter title.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enableTitle)
				.onChange(async (value) => {
					this.plugin.settings.enableTitle = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(containerEl)
			.setName("Enable description generation")
			.setDesc("Generate and overwrite the frontmatter description.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enableDescription)
				.onChange(async (value) => {
					this.plugin.settings.enableDescription = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(containerEl)
			.setName("Enable tag generation")
			.setDesc("Generate and write frontmatter tags.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enableTags)
				.onChange(async (value) => {
					this.plugin.settings.enableTags = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableTags) {
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
		}

		new Setting(containerEl)
			.setName("Custom properties")
			.setDesc("Generate additional frontmatter fields with one instruction per property.");
		this.renderCustomProperties(containerEl);

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

		new Setting(containerEl).setName("Debug").setHeading();

		new Setting(containerEl)
			.setName("Enable debug logging")
			.setDesc("When enabled, API requests and responses are logged for troubleshooting. Logs are stored in memory only and cleared on plugin reload.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enableDebugLog)
				.onChange(async (value) => {
					this.plugin.settings.enableDebugLog = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableDebugLog) {
			const logContainer = containerEl.createDiv({cls: "front-matter-generator-debug-log"});
			const logArea = logContainer.createEl("textarea", {
				attr: {
					readonly: "true",
					rows: "8",
					style: "width:100%;font-family:monospace;font-size:11px;resize:vertical;",
				},
			});
			logArea.value = this.plugin.debugLog.length > 0
				? this.plugin.debugLog.join("\n")
				: "(No log entries yet. Run a test or generate front matter to see output.)";

			const buttonRow = logContainer.createDiv({cls: "front-matter-generator-debug-buttons"});
			new ButtonComponent(buttonRow)
				.setButtonText("Refresh")
				.setIcon("refresh-cw")
				.onClick(() => {
					logArea.value = this.plugin.debugLog.length > 0
						? this.plugin.debugLog.join("\n")
						: "(No log entries yet.)";
				});
			new ButtonComponent(buttonRow)
				.setButtonText("Clear")
				.setIcon("trash")
				.onClick(() => {
					this.plugin.clearDebugLog();
					logArea.value = "(Log cleared.)";
				});
		}
	}

	private renderCustomProperties(containerEl: HTMLElement): void {
		const rules = normalizeCustomPropertyRows(this.plugin.settings.customProperties);
		this.plugin.settings.customProperties = rules;

		const wrapper = containerEl.createDiv({cls: "front-matter-generator-custom-properties"});
		if (rules.length === 0) {
			wrapper.createDiv({
				cls: "front-matter-generator-empty",
				text: "No custom properties configured.",
			});
		}

		rules.forEach((rule, index) => {
			const row = wrapper.createDiv({cls: "front-matter-generator-property-row"});
			const nameInput = row.createEl("input", {
				type: "text",
				placeholder: "property",
				cls: "front-matter-generator-property-name",
			});
			nameInput.value = rule.name;
			const instructionInput = row.createEl("input", {
				type: "text",
				placeholder: "generation instruction",
				cls: "front-matter-generator-property-instruction",
			});
			instructionInput.value = rule.instruction;

			const saveRow = async (): Promise<void> => {
				this.plugin.settings.customProperties[index] = {
					name: nameInput.value.trim(),
					instruction: instructionInput.value.trim(),
				};
				this.plugin.settings.customProperties = normalizeCustomPropertyRows(this.plugin.settings.customProperties);
				await this.plugin.saveSettings();
			};

			nameInput.addEventListener("change", () => {
				void saveRow();
			});
			instructionInput.addEventListener("change", () => {
				void saveRow();
			});

			new ButtonComponent(row)
				.setIcon("trash")
				.setTooltip("Remove property")
				.onClick(async () => {
					this.plugin.settings.customProperties.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				});
		});

		new Setting(containerEl)
			.setName("Add custom property")
			.setDesc("Custom properties are generated as frontmatter fields. title, tags, and description are reserved.")
			.addButton((button) => button
				.setButtonText("Add property")
				.setIcon("plus")
				.onClick(async () => {
					this.plugin.settings.customProperties.push({name: "", instruction: ""});
					await this.plugin.saveSettings();
					this.display();
				}));
	}
}
