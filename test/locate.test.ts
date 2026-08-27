import { locateTokenAt } from "../src/syntax/locate";

/** 正式前缀 + 输入别名，与运行期一致。 */
const PREFIXES = ["icon", "i"];

/** 用 `|` 标出光标位置，省得手数列号。 */
function at(
	lineWithCaret: string,
	options?: { includeEdges?: boolean },
	prefixes: readonly string[] = PREFIXES,
) {
	const ch = lineWithCaret.indexOf("|");
	if (ch < 0) throw new Error("测试用例里要用 | 标出光标位置");
	return locateTokenAt(lineWithCaret.replace("|", ""), ch, prefixes, options);
}

/** 命中的那一段原文，用来验证 start/end 切得对不对（应当含那对反引号）。 */
function span(
	lineWithCaret: string,
	options?: { includeEdges?: boolean },
): string | null {
	const located = at(lineWithCaret, options);
	if (located === null) return null;
	return lineWithCaret
		.replace("|", "")
		.slice(located.start, located.end);
}

describe("基本命中", () => {
	it("光标在记号内：区间含那对反引号", () => {
		const located = at("`icon:s|un`");
		expect(located).not.toBeNull();
		expect(located?.start).toBe(0);
		expect(located?.end).toBe(10);
		expect(located?.token).toEqual({
			source: null,
			name: "sun",
			modifiers: [],
		});
		expect(span("`icon:s|un`")).toBe("`icon:sun`");
	});

	it("句子中间的记号", () => {
		expect(span("今天 `icon:s|un` 很好")).toBe("`icon:sun`");
	});

	it("带修饰符：原样交回，供改写时保留", () => {
		expect(at("`icon:CI-mdi-outlined-123,#ab0|5cc`")?.token).toEqual({
			source: null,
			name: "CI-mdi-outlined-123",
			modifiers: ["#ab05cc"],
		});
	});

	it("带来源段", () => {
		expect(at("`icon:mdi:ho|me`")?.token).toMatchObject({
			source: "mdi",
			name: "home",
		});
	});

	it("输入别名形态也认（用户可能手写了 `i:sun`）", () => {
		expect(span("`i:s|un`")).toBe("`i:sun`");
	});

	it("前缀优先于别名", () => {
		// 两个都能解析时取前面那个：`icon:sun` 不该被当成别名 `i` 的记号
		expect(at("`icon:s|un`", undefined, ["icon", "i"])?.token.name).toBe(
			"sun",
		);
	});

	it("全角冒号（中文输入法）", () => {
		expect(at("`icon：s|un`")?.token).toMatchObject({ name: "sun" });
	});

	it("中文 id（用户 SVG 的 id 取自文件名）", () => {
		expect(at("`icon:CI-我的|图标`")?.token).toMatchObject({
			name: "CI-我的图标",
		});
	});
});

describe("一行多个行内代码：必须成对配对，不能跨对", () => {
	// `icon:sun` 占 [0,10)，`icon:moon` 占 [15,26)
	const line = "`icon:sun` and `icon:moon`";

	it("各自命中自己那一段", () => {
		expect(span("`icon:s|un` and `icon:moon`")).toBe("`icon:sun`");
		expect(span("`icon:sun` and `icon:m|oon`")).toBe("`icon:moon`");
	});

	it("光标落在两段之间：不命中", () => {
		// lastIndexOf + indexOf 的写法会把前一段的闭反引号与后一段的开反引号
		// 配成一对，于是把中间那段 " and " 当成记号体——这条就是钉住它的
		expect(at("`icon:sun` an|d `icon:moon`")).toBeNull();
		expect(locateTokenAt(line, 12, PREFIXES)).toBeNull();
	});

	it("前一段不是记号时，仍能命中后一段", () => {
		expect(span("`hello` `icon:s|un`")).toBe("`icon:sun`");
	});

	it("相邻两段：端点同时是前一对的 end 与后一对的 start", () => {
		// 前一对（`x`）不是记号，不该让后一对也定位不到
		expect(span("`x`|`icon:sun`", { includeEdges: true })).toBe("`icon:sun`");
		expect(at("`x`|`icon:sun`", { includeEdges: true })?.token).toMatchObject(
			{ name: "sun" },
		);
	});
});

describe("端点判定：includeEdges", () => {
	// 实时预览里记号被折叠成 widget，右键点图标时 caret 落在被替换区间的边界上，
	// 所以菜单那条路径必须开着这个开关
	it("开着时两个端点都算命中", () => {
		expect(span("|`icon:sun`", { includeEdges: true })).toBe("`icon:sun`");
		expect(span("`icon:sun`|", { includeEdges: true })).toBe("`icon:sun`");
	});

	it("默认关闭：端点不算命中（补全那条路径要的语义）", () => {
		expect(at("|`icon:sun`")).toBeNull();
		expect(at("`icon:sun`|")).toBeNull();
	});

	it("开着时紧贴外侧一个字符处也会命中——已知代价", () => {
		// `icon:sun`X 点在 X 上：多出来的只是一个菜单项，
		// 而漏掉「点图标本身」是致命的
		expect(span("`icon:sun`|X", { includeEdges: true })).toBe("`icon:sun`");
	});

	it("开着也不会把光标拽到更远的记号上", () => {
		expect(at("`icon:sun` far away |here", { includeEdges: true })).toBeNull();
	});
});

describe("不该命中的情形", () => {
	it("行内没有反引号", () => {
		expect(at("icon:s|un")).toBeNull();
	});

	it("孤立的开反引号（用户刚敲下第一个）", () => {
		expect(at("`icon:s|un")).toBeNull();
	});

	it("非记号的行内代码", () => {
		expect(at("`hel|lo`")).toBeNull();
	});

	it("代码里写的是别的插件的语法", () => {
		expect(at("`dv.pa|ges()`")).toBeNull();
	});

	it("三段以上的冒号形态（语法层就不猜）", () => {
		expect(at("`icon:a:b|:c`")).toBeNull();
	});

	it("超过记号长度上限的长段", () => {
		const long = "x".repeat(250);
		expect(at(`\`icon:${long.slice(0, 100)}|${long.slice(100)}\``)).toBeNull();
	});

	it("空的行内代码", () => {
		expect(at("``|`")).toBeNull();
	});

	it("前缀不匹配", () => {
		expect(at("`ico|n:sun`", undefined, ["glyph"])).toBeNull();
	});
});
