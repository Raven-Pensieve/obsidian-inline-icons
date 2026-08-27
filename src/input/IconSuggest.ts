import type InlineIconsPlugin from "@src/main";
import type { IconCandidate } from "@src/syntax/resolve";
import {
	EditorSuggest,
	type Editor,
	type EditorPosition,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
	type TFile,
} from "obsidian";
import { filterCandidates } from "./ranking";
import { renderIconSuggestion } from "./suggestItem";
import { matchTrigger } from "./trigger";

/**
 * 输入时的图标补全（P2 的主路径）。
 *
 * 核心一招：**「召唤补全的触发序列」与「落到文件里的记号」不是同一个东西**。
 * 用户敲 `i:su`，插件写进去的是 `` `icon:sun` ``——**反引号由插件补**，
 * 因此不依赖、也不受「自动配对反引号」这个设置影响。
 *
 * 触发判定全在 {@link matchTrigger}（纯函数、有单测），这里只负责与 Obsidian 对接。
 */
export class IconSuggest extends EditorSuggest<IconCandidate> {
	readonly #plugin: InlineIconsPlugin;

	/**
	 * 本次触发命中的来源段（`ci` / `lucide` / 包 id），没写来源时为 `null`。
	 *
	 * `EditorSuggestContext` 只带得动一个 `query` 字符串，所以来源段记在这里，
	 * 供 {@link getSuggestions} 收窄候选池、{@link selectSuggestion} 保留用户写的形态。
	 * onTrigger → getSuggestions → selectSuggestion 是同一轮同步调用，不会串。
	 */
	#source: string | null = null;

	constructor(plugin: InlineIconsPlugin) {
		super(plugin.app);
		this.#plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		this.#source = null;
		if (!this.#plugin.settings.suggest.enabled) return null;

		const { syntax, suggest } = this.#plugin.settings;
		const match = matchTrigger(editor.getLine(cursor.line), cursor.ch, {
			prefix: syntax.prefix,
			alias: suggest.alias,
		});
		if (match === null) return null;

		this.#source = match.source;
		return {
			start: { line: cursor.line, ch: match.start },
			end: { line: cursor.line, ch: match.end },
			query: match.query,
		};
	}

	/**
	 * 候选池按来源段收窄：写了 `icon:ci:` 就只列用户 SVG，写了 `icon:mdi:` 就只列 mdi 包。
	 *
	 * 来源段已经把池子缩小了，所以此时**允许空 query**——用户敲完 `icon:ci:`
	 * 就该直接看到里面有什么，而不是被迫再猜一个字母。
	 */
	getSuggestions(context: EditorSuggestContext): IconCandidate[] {
		const { maxResults, recent } = this.#plugin.settings.suggest;
		return filterCandidates(
			this.#plugin.resolver.catalogFor(this.#source),
			context.query,
			recent,
			maxResults,
			{ allowEmptyQuery: this.#source !== null },
		);
	}

	renderSuggestion(value: IconCandidate, el: HTMLElement): void {
		renderIconSuggestion(value, el);
	}

	/**
	 * 整段替换 `[start, end)`，写入**含那对反引号的单段形态** `` `icon:<icon-id>` ``。
	 *
	 * 即使用户是在 `icon:ci:` / `icon:mdi:` 的列表里挑的，落盘也不带来源段——
	 * 来源段只是输入期收窄候选池的工具，见 `dev/syntax-spec.md`。
	 */
	selectSuggestion(value: IconCandidate): void {
		const context = this.context;
		if (context === null) return;

		const text = this.#plugin.resolver.tokenFor(
			value.id,
			this.#plugin.grammarOptions,
		);

		context.editor.replaceRange(text, context.start, context.end);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + text.length,
		});

		void this.#plugin.rememberIcon(value.id);
		this.close();
	}
}
