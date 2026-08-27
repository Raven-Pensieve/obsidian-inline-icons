import { IPluginSettings } from "@src/settings/IPluginSettings";
import { PluginSettingTab } from "@src/settings/PluginSettingTab";
import SettingsStore from "@src/settings/SettingsStore";
import type { GrammarOptions } from "@src/syntax/grammar";
import { IconResolver } from "@src/syntax/resolve";
import "@styles/styles";
import { getIconIds, Plugin } from "obsidian";

/**
 * Inline Icons —— 把图标写进笔记正文。
 *
 * 当前进度：**语法层（`src/syntax/`）已就绪并有单测**；两条渲染管线与补全尚未接上，
 * 见 `dev/roadmap.md` 的 M1 清单。onload 里还要注册的东西：
 *
 * - `registerMarkdownPostProcessor`（阅读模式）
 * - `registerEditorExtension`（实时预览 CM6）
 * - `registerEditorSuggest` + `addCommand`（P2 的两条输入路径）
 */
export default class InlineIconsPlugin extends Plugin {
	settings: IPluginSettings;
	readonly settingsStore = new SettingsStore(this);

	/**
	 * 记号名 → Obsidian 图标 id 的解析器。
	 *
	 * 只吃公共 `getIconIds()`，因此对 Custom Icons **零耦合**：它装的用户 SVG
	 * （`CI-<id>`）与图标包（`CI-<packId>-<name>`）本来就是普通的全局图标。
	 */
	readonly resolver = new IconResolver(() => getIconIds());

	async onload() {
		await this.settingsStore.loadSettings();

		this.addSettingTab(new PluginSettingTab(this));

		// 插件集变化（Custom Icons 被启用/禁用、装卸图标包）后注册表会变，
		// 解析缓存必须作废，否则「装上 Custom Icons 却要重启才出图标」。
		// `app.plugins` 是非官方 API；事件名 `changed` 由 obsidian-typings 的
		// `Plugins.didChange` 注释确认（Events.on 接受任意字符串，写错了 tsc 不会报）。
		this.registerEvent(
			this.app.plugins.on("changed", () => this.resolver.invalidate()),
		);
	}

	onunload() {}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** 供设置页调用：语法或渲染选项变了，缓存作废。 */
	onSyntaxChanged(): void {
		this.resolver.invalidate();
	}

	/** 语法层需要的选项，两条管线与补全都从这里取，避免各自读设置。 */
	get grammarOptions(): GrammarOptions {
		return { prefix: this.settings.syntax.prefix };
	}
}
