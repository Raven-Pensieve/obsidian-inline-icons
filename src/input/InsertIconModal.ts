import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import type { IconCandidate } from "@src/syntax/resolve";
import { FuzzySuggestModal, type Editor, type FuzzyMatch } from "obsidian";
import { applyIconPick, type IconEditTarget } from "./iconEdit";
import { renderIconSuggestion } from "./suggestItem";

/**
 * 命令 / 快捷键路径：模糊搜索全部可用图标并插入。
 *
 * 完全不用记语法，也是敲不出 `i:` 触发序列时的兜底入口。与 `EditorSuggest` 共用
 * {@link renderIconSuggestion}，两条路径的候选行长得一样。
 *
 * 同时承担「Custom Icons 不在场时的更换图标」：那时右键菜单的「更换图标…」退回
 * 这里，所以它必须能吃 {@link IconEditTarget}——只会 `replaceSelection` 的话，
 * 会在旧记号旁边并列插一个新的。
 */
export class InsertIconModal extends FuzzySuggestModal<IconCandidate> {
	readonly #plugin: InlineIconsPlugin;
	readonly #editor: Editor;
	readonly #target: IconEditTarget | null;

	/** @param target `null` = 插入；否则整段替换那个已存在的记号。 */
	constructor(
		plugin: InlineIconsPlugin,
		editor: Editor,
		target: IconEditTarget | null = null,
	) {
		super(plugin.app);
		this.#plugin = plugin;
		this.#editor = editor;
		this.#target = target;
		this.setPlaceholder(LL.commands.insertIcon.placeholder());
	}

	getItems(): IconCandidate[] {
		return [...this.#plugin.resolver.catalog()];
	}

	/**
	 * 搜索用的文本：短名与完整 id 拼在一起，于是两种形态都搜得到——敲 `sun` 命中
	 * `lucide-sun`，敲 `CI-mdi` 也命中 `CI-mdi-outlined-1k`。与 `EditorSuggest`
	 * 那条路径的匹配口径一致（见 `ranking.ts` 的 `matchScore`）。
	 *
	 * 这不是展示文本：候选行由 {@link renderIconSuggestion} 画，写进文件的是
	 * `item.id`。因此本函数不必顾及可读性，只管让搜索够宽；也因为展示不走它，
	 * `FuzzyMatch.matches` 的高亮下标用不上，不存在下标错位的问题。
	 */
	getItemText(item: IconCandidate): string {
		return item.id === item.label ? item.id : `${item.label} ${item.id}`;
	}

	renderSuggestion(match: FuzzyMatch<IconCandidate>, el: HTMLElement): void {
		renderIconSuggestion(this.#plugin, match.item, el);
	}

	/**
	 * 走唯一写盘口。颜色传 `undefined`：本模态框没有颜色控件，那正是契约里
	 * 「未改动」的语义——编辑态因此会原样保留用户已写的颜色与尺寸，只换图标。
	 */
	onChooseItem(item: IconCandidate): void {
		applyIconPick(
			this.#plugin,
			this.#editor,
			this.#target,
			item.id,
			undefined,
		);
	}
}
