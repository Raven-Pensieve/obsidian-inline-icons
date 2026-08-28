import { getCustomIconsApi } from "@src/api/customIcons";
import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import type { IconCandidate } from "@src/syntax/resolve";
import { setIcon, type App } from "obsidian";

/** 候选行的类名，样式在 `styles/style.css`。 */
export const SUGGEST_ITEM_CLASS = "ii-suggest-item";

/**
 * 候选行的统一渲染，`EditorSuggest` 与插入命令的模态框共用，保证两条输入路径
 * 长得一样。
 *
 * 四段各有必要性：
 *
 * | 位置 | 内容 | 为什么 |
 * | --- | --- | --- |
 * | 左 | 真图标（`setIcon`） | 用户是照着图形挑的，只列名字等于没有补全 |
 * | 中·主 | {@link IconCandidate.label} | 去掉注册前缀的短名，也就是用户正在敲的那段 |
 * | 中·次 | 完整注册 id（弱化） | 回车后写进文件的那一段 |
 * | 右 | 来源 | 装了图标包后否则会变成一堆看不出出处的名字 |
 *
 * 完整 id 弱化但不能省：`catalogFor(null)` 逐个 id 映射、不按 label 去重，所以
 * 不同 id 可以有相同短名（`foo` 与 `lucide-foo` 都显示成 `foo`，来源也都算内置）。
 * 只显示短名就会出现两行长得一模一样、写进文件的东西却不同。短名与完整 id 相同时
 * 不重复渲染。
 */
export function renderIconSuggestion(
	plugin: InlineIconsPlugin,
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
		text: sourceLabel(plugin.app, candidate),
	});
}

/**
 * 来源标签，能细分到具体图标包就细分。
 *
 * `getIconIds()` 只给一串扁平 id，而 `CI-mdi-home` 里哪段是 packId 不可反推
 * （packId 与 name 都可含连字符），所以单靠公共 API 只能分到「内置 / Custom Icons」
 * 两档——一装图标包，右边那列就成了一片相同的「Custom Icons」，等于没有分组。
 * Custom Icons 的 `describe()` 认得出 `CI-mdi-home` 来自 mdi 包，于是这里能直接
 * 显示包名。提供方不在场时退回两档，那是裸装时的正常形态。
 *
 * 每行调一次 `describe()` 是廉价的：候选最多 `MAX_RESULTS` 行，而提供方按
 * `revision` 缓存了反查索引，单次是查表而不是重建。
 */
export function sourceLabel(app: App, candidate: IconCandidate): string {
	if (candidate.source === "builtin") return LL.ui.sourceBuiltin();

	const info = getCustomIconsApi(app)?.describe(candidate.id);
	// 包名优先：`mdi` 这种 id 对用户没有意义，`Material Design Icons` 才有
	if (info?.source === "pack") {
		return info.packName ?? info.packId ?? LL.ui.sourceCustomIcons();
	}
	if (info?.source === "user-svg") return LL.ui.sourceUserSvg();

	// 提供方不在场，或那个 id 它也认不出来（别的插件注册的 CI-*）
	return LL.ui.sourceCustomIcons();
}
