/**
 * 第三条输入路径：复用 Custom Icons 的图标选择器，兼作「改现有图标」的弹窗。
 *
 * `EditorSuggest` 与 `InsertIconModal` 只吃 `getIconIds()`，是一列文本候选；本路径
 * 把提供方那个选择器整个借过来——分组（收藏 / 最近 / Lucide / 我的 SVG / 每个包一段）、
 * 虚拟网格、分层检索、键盘导航、按当前颜色预览都是现成的。附带的好处是「最近使用」
 * 与「收藏」跨插件共享：选择器自己会写那两份列表，本插件不介入（那是提供方的用户数据，
 * 契约刻意没给写入口）。
 *
 * 提供方不在场时退回 {@link InsertIconModal}，且同样带着 `target`，
 * 否则「更换图标」会在旧记号旁边并列插一个新的。
 */
import { getCustomIconsApi } from "@src/api/customIcons";
import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import { findColorModifier } from "@src/syntax/modifiers";
import { Notice, type Editor } from "obsidian";
import { applyIconPick, removeIconToken, type IconEditTarget } from "./iconEdit";
import { InsertIconModal } from "./InsertIconModal";

/** 只有 hex 传得进提供方的色板（那是个 `<input type="color">`）。 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * 打开选择器，把结果插入或改写进编辑器。
 *
 * @param target `null` = 插入一个新记号；否则改写那个已存在的记号（换图标 / 改色 /
 *   清除），其余修饰符由 `iconEdit.ts` 负责保留。
 * @param sourceEl popout 必传：提供方靠它把弹窗挂到触发元素所在的那个窗口，
 *   否则从弹出窗口触发时弹窗会叠到主窗口去。
 */
export function pickIconIntoEditor(
	plugin: InlineIconsPlugin,
	editor: Editor,
	target: IconEditTarget | null = null,
	sourceEl?: HTMLElement,
): void {
	const api = getCustomIconsApi(plugin.app);
	if (!api) {
		// 退回自带的模糊搜索而不是什么都不做：用户按了命令就是想插图标。
		// target 一并传下去，于是编辑态仍然是「替换」而不是「并列插入」
		new Notice(LL.commands.pickIcon.unavailable());
		new InsertIconModal(plugin, editor, target).open();
		return;
	}

	api.openPicker({
		sourceEl,
		// 编辑态把当前状态交给弹窗，于是打开时高亮停在当前图标上、色板预填当前颜色。
		// `value` 传解析后的注册 id 而不是记号原文：契约只认注册 id，而记号里可能写的
		// 是简写（`` `icon:sun` `` → `lucide-sun`）。解析不出来时传 undefined，
		// 弹窗不高亮任何项，于是坏记号也能用这条路修回来
		value: target ? (plugin.resolver.resolve(target.token) ?? undefined) : undefined,
		color: target ? currentColor(target) : undefined,
		// 正文里没有独立的颜色控件，所以让弹窗自己提供一个
		colorEditable: true,
		// 不列 Lucide 差集（这也是契约默认值）：那一档只有 `api.renderTo` 画得出来，
		// 而选中的 id 会写进用户笔记。用户哪天禁用了提供方，同一篇笔记里就有几个图标
		// 退回原文而另几个还在。想要全量 Lucide 的路是在 Custom Icons 里装 Iconify 的
		// `lucide` 集，那批落在 registry 档，与提供方在不在场无关
		include: { lucideExtras: false },
		onPick: (result) => {
			// null = 用户点了「清除图标」。编辑态它意为删掉这个记号；
			// 插入态没有「当前图标」可清，仍然当取消
			if (!result) {
				if (target) removeIconToken(editor, target);
				return;
			}

			applyIconPick(plugin, editor, target, result.id, result.color);
		},
	});
}

/**
 * 取记号里当前那个颜色用于预填色板，仅当它是 hex。
 *
 * `--text-accent` / `red` 这类写法传不进 `<input type="color">`，所以不传；
 * 但用户不碰色板时它们会被 `iconEdit.ts` 原样保留，所以不会丢。一旦用户动了色板，
 * hex 覆盖它——那是用户的显式动作。
 */
function currentColor(target: IconEditTarget): string | undefined {
	const raw = findColorModifier(target.token.modifiers);
	if (raw === null || !HEX_COLOR.test(raw)) return undefined;
	return raw;
}
