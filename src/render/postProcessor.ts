import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import { parseTokenBody, scanBareTokens } from "@src/syntax/grammar";
import type { MarkdownPostProcessor } from "obsidian";
import { createIconEl, UNRESOLVED_CLASS } from "./renderIcon";

/**
 * 裸形式扫描要跳过的宿主。
 *
 * 和转义规则是同一件事的两面：这些地方的文本一律不当记号。
 * （行内代码里的记号走 {@link processCodeSpans}，不在这条路上。）
 */
const SKIP_HOSTS = "code, pre, a, .math, .MathJax, .frontmatter";

/**
 * 阅读模式管线。
 *
 * 覆盖阅读模式正文、内嵌 `![[note]]`、悬浮预览、Canvas 卡片与导出 PDF——
 * 它们都走同一套 markdown 渲染。post processor 按 **section** 调用，不是整篇。
 *
 * 生命周期：只做 `setIcon`（外加一个 aria-label 悬浮提示，由 Obsidian 自己处理），
 * 没有事件监听与定时器，因此**不需要** `ctx.addChild(new MarkdownRenderChild(...))`。
 * 一旦将来往图标上挂 click/hover 逻辑，就必须补上它，让 Obsidian 在容器脱离 DOM 时回收。
 */
export function createPostProcessor(
	plugin: InlineIconsPlugin,
): MarkdownPostProcessor {
	return (el: HTMLElement) => {
		if (!plugin.settings.render.readingMode) return;

		processCodeSpans(plugin, el);
		if (plugin.settings.syntax.renderBareToken) {
			processBareTokens(plugin, el);
		}
	};
}

/**
 * 主路径：`` `icon:sun` `` 在阅读模式里已经是 `<code>icon:sun</code>`，
 * 所以直接找 `<code>` 整体替换，**不必**去遍历文本节点。
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

		code.replaceWith(
			createIconEl(
				code.ownerDocument,
				iconId,
				token,
				plugin.grammarOptions,
			),
		);
	}
}

/**
 * 裸形式（默认关闭的逃生开关）：这时才需要遍历文本节点。
 *
 * **绝不**碰 `innerHTML`——那会毁掉已经渲染好的链接、公式与嵌入。
 */
function processBareTokens(plugin: InlineIconsPlugin, el: HTMLElement): void {
	const walker = el.ownerDocument.createTreeWalker(
		el,
		NodeFilter.SHOW_TEXT,
	);

	const targets: Text[] = [];
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		const text = node as Text;
		const parent = text.parentElement;
		if (parent === null) continue;
		if (parent.closest(SKIP_HOSTS) !== null) continue;
		targets.push(text);
	}

	for (const text of targets) {
		replaceBareTokensIn(plugin, text);
	}
}

function replaceBareTokensIn(plugin: InlineIconsPlugin, text: Text): void {
	const matches = scanBareTokens(text.data, plugin.grammarOptions);
	if (matches.length === 0) return;

	const doc = text.ownerDocument;
	// 攒成一串节点交给 replaceWith(...nodes)，省掉一个 DocumentFragment
	const parts: Node[] = [];
	let cursor = 0;
	let replaced = false;

	for (const match of matches) {
		const iconId = plugin.resolver.resolve(match.token);
		// 解析不出来就整段留着原文，连 class 都不加：裸形式本来就可能是普通文字
		if (iconId === null) continue;

		if (match.start > cursor) {
			parts.push(doc.createTextNode(text.data.slice(cursor, match.start)));
		}
		parts.push(
			createIconEl(doc, iconId, match.token, plugin.grammarOptions),
		);
		cursor = match.end;
		replaced = true;
	}

	if (!replaced) return;
	if (cursor < text.data.length) {
		parts.push(doc.createTextNode(text.data.slice(cursor)));
	}
	text.replaceWith(...parts);
}

/** 保留原文 + 一个可诊断的类名与提示，比留白友好得多。 */
function markUnresolved(code: Element, name: string): void {
	code.classList.add(UNRESOLVED_CLASS);
	code.setAttribute("aria-label", LL.ui.unresolved({ name }));
}
