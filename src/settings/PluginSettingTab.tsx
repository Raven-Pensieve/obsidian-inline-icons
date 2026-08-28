import { LL } from "@src/i18n/i18n";
import InlineIconsPlugin from "@src/main";
import { Objects } from "@src/util/Objects";
import {
	PluginSettingTab as ObPluginSettingTab,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from "obsidian";
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
 * - {@link getSettingDefinitions} 返回两个 `type: "page"`，即设置页里的两个 tab；
 * - {@link getControlValue} / {@link setControlValue} 负责读写：控件只声明一个
 *   点分路径 `key`，值从哪来、写到哪去由这两个方法决定。
 *
 * 项少，所以没有「重置全部设置」行：逐个改回去比弹一次确认框还快。
 */
export class PluginSettingTab extends ObPluginSettingTab {
	plugin: InlineIconsPlugin;
	icon: string = "settings";

	constructor(plugin: InlineIconsPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [this.syntaxPage(), this.suggestPage()];
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

	/** 语法：只有前缀词一项。 */
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
			],
		};
	}

	/** 补全：开关与输入别名。 */
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
			],
		};
	}
}
