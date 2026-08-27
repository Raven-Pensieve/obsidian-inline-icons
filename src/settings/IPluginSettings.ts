/**
 * 插件设置的数据形状。
 *
 * 约定：每个可配置项的存储路径（点分 key）与此结构一一对应，例如
 * `syntax.prefix`、`suggest.alias`。声明式设置页的每个 `control` 都以这个
 * 点分路径作为 `key`，由 {@link PluginSettingTab.getControlValue} /
 * {@link PluginSettingTab.setControlValue} 读写。
 *
 * 顶层两组恰好对应设置页的两个页面（tab）。
 *
 * **这里只放「用户真的会去改」的项**。曾经存在、后来被砍掉的四个：
 *
 * | 砍掉的 | 为什么 |
 * | --- | --- |
 * | `syntax.renderBareToken` | 只接在阅读模式那条管线上，实时预览没有裸形式路径，打开会两个模式显示不一致；而补全在敲到 `icon:` 时就已经弹出来了，正常路径撞不到裸形式 |
 * | `render.readingMode` / `render.livePreview` | 等于「把插件关掉一半」。真不要图标就禁用插件；想看原文，源码模式本来就永远显示原文 |
 * | `suggest.maxResults` | 「可选图标上万个」justify 的是**存在**一个上限，不是暴露它。想收窄结果的动作是多敲一个字母，见 `ranking.ts` 的 `MAX_RESULTS` |
 */
export interface IPluginSettings {
	/** 语法：记号长什么样。**改这里等于改用户笔记的可读性，谨慎。** */
	syntax: {
		/**
		 * 前缀词，默认 `icon`，落盘形态是 `` `icon:sun` ``。
		 *
		 * 改前缀会让已经写进笔记的旧记号解析失败（保留原文，不报错）。
		 *
		 * **留成设置项是有据的**：`dev/ecosystem/生态语法占用调研.md` 查到 `icon:`
		 * 在行内代码里目前无人占用，但这赛道很挤，真撞上了用户得有路可走
		 * （Iconize / GlyphIt 的 `iconIdentifier` 也是这个设计）。
		 */
		prefix: string;
	};
	/** 补全：输入记号的两条路径。反引号一律由插件补（P2）。 */
	suggest: {
		/** 输入时是否弹出候选（`EditorSuggest`）。命令入口不受此开关影响。 */
		enabled: boolean;
		/**
		 * 输入别名，默认 `i`——敲 `i:su` 就能弹出候选。
		 *
		 * **只存在于补全里，永远不会写进文件。**
		 */
		alias: string;
		/** 最近使用过的图标 id，最新的在前。由插件维护，不在设置页展示。 */
		recent: string[];
	};
}

export const DEFAULT_SETTINGS: IPluginSettings = {
	syntax: {
		prefix: "icon",
	},
	suggest: {
		enabled: true,
		alias: "i",
		recent: [],
	},
};

/** 前缀词与输入别名共用的字符集：不能含冒号、空白或其他会破坏边界的字符。 */
export const WORD_PATTERN = /^[A-Za-z0-9_-]+$/;
