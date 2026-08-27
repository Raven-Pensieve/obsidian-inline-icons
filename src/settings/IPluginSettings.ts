/**
 * 插件设置的数据形状。
 *
 * 约定：每个可配置项的存储路径（点分 key）与此结构一一对应，例如
 * `syntax.prefix`、`suggest.maxResults`。声明式设置页的每个 `control` 都以这个
 * 点分路径作为 `key`，由 {@link PluginSettingTab.getControlValue} /
 * {@link PluginSettingTab.setControlValue} 读写。
 *
 * 顶层三组恰好对应设置页的三个页面（tab）。
 */
export interface IPluginSettings {
	/** 语法：记号长什么样。**改这里等于改用户笔记的可读性，谨慎。** */
	syntax: {
		/**
		 * 前缀词，默认 `icon`，落盘形态是 `` `icon:sun` ``。
		 *
		 * 改前缀会让已经写进笔记的旧记号解析失败（保留原文，不报错）。
		 */
		prefix: string;
		/**
		 * 是否连正文里**没有反引号**的 `icon:sun` 也渲染。
		 *
		 * 默认 `false`：这是逃生开关，代价是与正文文字抢记号（`icon:sunny`
		 * 只能整段当成名字）。详见 `dev/syntax-spec.md`。
		 */
		renderBareToken: boolean;
	};
	/** 渲染：两条互不相干的管线各自的开关。 */
	render: {
		/** 阅读模式 / 内嵌 / 悬浮预览（`registerMarkdownPostProcessor`）。 */
		readingMode: boolean;
		/** 实时预览（CM6 `registerEditorExtension`）。源码模式永不渲染。 */
		livePreview: boolean;
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
		/** 候选数量上限：装了图标包后可选图标可达上万个。 */
		maxResults: number;
		/** 最近使用过的图标 id，最新的在前。由插件维护，不在设置页展示。 */
		recent: string[];
	};
}

export const DEFAULT_SETTINGS: IPluginSettings = {
	syntax: {
		prefix: "icon",
		renderBareToken: false,
	},
	render: {
		readingMode: true,
		livePreview: true,
	},
	suggest: {
		enabled: true,
		alias: "i",
		maxResults: 30,
		recent: [],
	},
};

/** 前缀词与输入别名共用的字符集：不能含冒号、空白或其他会破坏边界的字符。 */
export const WORD_PATTERN = /^[A-Za-z0-9_-]+$/;
