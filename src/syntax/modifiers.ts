/**
 * 修饰符：把 `` `icon:lucide-sun,1.5em,#e5a50a` `` 里逗号之后的那几段
 * 翻译成**颜色**与**尺寸**。
 *
 * 与 `grammar.ts` 的 `parseTokenBody` 的分工：语法层只负责**切分**（按括号外的逗号
 * 分段、trim、丢空段），本模块负责**解释语义**。这样切分规则从第一天就固定
 * （老笔记永不整体解析失败），而能认哪些写法可以慢慢加。
 *
 * 三条设计约束：
 *
 * - **纯函数，不碰 DOM**：和 `grammar.ts` / `resolve.ts` 一样可单测；
 *   产出的是两个字符串（CSS 值），交给 `renderIcon.ts` 写成 CSS 变量。
 * - **认不出来就忽略，绝不让整个记号失败**。修饰符是装饰，图标才是内容：
 *   `` `icon:lucide-sun,ならい` `` 该照常显示图标，而不是退回原文。
 * - **判据只有一处实现**（{@link interpretModifier}）。{@link parseModifiers} 与
 *   {@link classifyModifier} 都只是它的薄包装，于是菜单认的和渲染认的不可能不一致
 *   ——那会造成「菜单以为这段是颜色、于是替换掉，而渲染本来根本不认它」。
 *
 * ```md
 * `icon:lucide-sun,1.5em`                  尺寸
 * `icon:lucide-sun,#e5a50a`                颜色
 * `icon:lucide-sun,1.5em,#e5a50a`          两者，顺序随意
 * `icon:lucide-sun,rgb(255, 0, 0)`         逗号写法的颜色函数
 * `icon:lucide-sun,hsl(30, 100%, 50%)`     同上
 * `icon:lucide-sun,color-mix(in oklch, red 50%, blue)`
 * `icon:lucide-sun,light-dark(#eee, #222)` 深浅色主题各取一个色
 * `icon:lucide-sun,clamp(1em, 2vw, 2em)`   响应式尺寸
 * `icon:lucide-sun,--text-accent`          主题变量（自动包成 var()）
 * `icon:lucide-sun,--icon-l`               **尺寸**变量：名字说明它是尺寸
 * `icon:lucide-sun,size:--my-len`          显式类型：歧义的最终逃生口
 * ```
 *
 * ## 四层判定
 *
 * 完整推导见 `dev/modifier-values.md` §2.2。
 *
 * | 层 | 判据 |
 * | --- | --- |
 * | ① 显式类型前缀 | `size:` / `color:` 开头 |
 * | ② 无歧义的尺寸 | 带单位的长度、`calc` / `min` / `max` / `clamp` |
 * | ③ 无歧义的颜色 | `#hex`、颜色函数、颜色关键字 |
 * | ④ 变量消歧 | `--x` / `var(--x)` / `var(--x, fallback)` |
 *
 * ②③ 两层的模式**不重叠**，所以先后不影响结果。真正的歧义只有 CSS 变量：
 * 它没有类型，光看名字答不了，而**猜错的后果不对称**——把尺寸变量当颜色写进
 * `--ii-icon-color`，浏览器丢掉这个无效颜色，图标**毫无变化**（用户以为变量没生效）；
 * 反过来把颜色变量当尺寸，图标会塌成 0 或撑爆一行。所以第 ④ 层先问 fallback
 * 再问名字，两条都是启发式，都能被第 ① 层盖过去。
 *
 * ## 为什么白名单按函数名而不是按整段正则
 *
 * 颜色函数的合法内部形态太多（逗号 / 空格 / `/` 分隔 alpha、`in oklch` 这类关键字、
 * 嵌套 `var()`），逐个写正则必然漏。而**校验内部语法本来就不必**：浏览器会丢掉无效的
 * CSS 值，图标于是沿用继承色 / 默认尺寸，与「没写修饰符」的表现一致。
 * 真正要挡住的只有「逃出这一个值、多写一条声明」，那由 {@link isSafeValue} 负责。
 */
import { splitTopLevel } from "./grammar";

/** 解释过的修饰符。两个字段都可能是 `null`，表示「用 CSS 里的默认值」。 */
export interface IconStyle {
	/** CSS 颜色值，直接写进 `--ii-icon-color`。 */
	color: string | null;
	/** CSS 长度值，直接写进 `--ii-icon-size`。 */
	size: string | null;
}

/** 什么都没写。**共享的常量**，免得渲染热路径上每个记号都新建一个对象。 */
export const EMPTY_ICON_STYLE: IconStyle = { color: null, size: null };

/** 一段修饰符属于哪一类；`null` = 认不出（渲染时忽略，改写时**原样保留**）。 */
export type ModifierKind = "color" | "size" | null;

/** 解释一段修饰符的结果：属于哪一类，以及可直接写进 CSS 变量的值。 */
export interface ModifierValue {
	kind: "color" | "size";
	/** 归一化后的 CSS 值（裸 `--x` 已包成 `var(--x)`，类型前缀已剥掉）。 */
	value: string;
}

/** 单段修饰符的长度上限。记号总长已由语法层限到 200，这一条只是多一道防线。 */
const MAX_MODIFIER_LENGTH = 120;

/**
 * 显式类型前缀：`size:1.5em` / `color:--my-color`。
 *
 * **名字白名单永远补不全**（用户自己的 `--my-len` 谁也猜不到），而猜错的表现是
 * 「图标毫无变化」这种查不出原因的现象。这条前缀是一句说得清的逃生口：写出来就不再有歧义。
 *
 * 冒号在修饰符区是安全的——`parseTokenBody` 只对 head 段按冒号切分，
 * 修饰符区一个冒号都不看。
 */
const TYPE_PREFIX_PATTERN = /^(size|color)\s*:\s*/i;

/**
 * 长度字面量：`1.5em` / `20px` / `.5rem` / `3vw`。**单位必须写出来。**
 *
 * 单位表覆盖 CSS Values 4 的**全部**绝对与相对长度：字体相对（含 `r` 前缀的
 * root 版本）、视口相对（含 `sv` / `lv` / `dv` 三族动态视口）、容器查询（`cq*`）
 * 与绝对单位。多给几个单位不增加任何风险——认错也只是浏览器丢掉一个无效值。
 *
 * 故意**不含 `%`**：百分比是相对包含块的宽度，而图标的包含块就是它自己那个
 * inline-flex 盒子，写了等于没写（还会让高宽不等比）。想按字号缩放用 `em`。
 *
 * 整数限 3 位、小数限 2 位（也认省略整数位的 `.5em`）：`999px` 已经荒谬到不必再往上，
 * 顺带挡住 `1e999` 这类病态输入（`e` 不在单位表里，整段直接落空）。
 *
 * **裸数字仍然不算尺寸**（`icon:sun,2` 不是两倍字号）。原先的理由是它会被切碎的
 * `rgb(1,2,3)` 撞上——括号感知切分之后那条压力已经没了，但结论不变：
 * `2` 到底是 `2em` 还是 `2px` 没有自明答案，而写 `2em` 只多两个字符。
 */
const LENGTH_PATTERN = new RegExp(
	String.raw`^(?:\d{1,3}(?:\.\d{1,2})?|\.\d{1,2})` +
		// 字体相对
		String.raw`(?:em|rem|ex|rex|cap|rcap|ch|rch|ic|ric|lh|rlh` +
		// 视口相对（默认 / 小 / 大 / 动态四族）
		String.raw`|vw|vh|vi|vb|vmin|vmax` +
		String.raw`|svw|svh|svi|svb|svmin|svmax` +
		String.raw`|lvw|lvh|lvi|lvb|lvmin|lvmax` +
		String.raw`|dvw|dvh|dvi|dvb|dvmin|dvmax` +
		// 容器查询相对
		String.raw`|cqw|cqh|cqi|cqb|cqmin|cqmax` +
		// 绝对
		String.raw`|cm|mm|Q|in|pt|pc|px)$`,
	"i",
);

/** 十六进制颜色：`#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`。 */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * CSS 自定义属性名：`--text-accent`。
 *
 * 写成 `--x` 是简写，会被包成 `var(--x)`；用户直接写 `var(--x)` 也认。
 * 这条是**给主题用户的主路径**：`--text-accent` 这类变量在深浅色主题下自动换值，
 * 比写死 `#e5a50a` 好得多。
 */
const CSS_VAR_NAME_PATTERN = /^--[A-Za-z0-9_-]{1,64}$/;

/**
 * 名字看起来是**尺寸**的自定义属性，第 ④ 层的第二条规则。
 *
 * 覆盖 Obsidian 自己那几族（`--icon-s` / `--icon-xl` / `--font-ui-medium` /
 * `--size-4-2` / `--radius-m` / `--line-height-tight`）以及以 `-size` / `-width` /
 * `-height` 收尾的一切（`--nav-item-size`、`--checkbox-size`）。
 *
 * 只影响**歧义仲裁**：命中判尺寸，没命中判颜色（后者是既有行为，也是绝大多数——
 * `--text-accent` / `--color-red` / `--interactive-accent` 都是颜色）。
 * 判错时用户仍有出路：写 `size:--x` 或 `calc(var(--x))`。
 */
const SIZE_VAR_NAME_PATTERN = new RegExp(
	// 前缀族：`--icon-l` / `--font-ui-small` / `--size-4-2` / `--radius-m`
	String.raw`^--(?:icon|font|size|radius|line-height|spacing|indent|scrollbar)(?:-|$)` +
		// 后缀族：`--nav-item-size` / `--checkbox-size` / `--border-width` / `--width`
		String.raw`|^--(?:[A-Za-z0-9-]*-)?(?:size|width|height)$`,
	"i",
);

/**
 * CSS 颜色关键字（`red` / `rebeccapurple` / `currentColor` / `transparent`）。
 *
 * **不校验是不是真的颜色名**：全套 148 个 CSS 命名颜色打进产物不值得，
 * 而认错的代价极小——浏览器会直接丢掉无效的 CSS 值，图标于是沿用继承色，
 * 与「没写修饰符」的表现一致。
 */
const COLOR_KEYWORD_PATTERN = /^[A-Za-z]{3,32}$/;

/**
 * 只出现在**尺寸**里的函数。
 *
 * 四个数学函数（CSS Values 4，全平台可用）加上 `var`。`var` 同时在两张表里，
 * 所以「只用了 `var`」的段仍是歧义段，交给第 ④ 层；一旦混进 `calc`，
 * 答案就确定了——`calc(var(--x))` 因此是「名字判不准时」的确定逃生口。
 */
const SIZE_FUNCTIONS = new Set(["calc", "min", "max", "clamp", "var"]);

/**
 * 只出现在**颜色**里的函数。
 *
 * 全套 CSS Color 4/5 的常用形态：`rgb` / `rgba` / `hsl` / `hsla` / `hwb`、
 * CIE 系的 `lab` / `lch` / `oklab` / `oklch`、任意色空间的 `color()`、
 * 混色 `color-mix()`，以及 `light-dark()`——后者让一条记号在深浅色主题下给两个色，
 * 是主题变量之外的第二条「跟着主题变」的路。
 *
 * `color-mix` 与 `light-dark` 的实参里**必然有逗号**，所以它们能被书写的前提正是
 * 括号感知切分：在旧的裸 `split(",")` 下这两个函数根本写不出来。
 *
 * `light-dark()` 与 `calc()` 一样其实是**类型无关**的，理论上也能产出长度
 * （`light-dark(1em, 2em)`）。归到颜色是因为几乎所有用法都是颜色；
 * 要拿它当尺寸就写 `size:light-dark(1em,2em)`。
 */
const COLOR_FUNCTIONS = new Set([
	"rgb",
	"rgba",
	"hsl",
	"hsla",
	"hwb",
	"lab",
	"lch",
	"oklab",
	"oklch",
	"color",
	"color-mix",
	"light-dark",
	"var",
]);

/**
 * 安全闸：出现这些东西就不可能是我们要的值，整段丢掉。
 *
 * `;` 与 `}` 是**唯一**能让一个 CSS 值逃出去、多写一条声明的字符；`{` / `@` 挡住
 * 规则块与 at-rule；引号与反斜杠挡住字符串与转义（`\3b` 是 `;` 的转义写法）；
 * `!` 挡住 `!important`；`/*` 挡住注释拼接；`url(` 单独点名（函数名白名单本来
 * 也不含 `url`，写出来是为了让「不发网络请求」这条不依赖白名单的完整性）。
 *
 * **括号必须配平**，这一条正则表达不了，所以判定走 {@link callsIn}；
 * 这里先做一次廉价的字符检查，把绝大多数垃圾段挡在外面。
 *
 * 值最终是经 `setCssProps` 写成**自定义属性**的，浏览器本来就只把它当值解析，
 * 但这一层不依赖那个前提——白名单之外的东西**根本到不了 DOM**。
 *
 * 注意 `/` 单独出现是合法的（`rgb(255 0 0 / 50%)` 的 alpha 分隔符），只挡 `/*`。
 */
function isSafeValue(value: string): boolean {
	if (value.length === 0 || value.length > MAX_MODIFIER_LENGTH) return false;
	if (/[;{}@!"'\\]/.test(value)) return false;
	if (value.includes("/*")) return false;
	if (/\burl\s*\(/i.test(value)) return false;
	return true;
}

/**
 * 这段值里用到的**全部函数名**（已小写），顺带校验结构。
 *
 * @returns `null` 表示结构本身不合法，整段该被丢掉：括号没配平、右括号多出来、
 *   或者某个 `(` 前面没有函数名（`(1em)` / `a (b)`）。返回空数组表示这段里
 *   没有任何函数调用（`1.5em` / `red` / `#fff`）。
 *
 * 之所以要求**顶层**的每个 `(` 前面都得有函数名：裸括号组在 CSS 值里没有意义，
 * 而放过它就等于放过一整片没人验证过的形态。旧实现用整段正则
 * `\([^;{}]{1,64}\)` 判颜色函数，`rgb(1 2 3) url(x)` 能整段通过——
 * 现在这种拼接会在函数名白名单处被 `url` 挡掉，而**结构本身**由本函数把住。
 *
 * **函数实参内部的分组括号是例外，必须放行**：`calc((1em + 2px) * 2)` 里那对括号
 * 是 `calc()` 语法的一部分（要先算加法再乘），不是「没人验证过的形态」。
 * 一律要求前置标识符会把这类合法写法整段判掉，而修饰符认不出来是**静默忽略**的
 * ——用户只看到尺寸没生效，查不出原因。分组括号不引入任何新函数名，
 * 所以白名单该挡的仍然挡得住（`calc((url(x)))` 里的 `url` 照样会被收集并拒绝）。
 */
function callsIn(value: string): string[] | null {
	const names: string[] = [];
	let depth = 0;

	for (let i = 0; i < value.length; i += 1) {
		const char = value[i];

		if (char === "(") {
			// 往前吃掉标识符：函数名允许字母、数字与连字符（`color-mix`、`light-dark`）
			let start = i;
			while (start > 0 && /[A-Za-z0-9-]/.test(value[start - 1])) start -= 1;
			// 没有前置标识符：顶层不认（`(1em)` / `a (b)`），
			// 函数实参内部则是合法的分组括号（`calc((1em + 2px) * 2)`）
			if (start === i && depth === 0) return null;

			// 空括号一律不认（`var()` / `rgb()` / `calc(())`）：
			// 没有实参的函数、以及空的分组，都不可能是用户想写的值
			if (value.slice(i + 1).trim().startsWith(")")) return null;

			// 分组括号不是函数调用，不进名字表——否则会混进一个空字符串，
			// 让两张白名单的 every() 一律判否
			if (start !== i) names.push(value.slice(start, i).toLowerCase());
			depth += 1;
			continue;
		}

		if (char === ")") {
			depth -= 1;
			// 右括号多出来：这段不是合法值，不猜
			if (depth < 0) return null;
		}
	}

	return depth === 0 ? names : null;
}

/** 段里第一个自定义属性名（`var(--x, red)` → `--x`）；没有则 `null`。 */
function firstVarName(value: string): string | null {
	return /--[A-Za-z0-9_-]{1,64}/.exec(value)?.[0] ?? null;
}

/**
 * `var(--x, <fallback>)` 里的 fallback 原文；没写 fallback 时 `null`。
 *
 * 用 {@link splitTopLevel} 找**第一个括号外的逗号**，所以嵌套的
 * `var(--a, var(--b, 1em))` 也能一层层剥出来（{@link varKind} 递归下去）。
 */
function varFallback(value: string): string | null {
	const inner = /^var\(([\s\S]*)\)$/i.exec(value.trim())?.[1];
	if (inner === undefined) return null;

	const parts = splitTopLevel(inner);
	if (parts.length < 2) return null;

	// fallback 自己可以含顶层逗号（`var(--x, rgb(1,2,3))` 不会，但 `var(--x, a, b)` 会），
	// 按 CSS 规范整段都是 fallback，所以拼回去
	const fallback = parts.slice(1).join(",").trim();
	return fallback === "" ? null : fallback;
}

/**
 * 第 ④ 层：一个变量段到底是尺寸还是颜色。
 *
 * 两条规则，都是启发式：
 *
 * 1. **有 fallback 就问 fallback**——`var(--x, 1.5em)` 是尺寸，`var(--x, red)` 是颜色。
 *    这是 CSS 里最惯用的写法，答案确定且零学习成本。递归调用
 *    {@link interpretModifier}，所以 fallback 里再套一层 `var()` 也答得出来。
 * 2. **没有 fallback 就看名字**（{@link SIZE_VAR_NAME_PATTERN}），命中判尺寸，
 *    其余判颜色。
 *
 * 判错时用户有两条出路：`size:--x`（第 ① 层）或 `calc(var(--x))`（`calc` 只在
 * 尺寸表里，于是整段不再歧义）。颜色方向不需要出路，未知名字本来就归颜色。
 */
function varKind(value: string): "color" | "size" {
	const fallback = varFallback(value);
	if (fallback !== null) {
		const nested = interpretModifier(fallback);
		if (nested !== null) return nested.kind;
	}

	const name = firstVarName(value);
	return name !== null && SIZE_VAR_NAME_PATTERN.test(name) ? "size" : "color";
}

/**
 * 已经知道类型（第 ① 层的 `size:` / `color:`）时，这段值本身合不合法。
 *
 * 类型既然由用户点明，就不再用类型专属的白名单去判——只校验**结构**
 * （安全闸 + 括号配平 + 函数名在两张表的并集里），字面量则按点明的那一类校验。
 * 于是 `size:light-dark(1em,2em)` 这种「颜色函数当尺寸用」也能写出来，
 * 而 `color:url(x)` 仍然进不来。
 */
function forcedValue(raw: string, kind: "color" | "size"): string | null {
	// 裸 `--x` 简写：类型已点明，直接包成 var()
	if (CSS_VAR_NAME_PATTERN.test(raw)) return `var(${raw})`;

	const calls = callsIn(raw);
	if (calls === null) return null;

	if (calls.length > 0) {
		const known = calls.every(
			(name) => SIZE_FUNCTIONS.has(name) || COLOR_FUNCTIONS.has(name),
		);
		return known ? raw : null;
	}

	// 没有函数调用的字面量：按点明的类型校验
	if (kind === "size") return LENGTH_PATTERN.test(raw) ? raw : null;
	return HEX_COLOR_PATTERN.test(raw) || COLOR_KEYWORD_PATTERN.test(raw)
		? raw
		: null;
}

/**
 * **判据的唯一实现**：一段修饰符是什么。
 *
 * {@link parseModifiers}（渲染）与 {@link classifyModifier}（右键菜单改写）都只是
 * 它的薄包装，所以两条路径不可能对同一段给出不同答案。
 *
 * @returns `null` = 认不出。渲染时**静默忽略**，改写时**原样保留**——
 *   那可能是将来才支持的写法，也可能是用户的笔误，静默删掉比留着糟糕得多。
 */
export function interpretModifier(modifier: string): ModifierValue | null {
	if (!isSafeValue(modifier)) return null;

	// ① 显式类型前缀：写出来就不再有歧义
	const forced = TYPE_PREFIX_PATTERN.exec(modifier);
	if (forced !== null) {
		const kind = forced[1].toLowerCase() as "color" | "size";
		const value = forcedValue(modifier.slice(forced[0].length), kind);
		return value === null ? null : { kind, value };
	}

	// ② 无歧义的尺寸字面量
	if (LENGTH_PATTERN.test(modifier)) return { kind: "size", value: modifier };

	// ③ 无歧义的颜色字面量
	if (HEX_COLOR_PATTERN.test(modifier)) {
		return { kind: "color", value: modifier };
	}

	// ④ 裸变量名简写：包成 var() 之后按第 ④ 层消歧
	if (CSS_VAR_NAME_PATTERN.test(modifier)) {
		const value = `var(${modifier})`;
		return { kind: varKind(value), value };
	}

	const calls = callsIn(modifier);
	if (calls === null) return null;

	// 没有函数调用的裸词：当颜色关键字，不校验是不是真的颜色名
	if (calls.length === 0) {
		return COLOR_KEYWORD_PATTERN.test(modifier)
			? { kind: "color", value: modifier }
			: null;
	}

	// 只用了 var()：仍是歧义段（`var(--icon-l)` 是尺寸，`var(--text-accent)` 不是）
	if (calls.every((name) => name === "var")) {
		return { kind: varKind(modifier), value: modifier };
	}

	const sizeOnly = calls.every((name) => SIZE_FUNCTIONS.has(name));
	const colorOnly = calls.every((name) => COLOR_FUNCTIONS.has(name));

	// 混用两类函数（`calc(oklch(…))`）或用了两张表都没有的名字：不猜
	if (sizeOnly === colorOnly) return null;
	return { kind: sizeOnly ? "size" : "color", value: modifier };
}

/**
 * 判定单段修饰符的类别。
 *
 * 供右键菜单那条路径改写记号时用（`input/iconEdit.ts`）。判据与
 * {@link parseModifiers} **完全共用** {@link interpretModifier}——菜单认的和渲染
 * 认的必须是同一套，否则会出现「菜单以为这段是颜色、于是替换掉，而渲染本来
 * 根本不认它」这种用户无法理解的行为。
 */
export function classifyModifier(modifier: string): ModifierKind {
	return interpretModifier(modifier)?.kind ?? null;
}

/**
 * 把一串修饰符里的**颜色**换成 `color`，其余段原样保留。
 *
 * 这是「改现有记号」不丢用户已写内容的关键：用户那段
 * `` `icon:CI-mdi-outlined-123,1.5em,#ab05cc` `` 在只换图标时颜色与尺寸都得还在，
 * 只改颜色时尺寸也得还在。
 *
 * 两条语义值得记下：
 *
 * - **滤掉全部颜色段再把新的追加到末尾**，不做「就地替换第一段」。因为修饰符规则是
 *   「同类后者胜出」，就地改第一段的话后面那段会继续赢，用户看不到自己选的颜色。
 * - **认不出的段一律保留**。那是用户亲手写的字（可能是将来才支持的写法，也可能是
 *   笔误），静默删掉比留着糟糕得多。
 *
 * @param color `null` = 删除全部颜色段（回到跟随正文色）。
 */
export function replaceColorModifier(
	modifiers: readonly string[],
	color: string | null,
): string[] {
	const kept = modifiers.filter(
		(modifier) => classifyModifier(modifier) !== "color",
	);
	return color === null ? kept : [...kept, color];
}

/**
 * 取最后一个颜色段的**原始文本**，供打开选择器时预填色板。
 *
 * 「最后一个」与「同类后者胜出」一致——那正是当前生效的颜色。
 *
 * **要原始段而不是 {@link parseModifiers} 的产物**：后者会把 `--text-accent`
 * 归一成 `var(--text-accent)`，而调用方接着要判断「这是不是 hex」
 * （提供方的色板是 `<input type="color">`，只吃 `#rrggbb`）。
 */
export function findColorModifier(modifiers: readonly string[]): string | null {
	for (let i = modifiers.length - 1; i >= 0; i -= 1) {
		if (classifyModifier(modifiers[i]) === "color") return modifiers[i];
	}
	return null;
}

/**
 * 解释一串修饰符。
 *
 * **顺序随意**（`1.5em,red` 与 `red,1.5em` 等价）：每段各自判定是尺寸还是颜色，
 * 不靠位置。
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
		const interpreted = interpretModifier(modifier);
		if (interpreted === null) continue;
		if (interpreted.kind === "size") size = interpreted.value;
		else color = interpreted.value;
	}

	return { color, size };
}
