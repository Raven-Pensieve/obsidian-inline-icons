import {
	canReference,
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
		["INPUT[foo]", "别的插件的记号"],
		["icon::sun", "空来源段"],
	])("拒绝 %s（%s）", (body) => {
		expect(parseTokenBody(body)).toBeNull();
	});

	it("含逗号的 id 引用不了：逗号会被当成修饰符分隔符", () => {
		expect(parseTokenBody("icon:CI-a,b")).toEqual({
			source: null,
			name: "CI-a",
			modifiers: ["b"],
		});
		expect(canReference("CI-a,b")).toBe(false);
	});

	it("id 可以含中文（用户 SVG 的 id 取自文件名）", () => {
		expect(parseTokenBody("icon:CI-我的图标")).toEqual({
			source: null,
			name: "CI-我的图标",
			modifiers: [],
		});
		expect(parseTokenBody("icon:ci:我的图标")).toEqual({
			source: "ci",
			name: "我的图标",
			modifiers: [],
		});
	});

	it("id 可以含空格、点与括号——行内代码的反引号已经给出了边界", () => {
		expect(parseTokenBody("icon:CI-my icon")?.name).toBe("CI-my icon");
		expect(parseTokenBody("icon:CI-logo (dark)")?.name).toBe(
			"CI-logo (dark)",
		);
		expect(parseTokenBody("icon:CI-1.5x")?.name).toBe("CI-1.5x");
	});

	it("每段两侧的空白都 trim 掉", () => {
		expect(parseTokenBody("  icon:sun  ")?.name).toBe("sun");
		expect(parseTokenBody("icon: sun")?.name).toBe("sun");
		expect(parseTokenBody("icon: ci : my-logo ")).toEqual({
			source: "ci",
			name: "my-logo",
			modifiers: [],
		});
	});

	it("拒绝超长输入（挡住病态回溯）", () => {
		expect(parseTokenBody(`icon:${"a".repeat(97)}`)).toBeNull();
		expect(parseTokenBody(`icon:${"a".repeat(96)}`)?.name).toHaveLength(96);
		expect(parseTokenBody(`icon:sun,${"a".repeat(200)}`)).toBeNull();
	});
});

describe("canReference", () => {
	it("含结构字符的 id 引用不了，补全候选池要剔掉它们", () => {
		expect(canReference("lucide-sun")).toBe(true);
		expect(canReference("CI-我的图标")).toBe(true);
		expect(canReference("CI-my icon")).toBe(true);
		expect(canReference("CI-a,b")).toBe(false);
		expect(canReference("CI-a:b")).toBe(false);
		expect(canReference("CI-a`b")).toBe(false);
		expect(canReference(" CI-a")).toBe(false);
		expect(canReference("")).toBe(false);
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

	it("中文 id：有空格分隔时能命中", () => {
		expect(scanBareTokens("看这个 icon:CI-我的图标 好看")[0]).toMatchObject({
			raw: "icon:CI-我的图标",
		});
	});

	it("中文语境下裸形式本就不可靠（这也是它默认关闭的原因）", () => {
		// 紧贴中文时不命中：左边界要求前一个字符不是字母/数字
		expect(scanBareTokens("看这个icon:CI-我的图标")).toEqual([]);
		// 命中时也会把后面的中文一起吃进 id
		expect(scanBareTokens("看 icon:sun很好")[0].token.name).toBe("sun很好");
	});
});
