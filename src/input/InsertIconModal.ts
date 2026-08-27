import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import type { IconCandidate } from "@src/syntax/resolve";
import { FuzzySuggestModal, type Editor, type FuzzyMatch } from "obsidian";
import { renderIconSuggestion } from "./suggestItem";

/**
 * 命令 / 快捷键路径：模糊搜索全部可用图标并插入（P2 的第二条路）。
 *
 * 完全不用记语法——这也是「敲不出 `i:` 触发序列」时的兜底入口。
 * 与 `EditorSuggest` 共用 {@link renderIconSuggestion}，两条路径的候选行长得一样。
 */
export class InsertIconModal extends FuzzySuggestModal<IconCandidate> {
	readonly #plugin: InlineIconsPlugin;
	readonly #editor: Editor;

	constructor(plugin: InlineIconsPlugin, editor: Editor) {
		super(plugin.app);
		this.#plugin = plugin;
		this.#editor = editor;
		this.setPlaceholder(LL.commands.insertIcon.placeholder());
	}

	getItems(): IconCandidate[] {
		return [...this.#plugin.resolver.catalog()];
	}

	getItemText(item: IconCandidate): string {
		return item.label;
	}

	renderSuggestion(match: FuzzyMatch<IconCandidate>, el: HTMLElement): void {
		renderIconSuggestion(match.item, el);
	}

	onChooseItem(item: IconCandidate): void {
		const text = this.#plugin.resolver.tokenFor(
			item.id,
			this.#plugin.grammarOptions,
		);
		this.#editor.replaceSelection(text);
		void this.#plugin.rememberIcon(item.id);
	}
}
