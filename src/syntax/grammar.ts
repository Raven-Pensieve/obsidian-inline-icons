/**
 * 记号语法：把文本解析成 {@link IconToken}，以及把 IconToken 写回文本。
 *
 * 这是全项目**唯一不可回退**的一层——记号会写进用户文件，改语法等于毁用户笔记。
 * 因此本模块：
 *
 * - **不依赖 DOM、不依赖 obsidian**，是纯函数，单测覆盖率应当全项目最高；
 * - 是「什么算合法记号」的**唯一裁判**，两条渲染管线与补全都必须走这里，
 *   不许各自再写一套正则。
 *
 * 落盘形态（详见 `dev/syntax-spec.md`）：
 *
 * ```
 * token      = "`" prefix ":" [ source ":" ] icon-id [ "," modifier ]* "`"
 * prefix     = "icon"                       (可在设置里改)
 * source     = "lucide" | "ci" | pack-id    (输入期可选；补全不会把它写进文件)
 * icon-id    = [^`:,\r\n]{1,96}             (Obsidian 注册表里那个完整 id，可含中文)
 * modifier   = 颜色 | 尺寸                   (M1 只解析并忽略)
 * ```
 *
 * ```
 * `icon:lucide-sun`                    → lucide-sun
 * `icon:CI-mdi-outlined-1k`            → CI-mdi-outlined-1k
 * `icon:CI-vscode-icons-default-file`  → CI-vscode-icons-default-file
 * `icon:CI-我的图标`                    → CI-我的图标（用户 SVG 的 id 取自文件名）
 * `icon:sun`                           → lucide-sun（手写简写也认，见 resolve.ts）
 * ```
 */

/** 默认前缀词。 */
export const DEFAULT_PREFIX = "icon";

/** 保留来源段：用户导入的单个 SVG。 */
export const SOURCE_CI = "ci";

/** 保留来源段：Lucide（内置优先、图标包兜底，见 resolve.ts）。 */
export const SOURCE_LUCIDE = "lucide";

/**
 * 图标 id 段允许的字符：**除反引号、冒号、逗号与换行之外都行**。
 *
 * 之所以可以这么宽松，是因为行内代码的那对反引号已经给出了边界（C1）。
 * 而必须这么宽松，是因为 Custom Icons 的用户 SVG id 直接取自**文件名**
 * （`AddSvg.tsx` 里 `file.name.replace(/\.svg$/i, "")`），因此可能含
 * **中文**、空格、点、括号。排除的三个字符各有结构含义：反引号是记号边界、
 * 冒号分隔来源段、逗号分隔修饰符——含逗号的 id 无法被记号引用，这是已知代价。
 */
const NAME_PATTERN = /^[^`:,\r\n]{1,96}$/u;

/** 来源段：图标包 id 被 Custom Icons 限定为小写字母/数字/连字符，不必放宽。 */
const SOURCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** 记号总长度上限：超过一律不当记号，避免长串文本反复过正则。 */
const MAX_BODY_LENGTH = 200;

/** 括号深度上限：`color-mix(in oklch, var(--a), rgb(1 2 3))` 才 3 层，8 层足够。 */
const MAX_PAREN_DEPTH = 8;

/**
 * 按**括号外的逗号**切分修饰符区。
 *
 * 这是「颜色函数的逗号写法用不了」那条老限制的唯一成因所在。`rgb(255, 0, 0)`
 * 曾被裸 `split(",")` 切成 `rgb(255` / `0` / `0)` 三段，没有一段是合法颜色；
 * 同样受害的有 `hsl(30, 100%, 50%)`、`color-mix(in oklch, red 50%, blue)`、
 * `light-dark(red, blue)`、`var(--x, red)`。
 *
 * **改切分不动语法承诺**：现有能被解释的修饰符里括号一律配平（`rgb(1 2 3)`、
 * `var(--x)`），配平的括号内本来就不含顶层逗号，所以老笔记的切分结果**逐字不变**。
 *
 * 三种病态输入都收敛到「当一段交出去」，于是结果仍是修饰符层的既有语义
 * ——**认不出 → 忽略并原样保留**，与旧行为等价：
 *
 * | 输入 | 切法 | 后果 |
 * | --- | --- | --- |
 * | `rgb(1,2` 少右括号 | 余下整段当一段 | 认不出，忽略 |
 * | `rgb(1,2))` 多右括号 | 深度归零后继续，那个 `)` 留在段里 | 同上 |
 * | 嵌套超 {@link MAX_PAREN_DEPTH} | 剩余整段当一段 | 同上，且不再往下数 |
 *
 * **只切修饰符区，不切图标 id 段**：用户 SVG 的 id 取自文件名，可能含括号
 * （`CI-logo (dark)`）甚至含**不配平**的括号（`CI-a(`）。若让 id 段也参与括号感知，
 * 那个孤立 `(` 会把后面的修饰符全吃进 id，而 id 段不允许逗号（{@link NAME_PATTERN}），
 * 于是整条记号解析失败——比「颜色认不出」严重得多。所以第一个逗号照旧裸切，
 * 见 {@link parseTokenBody}。
 */
export function splitTopLevel(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];

		if (char === "(") {
			// 深度爆表：不再解析，剩下的整段交出去（认不出 → 被忽略）
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

	// 收尾这一段同时兜住「括号没配平」——余下整段原样交出，不再找逗号
	parts.push(text.slice(start));
	return parts;
}

/** 解析出来的一个记号。 */
export interface IconToken {
	/**
	 * 来源段；省略时为 `null`，交给解析链逐层尝试。已小写化。
	 *
	 * **输入期的便利**：能解析、补全里用来收窄候选池，但补全写进文件的是**真实注册 id**。
	 */
	source: string | null;
	/**
	 * 图标 id。落盘形态里就是 Obsidian 注册表里那个**完整 id**
	 * （`lucide-sun` / `CI-mdi-outlined-1k` / `CI-我的图标`）；
	 * 写了来源段时是相对该来源的名字。大小写与中文原样保留。
	 */
	name: string;
	/** 修饰符，**M1 解析但忽略**——留着是为了老笔记将来不会整体解析失败。 */
	modifiers: string[];
}

/** 语法选项，全部来自插件设置。 */
export interface GrammarOptions {
	/** 前缀词，默认 {@link DEFAULT_PREFIX}。空白值一律回退到默认。 */
	prefix?: string;
}

/** 把字符串转成可安全嵌进正则的形态（前缀词与输入别名都来自用户设置）。 */
export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 前缀词归一：去空白、空值回退默认。**不改大小写**，比较时才忽略大小写。 */
export function normalizePrefix(prefix: string | undefined): string {
	const trimmed = (prefix ?? "").trim();
	return trimmed === "" ? DEFAULT_PREFIX : trimmed;
}

/**
 * 解析一段**行内代码的内容**（不含那对反引号）。
 *
 * 两条渲染管线拿到的都是这个形态：阅读模式是 `<code>` 的 textContent，
 * 实时预览是语法树里 `inline-code` 节点覆盖的文本。
 *
 * 两条容错：
 *
 * - 中文输入法下的**全角冒号 `：` 折成半角**（落盘只承认半角，但用户手打时
 *   不该因为没切键盘就看不到图标）；
 * - 每段两侧的空白都会 trim 掉，所以 `` `icon: sun` `` 也认。
 *
 * @returns 不是记号时返回 `null`（调用方据此保留原文）。
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
	/*
	 * **第一个逗号定死 id 段的终点，不看括号**；括号感知只用在它之后。
	 *
	 * 两段各用一套规则不是权宜：id 可能含**不配平**的括号（用户 SVG 的 id 取自文件名，
	 * `CI-a(` 是合法文件名），让 id 段也参与括号计数就会把后面的修饰符吃进 id，
	 * 而 id 段不允许逗号，于是整条记号解析失败——比切碎颜色更糟。
	 * 修饰符区反过来：那里的括号一定来自 CSS 函数，配平是常态。
	 */
	const firstComma = rest.indexOf(",");
	const head = firstComma < 0 ? rest : rest.slice(0, firstComma);
	const modifiers =
		firstComma < 0
			? []
			: splitTopLevel(rest.slice(firstComma + 1))
					.map((modifier) => modifier.trim())
					.filter((modifier) => modifier !== "");

	const segments = head.split(":").map((segment) => segment.trim());
	// 最多两段：<source>:<name>。三段以上说明用户写错了，不猜
	if (segments.length > 2) return null;

	const name = segments[segments.length - 1];
	const source = segments.length === 2 ? segments[0].toLowerCase() : null;

	if (!NAME_PATTERN.test(name)) return null;
	if (source !== null && !SOURCE_PATTERN.test(source)) return null;

	return { source, name, modifiers };
}

/**
 * 这个图标 id 能不能被记号引用。
 *
 * 含冒号 / 逗号 / 反引号 / 换行的 id 写不进记号（那几个字符有结构含义），
 * 补全的候选池要把它们过滤掉，免得插入一个解析不回来的记号。
 */
export function canReference(iconId: string): boolean {
	return iconId === iconId.trim() && NAME_PATTERN.test(iconId);
}

/** 记号内容（不含反引号），用于拼接与比较。 */
export function formatTokenBody(
	token: IconToken,
	options: GrammarOptions = {},
): string {
	const prefix = normalizePrefix(options.prefix);
	const head = token.source === null ? token.name : `${token.source}:${token.name}`;
	return [`${prefix}:${head}`, ...token.modifiers].join(",");
}

/**
 * 完整的落盘形态，**含那一对反引号**。
 *
 * 补全与插入命令必须用这个函数写入——反引号由插件补是 P2 的核心（用户不碰反引号），
 * 而且它不能依赖 Obsidian 的「自动配对反引号」设置。
 */
export function formatCodeSpan(
	token: IconToken,
	options: GrammarOptions = {},
): string {
	return `\`${formatTokenBody(token, options)}\``;
}
