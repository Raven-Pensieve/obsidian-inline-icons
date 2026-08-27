import {
	canReference,
	DEFAULT_PREFIX,
	formatCodeSpan,
	formatTokenBody,
	normalizePrefix,
	parseTokenBody,
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

	describe("修饰符区按括号外的逗号切分", () => {
		it("括号内的逗号不切——颜色函数因此能用逗号写法", () => {
			expect(parseTokenBody("icon:sun,rgb(255, 0, 0)")?.modifiers).toEqual([
				"rgb(255, 0, 0)",
			]);
			expect(parseTokenBody("icon:sun,hsl(30, 100%, 50%)")?.modifiers).toEqual(
				["hsl(30, 100%, 50%)"],
			);
		});

		it("括号外的逗号照旧切", () => {
			expect(
				parseTokenBody("icon:sun,rgb(1, 2, 3),1.5em")?.modifiers,
			).toEqual(["rgb(1, 2, 3)", "1.5em"]);
		});

		it("嵌套括号只按最外层的深度算", () => {
			expect(
				parseTokenBody(
					"icon:sun,color-mix(in oklch, var(--a, red) 60%, var(--b))",
				)?.modifiers,
			).toEqual(["color-mix(in oklch, var(--a, red) 60%, var(--b))"]);
		});

		it("括号不配平时余下整段当一段（结果仍是「认不出→忽略」）", () => {
			expect(parseTokenBody("icon:sun,rgb(1,2")?.modifiers).toEqual([
				"rgb(1,2",
			]);
			// 多余的右括号不让深度变负，否则后面的顶层逗号会被永久吞掉
			expect(parseTokenBody("icon:sun,rgb(1,2)),1.5em")?.modifiers).toEqual([
				"rgb(1,2))",
				"1.5em",
			]);
		});

		it("id 段仍按第一个逗号切，不参与括号感知", () => {
			// 用户 SVG 的 id 取自文件名，可能含**不配平**的括号（`CI-a(` 是合法文件名）。
			// 让 id 段参与括号计数就会把后面的修饰符吃进 id，而 id 段不允许逗号，
			// 于是整条记号解析失败——比切碎颜色更糟
			expect(parseTokenBody("icon:CI-a(,red")).toEqual({
				source: null,
				name: "CI-a(",
				modifiers: ["red"],
			});
			expect(parseTokenBody("icon:CI-logo (dark),1.5em")).toEqual({
				source: null,
				name: "CI-logo (dark)",
				modifiers: ["1.5em"],
			});
		});
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
			// 括号内的逗号：切分不断开，拼回去必须逐字相同
			"icon:sun,rgb(255, 0, 0)",
			"icon:sun,color-mix(in oklch, red 50%, blue),1.5em",
			// 括号不配平的病态段同样拼得回去（余下整段当一段）
			"icon:sun,rgb(1,2",
		]) {
			const token = parseTokenBody(body);
			expect(token).not.toBeNull();
			expect(formatTokenBody(token!)).toBe(body);
		}
	});
});
