# Front Matter Generator

Front Matter Generator adds an `Auto: front matter` action to Markdown files in the Obsidian file explorer. It uses an OpenAI-compatible provider to generate frontmatter descriptions, tags, optional filename candidates, and custom properties from note content.

## Features

- Generate or overwrite `description`.
- Generate `tags` with existing vault tags as context.
- Optionally generate filename candidates and rename after confirmation.
- Add custom frontmatter properties with per-property instructions.
- Choose how much note content is sent: full text, first N lines, or headings only.
- Use Chat Completions or Responses API style endpoints.

## Usage

1. Install and enable the plugin.
2. Open plugin settings and configure your AI provider.
3. Right-click a Markdown file in the file explorer.
4. Choose `Auto: front matter`.
5. Review the generated frontmatter preview and click `Apply`.

File name generation is disabled by default. When enabled, the confirmation modal shows three filename candidates and a custom filename input before applying changes.

## Settings

- `AI provider`: API base URL, API key, model, API type, and test button.
- `Content`: controls the amount of Markdown sent to the provider.
- `Description`: enable description generation and choose the output language.
- `File name`: enable optional filename generation and choose naming style.
- `Tags`: enable tag generation, choose tag policy, write mode, and context size.
- `Custom properties`: add frontmatter property rows with a property name and instruction.
- `Safety`: exclude folders or regex-matched paths.

Excluded path rules support plain folder prefixes, JavaScript-style regular expressions, and `regex:` rules.

## Privacy And Network Use

This plugin sends selected note content, vault-relative path context, current frontmatter context, and existing tag context to the configured AI provider when you run `Auto: front matter`. API keys are stored locally in this plugin's Obsidian data file and are not committed to the repository.

Use `First N lines` or `Headings only` content mode to reduce token usage and limit shared content.

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

## Development

```bash
npm install
npm test
npm run build
```

Release assets are built locally. `main.js` is intentionally ignored by Git and uploaded only as a GitHub release asset.
