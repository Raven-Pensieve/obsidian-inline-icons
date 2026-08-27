import { LL } from "@src/i18n/i18n";
import type { IconCandidate } from "@src/syntax/resolve";
import { setIcon } from "obsidian";

/** 候选行的类名，样式在 `styles/style.css`。 */
export const SUGGEST_ITEM_CLASS = "ii-suggest-item";

/**
 * 候选行的统一渲染：**左侧必须是真图标**。
 *
 * 只列名字的补全等于没有补全——用户不可能记住上千个 id。三段各有各的必要性：
 *
 * | 位置 | 内容 | 为什么 |
 * | --- | --- | --- |
 * | 左 | 真图标（`setIcon`） | 用户是照着图形挑的 |
 * | 中·主 | {@link IconCandidate.label} | 去掉注册前缀的短名，也就是用户正在敲的那段 |
 * | 中·次 | 完整注册 id（弱化） | 回车后写进文件的那一段（所见即所得） |
 * | 右 | 来源 | 装了图标包后否则会变成一堆看不出出处的名字 |
 *
 * **短名当主、完整 id 弱化但不能省**：`catalogFor(null)` 是逐个 id 映射的、
 * 不按 label 去重，所以**不同 id 可以有相同短名**——`foo` 与 `lucide-foo` 都显示成
 * `foo`，且两者的来源都算「内置」，连右边那列也分不开。只显示短名就会出现两行
 * 长得一模一样、回车后写进去的东西却不同。
 *
 * 短名与完整 id 相同时（id 本来就没有注册前缀）不重复渲染。
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
	if (candidate.id !== candidate.label) {
		el.createSpan({ cls: "ii-suggest-id", text: candidate.id });
	}
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
