# Front Matter Generator

Front Matter Generator adds a `Generate front matter` action to Markdown files in the Obsidian file explorer. It uses an OpenAI-compatible provider to generate frontmatter titles, descriptions, tags, optional filename candidates, and custom properties from note content.

## Features

- Generate or overwrite `title`.
- Generate or overwrite `description`.
- Generate `tags` with existing vault tags as context.
- Optionally generate filename candidates and rename after confirmation.
- Add custom frontmatter properties with per-property instructions.
- Set one global output language for generated filenames, titles, descriptions, new tags, and custom text values.
- Choose how much note content is sent: full text, first N lines, or headings only.
- Use Chat Completions or Responses API style endpoints.
- Exclude folders or regex-matched paths from generation.

## Usage

1. Install and enable the plugin.
2. Open plugin settings and configure your AI provider.
3. Right-click a Markdown file in the file explorer.
4. Choose `Generate front matter`.
5. Review the generated frontmatter preview and click `Apply`.

You can also run `Generate front matter for current file` from the command palette or bind it to a hotkey.

File name generation is disabled by default. When enabled, the confirmation modal shows three filename candidates and a custom filename input before applying changes.

## Settings

- `AI provider`: API base URL, API key, model, API type, and test button.
- `Generation`: global output language used by generated filenames, frontmatter fields, and custom text values.
- `Content`: controls the amount of Markdown sent to the provider.
- `File name`: enable optional filename generation and choose naming style.
- `Front matter`: enable title, description, and tag generation. Tag policy, tag write mode, and tag context size are shown only when relevant.
- `Custom properties`: add additional frontmatter property rows with a property name and instruction.
- `Safety`: exclude folders or regex-matched paths.

Excluded path rules support plain folder prefixes, JavaScript-style regular expressions, and `regex:` rules.

## Privacy And Network Use

This plugin sends data to the AI provider you configure only when you run `Generate front matter` or the command palette action. The request may include selected note content, vault-relative path context, current frontmatter context, configured custom property instructions, global output language, and existing vault tag context so the model can generate useful metadata.

API keys are stored locally in this plugin's Obsidian data file. They are not logged by the plugin and are not committed to the repository.

The plugin has no client-side telemetry, no ads, no self-update mechanism, and no network calls other than the AI provider endpoint you configure. It does not read files outside your Obsidian vault. Account or payment requirements depend on your chosen AI provider.

Use `First N lines` or `Headings only` content mode to reduce token usage and limit shared content. Use excluded paths to keep templates or private folders out of generation.

## Compatibility

Front Matter Generator is designed for Obsidian `0.15.0` and newer. It uses Obsidian APIs for reading notes, updating frontmatter, renaming files, settings, commands, file explorer menus, and network requests.

## Manual Installation

Download the latest release assets and place them in:

```text
<vault>/.obsidian/plugins/front-matter-generator/
```

Required files:

- `manifest.json`
- `main.js`
- `styles.css`

Then reload Obsidian and enable `Front Matter Generator` in Community Plugins.

## License

MIT. See `LICENSE`.
