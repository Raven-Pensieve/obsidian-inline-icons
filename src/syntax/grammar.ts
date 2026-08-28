/**
 * 记号语法：文本与 {@link IconToken} 之间的双向转换。
 *
 * ```
 * token    = "`" prefix ":" [ source ":" ] icon-id [ "," modifier ]* "`"
 * prefix   = "icon"                      // 可在设置里改
 * source   = "lucide" | "ci" | pack-id   // 仅输入期可选，不落盘
 * icon-id  = [^`:,\r\n]{1,96}            // 注册表里的完整 id，可含中文
 * modifier = 颜色 | 尺寸                  // 本模块只切分，语义见 modifiers.ts
 * ```
 *
 * 纯函数模块，不依赖 DOM 与 obsidian。「什么算合法记号」只由本模块裁定，
 * 两条渲染管线与补全都必须经由此处，不得各自实现一套正则。
 */

/** 默认前缀词。 */
export const DEFAULT_PREFIX = "icon";

/** 保留来源段：用户导入的单个 SVG。 */
export const SOURCE_CI = "ci";

/** 保留来源段：Lucide（内置优先、图标包兜底）。 */
export const SOURCE_LUCIDE = "lucide";

/**
 * 图标 id 段允许的字符：除反引号、两种冒号、逗号与换行之外均可。
 *
 * 边界由行内代码的那对反引号给出，因此可以宽松；而必须宽松，是因为用户 SVG 的
 * id 取自文件名，可能含中文、空格、点与括号。被排除的字符各有结构含义：
 * 反引号是记号边界，冒号分隔来源段，逗号分隔修饰符。
 *
 * 全角冒号 `：` 与半角一同排除，这一条只为 {@link canReference} 服务：
 * {@link parseTokenBody} 会先把 `：` 折成 `:`，于是 `CI-a：b` 一旦被判为可引用，
 * 写出的记号回读后会解析成「来源段 ci-a + 名字 b」，静默指向另一个图标。
 */
const NAME_PATTERN = /^[^`:：,\r\n]{1,96}$/u;

/** 来源段：图标包 id 被 Custom Icons 限定为小写字母/数字/连字符。 */
const SOURCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** 记号总长度上限，避免长串文本反复过正则。 */
const MAX_BODY_LENGTH = 200;

/** 括号深度上限；`color-mix(in oklch, var(--a), rgb(1 2 3))` 才 3 层。 */
const MAX_PAREN_DEPTH = 8;

/**
 * 按括号外的逗号切分修饰符区，使 `rgb(255, 0, 0)` 这类逗号写法可用。
 *
 * 括号不配平、或嵌套超过 {@link MAX_PAREN_DEPTH} 时，余下部分整段交出，
 * 结果收敛到修饰符层既有的「认不出则忽略」语义。
 *
 * 只切修饰符区：图标 id 段可能含不配平的括号（`CI-a(` 是合法文件名），
 * 若一并参与括号计数就会把后续修饰符吃进 id，而 id 段不允许逗号
 * （{@link NAME_PATTERN}），整条记号将解析失败。见 {@link parseTokenBody}。
 */
export function splitTopLevel(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];

		if (char === "(") {
			if (depth >= MAX_PAREN_DEPTH) break;
			depth += 1;
			continue;
		}
		// 多余的右括号不让深度变负，否则后续顶层逗号会被永久吞掉
		if (char === ")") {
			if (depth > 0) depth -= 1;
			continue;
		}
		if (char === "," && depth === 0) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}

	// 收尾这一段同时兜住括号不配平的情形
	parts.push(text.slice(start));
	return parts;
}

/** 解析出来的一个记号。 */
export interface IconToken {
	/** 来源段，已小写化；省略时为 `null`，交给解析链逐层尝试。 */
	source: string | null;
	/**
	 * 图标 id。落盘形态里是注册表中的完整 id（`lucide-sun` / `CI-我的图标`）；
	 * 写了来源段时是相对该来源的名字。大小写与中文原样保留。
	 */
	name: string;
	/** 修饰符原文，语义由 `modifiers.ts` 解释。 */
	modifiers: string[];
}

/** 语法选项，全部来自插件设置。 */
export interface GrammarOptions {
	/** 前缀词，默认 {@link DEFAULT_PREFIX}；空白值回退到默认。 */
	prefix?: string;
}

/** 转义字符串中的正则元字符（前缀词与输入别名来自用户设置）。 */
export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 前缀词归一：去空白、空值回退默认。不改大小写，比较时才忽略大小写。 */
export function normalizePrefix(prefix: string | undefined): string {
	const trimmed = (prefix ?? "").trim();
	return trimmed === "" ? DEFAULT_PREFIX : trimmed;
}

/**
 * 解析一段行内代码的内容（不含那对反引号）。
 *
 * 两条容错：中文输入法的全角冒号 `：` 折成半角；每段两侧的空白一律 trim。
 *
 * @param body 阅读模式取 `<code>` 的 textContent，实时预览取 `inline-code`
 *   节点覆盖的文本。
 * @returns 不是记号时返回 `null`，调用方据此保留原文。
 */
export function parseTokenBody(
	body: string,
	options: GrammarOptions = {},
): IconToken | null {
	if (body.length > MAX_BODY_LENGTH) return null;

	const text = body.replace(/：/g, ":").trim();
	const prefix = normalizePrefix(options.prefix);

	if (text.length <= prefix.length) return null;
	if (text.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) {
		return null;
	}
	if (text[prefix.length] !== ":") return null;

	const rest = text.slice(prefix.length + 1);
	// 第一个逗号定死 id 段的终点，不看括号；括号感知只用于其后的修饰符区。
	// 理由见 splitTopLevel：id 可能含不配平的括号
	const firstComma = rest.indexOf(",");
	const head = firstComma < 0 ? rest : rest.slice(0, firstComma);
	const modifiers =
		firstComma < 0
			? []
			: splitTopLevel(rest.slice(firstComma + 1))
					.map((modifier) => modifier.trim())
					.filter((modifier) => modifier !== "");

	const segments = head.split(":").map((segment) => segment.trim());
	// 最多两段 <source>:<name>；三段以上说明写错了，不猜
	if (segments.length > 2) return null;

	const name = segments[segments.length - 1];
	const source = segments.length === 2 ? segments[0].toLowerCase() : null;

	if (!NAME_PATTERN.test(name)) return null;
	if (source !== null && !SOURCE_PATTERN.test(source)) return null;

	return { source, name, modifiers };
}

/**
 * 判断一个图标 id 能否被记号引用，即写进记号后是否还能解析回同一个 id。
 *
 * 含冒号 / 逗号 / 反引号 / 换行的 id 不行（那几个字符有结构含义），
 * 补全的候选池要据此剔除，以免插入解析不回来的记号。
 */
export function canReference(iconId: string): boolean {
	return iconId === iconId.trim() && NAME_PATTERN.test(iconId);
}

/** 拼出记号内容（不含反引号），用于比较与二次拼接。 */
export function formatTokenBody(
	token: IconToken,
	options: GrammarOptions = {},
): string {
	const prefix = normalizePrefix(options.prefix);
	const head = token.source === null ? token.name : `${token.source}:${token.name}`;
	return [`${prefix}:${head}`, ...token.modifiers].join(",");
}

/**
 * 拼出完整的落盘形态，含那一对反引号。
 *
 * 补全与插入命令必须用本函数写入：反引号由插件补齐，不依赖 Obsidian 的
 * 「自动配对反引号」设置。
 */
export function formatCodeSpan(
	token: IconToken,
	options: GrammarOptions = {},
): string {
	return `\`${formatTokenBody(token, options)}\``;
}
