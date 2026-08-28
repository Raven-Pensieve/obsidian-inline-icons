/**
 * 补全的触发判定。
 *
 * 纯函数模块，不碰 DOM、不 import obsidian，因此可单测——边界、反引号、来源段与
 * 全角冒号是整个补全里最容易写错的地方，故从 `IconSuggest` 里拆出来。
 */
import { escapeRegExp } from "@src/syntax/grammar";
import { locateTokenAt } from "@src/syntax/locate";

/** 一次命中：列区间 `[start, end)` 会被整段替换成规范形态。 */
export interface TriggerMatch {
	/** 起始列（含），已把紧邻的开反引号吃进来。 */
	start: number;
	/** 结束列（不含），已把紧邻的闭反引号吃进来。 */
	end: number;
	/** 来源段（`ci` / `lucide` / 包 id），已小写化；没写则 `null`。 */
	source: string | null;
	/** 供过滤候选用的名字片段；写了来源段时可能是空串。 */
	query: string;
	/**
	 * 命中的已存在记号里那几段修饰符；正在敲新记号时是空数组。
	 *
	 * 必须带出来，因为「光标落在已有记号里」那一支的 `[start, end)` 覆盖整条记号、
	 * 包括修饰符区。补全接着整段替换，不带回去就等于用户换个图标、
	 * 已写的颜色与尺寸被静默删掉。
	 */
	modifiers: readonly string[];
}

export interface TriggerOptions {
	/** 正式前缀词，会写进文件。 */
	prefix: string;
	/** 输入别名，只存在于补全里。 */
	alias: string;
}

/** 来源段：图标包 id 被 Custom Icons 限定为小写字母/数字/连字符。 */
const SOURCE_SEGMENT = "[A-Za-z0-9_-]{1,64}";

/**
 * 正在敲的 id 片段。
 *
 * 要认中文（用户 SVG 的 id 取自文件名），也要认完整注册 id 里的点与连字符；
 * 但不认空格——补全每次按键都会跑，允许空格就会在句子里乱触发。含空格的 id
 * 只能走插入命令的模糊搜索。
 */
const QUERY_SEGMENT = "[\\p{L}\\p{N}_.-]{1,96}";

/**
 * 判定光标处是否该弹补全。
 *
 * 两种情形，按优先级：
 *
 * 1. 光标落在一个已存在的记号里（`` `icon:m|di:home` ``），替换范围覆盖整对反引号，
 *    于是换图标不用重打，也不会改一半留下残渣；
 * 2. 正在敲一个新记号（`icon:` / `i:` / `icon:ci:` / `icon:mdi:ho`），冒号一敲完就
 *    算命中，后面还没有字符也算，前缀与别名一视同仁。
 *
 * 空 query 不再要求「至少一个字符」：候选有 `MAX_RESULTS` 上限，而要求用户先猜一个
 * 字母等于要求他先知道图标叫什么，那正是补全该解决的问题。数量交给
 * `filterCandidates`，这里只管边界。
 *
 * 单字符别名（默认 `i`）光秃秃一个冒号也弹。代价是英文提纲的 `I: Introduction`
 * 会误弹一次，按 Esc 或接着打字即消，比「别名非得多敲一个字母才生效」更值。
 */
export function matchTrigger(
	line: string,
	cursorCh: number,
	options: TriggerOptions,
): TriggerMatch | null {
	const before = line.slice(0, cursorCh);
	// onTrigger 每次按键都会触发，所以先做一次廉价的字符检查再上正则
	// （`\p{L}` 让中文 id 也能触发）
	if (!/[\p{L}\p{N}_:：.-]$/u.test(before)) return null;

	return (
		matchInsideSpan(line, cursorCh, options) ??
		matchWhileTyping(line, cursorCh, before, options)
	);
}

/**
 * 情形 1：光标落在一个已存在的记号里。
 *
 * 配对逻辑走 {@link locateTokenAt} 而不在此另写一套，否则会出现「菜单能改但补全不认」。
 *
 * `includeEdges` 保持默认的 `false`：光标贴在记号外侧时不该弹出「替换整个记号」的
 * 候选，那时用户是在记号旁边打字，该走 {@link matchWhileTyping}。菜单那条路径才开。
 */
function matchInsideSpan(
	line: string,
	cursorCh: number,
	options: TriggerOptions,
): TriggerMatch | null {
	// 记号体既认正式前缀，也认输入别名（用户可能把别名敲进了反引号里）
	const located = locateTokenAt(line, cursorCh, [
		options.prefix,
		options.alias,
	]);
	if (located === null) return null;

	return {
		start: located.start,
		end: located.end,
		source: located.token.source,
		query: located.token.name,
		modifiers: located.token.modifiers,
	};
}

/** 情形 2：正在敲一个新记号。 */
function matchWhileTyping(
	line: string,
	cursorCh: number,
	before: string,
	options: TriggerOptions,
): TriggerMatch | null {
	const words = triggerWords(options);
	if (words.length === 0) return null;

	const pattern = new RegExp(
		`(?:^|[^\\p{L}\\p{N}_-])((?:${words.join("|")})[:：](?:(${SOURCE_SEGMENT})[:：])?(${QUERY_SEGMENT})?)$`,
		"iu",
	);
	const match = pattern.exec(before);
	if (match === null) return null;

	const source = match[2] === undefined ? null : match[2].toLowerCase();
	const query = match[3] ?? "";

	let start = before.length - match[1].length;
	let end = cursorCh;
	// 用户自己敲了反引号，或 Obsidian 自动配对出了一对：一并纳入替换范围，
	// 于是「自动配对反引号」开或关，结果都一致
	if (line[start - 1] === "`") start -= 1;
	if (line[end] === "`") end += 1;

	// 新记号还没有修饰符可保留：本支的区间也不含逗号，因为 QUERY_SEGMENT 不认逗号
	// ——真有修饰符时命中的是 matchInsideSpan
	return { start, end, source, query, modifiers: [] };
}

/** 可触发补全的词：正式前缀 + 输入别名，长的排前面，去重。 */
function triggerWords(options: TriggerOptions): string[] {
	const words = [options.prefix.trim(), options.alias.trim()].filter(
		(word) => word !== "",
	);
	return [...new Set(words)]
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp);
}
