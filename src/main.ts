import {
	getCustomIconsApi,
	onCustomIconsChanged,
} from "@src/api/customIcons";
import { LL } from "@src/i18n/i18n";
import { IconSuggest } from "@src/input/IconSuggest";
import { InsertIconModal } from "@src/input/InsertIconModal";
import { pickIconIntoEditor } from "@src/input/pickIcon";
import { withRecent } from "@src/input/ranking";
import { inlineIconsExtension } from "@src/render/livePreview";
import { createPostProcessor } from "@src/render/postProcessor";
import { IPluginSettings } from "@src/settings/IPluginSettings";
import { PluginSettingTab } from "@src/settings/PluginSettingTab";
import SettingsStore from "@src/settings/SettingsStore";
import type { GrammarOptions } from "@src/syntax/grammar";
import { IconResolver } from "@src/syntax/resolve";
import "@styles/styles";
import { getIconIds, MarkdownView, Plugin, type Editor } from "obsidian";

/**
 * Inline Icons —— 把图标写进笔记正文。
 *
 * onload 注册四件东西，正好对应文档里的两条渲染管线与两条输入路径：
 *
 * | 注册项 | 覆盖 |
 * | --- | --- |
 * | `registerMarkdownPostProcessor` | 阅读模式、内嵌、悬浮预览、Canvas、导出 PDF |
 * | `registerEditorExtension` | 实时预览（源码模式故意不渲染） |
 * | `registerEditorSuggest` | 敲 `i:su` 弹候选，反引号由插件补 |
 * | `addCommand` | 模糊搜索插入 + 重新渲染本文档 |
 */
export default class InlineIconsPlugin extends Plugin {
	settings: IPluginSettings;
	readonly settingsStore = new SettingsStore(this);

	/**
	 * 记号名 → Obsidian 图标 id 的解析器。
	 *
	 * 主体只吃公共 `getIconIds()`，所以**没装 Custom Icons 也照常工作**（P1）：
	 * 它装的用户 SVG（`CI-<id>`）与图标包（`CI-<packId>-<name>`）本来就是普通的
	 * 全局图标。第二个参数是补充档——只有 Custom Icons 的 `api.renderTo` 画得出来
	 * 的那批（Lucide 差集，**不在注册表里**），提供方不在场时整档消失。
	 */
	readonly resolver = new IconResolver(
		() => getIconIds(),
		(id) => getCustomIconsApi(this.app)?.has(id) ?? false,
	);

	async onload() {
		await this.settingsStore.loadSettings();

		this.addSettingTab(new PluginSettingTab(this));

		// 两条渲染管线。两个开关都在运行时判断（见各自实现），
		// 所以用户改设置不必重载插件
		this.registerMarkdownPostProcessor(createPostProcessor(this));
		this.registerEditorExtension(inlineIconsExtension(this));

		// 两条输入路径
		this.registerEditorSuggest(new IconSuggest(this));
		this.addCommand({
			id: "insert-icon",
			name: LL.commands.insertIcon.name(),
			editorCallback: (editor: Editor) => {
				new InsertIconModal(this, editor).open();
			},
		});
		// 第三条：借 Custom Icons 的图标选择器（分组网格 + 收藏/最近跨插件共享）。
		// 提供方不在场时它退回上面那个模糊搜索，所以命令始终可用
		this.addCommand({
			id: "pick-icon",
			name: LL.commands.pickIcon.name(),
			editorCallback: (editor: Editor, ctx) => {
				// 传 sourceEl 才能让弹窗落在 popout 窗口里而不是叠到主窗口。
				// ctx 也可能是 MarkdownFileInfo（如 Canvas 里的嵌入编辑器），
				// 那一支没有 containerEl，退回不传——弹窗落到 activeDocument
				pickIconIntoEditor(
					this,
					editor,
					ctx instanceof MarkdownView ? ctx.containerEl : undefined,
				);
			},
		});
		// 用户自救入口：图标包刚装好、或某处没跟上时手动刷一遍
		this.addCommand({
			id: "reapply-icons",
			name: LL.commands.reapply.name(),
			callback: () => this.reapplyIcons(),
		});

		// 插件集变化（Custom Icons 被启用/禁用）后注册表会变，解析缓存必须作废，
		// 否则「装上 Custom Icons 却要重启才出图标」。
		// `app.plugins` 是非官方 API；事件名 `changed` 由 obsidian-typings 的
		// `Plugins.didChange` 注释确认（Events.on 接受任意字符串，写错了 tsc 不会报）。
		this.registerEvent(
			this.app.plugins.on("changed", () => this.reapplyIcons()),
		);

		/*
		 * 图标集合本身变化（装包 / 卸包 / 启停包 / 增删改 SVG）——**这一条才是关键**。
		 *
		 * 上面那个 `changed` 只在**插件集**变化时触发，而在 Custom Icons 里删一个 SVG
		 * 或停用一个包都不会改变插件集。缺了本监听，那份 `getIconIds()` 快照会留在
		 * 原地，于是：
		 *
		 * - 装包 / 加 SVG → 快照里没有新 id，补全列不出来、已写的记号解析失败；
		 * - 删 SVG / 停用包 → 快照里**还有**那个 id，`resolve()` 报成功而 `setIcon`
		 *   画不出东西 → **空白 span**。后者绕过了本插件所有的「保留原文」判断，
		 *   因为它自认为解析成功了。
		 *
		 * 提供方的 `onunload` 也会广播一次（那时注册表刚被 removeIcon 清空），
		 * 所以禁用 Custom Icons 后全部 `CI-*` 记号会立刻退回原文而不是留白。
		 */
		this.registerEvent(onCustomIconsChanged(this.app, () => this.reapplyIcons()));
	}

	onunload() {}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** 供设置页调用：语法或渲染选项变了，缓存作废并重刷已打开的视图。 */
	onSyntaxChanged(): void {
		this.reapplyIcons();
	}

	/**
	 * 作废缓存并让所有已打开的视图重新渲染。
	 *
	 * `updateOptions()` 让 CM6 重建装饰；`previewMode.rerender(true)` 重跑阅读模式管线。
	 * `iterateAllLeaves` 会走到 popout 窗口里的叶子，别换成只看活动视图。
	 */
	reapplyIcons(): void {
		this.resolver.invalidate();
		this.app.workspace.updateOptions();
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				leaf.view.previewMode.rerender(true);
			}
		});
	}

	/** 记一次「最近使用」，两条输入路径共用。 */
	async rememberIcon(iconId: string): Promise<void> {
		await this.settingsStore.updateSettingByPath(
			"suggest.recent",
			withRecent(this.settings.suggest.recent, iconId),
		);
	}

	/** 语法层需要的选项，两条管线与补全都从这里取，避免各自读设置。 */
	get grammarOptions(): GrammarOptions {
		return { prefix: this.settings.syntax.prefix };
	}
}
