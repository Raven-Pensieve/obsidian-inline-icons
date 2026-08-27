import { formatTokenBody, type GrammarOptions, type IconToken } from "@src/syntax/grammar";
import { parseModifiers } from "@src/syntax/modifiers";
import { setIcon } from "obsidian";

/** 渲染产物的类名，与 `styles/style.css` 对应。 */
export const ICON_CLASS = "inline-icon";

/** 解析失败时打在原文上的类名，供用户诊断。 */
export const UNRESOLVED_CLASS = "inline-icon-unresolved";

/** 尺寸修饰符落地成这个 CSS 变量；没写时由 `style.css` 里的默认值兜着。 */
export const SIZE_VAR = "--ii-icon-size";

/** 颜色修饰符落地成这个 CSS 变量；没写时默认 `currentColor`。 */
export const COLOR_VAR = "--ii-icon-color";

/**
 * 造一个正文里的图标元素。
 *
 * **必须传入 `doc`**：popout 窗口是另一个 `document`，用全局 `document` 建出来的
 * 元素在弹出窗口里会出问题。CM6 widget 传 `view.dom.ownerDocument`，
 * 阅读模式传被替换节点的 `ownerDocument`。
 *
 * 没写修饰符时**不设任何内联样式**，尺寸与颜色全部由 CSS 决定（1em + currentColor），
 * 详见 `dev/ecosystem/custom-icons-contract.md` 的「颜色与尺寸不需要跨插件 API」。
 * 写了修饰符则只覆盖那两个 CSS 变量——**不直接写 `width` / `color`**，
 * 于是 `style.css` 仍是唯一定义盒模型的地方，用户也能在片段里覆盖这两个变量。
 */
export function createIconEl(
	doc: Document,
	iconId: string,
	token: IconToken,
	options: GrammarOptions,
): HTMLSpanElement {
	// 从 doc 反推 window 再建元素：popout 里 doc.win 就是那个弹出窗口，
	// 绝不能用全局 window / document。
	// （Custom Icons 那边一律写 ownerDocument.defaultView，但本仓库的 eslint 规则
	//   obsidianmd/prefer-create-el 要求走 createSpan，且不允许 disable。）
	const el = doc.win.createSpan({ cls: ICON_CLASS });
	el.dataset.iconId = iconId;
	// aria-label 同时充当 Obsidian 的悬浮提示：鼠标停上去能看到原本写的记号
	el.setAttribute("aria-label", formatTokenBody(token, options));
	setIcon(el, iconId);
	applyIconStyle(el, token);
	return el;
}

/**
 * 把修饰符写成两个 CSS 变量。
 *
 * 用 `setCssProps` 而不是直接赋 `style.width`：自定义属性是 `no-static-styles-assignment`
 * 这条 eslint 规则明确放行的形态，也让「盒模型写在 CSS 里」这条继续成立。
 * 值来自用户输入，但都已经过 {@link parseModifiers} 的白名单，
 * 认不出的段在那一步就被丢掉了。
 */
function applyIconStyle(el: HTMLElement, token: IconToken): void {
	const { color, size } = parseModifiers(token.modifiers);
	const props: Record<string, string> = {};
	if (size !== null) props[SIZE_VAR] = size;
	if (color !== null) props[COLOR_VAR] = color;
	// 一个变量都没有时不碰 style，免得给每个图标都留一个空的 style 属性
	if (size !== null || color !== null) el.setCssProps(props);
}
