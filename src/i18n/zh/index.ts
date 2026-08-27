import type { BaseTranslation } from '../i18n-types'

const zh = {
	settings: {
		syntax: {
			name: "语法",
			desc: "记号长什么样",
			prefix: {
				name: "前缀词",
				desc: "记号形如 `<前缀>:sun`。改前缀会让已经写进笔记的旧记号失效，请谨慎",
				invalid: "只能用字母、数字、下划线与连字符，长度 1-16",
			},
		},
		suggest: {
			name: "补全",
			desc: "输入记号的两条路径，反引号一律由插件补",
			enabled: {
				name: "输入时弹出候选",
				desc: "敲前缀或输入别名时弹出图标候选，回车整段写入含反引号的记号。关掉后仍可用「插入图标」命令",
			},
			alias: {
				name: "输入别名",
				desc: "敲「别名 + 冒号」就能弹出候选。这个别名只存在于补全里，不会写进文件",
				invalid: "只能用字母、数字、下划线与连字符，长度 1-8",
			},
		},
	},
	ui: {
		unresolved: "找不到图标「{name}」",
		sourceBuiltin: "Obsidian 内置",
		sourceCustomIcons: "Custom Icons",
		sourceUserSvg: "我的 SVG",
	},
	commands: {
		insertIcon: {
			name: "插入图标",
			placeholder: "搜索图标…",
		},
		pickIcon: {
			name: "从图标库插入图标",
			unavailable: "没有启用 Custom Icons，改用内置的图标搜索",
			unreferenceable: "图标「{id}」的 id 里有冒号、逗号或反引号，写不进记号",
		},
		reapply: {
			name: "重新渲染本文档的图标",
		},
	},
} satisfies BaseTranslation;

export default zh;
