import type { BaseTranslation } from '../i18n-types'

const en = {
	common: {
		add: "Add",
		delete: "Delete",
		reset: "Reset",
		save: "Save",
		cancel: "Cancel",
		confirm: "Confirm",
		moveUp: "Move up",
		moveDown: "Move down",
	},
	settings: {
		syntax: {
			name: "Syntax",
			desc: "What a token looks like, and whether the bare form renders",
			prefix: {
				name: "Prefix",
				desc: "A token looks like `<prefix>:sun`. Changing this breaks the tokens already written in your notes — be careful",
				invalid: "Letters, digits, underscores and hyphens only, 1-16 characters",
			},
			renderBareToken: {
				name: "Render the bare form",
				desc: "Also render icon:sun written without backticks. It competes with your prose for tokens (icon:sunny is read as the name \"sunny\"), so it is off by default",
			},
		},
		render: {
			name: "Rendering",
			desc: "One switch per rendering pipeline",
			readingMode: {
				name: "Reading view",
				desc: "Render tokens in reading view, embeds and hover previews",
			},
			livePreview: {
				name: "Live Preview",
				desc: "Render tokens in Live Preview; moving the cursor onto a token reveals the original text. Source mode always shows the text",
			},
		},
		suggest: {
			name: "Suggester",
			desc: "Two ways to type a token — the backticks are always written by the plugin",
			enabled: {
				name: "Suggest while typing",
				desc: "Pop up icon candidates when you type the prefix or the input alias; Enter writes the whole token, backticks included",
			},
			alias: {
				name: "Input alias",
				desc: "Type \"alias + colon + a few letters\" to get candidates. The alias only exists in the suggester and is never written to the file",
				invalid: "Letters, digits, underscores and hyphens only, 1-8 characters",
			},
			maxResults: {
				name: "Maximum candidates",
				desc: "With icon packs installed there can be tens of thousands of icons, so the list has to be truncated",
			},
		},
		reset: {
			name: "Reset all settings",
			desc: "Restore all settings to their defaults",
			button: "Reset",
		},
	},
	ui: {
		unresolved: "No icon named \"{name}\"",
		sourceBuiltin: "Built-in",
		sourceCustomIcons: "Custom Icons",
	},
	commands: {
		insertIcon: {
			name: "Insert icon",
			placeholder: "Search icons…",
		},
		reapply: {
			name: "Re-render icons in this note",
		},
	},
} satisfies BaseTranslation;

export default en;
