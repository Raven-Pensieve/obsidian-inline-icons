import {
	DEFAULT_PREFIX,
	formatCodeSpan,
	formatTokenBody,
	normalizePrefix,
	parseTokenBody,
	scanBareTokens,
} from "../src/syntax/grammar";

describe("parseTokenBody", () => {
	it("解析单段形式", () => {
		expect(parseTokenBody("icon:sun")).toEqual({
			source: null,
			name: "sun",
			modifiers: [],
		});
	});

	it.each([
		["icon:lucide:sun", "lucide", "sun"],
		["icon:ci:my-logo", "ci", "my-logo"],
		["icon:mdi:home", "mdi", "home"],
	])("解析两段形式 %s", (body, source, name) => {
		expect(parseTokenBody(body)).toEqual({ source, name, modifiers: [] });
	});

	it("来源段小写化，名字段保留大小写", () => {
		expect(parseTokenBody("icon:CI:MyLogo")).toEqual({
			source: "ci",
			name: "MyLogo",
			modifiers: [],
		});
	});

	it("前缀比较忽略大小写（移动端键盘会自动首字母大写）", () => {
		expect(parseTokenBody("Icon:sun")?.name).toBe("sun");
		expect(parseTokenBody("ICON:sun")?.name).toBe("sun");
	});

	it("中文输入法的全角冒号折成半角", () => {
		expect(parseTokenBody("icon：sun")).toEqual({
			source: null,
			name: "sun",
			modifiers: [],
		});
		expect(parseTokenBody("icon：mdi：home")).toEqual({
			source: "mdi",
			name: "home",
			modifiers: [],
		});
	});

	it("前缀可配置，默认前缀此时不再生效", () => {
		const options = { prefix: "ico" };
		expect(parseTokenBody("ico:sun", options)?.name).toBe("sun");
		expect(parseTokenBody("icon:sun", options)).toBeNull();
	});

	it("空白前缀回退到默认值", () => {
		expect(normalizePrefix("  ")).toBe(DEFAULT_PREFIX);
		expect(parseTokenBody("icon:sun", { prefix: "" })?.name).toBe("sun");
	});

	it("M1 解析修饰符但不解释语义", () => {
		expect(parseTokenBody("icon:lucide:sun,1.5em,#e5a50a")).toEqual({
			source: "lucide",
			name: "sun",
			modifiers: ["1.5em", "#e5a50a"],
		});
	});

	it("忽略空修饰符段，容忍尾随逗号", () => {
		expect(parseTokenBody("icon:sun,")?.modifiers).toEqual([]);
		expect(parseTokenBody("icon:sun, 1em , ")?.modifiers).toEqual(["1em"]);
	});

	it.each([
		["", "空串"],
		["icon", "只有前缀"],
		["icon:", "空名字"],
		["sun", "没有前缀"],
		["iconsun", "缺冒号"],
		["icon:a:b:c", "三段以上不猜"],
		["icon:sun sun", "名字里有空格"],
		["icon:变量", "非 ASCII 名字"],
		["icon:sun/moon", "名字含非法字符"],
		["INPUT[foo]", "别的插件的记号"],
		["icon::sun", "空来源段"],
	])("拒绝 %s（%s）", (body) => {
		expect(parseTokenBody(body)).toBeNull();
	});

	it("拒绝超长输入（挡住病态回溯）", () => {
		expect(parseTokenBody(`icon:${"a".repeat(65)}`)).toBeNull();
		expect(parseTokenBody(`icon:sun,${"a".repeat(200)}`)).toBeNull();
	});

	it("两侧空白无所谓，内部空白不行", () => {
		expect(parseTokenBody("  icon:sun  ")?.name).toBe("sun");
		expect(parseTokenBody("icon: sun")).toBeNull();
	});
});

describe("formatTokenBody / formatCodeSpan", () => {
	it("反引号由插件补，这是 P2 的核心", () => {
		expect(
			formatCodeSpan({ source: null, name: "sun", modifiers: [] }),
		).toBe("`icon:sun`");
		expect(
			formatCodeSpan({ source: "mdi", name: "home", modifiers: [] }),
		).toBe("`icon:mdi:home`");
	});

	it("带上自定义前缀与修饰符", () => {
		expect(
			formatTokenBody(
				{ source: "lucide", name: "sun", modifiers: ["1em"] },
				{ prefix: "ico" },
			),
		).toBe("ico:lucide:sun,1em");
	});

	it("解析与格式化互为逆运算", () => {
		for (const body of [
			"icon:sun",
			"icon:ci:my-logo",
			"icon:mdi:home",
			"icon:lucide:sun,1.5em",
		]) {
			const token = parseTokenBody(body);
			expect(token).not.toBeNull();
			expect(formatTokenBody(token!)).toBe(body);
		}
	});
});

describe("scanBareTokens（默认关闭的逃生开关）", () => {
	it("命中正文里的裸记号并给出位置", () => {
		const text = "今天 icon:sun 很好";
		expect(scanBareTokens(text)).toEqual([
			{
				start: 3,
				end: 11,
				raw: "icon:sun",
				token: { source: null, name: "sun", modifiers: [] },
			},
		]);
	});

	it("一行里多个记号都命中", () => {
		expect(scanBareTokens("icon:sun 和 icon:mdi:home").map((m) => m.raw))
			.toEqual(["icon:sun", "icon:mdi:home"]);
	});

	it("尾随标点不吃进名字", () => {
		expect(scanBareTokens("提醒我 icon:alarm-clock。")[0]).toMatchObject({
			raw: "icon:alarm-clock",
		});
	});

	it("左边界：贴着名字字符或反引号时不命中", () => {
		expect(scanBareTokens("myicon:sun")).toEqual([]);
		expect(scanBareTokens("`icon:sun`")).toEqual([]);
		expect(scanBareTokens("a:icon:sun")).toEqual([]);
	});

	it("C1 的已知代价：icon:sunny 整段当成名字 sunny", () => {
		expect(scanBareTokens("icon:sunny")[0].token.name).toBe("sunny");
	});
});
