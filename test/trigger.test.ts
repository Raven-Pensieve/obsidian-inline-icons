import { matchTrigger, type TriggerMatch } from "../src/input/trigger";

const OPTIONS = { prefix: "icon", alias: "i" };

/** 用 `|` 标出光标位置，省得手数列号。 */
function at(lineWithCaret: string, options = OPTIONS): TriggerMatch | null {
	const cursorCh = lineWithCaret.indexOf("|");
	if (cursorCh < 0) throw new Error("测试用例里要用 | 标出光标位置");
	const line = lineWithCaret.replace("|", "");
	return matchTrigger(line, cursorCh, options);
}

/** 被替换掉的那一段原文，用来验证 start/end 切得对不对。 */
function replaced(lineWithCaret: string, options = OPTIONS): string | null {
	const match = at(lineWithCaret, options);
	if (match === null) return null;
	return lineWithCaret.replace("|", "").slice(match.start, match.end);
}

describe("正在敲一个新记号", () => {
	it("输入别名：i:su", () => {
		expect(at("i:su|")).toEqual({
			start: 0,
			end: 4,
			source: null,
			query: "su",
		});
	});

	it("全写前缀：icon:su", () => {
		expect(at("icon:su|")).toMatchObject({ source: null, query: "su" });
	});

	it("句子中间也能触发，只吃记号那一段", () => {
		expect(replaced("今天 icon:su| 很好")).toBe("icon:su");
	});

	it("光秃秃一个 icon: 就弹（不必再猜一个字母）", () => {
		expect(at("icon:|")).toEqual({
			start: 0,
			end: 5,
			source: null,
			query: "",
		});
		expect(replaced("今天 icon:| 很好")).toBe("icon:");
	});

	it("单字符别名光秃秃一个冒号不弹（英文提纲 `I: Introduction`）", () => {
		expect(at("i:|")).toBeNull();
		// 敲了字母、或写了来源段就不受此限
		expect(at("i:s|")).toMatchObject({ query: "s" });
		expect(at("i:ci:|")).toMatchObject({ source: "ci", query: "" });
	});

	it("两字以上的自定义别名光秃秃一个冒号也弹", () => {
		expect(at("ii:|", { prefix: "icon", alias: "ii" })).toMatchObject({
			source: null,
			query: "",
		});
	});

	it("全角冒号（中文输入法）", () => {
		expect(at("icon：su|")).toMatchObject({ source: null, query: "su" });
		expect(at("icon：mdi：ho|")).toMatchObject({
			source: "mdi",
			query: "ho",
		});
	});

	it("自定义前缀与别名", () => {
		const options = { prefix: "ico", alias: "ii" };
		expect(at("ico:su|", options)).toMatchObject({ query: "su" });
		expect(at("ii:su|", options)).toMatchObject({ query: "su" });
		expect(at("icon:su|", options)).toBeNull();
	});

	it("中文 id 片段能触发（用户 SVG 的 id 取自文件名）", () => {
		expect(at("icon:我的|")).toMatchObject({
			source: null,
			query: "我的",
		});
		expect(replaced("今天 icon:CI-我的图标| 很好")).toBe("icon:CI-我的图标");
	});

	it("完整注册 id 也能一路敲下去", () => {
		expect(at("icon:CI-mdi-outlined-1k|")).toMatchObject({
			source: null,
			query: "CI-mdi-outlined-1k",
		});
		expect(at("icon:lucide-sun|")).toMatchObject({
			query: "lucide-sun",
		});
	});
});

describe("写了来源段", () => {
	it("icon:ci: 立刻弹出该来源全部图标（空 query）", () => {
		expect(at("icon:ci:|")).toEqual({
			start: 0,
			end: 8,
			source: "ci",
			query: "",
		});
	});

	it("icon:lucide: 同理", () => {
		expect(at("icon:lucide:|")).toMatchObject({
			source: "lucide",
			query: "",
		});
	});

	it("来源段 + 名字片段", () => {
		expect(at("icon:mdi:ho|")).toMatchObject({
			source: "mdi",
			query: "ho",
		});
	});

	it("来源段小写化", () => {
		expect(at("icon:CI:|")).toMatchObject({ source: "ci" });
	});

	it("别名也能带来源段", () => {
		expect(at("i:mdi:ho|")).toMatchObject({ source: "mdi", query: "ho" });
	});
});

describe("不该触发的情形", () => {
	it.each([
		["|", "空行"],
		["hello |", "刚敲了空格"],
		["myicon:su|", "贴在别的词后面"],
		["中文icon:su|", "贴在中文后面"],
		["icon-su|", "不是冒号"],
	])("%s（%s）", (lineWithCaret) => {
		expect(at(lineWithCaret)).toBeNull();
	});
});

describe("反引号", () => {
	it("用户自己敲了开反引号：一并吃进替换范围", () => {
		expect(replaced("`icon:su|")).toBe("`icon:su");
	});

	it("自动配对出的一对反引号：两侧都吃进来", () => {
		expect(replaced("`icon:su|`")).toBe("`icon:su`");
	});

	it("光标落在已存在的完整记号里：整对反引号都在替换范围内", () => {
		const match = at("`icon:m|di:home`");
		expect(match).toEqual({
			start: 0,
			end: 15,
			source: "mdi",
			query: "home",
		});
		expect(replaced("`icon:m|di:home`")).toBe("`icon:mdi:home`");
	});

	it("已存在的记号在句子中间", () => {
		expect(replaced("今天 `icon:su|n` 很好")).toBe("`icon:sun`");
	});

	it("已存在的记号里写了别名形态也认", () => {
		expect(replaced("`i:su|n`")).toBe("`i:sun`");
	});
});
