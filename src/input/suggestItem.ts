import { LL } from "@src/i18n/i18n";
import type { IconCandidate } from "@src/syntax/resolve";
import { setIcon } from "obsidian";

/** 候选行的类名，样式在 `styles/style.css`。 */
export const SUGGEST_ITEM_CLASS = "ii-suggest-item";

/**
 * 候选行的统一渲染：**左侧必须是真图标**。
 *
 * 只列名字的补全等于没有补全——用户不可能记住上千个 id。右侧显示来源，
 * 否则装了图标包后列表会变成一堆看不出出处的名字。
 *
 * `EditorSuggest` 与插入命令的模态框共用这一份，保证两条输入路径长得一样。
 */
export function renderIconSuggestion(
	candidate: IconCandidate,
	el: HTMLElement,
): void {
	el.addClass(SUGGEST_ITEM_CLASS);

	const iconEl = el.createSpan({ cls: "ii-suggest-icon" });
	setIcon(iconEl, candidate.id);

	el.createSpan({ cls: "ii-suggest-label", text: candidate.label });
	el.createSpan({
		cls: "ii-suggest-source",
		text: sourceLabel(candidate.source),
	});
}

/**
 * 来源标签。
 *
 * 只分「内置 / Custom Icons」两档：`getIconIds()` 给的是扁平 id，
 * `CI-mdi-home` 无法反推 packId 与 name 的切分点，细分到具体图标包要等
 * Custom Icons 暴露 `api.catalog()`（M3）。
 */
export function sourceLabel(source: IconCandidate["source"]): string {
	return source === "custom-icons"
		? LL.ui.sourceCustomIcons()
		: LL.ui.sourceBuiltin();
}
