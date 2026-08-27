import { LL } from "@src/i18n/i18n";
import InlineIconsPlugin from "@src/main";
import { Objects } from "@src/util/Objects";
import {
	PluginSettingTab as ObPluginSettingTab,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from "obsidian";
import { ConfirmModal } from "./ConfirmModal";
import {
	DEFAULT_SETTINGS,
	WORD_PATTERN,
	type IPluginSettings,
} from "./IPluginSettings";

/**
 * 声明式设置页（Obsidian 1.13+）。
 *
 * 只需描述「有哪些设置项」，渲染、布局、搜索索引、移动端适配全部交给框架：
 *
 * - {@link getSettingDefinitions} 返回三个 `type: "page"`，即设置页里的三个 tab；
 * - {@link getControlValue} / {@link setControlValue} 负责读写：控件只声明一个
 *   点分路径 `key`，值从哪来、写到哪去由这两个方法决定。
 *
 * 重渲染的三档成本：什么都不调（React 孤岛自行管状态）＜ {@link refreshDomState}
 * （只重算 `visible` / `disabled` 谓词）＜ {@link update}（整页重建，只在结构性
 * 变化时用，见 {@link confirmReset}）。
 */
export class PluginSettingTab extends ObPluginSettingTab {
	plugin: InlineIconsPlugin;
	icon: string = "settings";

	constructor(plugin: InlineIconsPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	// ==================== 框架入口 ====================

	getSettingDefinitions(): SettingDefinitionItem[] {
		const T = LL.settings;
		return [
			this.syntaxPage(),
			this.renderPage(),
			this.suggestPage(),
			{
				// action 行：整行可点，适合「立即执行某个操作」
				name: T.reset.name(),
				desc: T.reset.desc(),
				action: () => this.confirmReset(),
			},
		];
	}

	getControlValue(key: string): unknown {
		return Objects.getByPath(this.plugin.settings, key);
	}

	/**
	 * 统一走 SettingsStore：落盘之外还会通知订阅者。
	 *
	 * 语法相关的项改动后必须让解析缓存与已渲染的记号跟着变，所以这里额外调一次
	 * {@link InlineIconsPlugin.onSyntaxChanged}。
	 */
	async setControlValue(key: string, value: unknown): Promise<void> {
		await this.plugin.settingsStore.updateSettingByPath(key, value);
		this.plugin.onSyntaxChanged();
		this.refreshDomState();
	}

	// ==================== 页面（tab） ====================

	/** 语法：前缀词与裸形式开关。 */
	private syntaxPage(): SettingDefinitionPage {
		const T = LL.settings.syntax;
		const syntax = (): IPluginSettings["syntax"] =>
			this.plugin.settings.syntax;

		return {
			type: "page",
			name: T.name(),
			desc: T.desc(),
			// 在入口行右侧顺带显示当前记号形态，用户不必点进去看
			displayValue: () => `\`${syntax().prefix}:sun\``,
			items: [
				{
					name: T.prefix.name(),
					desc: T.prefix.desc(),
					control: {
						type: "text" as const,
						key: "syntax.prefix",
						defaultValue: DEFAULT_SETTINGS.syntax.prefix,
						// 返回非空字符串 = 拒绝这次改动，并在行下方显示内联错误
						validate: (value: string) =>
							WORD_PATTERN.test(value.trim()) &&
							value.trim().length <= 16
								? undefined
								: T.prefix.invalid(),
					},
				},
				{
					name: T.renderBareToken.name(),
					desc: T.renderBareToken.desc(),
					control: {
						type: "toggle" as const,
						key: "syntax.renderBareToken",
						defaultValue: DEFAULT_SETTINGS.syntax.renderBareToken,
					},
				},
			],
		};
	}

	/** 渲染：两条管线的开关。两条都关就等于把插件停了，给个警示徽标。 */
	private renderPage(): SettingDefinitionPage {
		const T = LL.settings.render;
		const render = (): IPluginSettings["render"] =>
			this.plugin.settings.render;

		return {
			type: "page",
			name: T.name(),
			desc: T.desc(),
			status: () =>
				render().readingMode || render().livePreview ? null : "warning",
			items: [
				{
					name: T.readingMode.name(),
					desc: T.readingMode.desc(),
					control: {
						type: "toggle" as const,
						key: "render.readingMode",
						defaultValue: DEFAULT_SETTINGS.render.readingMode,
					},
				},
				{
					name: T.livePreview.name(),
					desc: T.livePreview.desc(),
					control: {
						type: "toggle" as const,
						key: "render.livePreview",
						defaultValue: DEFAULT_SETTINGS.render.livePreview,
					},
				},
			],
		};
	}

	/** 补全：开关、输入别名、候选上限。 */
	private suggestPage(): SettingDefinitionPage {
		const T = LL.settings.suggest;
		const suggest = (): IPluginSettings["suggest"] =>
			this.plugin.settings.suggest;

		return {
			type: "page",
			name: T.name(),
			desc: T.desc(),
			displayValue: () => `${suggest().alias}:`,
			items: [
				{
					name: T.enabled.name(),
					desc: T.enabled.desc(),
					control: {
						type: "toggle" as const,
						key: "suggest.enabled",
						defaultValue: DEFAULT_SETTINGS.suggest.enabled,
					},
				},
				{
					name: T.alias.name(),
					desc: T.alias.desc(),
					// 补全关掉后别名没有意义，但保留可见（disabled 而非隐藏）
					disabled: () => !suggest().enabled,
					control: {
						type: "text" as const,
						key: "suggest.alias",
						defaultValue: DEFAULT_SETTINGS.suggest.alias,
						validate: (value: string) =>
							WORD_PATTERN.test(value.trim()) &&
							value.trim().length <= 8
								? undefined
								: T.alias.invalid(),
					},
				},
				{
					name: T.maxResults.name(),
					desc: T.maxResults.desc(),
					disabled: () => !suggest().enabled,
					control: {
						type: "number" as const,
						key: "suggest.maxResults",
						defaultValue: DEFAULT_SETTINGS.suggest.maxResults,
						min: 5,
						max: 100,
						step: 5,
					},
				},
			],
		};
	}

	// ==================== 辅助 ====================

	/** 破坏性操作先确认，避免一次误点丢掉全部配置。 */
	private confirmReset(): void {
		const T = LL.settings.reset;
		new ConfirmModal(this.plugin.app, {
			title: T.name(),
			message: T.desc(),
			confirmText: T.button(),
			destructive: true,
			onConfirm: async () => {
				await this.plugin.settingsStore.updateSettings(
					structuredClone(DEFAULT_SETTINGS),
				);
				this.plugin.onSyntaxChanged();
				this.update();
			},
		}).open();
	}
}
