/**
 * 定位：**光标所在的那个记号是哪一段**。
 *
 * 与 `grammar.ts` 的分工：那边回答「这段文本是不是记号」，本模块回答
 * 「这一行的这一列落在哪个记号里、它的边界在哪」。两条用途：
 *
 * - **右键菜单**要知道该改哪一段（`input/editorMenu.ts`）；
 * - **补全**里「光标落在已有记号内」那一支（`input/trigger.ts` 的 `matchInsideSpan`）。
 *
 * 两处必须共用同一份配对逻辑，否则菜单认的记号与补全认的记号会不一致。
 *
 * **纯函数，不碰 DOM、不 import obsidian**，所以能被单测钉住——这一层的边界
 * （多个行内代码、孤立反引号、端点）正是最容易写错的地方。
 *
 * ## 为什么不问 CM6 的语法树
 *
 * - `editor-menu` 事件**不带 `MouseEvent`**，拿不到坐标，`posAtCoords` 无从下手；
 * - 走 `editor.cm` 摸 CM6 是非公开 API，而这里要的信息（「这一列在哪个行内代码里」）
 *   本来就是**纯字符串问题**：行内代码的边界就是那对反引号。
 *
 * 代价：`` `` `icon:sun` `` `` 这类多反引号围栏、以及跨行的行内代码不认。
 * 两条渲染管线本来也只处理单反引号形态，口径一致。
 */
import { parseTokenBody, type IconToken } from "./grammar";

/** 命中的一段行内代码，区间是 `[start, end)`，**含那对反引号**。 */
export interface LocatedSpan {
	/** 开反引号所在列（含）。 */
	start: number;
	/** 闭反引号之后一列（不含）。 */
	end: number;
	token: IconToken;
}

export interface LocateOptions {
	/**
	 * 端点（`ch === start` 或 `ch === end`）算不算命中。
	 *
	 * | 调用方 | 取值 | 理由 |
	 * | --- | --- | --- |
	 * | 右键菜单 | `true` | 实时预览里记号被折叠成 widget（`Decoration.replace`），右键点在图标上时 caret 落在**被替换区间的边界**而不是内部。按开区间判定的话，右键点图标永远定位不到自己那个记号 |
	 * | 补全 | `false`（默认） | 光标贴在记号外侧时不该弹出「替换整个记号」的候选——那时用户是在记号旁边打字 |
	 *
	 * 开着的副作用：紧贴记号外侧那一个字符处也会命中（`` `icon:sun`X `` 点在 `X` 上）。
	 * 接受——多出来的只是一个菜单项，而漏掉「点图标本身」是致命的。
	 */
	includeEdges?: boolean;
}

/**
 * 找出包含 `ch` 的那段记号。
 *
 * **从行首成对配对反引号**，而不是 `lastIndexOf` + `indexOf` 各找一边：后者在一行里
 * 有两个行内代码时会跨对匹配——`` `a` | `b` `` 光标在中间时，它会把前一段的闭反引号
 * 与后一段的开反引号配成一对，于是把中间那段空白当成记号体。
 *
 * @param prefixes 可接受的前缀词，**顺序即优先级**（正式前缀 + 输入别名）。
 *   两个都认是因为用户可能手写了 `` `i:sun` ``，那也该能改。
 * @returns 不在任何记号里时返回 `null`。
 */
export function locateTokenAt(
	line: string,
	ch: number,
	prefixes: readonly string[],
	options: LocateOptions = {},
): LocatedSpan | null {
	const includeEdges = options.includeEdges ?? false;
	let cursor = 0;

	for (;;) {
		const open = line.indexOf("`", cursor);
		if (open < 0) return null;

		const close = line.indexOf("`", open + 1);
		// 孤立的开反引号：后面不可能再配出包含 ch 的对
		if (close < 0) return null;

		const start = open;
		const end = close + 1;

		// 各对按列递增，所以 ch 落在这一对之前就意味着它不在任何一对里
		if (ch < start) return null;

		const inside = ch > start && ch < end;
		const onEdge = ch === start || ch === end;

		if (inside || (includeEdges && onEdge)) {
			const token = parseFirst(line.slice(open + 1, close), prefixes);
			if (token !== null) return { start, end, token };

			/*
			 * 这一对不是记号。**只有端点命中时才继续往后找**：
			 * 相邻的两段行内代码（`` `x``icon:sun` ``）里，`ch` 同时是前一对的 end
			 * 与后一对的 start，前一对不是记号不该让后一对也定位不到。
			 * 而 ch 落在这一对**内部**时答案已经确定——光标就在一段非记号的行内代码里。
			 */
			if (inside) return null;
		}

		cursor = end;
	}
}

/** 逐个前缀试，第一个解析成功的胜出。 */
function parseFirst(
	body: string,
	prefixes: readonly string[],
): IconToken | null {
	for (const prefix of prefixes) {
		const token = parseTokenBody(body, { prefix });
		if (token !== null) return token;
	}
	return null;
}
