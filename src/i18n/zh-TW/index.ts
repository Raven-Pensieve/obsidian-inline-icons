import type { BaseTranslation } from '../i18n-types'

const zh_TW = {
	common: {
		add: "新增",
		delete: "刪除",
		reset: "重設",
		save: "儲存",
		cancel: "取消",
		confirm: "確定",
		moveUp: "上移",
		moveDown: "下移",
	},
	settings: {
		syntax: {
			name: "語法",
			desc: "記號長什麼樣，以及是否渲染裸形式",
			prefix: {
				name: "前綴詞",
				desc: "記號形如 `<前綴>:sun`。改前綴會讓已經寫進筆記的舊記號失效，請謹慎",
				invalid: "只能用字母、數字、底線與連字號，長度 1-16",
			},
			renderBareToken: {
				name: "渲染裸形式",
				desc: "連正文裡沒有反引號的 icon:sun 也渲染。它會與正文文字搶記號（icon:sunny 會整段當成名稱），預設關閉",
			},
		},
		render: {
			name: "渲染",
			desc: "兩條渲染管線各自的開關",
			readingMode: {
				name: "閱讀模式",
				desc: "在閱讀模式、內嵌與懸浮預覽裡渲染記號",
			},
			livePreview: {
				name: "即時預覽",
				desc: "在即時預覽裡渲染記號；游標移進記號時會露出原文。原始碼模式一律只顯示原文",
			},
		},
		suggest: {
			name: "補全",
			desc: "輸入記號的兩條路徑，反引號一律由外掛補上",
			enabled: {
				name: "輸入時彈出候選",
				desc: "敲前綴或輸入別名時彈出圖示候選，Enter 整段寫入含反引號的記號",
			},
			alias: {
				name: "輸入別名",
				desc: "敲「別名 + 冒號 + 幾個字母」就能彈出候選。這個別名只存在於補全裡，不會寫進檔案",
				invalid: "只能用字母、數字、底線與連字號，長度 1-8",
			},
			maxResults: {
				name: "候選數量上限",
				desc: "裝了圖示包後可選圖示可達上萬個，清單需要截斷",
			},
		},
		reset: {
			name: "重設全部設定",
			desc: "把所有設定恢復為預設值",
			button: "重設",
		},
	},
} satisfies BaseTranslation;

export default zh_TW;
