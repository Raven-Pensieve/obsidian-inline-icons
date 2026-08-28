/**
 * 插件设置的数据形状。
 *
 * 每个可配置项的存储路径（点分 key）与此结构一一对应，例如 `syntax.prefix`、
 * `suggest.alias`。声明式设置页的每个 `control` 都以这个点分路径作为 `key`，
 * 由 `PluginSettingTab` 的 `getControlValue` / `setControlValue` 读写。
 *
 * 顶层两组对应设置页的两个 tab。此处只放用户真的会去改的项。
 */
export interface IPluginSettings {
	/** 语法：记号长什么样。改这里等于改用户笔记的可读性。 */
	syntax: {
		/**
		 * 前缀词，默认 `icon`，落盘形态是 `` `icon:sun` ``。
		 *
		 * 改前缀会让已写进笔记的旧记号解析失败（保留原文，不报错）。留成设置项是
		 * 因为这条赛道很挤，真与别的插件撞上了用户得有路可走（Iconize / GlyphIt 的
		 * `iconIdentifier` 也是这个设计）。
		 */
		prefix: string;
	};
	/** 补全：输入记号的两条路径。反引号一律由插件补。 */
	suggest: {
		/** 输入时是否弹出候选（`EditorSuggest`）。命令入口不受此开关影响。 */
		enabled: boolean;
		/**
		 * 输入别名，默认 `i`——敲 `i:su` 就能弹出候选。
		 *
		 * 只存在于补全里，永远不会写进文件。
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
