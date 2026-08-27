import type { BaseTranslation } from '../i18n-types'

const zh = {
	common: {
		add: "添加",
		delete: "删除",
		reset: "重置",
		save: "保存",
		cancel: "取消",
		confirm: "确定",
		moveUp: "上移",
		moveDown: "下移",
	},
	settings: {
		syntax: {
			name: "语法",
			desc: "记号长什么样，以及是否渲染裸形式",
			prefix: {
				name: "前缀词",
				desc: "记号形如 `<前缀>:sun`。改前缀会让已经写进笔记的旧记号失效，请谨慎",
				invalid: "只能用字母、数字、下划线与连字符，长度 1-16",
			},
			renderBareToken: {
				name: "渲染裸形式",
				desc: "连正文里没有反引号的 icon:sun 也渲染。它会与正文文字抢记号（icon:sunny 会整段当成名字），默认关闭",
			},
		},
		render: {
			name: "渲染",
			desc: "两条渲染管线各自的开关",
			readingMode: {
				name: "阅读模式",
				desc: "在阅读模式、内嵌与悬浮预览里渲染记号",
			},
			livePreview: {
				name: "实时预览",
				desc: "在实时预览里渲染记号；光标移进记号时会露出原文。源码模式一律只显示原文",
			},
		},
		suggest: {
			name: "补全",
			desc: "输入记号的两条路径，反引号一律由插件补",
			enabled: {
				name: "输入时弹出候选",
				desc: "敲前缀或输入别名时弹出图标候选，回车整段写入含反引号的记号",
			},
			alias: {
				name: "输入别名",
				desc: "敲「别名 + 冒号 + 几个字母」就能弹出候选。这个别名只存在于补全里，不会写进文件",
				invalid: "只能用字母、数字、下划线与连字符，长度 1-8",
			},
			maxResults: {
				name: "候选数量上限",
				desc: "装了图标包后可选图标可达上万个，列表要截断",
			},
		},
		reset: {
			name: "重置全部设置",
			desc: "把所有设置恢复为默认值",
			button: "重置",
		},
	},
} satisfies BaseTranslation;

export default zh;
