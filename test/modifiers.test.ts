import { parseTokenBody } from "../src/syntax/grammar";
import {
	classifyModifier,
	EMPTY_ICON_STYLE,
	findColorModifier,
	parseModifiers,
	replaceColorModifier,
	type IconStyle,
} from "../src/syntax/modifiers";

/** 从完整记号体走一遍，验证「语法层切分 + 本模块解释」这条链是通的。 */
function styleOf(body: string): IconStyle {
	const token = parseTokenBody(body);
	if (token === null) throw new Error(`本该是合法记号：${body}`);
	return parseModifiers(token.modifiers);
}

describe("尺寸", () => {
	it.each([
		["1.5em", "1.5em"],
		["20px", "20px"],
		["1rem", "1rem"],
		["12pt", "12pt"],
		["2ch", "2ch"],
		["3ex", "3ex"],
		// 省略整数位
		[".5em", ".5em"],
		// 视口相对（含动态视口那三族，移动端才有意义）
		["3vw", "3vw"],
		["2vmin", "2vmin"],
		["4dvh", "4dvh"],
		["5svw", "5svw"],
		["6lvh", "6lvh"],
		// 容器查询相对
		["10cqw", "10cqw"],
		// 字体相对的 root 版本与新单位
		["1lh", "1lh"],
		["2rlh", "2rlh"],
		["1cap", "1cap"],
		["1ic", "1ic"],
		// 绝对
		["1in", "1in"],
		["10mm", "10mm"],
		["3pc", "3pc"],
	])("%s", (modifier, expected) => {
		expect(parseModifiers([modifier]).size).toBe(expected);
	});

	it.each([
		["%（相对包含块宽度，写了等于没写）", "50%"],
		["超长数字", "1234em"],
		["小数超三位", "1.234em"],
		["病态指数", "1e999"],
		["带空格", "1.5 em"],
		["编出来的单位", "1qux"],
		["负数", "-1em"],
		["裸数字（单位必须写出来，见下一条）", "2"],
	])("不认 %s", (_why, modifier) => {
		expect(parseModifiers([modifier]).size).toBeNull();
	});

	it("裸数字仍然不算尺寸：`2` 读不出单位是 em 还是 px", () => {
		// 原先的理由是「会被切碎的 rgb(1,2,3) 撞上」，括号感知切分后那条压力已经没了，
		// 但结论不变——写 `2em` 只多两个字符，而 `2` 没有自明含义
		expect(parseModifiers(["2"])).toEqual(EMPTY_ICON_STYLE);
	});

	it.each([
		["calc(1em + 2px)", "calc(1em + 2px)"],
		["clamp(1em, 2vw, 2em)", "clamp(1em, 2vw, 2em)"],
		["min(1em, 20px)", "min(1em, 20px)"],
		["max(1em, 3vw)", "max(1em, 3vw)"],
	])("数学函数 %s", (modifier, expected) => {
		// 逗号在括号内，所以这些段能整段抵达本模块（见 grammar.ts 的 splitTopLevel）
		expect(styleOf(`icon:sun,${modifier}`).size).toBe(expected);
	});

	/*
	 * 函数实参里的**分组括号**。
	 *
	 * `calc((1em + 2px) * 2)` 里那对括号是 `calc()` 语法的一部分（先加后乘），
	 * 而 `callsIn` 曾经要求每个 `(` 前面都有函数名，于是这类合法写法整段被判掉。
	 * 表现是最难查的那种：修饰符认不出来是**静默忽略**，用户只看到尺寸没生效。
	 *
	 * 顶层的裸括号组仍然不认（见「颜色」那张不认表里的 `(1em)`）——
	 * 放行只发生在函数实参内部。
	 */
	it.each([
		["先加后乘", "calc((1em + 2px) * 2)"],
		["clamp 的中项加括号", "clamp(1em, (2vw + 1px), 2em)"],
		["min 的实参加括号", "min((1em),2em)"],
		["嵌套两层分组", "calc(((1em)))"],
	])("函数实参里的分组括号：%s", (_why, modifier) => {
		expect(parseModifiers([modifier]).size).toBe(modifier);
	});

	it("分组括号不绕过函数名白名单", () => {
		// 分组括号不引入新函数名，所以 url 照样会被收集并拒绝——
		// 这是放行分组括号时唯一需要担心的事
		expect(parseModifiers(["calc((url(https://evil/x)))"])).toEqual(
			EMPTY_ICON_STYLE,
		);
		expect(parseModifiers(["(url(https://evil/x))"])).toEqual(
			EMPTY_ICON_STYLE,
		);
		// 空的分组也不认
		expect(parseModifiers(["calc(())"])).toEqual(EMPTY_ICON_STYLE);
		// 括号仍然必须配平
		expect(parseModifiers(["calc((1em)"])).toEqual(EMPTY_ICON_STYLE);
	});
});

describe("颜色", () => {
	it.each([
		["#e5a50a", "#e5a50a"],
		["#fff", "#fff"],
		["#ffff", "#ffff"],
		["#12345678", "#12345678"],
		["red", "red"],
		["rebeccapurple", "rebeccapurple"],
		["currentColor", "currentColor"],
		["rgb(255 0 0)", "rgb(255 0 0)"],
		["oklch(0.7 0.1 60)", "oklch(0.7 0.1 60)"],
		["var(--text-accent)", "var(--text-accent)"],
		["var(--x, red)", "var(--x, red)"],
		// CSS Color 4/5 的其余常用形态
		["hwb(30 0% 0%)", "hwb(30 0% 0%)"],
		["lab(50% 40 59)", "lab(50% 40 59)"],
		["lch(50% 70 40)", "lch(50% 70 40)"],
		["oklab(0.4 0.1 0.1)", "oklab(0.4 0.1 0.1)"],
		["color(display-p3 1 0 0)", "color(display-p3 1 0 0)"],
		// alpha 的斜杠写法（`/` 不能被安全闸挡掉，只挡 `/*`）
		["rgb(255 0 0 / 50%)", "rgb(255 0 0 / 50%)"],
		["oklch(0.7 0.1 60 / 0.5)", "oklch(0.7 0.1 60 / 0.5)"],
	])("%s", (modifier, expected) => {
		expect(parseModifiers([modifier]).color).toBe(expected);
	});

	it("`--x` 是简写，自动包成 var()——主题变量是主路径", () => {
		expect(parseModifiers(["--text-accent"]).color).toBe(
			"var(--text-accent)",
		);
	});

	it.each([
		["位数不对的十六进制", "#ff"],
		["非十六进制字符", "#gggggg"],
		["带分号想注入", "red;color:blue"],
		["带花括号想注入", "red}"],
		["空 var()", "var()"],
		["空 rgb()", "rgb()"],
		["两张表都没有的函数名", "attr(data-x)"],
		["裸括号组（`(` 前面没有函数名）", "(1em)"],
		["拼接一个网络请求", "rgb(1 2 3) url(https://evil/x)"],
		["!important", "red !important"],
		["带引号", "'red'"],
		["反斜杠转义（`\\3b` 是分号）", "red\\3b color:blue"],
		["注释拼接", "red/*x*/"],
		["混用两类函数", "calc(oklch(0.7 0.1 60))"],
	])("不认 %s", (_why, modifier) => {
		expect(parseModifiers([modifier])).toEqual(EMPTY_ICON_STYLE);
	});

	it("逗号写法的颜色函数现在能用了（括号感知切分）", () => {
		// 这是本次改动的核心：过去 `rgb(1,2,3)` 被切成三段，没有一段是合法颜色
		expect(styleOf("icon:sun,rgb(1,2,3)").color).toBe("rgb(1,2,3)");
		expect(styleOf("icon:sun,rgb(255, 0, 0)").color).toBe("rgb(255, 0, 0)");
		expect(styleOf("icon:sun,hsl(30, 100%, 50%)").color).toBe(
			"hsl(30, 100%, 50%)",
		);
		// 空格写法（CSS Color 4 的推荐形态）继续能用，一字不变
		expect(styleOf("icon:sun,rgb(1 2 3)").color).toBe("rgb(1 2 3)");
	});

	it("必须带逗号才能写的那两个函数", () => {
		// color-mix / light-dark 没有空格写法，所以在旧的裸 split(",") 下根本写不出来
		expect(
			styleOf("icon:sun,color-mix(in oklch, red 50%, blue)").color,
		).toBe("color-mix(in oklch, red 50%, blue)");
		expect(styleOf("icon:sun,light-dark(#eee, #222)").color).toBe(
			"light-dark(#eee, #222)",
		);
	});

	it("嵌套 var() 与括号内的多个逗号", () => {
		const body =
			"icon:sun,color-mix(in oklch, var(--interactive-accent) 60%, var(--background-primary))";
		expect(styleOf(body).color).toBe(
			"color-mix(in oklch, var(--interactive-accent) 60%, var(--background-primary))",
		);
	});
});

describe("组合与容错", () => {
	it("顺序随意", () => {
		const expected = { color: "red", size: "1.5em" };
		expect(styleOf("icon:lucide-sun,1.5em,red")).toEqual(expected);
		expect(styleOf("icon:lucide-sun,red,1.5em")).toEqual(expected);
	});

	it("同类写了多次则后者胜出，与 CSS 层叠直觉一致", () => {
		expect(parseModifiers(["1em", "2em"]).size).toBe("2em");
		expect(parseModifiers(["red", "#fff"]).color).toBe("#fff");
	});

	it("认不出的段静默忽略，图标照常显示", () => {
		expect(styleOf("icon:lucide-sun,ならい")).toEqual(EMPTY_ICON_STYLE);
		// 一段不认不影响另一段
		expect(styleOf("icon:lucide-sun,1qq,red")).toEqual({
			color: "red",
			size: null,
		});
	});

	it("没写修饰符时复用同一个常量对象（渲染热路径上每个记号都会走到）", () => {
		expect(parseModifiers([])).toBe(EMPTY_ICON_STYLE);
	});

	it("尺寸与颜色的模式不重叠，互不抢占", () => {
		// 带单位的长度只会被判成尺寸，不会漏进颜色关键字
		expect(parseModifiers(["2em"])).toEqual({ color: null, size: "2em" });
		// 纯字母只会被判成颜色
		expect(parseModifiers(["red"])).toEqual({ color: "red", size: null });
	});
});

describe("变量消歧（第 ④ 层）", () => {
	it("名字像尺寸的变量判成尺寸——这是过去那个隐蔽 bug", () => {
		// 旧实现里 asSize 不认变量、asColor 认，于是尺寸变量被写进 --ii-icon-color，
		// 浏览器丢掉这个无效颜色 → 图标毫无变化，而记号看起来完全正确
		expect(parseModifiers(["--icon-l"])).toEqual({
			color: null,
			size: "var(--icon-l)",
		});
		expect(classifyModifier("--icon-xl")).toBe("size");
		expect(classifyModifier("--font-ui-medium")).toBe("size");
		expect(classifyModifier("--size-4-2")).toBe("size");
		expect(classifyModifier("--radius-m")).toBe("size");
		expect(classifyModifier("--line-height-tight")).toBe("size");
	});

	it("以 -size / -width / -height 收尾的也算尺寸", () => {
		expect(classifyModifier("--nav-item-size")).toBe("size");
		expect(classifyModifier("--checkbox-size")).toBe("size");
		expect(classifyModifier("--border-width")).toBe("size");
	});

	it("其余变量仍然判成颜色（主题用户的主路径，旧行为不变）", () => {
		expect(parseModifiers(["--text-accent"])).toEqual({
			color: "var(--text-accent)",
			size: null,
		});
		expect(classifyModifier("--color-red")).toBe("color");
		expect(classifyModifier("--interactive-accent")).toBe("color");
		// 用户自己的、名字看不出类型的变量：归颜色（未知名字的默认方向）
		expect(classifyModifier("--my-thing")).toBe("color");
	});

	it("有 fallback 时问 fallback，比名字更确定", () => {
		expect(classifyModifier("var(--x, 1.5em)")).toBe("size");
		expect(classifyModifier("var(--x, red)")).toBe("color");
		// fallback 胜过名字：名字像颜色但 fallback 是长度
		expect(classifyModifier("var(--text-accent, 2em)")).toBe("size");
		// 嵌套 fallback 也能一层层剥出来
		expect(classifyModifier("var(--a, var(--b, 1em))")).toBe("size");
	});

	it("calc(var(--x)) 是名字判不准时的确定逃生口", () => {
		// calc 只在尺寸表里，于是整段不再歧义——哪怕名字看着像颜色
		expect(parseModifiers(["calc(var(--text-accent))"])).toEqual({
			color: null,
			size: "calc(var(--text-accent))",
		});
	});

	it("var() 的完整写法与裸简写判定一致", () => {
		expect(classifyModifier("var(--icon-l)")).toBe(
			classifyModifier("--icon-l"),
		);
		expect(classifyModifier("var(--text-accent)")).toBe(
			classifyModifier("--text-accent"),
		);
	});
});

describe("显式类型前缀（第 ① 层）", () => {
	it("size: / color: 点明类型，歧义就没了", () => {
		expect(parseModifiers(["size:--my-len"])).toEqual({
			color: null,
			size: "var(--my-len)",
		});
		expect(parseModifiers(["color:--my-color"])).toEqual({
			color: "var(--my-color)",
			size: null,
		});
	});

	it("能把名字判反的变量掰回来（两个方向都要能）", () => {
		// 名字像尺寸，但用户说它是颜色
		expect(classifyModifier("color:--icon-l")).toBe("color");
		// 名字像颜色，但用户说它是尺寸
		expect(classifyModifier("size:--text-accent")).toBe("size");
	});

	it("前缀不区分大小写，冒号两侧可有空格", () => {
		expect(classifyModifier("SIZE:1.5em")).toBe("size");
		expect(classifyModifier("size : 1.5em")).toBe("size");
	});

	it("类型点明后允许跨类函数（light-dark 拿来当尺寸）", () => {
		expect(parseModifiers(["size:light-dark(1em, 2em)"])).toEqual({
			color: null,
			size: "light-dark(1em, 2em)",
		});
	});

	it("前缀剥掉之后的值仍要过校验，不是无条件放行", () => {
		expect(classifyModifier("size:ならい")).toBeNull();
		expect(classifyModifier("size:red")).toBeNull();
		expect(classifyModifier("color:1.5em")).toBeNull();
		// 安全闸在前缀之前就跑过了
		expect(classifyModifier("color:url(https://evil/x)")).toBeNull();
		expect(classifyModifier("size:red;color:blue")).toBeNull();
	});
});

describe("classifyModifier", () => {
	it.each([
		["1.5em", "size"],
		["20px", "size"],
		["#ab05cc", "color"],
		["red", "color"],
		["--text-accent", "color"],
		["var(--x, red)", "color"],
		["rgb(1 2 3)", "color"],
	])("%s → %s", (modifier, kind) => {
		expect(classifyModifier(modifier)).toBe(kind);
	});

	it("认不出的段返回 null（改写时要原样保留）", () => {
		expect(classifyModifier("ならい")).toBeNull();
		expect(classifyModifier("1zz")).toBeNull();
		expect(classifyModifier("2")).toBeNull();
	});

	it("判据与 parseModifiers 完全一致（共用 interpretModifier）", () => {
		// 菜单认的和渲染认的必须是同一套，否则会出现「菜单以为这段是颜色、
		// 于是替换掉，而渲染本来根本不认它」。收拢成单一 interpretModifier 之后
		// 这条守卫在结构上已经必然成立，但样本仍然留着——它同时钉住
		// 「size 段一定填 size 字段、color 段一定填 color 字段」这层映射
		for (const modifier of [
			"1.5em",
			"#fff",
			"red",
			"1zz",
			"ならい",
			"2",
			"--icon-l",
			"--text-accent",
			"size:--my-len",
			"rgb(1, 2, 3)",
			"clamp(1em, 2vw, 2em)",
		]) {
			const style = parseModifiers([modifier]);
			const kind = classifyModifier(modifier);
			if (kind === "size") expect(style.size).not.toBeNull();
			else if (kind === "color") expect(style.color).not.toBeNull();
			else expect(style).toEqual(EMPTY_ICON_STYLE);
		}
	});
});

describe("replaceColorModifier", () => {
	it("空数组：加一段颜色", () => {
		expect(replaceColorModifier([], "#123456")).toEqual(["#123456"]);
	});

	it("只有尺寸：尺寸留着，颜色追加", () => {
		expect(replaceColorModifier(["1.5em"], "#123456")).toEqual([
			"1.5em",
			"#123456",
		]);
	});

	it("只有颜色：换掉", () => {
		expect(replaceColorModifier(["#ab05cc"], "#123456")).toEqual([
			"#123456",
		]);
	});

	it("颜色写了两遍：结果只剩一段", () => {
		// 不做「就地替换第一段」——修饰符是「同类后者胜出」，
		// 就地改第一段的话后面那段会继续赢，用户看不到自己选的颜色
		expect(replaceColorModifier(["red", "#ab05cc"], "#123456")).toEqual([
			"#123456",
		]);
	});

	it("认不出的段必须保留（那是用户亲手写的字）", () => {
		expect(replaceColorModifier(["ならい", "#ab05cc"], "#123456")).toEqual([
			"ならい",
			"#123456",
		]);
	});

	it("color = null 删除全部颜色段，其余留着", () => {
		expect(
			replaceColorModifier(["1.5em", "red", "ならい", "#ab05cc"], null),
		).toEqual(["1.5em", "ならい"]);
	});

	it("主题变量与颜色关键字也算颜色段，会被替换掉", () => {
		expect(replaceColorModifier(["--text-accent"], "#123456")).toEqual([
			"#123456",
		]);
		expect(replaceColorModifier(["rebeccapurple"], null)).toEqual([]);
	});

	it("逗号写法的颜色函数现在认得出来，于是会被正确替换而不是并列留下", () => {
		// 改动前 `hsl(30, 100%, 50%)` 会被切成三段、三段都认不出，于是
		// 「换颜色」时它们全部作为「认不出的段」留着，与新颜色并列——
		// 用户看到的是自己选的色，但记号里堆着一串垃圾
		expect(
			replaceColorModifier(["hsl(30, 100%, 50%)"], "#123456"),
		).toEqual(["#123456"]);
		expect(
			replaceColorModifier(["1.5em", "light-dark(#eee, #222)"], null),
		).toEqual(["1.5em"]);
	});

	it("尺寸变量不再被当成颜色段删掉", () => {
		// 成因 B 的回归守卫：`--icon-l` 过去判成颜色，于是「重置颜色」会把
		// 用户的尺寸设定一起删掉
		expect(replaceColorModifier(["--icon-l"], null)).toEqual(["--icon-l"]);
		expect(replaceColorModifier(["--icon-l"], "#123456")).toEqual([
			"--icon-l",
			"#123456",
		]);
	});

	it("不改动入参", () => {
		const input = ["1.5em", "red"];
		replaceColorModifier(input, "#123456");
		expect(input).toEqual(["1.5em", "red"]);
	});

	it("换图标不碰颜色的场景由调用方直接复用原数组，这里只管显式改色", () => {
		// 保留矩阵里 `color === undefined` 那一行不经过本函数（见 iconEdit.ts），
		// 所以本函数永远是「用户显式动了颜色」的语义
		expect(replaceColorModifier(["1.5em", "#ab05cc"], "#123456")).toEqual([
			"1.5em",
			"#123456",
		]);
	});
});

describe("findColorModifier", () => {
	it("取最后一个颜色段——那才是当前生效的（同类后者胜出）", () => {
		expect(findColorModifier(["red", "#ab05cc"])).toBe("#ab05cc");
	});

	it("给的是原始段而不是归一化后的值", () => {
		// parseModifiers 会把 `--x` 归一成 `var(--x)`，而调用方接着要判断
		// 「这是不是 hex」（提供方的色板只吃 #rrggbb）
		expect(findColorModifier(["--text-accent"])).toBe("--text-accent");
		expect(parseModifiers(["--text-accent"]).color).toBe(
			"var(--text-accent)",
		);
	});

	it("没有颜色段时返回 null", () => {
		expect(findColorModifier([])).toBeNull();
		expect(findColorModifier(["1.5em", "ならい"])).toBeNull();
	});
});
