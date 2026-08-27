/**
 * 修饰符：把 `` `icon:lucide-sun,1.5em,#e5a50a` `` 里逗号之后的那几段
 * 翻译成**颜色**与**尺寸**。
 *
 * 与 {@link parseTokenBody} 的分工：语法层只负责**切分**（逗号分段、trim、丢空段），
 * 本模块负责**解释语义**。这样切分规则从第一天就固定（老笔记永不整体解析失败），
 * 而能认哪些写法可以慢慢加。
 *
 * 三条设计约束：
 *
 * - **纯函数，不碰 DOM**：和 `grammar.ts` / `resolve.ts` 一样可单测；
 *   产出的是两个字符串（CSS 值），交给 `renderIcon.ts` 写成 CSS 变量。
 * - **认不出来就忽略，绝不让整个记号失败**。修饰符是装饰，图标才是内容：
 *   `` `icon:lucide-sun,ならい` `` 该照常显示图标，而不是退回原文。
 * - **分隔符是逗号，不是 `|`**：行内代码在 Markdown 表格里仍会被 `|` 截断，
 *   写在表格里就得转义成 `\|`（见 `dev/ecosystem/生态语法占用调研.md`）。
 *   代价是**含逗号的图标 id 引用不了**，由 `canReference()` 把它们从补全候选里剔掉。
 *
 * ```md
 * `icon:lucide-sun,1.5em`              尺寸
 * `icon:lucide-sun,#e5a50a`            颜色
 * `icon:lucide-sun,1.5em,#e5a50a`      两者，顺序随意
 * `icon:lucide-sun,--text-accent`      主题变量（自动包成 var()），随主题与深浅色变
 * `icon:lucide-sun,red`                CSS 颜色名
 * ```
 */

/** 解释过的修饰符。两个字段都可能是 `null`，表示「用 CSS 里的默认值」。 */
export interface IconStyle {
	/** CSS 颜色值，直接写进 `--ii-icon-color`。 */
	color: string | null;
	/** CSS 长度值，直接写进 `--ii-icon-size`。 */
	size: string | null;
}

/** 什么都没写。**共享的常量**，免得渲染热路径上每个记号都新建一个对象。 */
export const EMPTY_ICON_STYLE: IconStyle = { color: null, size: null };

/**
 * 尺寸：`1.5em` / `20px`。**单位必须写出来。**
 *
 * 单位白名单里全是**相对或绝对长度**，故意**不含 `%`**：百分比是相对包含块的宽度，
 * 而图标的包含块就是它自己那个 inline-flex 盒子，写了等于没写（还会让高宽不等比）。
 *
 * 数字限 3 位整数 + 2 位小数：`999em` 已经荒谬到不必再往上支持，
 * 顺带挡住 `1e999` 这类病态输入。
 *
 * **曾经允许裸数字按 em 处理（`icon:sun,2` = 两倍字号），已去掉**，
 * 因为它与「逗号写法的颜色函数」相撞：用户写 `` `icon:sun,rgb(1,2,3)` `` 时，
 * 语法层把它切成 `rgb(1` / `2` / `3)` 三段，中间那个 `2` 会被当成尺寸——
 * 于是一个**写错的颜色静默把图标放大到两倍**，而用户完全看不出为什么。
 * 要求写单位就没有这个歧义（`2em` 不会从任何颜色函数里被切出来），
 * 代价只是两个字符。
 */
const SIZE_PATTERN = /^\d{1,3}(?:\.\d{1,2})?(?:em|rem|px|pt|ch|ex)$/;

/** 十六进制颜色：`#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`。 */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * CSS 自定义属性名：`--text-accent`。
 *
 * 写成 `--x` 是简写，会被包成 `var(--x)`；用户直接写 `var(--x)` 也认（见下）。
 * 这条是**给主题用户的主路径**：`--text-accent` 这类变量在深浅色主题下自动换值，
 * 比写死 `#e5a50a` 好得多。
 */
const CSS_VAR_NAME_PATTERN = /^--[A-Za-z0-9_-]{1,64}$/;

/**
 * `var(--x)` 与 `var(--x, red)` 的完整写法。
 *
 * **fallback 里不能有逗号**——那个逗号早在语法层就把这段切开了，
 * 所以 `var(--x, red)` 认，`var(--x, rgb(1,2,3))` 不认。同理
 * `rgb()` / `hsl()` 的逗号写法一律引用不了，用空格写法（`rgb(1 2 3)`）或十六进制。
 */
const CSS_VAR_CALL_PATTERN = /^var\(\s*--[A-Za-z0-9_-]{1,64}\s*(?:,[^;{}()]{0,64})?\)$/;

/**
 * CSS 颜色关键字（`red` / `rebeccapurple` / `currentColor` / `transparent`）。
 *
 * **不校验是不是真的颜色名**：全套 148 个 CSS 命名颜色打进产物不值得，
 * 而认错的代价极小——浏览器会直接丢掉无效的 CSS 值，图标于是沿用继承色，
 * 与「没写修饰符」的表现一致。
 */
const COLOR_KEYWORD_PATTERN = /^[A-Za-z]{3,32}$/;

/**
 * 空格分隔的现代颜色函数：`rgb(255 0 0)` / `oklch(0.7 0.1 60)` / `hsl(30 100% 50%)`。
 *
 * 逗号写法在语法层就被切开了，所以只支持空格写法——这不算限制，
 * 空格写法是 CSS Color 4 的推荐形态，各家浏览器早已支持。
 */
const COLOR_FUNCTION_PATTERN =
	/^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\([^;{}]{1,64}\)$/;

/** 这一段是不是尺寸；是则返回归一化后的 CSS 长度。 */
function asSize(modifier: string): string | null {
	return SIZE_PATTERN.test(modifier) ? modifier : null;
}

/** 这一段是不是颜色；是则返回可直接用的 CSS 颜色值。 */
function asColor(modifier: string): string | null {
	if (HEX_COLOR_PATTERN.test(modifier)) return modifier;
	// `--text-accent` 是简写，补成 var()；用户写全了也照用
	if (CSS_VAR_NAME_PATTERN.test(modifier)) return `var(${modifier})`;
	if (CSS_VAR_CALL_PATTERN.test(modifier)) return modifier;
	if (COLOR_FUNCTION_PATTERN.test(modifier)) return modifier;
	if (COLOR_KEYWORD_PATTERN.test(modifier)) return modifier;
	return null;
}

/**
 * 解释一串修饰符。
 *
 * **顺序随意**（`1.5em,red` 与 `red,1.5em` 等价）：每段各自判定是尺寸还是颜色，
 * 不靠位置。判定顺序是「先尺寸再颜色」，两个模式不重叠，所以互不抢占。
 *
 * **同类写了多次则后者胜出**，与 CSS 声明的层叠直觉一致：在已有记号后面追加一段
 * 就能覆盖前面的，不必先把旧的删掉。
 *
 * 认不出的段**静默忽略**——修饰符是装饰，不该让图标本身消失。
 */
export function parseModifiers(modifiers: readonly string[]): IconStyle {
	if (modifiers.length === 0) return EMPTY_ICON_STYLE;

	let color: string | null = null;
	let size: string | null = null;

	for (const modifier of modifiers) {
		const asSizeValue = asSize(modifier);
		if (asSizeValue !== null) {
			size = asSizeValue;
			continue;
		}

		const asColorValue = asColor(modifier);
		if (asColorValue !== null) color = asColorValue;
	}

	return { color, size };
}
