/**
 * 第四条输入路径：编辑器右键菜单。
 *
 * 前三条都只在光标处插入新记号，于是「把这个图标换成另一个」得手动选中整段删掉再重来，
 * 颜色也一起没了。本路径补上它：
 *
 * ```
 * 光标 / 右键处命中记号 → [更换图标…]  [移除图标]
 * 没命中               → [插入图标…]
 * ```
 *
 * 定位走 `syntax/locate.ts` 的纯函数，不碰 CM6：`editor-menu` 事件不带 `MouseEvent`，
 * 拿不到坐标，而「这一列在哪个行内代码里」本来就是纯字符串问题。
 */
import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import {
	MarkdownView,
	type Editor,
	type MarkdownFileInfo,
	type Menu,
} from "obsidian";
import { locateIconTarget, removeIconToken } from "./iconEdit";
import { pickIconIntoEditor } from "./pickIcon";

/**
 * 菜单分段：用插件自己的 id 单独占一段，于是图标那几项自成一组。
 *
 * 分割线不必自己加——菜单显示前会按段排序（`Menu.sort()`），段与段之间的分隔由那一步
 * 生成。手动 `addSeparator()` 反而危险：它插进 `items[]` 里的那条没有归属段，
 * 排序后落在哪不受控。
 *
 * 未在宿主 `addSections()` 里登记过的段不会被丢掉，而是整组排在末尾（`cmdr` /
 * `tasknotes` / `tldraw` / `excalidraw` 都这么用）。排末尾正合适，不去挤动宿主自己
 * 那些项的顺序。段 id 与渲染出的 `data-section` 属性一致。
 */
const MENU_SECTION = "inline-icons";

/** 命中记号但解析不出图标时，菜单项左侧用的通用图标。 */
const FALLBACK_MENU_ICON = "image";

/** 注册 `editor-menu`；调用方需用 `this.registerEvent(...)` 包住返回值。 */
export function registerEditorMenu(plugin: InlineIconsPlugin) {
	return plugin.app.workspace.on(
		"editor-menu",
		(menu: Menu, editor: Editor, info: MarkdownFileInfo) => {
			buildIconMenu(plugin, menu, editor, info);
		},
	);
}

function buildIconMenu(
	plugin: InlineIconsPlugin,
	menu: Menu,
	editor: Editor,
	info: MarkdownFileInfo,
): void {
	// popout 必须传 sourceEl，否则弹窗叠到主窗口去。info 也可能是 Canvas 里的嵌入
	// 编辑器（MarkdownFileInfo 那一支没有 containerEl），退回不传
	const sourceEl = info instanceof MarkdownView ? info.containerEl : undefined;
	const target = locateIconTarget(plugin, editor);

	if (target === null) {
		menu.addItem((item) =>
			item
				.setSection(MENU_SECTION)
				.setTitle(LL.menu.insertIcon())
				.setIcon(FALLBACK_MENU_ICON)
				.onClick(() => {
					pickIconIntoEditor(plugin, editor, null, sourceEl);
				}),
		);
		return;
	}

	menu.addItem((item) =>
		item
			.setSection(MENU_SECTION)
			.setTitle(LL.menu.replaceIcon())
			// 菜单项左侧直接显示当前那个图标，比任何文案都清楚说明「改的是这一个」。
			// 解析不出来时（坏记号）退回通用图标，那种记号也该能用这条路修回来
			.setIcon(plugin.resolver.resolve(target.token) ?? FALLBACK_MENU_ICON)
			.onClick(() => {
				pickIconIntoEditor(plugin, editor, target, sourceEl);
			}),
	);

	menu.addItem((item) =>
		item
			.setSection(MENU_SECTION)
			.setTitle(LL.menu.removeIcon())
			.setIcon("trash-2")
			.onClick(() => {
				removeIconToken(editor, target);
			}),
	);
}
