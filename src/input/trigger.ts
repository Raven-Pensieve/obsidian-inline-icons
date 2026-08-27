import { escapeRegExp, parseTokenBody } from "@src/syntax/grammar";

/**
 * 补全的触发判定——**纯函数，不碰 DOM、不 import obsidian**，所以可单测。
 *
 * 这是整个补全里最容易写错的一块（边界、反引号、来源段、全角冒号），
 * 所以从 `IconSuggest` 里拆出来，让它能被测试钉住。
 */

/** 一次命中：列区间 `[start, end)` 会被整段替换成规范形态。 */
export interface TriggerMatch {
	/** 起始列（含），已把紧邻的开反引号吃进来。 */
	start: number;
	/** 结束列（不含），已把紧邻的闭反引号吃进来。 */
	end: number;
	/** 来源段（`ci` / `lucide` / 包 id），没写就是 `null`。已小写化。 */
	source: string | null;
	/** 供过滤候选用的名字片段，可能是空串（仅当写了来源段时）。 */
	query: string;
}

export interface TriggerOptions {
	/** 正式前缀词（会写进文件）。 */
	prefix: string;
	/** 输入别名，只存在于补全里。 */
	alias: string;
}

const SEGMENT = "[A-Za-z0-9_-]{1,64}";

/**
 * 判定光标处是否该弹补全。
 *
 * 两种情形，按优先级：
 *
 * 1. **光标落在一个已存在的记号里**（`` `icon:m|di:home` ``）——替换范围覆盖整对反引号，
 *    于是换图标不用重打，也不会改一半留下残渣；
 * 2. **正在敲一个新记号**（`i:su` / `icon:ci:` / `icon:mdi:ho`）——
 *    写了来源段时允许后面还没有字符，没写来源段则至少要一个字符
 *    （否则光秃秃一个 `icon:` 会一次列出上千个图标）。
 */
export function matchTrigger(
	line: string,
	cursorCh: number,
	options: TriggerOptions,
): TriggerMatch | null {
	const before = line.slice(0, cursorCh);
	// obsidian 的 jsdoc 明确写了 onTrigger「每次按键都会触发」，
	// 所以先做一次廉价的字符检查，再上正则
	if (!/[A-Za-z0-9_:：-]$/.test(before)) return null;

	return (
		matchInsideSpan(line, cursorCh, options) ??
		matchWhileTyping(line, cursorCh, before, options)
	);
}

function matchInsideSpan(
	line: string,
	cursorCh: number,
	options: TriggerOptions,
): TriggerMatch | null {
	const open = line.lastIndexOf("`", cursorCh - 1);
	if (open < 0) return null;

	const close = line.indexOf("`", cursorCh);
	if (close < 0) return null;

	const body = line.slice(open + 1, close);
	// 记号体既认正式前缀，也认输入别名（用户可能把别名敲进了反引号里）
	const token =
		parseTokenBody(body, { prefix: options.prefix }) ??
		parseTokenBody(body, { prefix: options.alias });
	if (token === null) return null;

	return {
		start: open,
		end: close + 1,
		source: token.source,
		query: token.name,
	};
}

function matchWhileTyping(
	line: string,
	cursorCh: number,
	before: string,
	options: TriggerOptions,
): TriggerMatch | null {
	const words = triggerWords(options);
	if (words.length === 0) return null;

	const pattern = new RegExp(
		`(?:^|[^A-Za-z0-9_-])((?:${words.join("|")})[:：](?:(${SEGMENT})[:：])?(${SEGMENT})?)$`,
		"i",
	);
	const match = pattern.exec(before);
	if (match === null) return null;

	const source = match[2] === undefined ? null : match[2].toLowerCase();
	const query = match[3] ?? "";
	if (source === null && query === "") return null;

	let start = before.length - match[1].length;
	let end = cursorCh;
	// 用户自己敲了反引号，或 Obsidian 自动配对出了一对：一并纳入替换范围，
	// 于是「自动配对反引号」开或关，结果都一致
	if (line[start - 1] === "`") start -= 1;
	if (line[end] === "`") end += 1;

	return { start, end, source, query };
}

/** 可触发补全的词：正式前缀 + 输入别名；长的排前面，去重。 */
function triggerWords(options: TriggerOptions): string[] {
	const words = [options.prefix.trim(), options.alias.trim()].filter(
		(word) => word !== "",
	);
	return [...new Set(words)]
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp);
}
