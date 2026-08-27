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

	const [head, ...rest] = text.slice(prefix.length + 1).split(",");
	const modifiers = rest
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
