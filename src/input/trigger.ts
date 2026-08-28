import { escapeRegExp } from "@src/syntax/grammar";
import { locateTokenAt } from "@src/syntax/locate";

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
	/**
	 * 命中的**已存在记号**里那几段修饰符；正在敲新记号时是空数组。
	 *
	 * 存在的理由只有一个：`[start, end)` 在「光标落在已有记号里」那一支**覆盖整条记号**，
	 * 包括修饰符。补全接着整段替换，若不把这些段带过去，用户写好的
	 * `` `icon:lucide-sun,1.5em,#e5a50a` `` 一改图标就只剩 `` `icon:lucide-moon` ``
	 * ——颜色与尺寸被静默吃掉，而用户只是想换个图标。
	 *
	 * 右键菜单那条路径本来就带着（`IconEditTarget.token.modifiers`），
	 * 补全这一支是四条输入路径里唯一漏掉的。
	 */
	modifiers: readonly string[];
}

export interface TriggerOptions {
	/** 正式前缀词（会写进文件）。 */
	prefix: string;
	/** 输入别名，只存在于补全里。 */
	alias: string;
}

/** 来源段：图标包 id 被 Custom Icons 限定为小写字母/数字/连字符。 */
const SOURCE_SEGMENT = "[A-Za-z0-9_-]{1,64}";

/**
 * 正在敲的 id 片段：**要认中文**（用户 SVG 的 id 取自文件名），也要认完整注册 id
 * 里的点与连字符。但**不认空格**——补全每次按键都会跑，允许空格就会在句子里乱触发。
 * 含空格的 id 只能走插入命令的模糊搜索。
 */
const QUERY_SEGMENT = "[\\p{L}\\p{N}_.-]{1,96}";

/**
 * 判定光标处是否该弹补全。
 *
 * 两种情形，按优先级：
 *
 * 1. **光标落在一个已存在的记号里**（`` `icon:m|di:home` ``）——替换范围覆盖整对反引号，
 *    于是换图标不用重打，也不会改一半留下残渣；
 * 2. **正在敲一个新记号**（`icon:` / `i:` / `icon:ci:` / `icon:mdi:ho`）——
 *    **冒号一敲完就算命中**，后面还没有字符也算，前缀和别名一视同仁。
 *
 * 早期版本要求「没写来源段时至少一个字符」，理由是空 query 会列出上千个图标。
 * 那个理由站不住：候选本来就有 `MAX_RESULTS` 上限，而「敲完 `icon:` 什么都不弹、
 * 必须再猜一个字母」反而要求用户先知道图标叫什么——正好是补全该解决的问题。
 * 数量上限交给 `filterCandidates`，这里只管边界。
 *
 * 单字符别名（默认 `i`）光秃秃一个冒号也照弹：代价是英文提纲的 `I: Introduction`
 * 会误弹一次，但按 Esc 或接着打字就消掉，比「别名非得多敲一个字母才生效」更值。
 */
export function matchTrigger(
	line: string,
	cursorCh: number,
	options: TriggerOptions,
): TriggerMatch | null {
	const before = line.slice(0, cursorCh);
	// obsidian 的 jsdoc 明确写了 onTrigger「每次按键都会触发」，
	// 所以先做一次廉价的字符检查，再上正则（\p{L} 让中文 id 也能触发）
	if (!/[\p{L}\p{N}_:：.-]$/u.test(before)) return null;

	return (
		matchInsideSpan(line, cursorCh, options) ??
		matchWhileTyping(line, cursorCh, before, options)
	);
}

/**
 * 光标落在一个已存在的记号里。
 *
 * 配对逻辑走 {@link locateTokenAt}，**不在这里自己找反引号**：右键菜单要的是同一个
 * 判定，两处各写一遍就会出现「菜单能改但补全不认」这类不一致。
 *
 * `includeEdges` 保持默认的 `false`：光标贴在记号外侧时不该弹出「替换整个记号」的
 * 候选——那时用户是在记号旁边打字，该走 {@link matchWhileTyping}。菜单那条路径才开。
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
		// 整段替换会覆盖修饰符区，所以必须把它带给调用方原样写回，见 {@link TriggerMatch.modifiers}
		modifiers: located.token.modifiers,
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

	// 正在敲一个新记号：还没有修饰符可保留（这一支的 `[start, end)` 也不含逗号，
	// 因为 QUERY_SEGMENT 不认逗号——真有修饰符时命中的是 matchInsideSpan 那一支）
	return { start, end, source, query, modifiers: [] };
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
