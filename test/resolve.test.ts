import { parseTokenBody, type IconToken } from "../src/syntax/grammar";
import { IconResolver } from "../src/syntax/resolve";

/** 只装本插件时的注册表：Obsidian 内置图标，没有任何 CI-*。 */
const BUILTIN_ONLY = ["lucide-sun", "lucide-alarm-clock", "lucide-home"];

/** 装了 Custom Icons：用户 SVG + 两个图标包。 */
const WITH_CUSTOM_ICONS = [
	...BUILTIN_ONLY,
	"CI-my-logo",
	"CI-mdi-home",
	"CI-mdi-account-circle",
	"CI-ph-home",
	"CI-lucide-sun-medium",
];

/** 语法层与解析层的接缝：测试一律从落盘形态出发，不手搓 IconToken。 */
function token(body: string): IconToken {
	const parsed = parseTokenBody(body);
	if (parsed === null) throw new Error(`不是合法记号: ${body}`);
	return parsed;
}

function resolverFor(ids: readonly string[]): IconResolver {
	return new IconResolver(() => [...ids]);
}

describe("P1 基线：只装本插件", () => {
	const resolver = resolverFor(BUILTIN_ONLY);

	it("内置图标能解析（这是裸装唯一可用的一档）", () => {
		expect(resolver.resolve(token("icon:sun"))).toBe("lucide-sun");
		expect(resolver.resolve(token("icon:alarm-clock"))).toBe(
			"lucide-alarm-clock",
		);
	});

	it("Custom Icons 的记号全部落空 → null，调用方保留原文", () => {
		expect(resolver.resolve(token("icon:ci:my-logo"))).toBeNull();
		expect(resolver.resolve(token("icon:mdi:home"))).toBeNull();
	});

	it("不存在的名字返回 null 而不是抛错", () => {
		expect(resolver.resolve(token("icon:not-a-real-icon"))).toBeNull();
	});
});

describe("装了 Custom Icons", () => {
	const resolver = resolverFor(WITH_CUSTOM_ICONS);

	it("单段解析链的优先级：内置 > 用户 SVG > 图标包", () => {
		// home 同时存在于内置、mdi 包、ph 包
		expect(resolver.resolve(token("icon:home"))).toBe("lucide-home");
		// my-logo 只有用户 SVG 有
		expect(resolver.resolve(token("icon:my-logo"))).toBe("CI-my-logo");
		// account-circle 只有 mdi 包有 → 走后缀索引
		expect(resolver.resolve(token("icon:account-circle"))).toBe(
			"CI-mdi-account-circle",
		);
	});

	it("写完整 id 也能命中（原样那一档）", () => {
		expect(resolver.resolve(token("icon:CI-my-logo"))).toBe("CI-my-logo");
		expect(resolver.resolve(token("icon:lucide-sun"))).toBe("lucide-sun");
	});

	it("ci: 钉死用户 SVG，不回退到图标包", () => {
		expect(resolver.resolve(token("icon:ci:my-logo"))).toBe("CI-my-logo");
		expect(resolver.resolve(token("icon:ci:home"))).toBeNull();
	});

	it("<packId>: 钉死某个包，包与包之间不串味", () => {
		expect(resolver.resolve(token("icon:mdi:home"))).toBe("CI-mdi-home");
		expect(resolver.resolve(token("icon:ph:home"))).toBe("CI-ph-home");
		expect(resolver.resolve(token("icon:mdi:my-logo"))).toBeNull();
	});

	it("lucide: 内置优先、包兜底（M2 放开保留字后的两级回退）", () => {
		expect(resolver.resolve(token("icon:lucide:sun"))).toBe("lucide-sun");
		// sun-medium 内置没有，但被装成了 CI-lucide-* 包图标
		expect(resolver.resolve(token("icon:lucide:sun-medium"))).toBe(
			"CI-lucide-sun-medium",
		);
	});

	it("后缀索引不会把 packId 段本身当成名字", () => {
		expect(resolver.resolve(token("icon:mdi"))).toBeNull();
	});
});

describe("缓存与失效", () => {
	it("同一记号只查一次注册表", () => {
		const getIconIds = jest.fn(() => [...BUILTIN_ONLY]);
		const resolver = new IconResolver(getIconIds);

		resolver.resolve(token("icon:sun"));
		resolver.resolve(token("icon:sun"));
		resolver.resolve(token("icon:home"));

		expect(getIconIds).toHaveBeenCalledTimes(1);
	});

	it("解析失败的结果也缓存（否则每次渲染都要重扫）", () => {
		const getIconIds = jest.fn(() => [...BUILTIN_ONLY]);
		const resolver = new IconResolver(getIconIds);

		expect(resolver.resolve(token("icon:ci:my-logo"))).toBeNull();
		expect(resolver.resolve(token("icon:ci:my-logo"))).toBeNull();
		expect(getIconIds).toHaveBeenCalledTimes(1);
	});

	it("invalidate 后能看到新装的图标包（不必重启 Obsidian）", () => {
		let ids = [...BUILTIN_ONLY];
		const resolver = new IconResolver(() => ids);

		expect(resolver.resolve(token("icon:ci:my-logo"))).toBeNull();

		ids = [...WITH_CUSTOM_ICONS];
		expect(resolver.resolve(token("icon:ci:my-logo"))).toBeNull(); // 仍是缓存
		resolver.invalidate();
		expect(resolver.resolve(token("icon:ci:my-logo"))).toBe("CI-my-logo");
	});
});

describe("sourceOf", () => {
	it("按前缀分组，供补全显示来源", () => {
		expect(IconResolver.sourceOf("lucide-sun")).toBe("builtin");
		expect(IconResolver.sourceOf("CI-mdi-home")).toBe("custom-icons");
	});
});
