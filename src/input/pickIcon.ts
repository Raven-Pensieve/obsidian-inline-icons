/**
 * 第三条输入路径：**复用 Custom Icons 的图标选择器**。
 *
 * 前两条（`EditorSuggest` 与 `InsertIconModal`）只吃 `getIconIds()`，是一列文本候选；
 * 这一条把提供方那个 657 行的选择器整个借过来——分组（收藏 / 最近 / Lucide / 我的 SVG /
 * 每个包一段）、虚拟网格、分层检索、键盘导航、按当前颜色预览，全都现成。
 *
 * 附带一个白拿的好处：**「最近使用」与「收藏」跨插件共享**。用户在正文里挑过的图标，
 * 回到 Custom Icons 里给文件设图标时就排在最前——选择器自己会写那两份列表，
 * 我们一行都不用管（也**不该**管：那是提供方的用户数据，契约刻意没给写入口）。
 *
 * 提供方不在场时这条路自然消失，退回 {@link InsertIconModal}——P1 说的裸装可用。
 */
import { getCustomIconsApi } from "@src/api/customIcons";
import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import { canReference } from "@src/syntax/grammar";
import { Notice, type Editor } from "obsidian";
import { InsertIconModal } from "./InsertIconModal";

/**
 * 只有 `#rrggbb` / `#rgb` 这类十六进制值才落成修饰符。
 *
 * 提供方的色板是 `<input type="color">`，产出的一定是 `#rrggbb`，所以这条校验
 * 平时不会拦下任何东西——它挡的是**将来**：若提供方哪天改成能给 `var(--x)` 或
 * `rgb(1,2,3)`，前者含义会随主题漂移、后者的逗号会被语法层切开
 * （见 `syntax/modifiers.ts` 的说明），都不该被静默写进用户笔记。
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * 打开选择器并把结果插进编辑器。
 *
 * @param sourceEl **popout 必传**：提供方靠它把弹窗挂到触发元素所在的那个窗口，
 *   否则从弹出窗口触发时弹窗会叠到主窗口去（提供方仓库里已修过的问题）。
 */
export function pickIconIntoEditor(
	plugin: InlineIconsPlugin,
	editor: Editor,
	sourceEl?: HTMLElement,
): void {
	const api = getCustomIconsApi(plugin.app);
	if (!api) {
		// 退回自带的模糊搜索，而不是什么都不做：用户按了命令就是想插图标
		new Notice(LL.commands.pickIcon.unavailable());
		new InsertIconModal(plugin, editor).open();
		return;
	}

	api.openPicker({
		sourceEl,
		// 正文里没有独立的颜色控件，所以让弹窗自己提供一个
		colorEditable: true,
		/*
		 * 不列 Lucide 差集（这也是契约的默认值，写出来是为了说明理由）：
		 * 那一档只有 `api.renderTo` 画得出来，而我们会把选中的 id **写进用户笔记**。
		 * 用户装着 Custom Icons 时一切正常，哪天禁用了，同一篇笔记里就有几个图标
		 * 退回原文而另几个还在——这种不一致没法向用户解释。
		 * 想要全量 Lucide 的路仍然是在 Custom Icons 里装 Iconify 的 `lucide` 集，
		 * 那批落在 `registry` 档，与提供方在不在场无关。
		 */
		include: { lucideExtras: false },
		onPick: (result) => {
			// null = 用户点了「清除图标」。正文里没有「当前图标」可清，直接当取消
			if (!result) return;

			if (!canReference(result.id)) {
				// 含冒号 / 逗号 / 反引号的 id 写不进记号（那几个字符有结构含义）。
				// 补全的候选池会提前剔掉它们，但选择器是提供方的，列的是全部图标
				new Notice(LL.commands.pickIcon.unreferenceable({ id: result.id }));
				return;
			}

			editor.replaceSelection(
				plugin.resolver.tokenFor(
					result.id,
					plugin.grammarOptions,
					colorModifiers(result.color),
				),
			);
			void plugin.rememberIcon(result.id);
		},
	});
}

/**
 * 用户选的颜色 → 修饰符段。
 *
 * 契约里 `color` 有三态，只有中间那个该落地：
 *
 * | 回调给的 | 含义 | 落盘 |
 * | --- | --- | --- |
 * | `undefined` | 没碰颜色控件 | **不写修饰符**，颜色跟着正文走（`currentColor`） |
 * | `#e5a50a` | 显式选了色 | `` `icon:lucide-sun,#e5a50a` `` |
 * | `""` | 点了重置 | **不写修饰符**，等价于回到默认 |
 *
 * 「默认色不写修饰符」不只是省字符：记号里没有颜色段时，图标会跟随所在段落
 * （标题、加粗、链接色）与深浅色主题变化，而写死一个 hex 就把它钉住了。
 */
function colorModifiers(color: string | undefined): string[] {
	const trimmed = color?.trim();
	if (!trimmed || !HEX_COLOR.test(trimmed)) return [];
	return [trimmed.toLowerCase()];
}
