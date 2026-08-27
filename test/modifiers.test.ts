import { parseTokenBody } from "../src/syntax/grammar";
import {
	EMPTY_ICON_STYLE,
	parseModifiers,
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
	])("%s", (modifier, expected) => {
		expect(parseModifiers([modifier]).size).toBe(expected);
	});

	it.each([
		["%", "50%"],
		["超长数字", "1234em"],
		["小数超三位", "1.234em"],
		["病态指数", "1e999"],
		["带空格", "1.5 em"],
		["不认的单位", "1vw"],
		["负数", "-1em"],
		["裸数字（单位必须写出来，见下一条）", "2"],
	])("不认 %s", (_why, modifier) => {
		expect(parseModifiers([modifier]).size).toBeNull();
	});

	it("裸数字不算尺寸：否则写错的颜色函数会静默改尺寸", () => {
		// `icon:sun,rgb(1,2,3)` 被语法层切成 rgb(1 / 2 / 3)，
		// 若裸数字算尺寸，中间那个 2 就把图标放大到两倍——用户完全看不出为什么
		expect(styleOf("icon:sun,rgb(1,2,3)")).toEqual(EMPTY_ICON_STYLE);
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
	])("不认 %s", (_why, modifier) => {
		expect(parseModifiers([modifier]).color).toBeNull();
	});

	it("逗号写法的颜色函数天然引用不了：逗号在语法层就把它切开了", () => {
		// 用户写 `icon:sun,rgb(1,2,3)`，语法层切成三段，没有一段是合法颜色
		expect(styleOf("icon:sun,rgb(1,2,3)").color).toBeNull();
		// 空格写法是 CSS Color 4 的推荐形态，能用
		expect(styleOf("icon:sun,rgb(1 2 3)").color).toBe("rgb(1 2 3)");
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
		expect(styleOf("icon:lucide-sun,1vw,red")).toEqual({
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
