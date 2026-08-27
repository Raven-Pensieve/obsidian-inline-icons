import type { BaseTranslation } from '../i18n-types'

const zh_TW = {
	settings: {
		syntax: {
			name: "語法",
			desc: "記號長什麼樣",
			prefix: {
				name: "前綴詞",
				desc: "記號形如 `<前綴>:sun`。改前綴會讓已經寫進筆記的舊記號失效，請謹慎",
				invalid: "只能用字母、數字、底線與連字號，長度 1-16",
			},
		},
		suggest: {
			name: "補全",
			desc: "輸入記號的兩條路徑，反引號一律由外掛補上",
			enabled: {
				name: "輸入時彈出候選",
				desc: "敲前綴或輸入別名時彈出圖示候選，Enter 整段寫入含反引號的記號。關掉後仍可使用「插入圖示」命令",
			},
			alias: {
				name: "輸入別名",
				desc: "敲「別名 + 冒號」就能彈出候選。這個別名只存在於補全裡，不會寫進檔案",
				invalid: "只能用字母、數字、底線與連字號，長度 1-8",
			},
		},
	},
	ui: {
		unresolved: "找不到圖示「{name}」",
		sourceBuiltin: "Obsidian 內建",
		sourceCustomIcons: "Custom Icons",
		sourceUserSvg: "我的 SVG",
	},
	commands: {
		insertIcon: {
			name: "插入圖示",
			placeholder: "搜尋圖示…",
		},
		pickIcon: {
			name: "從圖示庫插入圖示",
			unavailable: "未啟用 Custom Icons，改用內建的圖示搜尋",
			unreferenceable: "id「{id}」含冒號、逗號或反引號，寫不進記號",
		},
		reapply: {
			name: "重新渲染本文件的圖示",
		},
	},
} satisfies BaseTranslation;

export default zh_TW;
