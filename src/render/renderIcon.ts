import { formatTokenBody, type GrammarOptions, type IconToken } from "@src/syntax/grammar";
import { setIcon } from "obsidian";

/** 渲染产物的类名，与 `styles/style.css` 对应。 */
export const ICON_CLASS = "inline-icon";

/** 解析失败时打在原文上的类名，供用户诊断。 */
export const UNRESOLVED_CLASS = "inline-icon-unresolved";

/**
 * 造一个正文里的图标元素。
 *
 * **必须传入 `doc`**：popout 窗口是另一个 `document`，用全局 `document` 建出来的
 * 元素在弹出窗口里会出问题。CM6 widget 传 `view.dom.ownerDocument`，
 * 阅读模式传被替换节点的 `ownerDocument`。
 *
 * 尺寸与颜色全部交给 CSS（1em + currentColor），所以这里不设任何内联样式——
 * 详见 `dev/ecosystem/custom-icons-contract.md` 的「颜色与尺寸不需要跨插件 API」。
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
	return el;
}
