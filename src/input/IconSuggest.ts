import type InlineIconsPlugin from "@src/main";
import { escapeRegExp, parseTokenBody, type IconToken } from "@src/syntax/grammar";
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

/**
 * 输入时的图标补全（P2 的主路径）。
 *
 * 核心一招：**「召唤补全的触发序列」与「落到文件里的记号」不是同一个东西**。
 * 用户敲 `i:su`，插件写进去的是 `` `icon:sun` ``——**反引号由插件补**，
 * 因此不依赖、也不受「自动配对反引号」这个设置影响。
 */
export class IconSuggest extends EditorSuggest<IconCandidate> {
	readonly #plugin: InlineIconsPlugin;

	constructor(plugin: InlineIconsPlugin) {
		super(plugin.app);
		this.#plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!this.#plugin.settings.suggest.enabled) return null;

		const line = editor.getLine(cursor.line);
		const before = line.slice(0, cursor.ch);
		// obsidian 的 jsdoc 明确写了 onTrigger「每次按键都会触发」，
		// 所以先做一次廉价的字符检查，再上正则
		if (!/[A-Za-z0-9_:：-]$/.test(before)) return null;

		return (
			this.#triggerInsideSpan(cursor, line) ??
			this.#triggerWhileTyping(cursor, line, before)
		);
	}

	getSuggestions(context: EditorSuggestContext): IconCandidate[] {
		const { maxResults, recent } = this.#plugin.settings.suggest;
		return filterCandidates(
			this.#plugin.resolver.catalog(),
			context.query,
			recent,
			maxResults,
		);
	}

	renderSuggestion(value: IconCandidate, el: HTMLElement): void {
		renderIconSuggestion(value, el);
	}

	/** 整段替换 `[start, end)`，写入**含那对反引号**的规范形态。 */
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

	/**
	 * 光标落在一个**已存在**的记号里：换图标不用重打（0 键路径）。
	 *
	 * 替换范围覆盖整对反引号，所以写回去的仍是完整形态，不会出现 `` ``icon:sun` `` 这种残留。
	 */
	#triggerInsideSpan(
		cursor: EditorPosition,
		line: string,
	): EditorSuggestTriggerInfo | null {
		const open = line.lastIndexOf("`", cursor.ch - 1);
		if (open < 0) return null;

		const close = line.indexOf("`", cursor.ch);
		if (close < 0) return null;

		const body = line.slice(open + 1, close);
		const token = this.#parse(body);
		if (token === null) return null;

		return {
			start: { line: cursor.line, ch: open },
			end: { line: cursor.line, ch: close + 1 },
			query: token.name,
		};
	}

	/**
	 * 正在敲一个新记号：`i:su` / `icon:su`，至少要有一个字符才弹窗。
	 *
	 * 若用户自己敲了反引号（或 Obsidian 自动配对出了一对），把它们一并纳入替换范围，
	 * 于是两种设置下的结果一致。
	 */
	#triggerWhileTyping(
		cursor: EditorPosition,
		line: string,
		before: string,
	): EditorSuggestTriggerInfo | null {
		const words = this.#triggerWords();
		if (words.length === 0) return null;

		const pattern = new RegExp(
			`(?:^|[^A-Za-z0-9_-])((?:${words.map(escapeRegExp).join("|")})[:：]([A-Za-z0-9_-]{1,64}))$`,
			"i",
		);
		const match = pattern.exec(before);
		if (match === null) return null;

		let start = before.length - match[1].length;
		let end = cursor.ch;
		if (line[start - 1] === "`") start -= 1;
		if (line[end] === "`") end += 1;

		return {
			start: { line: cursor.line, ch: start },
			end: { line: cursor.line, ch: end },
			query: match[2],
		};
	}

	/** 可触发补全的词：正式前缀 + 只存在于补全里的输入别名。 */
	#triggerWords(): string[] {
		const { syntax, suggest } = this.#plugin.settings;
		const words = [syntax.prefix.trim(), suggest.alias.trim()].filter(
			(word) => word !== "",
		);
		return [...new Set(words)];
	}

	/** 记号体既认正式前缀，也认输入别名（用户可能把别名敲进了反引号里）。 */
	#parse(body: string): IconToken | null {
		const { syntax, suggest } = this.#plugin.settings;
		return (
			parseTokenBody(body, { prefix: syntax.prefix }) ??
			parseTokenBody(body, { prefix: suggest.alias })
		);
	}
}
