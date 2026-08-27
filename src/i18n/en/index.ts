import type { BaseTranslation } from '../i18n-types'

const en = {
	settings: {
		syntax: {
			name: "Syntax",
			desc: "What a token looks like",
			prefix: {
				name: "Prefix",
				desc: "A token looks like `<prefix>:sun`. Changing this breaks the tokens already written in your notes — be careful",
				invalid: "Letters, digits, underscores and hyphens only, 1-16 characters",
			},
		},
		suggest: {
			name: "Suggester",
			desc: "Two ways to type a token — the backticks are always written by the plugin",
			enabled: {
				name: "Suggest while typing",
				desc: "Pop up icon candidates when you type the prefix or the input alias; Enter writes the whole token, backticks included. The \"Insert icon\" command still works when this is off",
			},
			alias: {
				name: "Input alias",
				desc: "Type \"alias + colon\" to get candidates. The alias only exists in the suggester and is never written to the file",
				invalid: "Letters, digits, underscores and hyphens only, 1-8 characters",
			},
		},
	},
	ui: {
		unresolved: "No icon named \"{name}\"",
		sourceBuiltin: "Built-in",
		sourceCustomIcons: "Custom Icons",
		sourceUserSvg: "My SVGs",
	},
	menu: {
		insertIcon: "Insert icon…",
		replaceIcon: "Change icon…",
		removeIcon: "Remove icon",
	},
	commands: {
		insertIcon: {
			name: "Insert icon",
			placeholder: "Search icons…",
		},
		pickIcon: {
			name: "Insert icon from the icon library",
			unavailable: "Custom Icons is not enabled — falling back to the built-in icon search",
			unreferenceable: "The id \"{id}\" contains a colon, comma or backtick, so it cannot be written into a token",
		},
		reapply: {
			name: "Re-render icons in this note",
		},
	},
} satisfies BaseTranslation;

export default en;
