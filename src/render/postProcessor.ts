import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import { parseTokenBody } from "@src/syntax/grammar";
import type { MarkdownPostProcessor } from "obsidian";
import { createIconEl, UNRESOLVED_CLASS } from "./renderIcon";

/**
 * 阅读模式管线，按 section 调用而非整篇。
 *
 * 覆盖阅读模式正文、内嵌 `![[note]]`、悬浮预览、Canvas 卡片与导出 PDF，
 * 它们都走同一套 markdown 渲染。
 *
 * 只认带反引号的形态。裸写的 `icon:sun` 不渲染：那个形态没有闭合符，字符集就是
 * 边界，`icon:sunny` 只能整段当成名字，中文语境下更糟（`icon:sun很好` 会把
 * 「很好」吃进 id）。而补全在用户敲到 `icon:` 时就已弹出，正常路径撞不到裸形式。
 *
 * 生命周期：只做 `setIcon` 与一个由 Obsidian 处理的 aria-label 提示，没有事件监听
 * 与定时器，因此不需要 `ctx.addChild(new MarkdownRenderChild(...))`。将来若往图标上
 * 挂 click / hover 逻辑，必须补上它，让 Obsidian 在容器脱离 DOM 时回收。
 */
export function createPostProcessor(
	plugin: InlineIconsPlugin,
): MarkdownPostProcessor {
	return (el: HTMLElement) => {
		processCodeSpans(plugin, el);
	};
}

/**
 * 替换记号对应的 `<code>` 元素。
 *
 * `` `icon:sun` `` 在阅读模式里已经是 `<code>icon:sun</code>`，所以直接找 `<code>`
 * 整体替换，不必遍历文本节点。
 */
function processCodeSpans(plugin: InlineIconsPlugin, el: HTMLElement): void {
	// 先收集再改：替换节点会动 DOM，边遍历边改是自找麻烦
	for (const code of Array.from(el.querySelectorAll("code"))) {
		// <pre><code> 是代码块，故意不渲染
		if (code.closest("pre") !== null) continue;

		const token = parseTokenBody(
			code.textContent ?? "",
			plugin.grammarOptions,
		);
		if (token === null) continue;

		const iconId = plugin.resolver.resolve(token);
		if (iconId === null) {
			markUnresolved(code, token.name);
			continue;
		}

		// 解析成功却画不出来：图标刚被删 / 包刚被停用而缓存还没作废。
		// **仍然保留原文**——replaceWith 一个空 span 就是那个「空白记号」缺陷
		const iconEl = createIconEl(plugin, code.ownerDocument, iconId, token);
		if (iconEl === null) {
			markUnresolved(code, token.name);
			continue;
		}

		code.replaceWith(iconEl);
	}
}

/** 保留原文 + 一个可诊断的类名与提示，比留白友好得多。 */
function markUnresolved(code: Element, name: string): void {
	code.classList.add(UNRESOLVED_CLASS);
	code.setAttribute("aria-label", LL.ui.unresolved({ name }));
}
