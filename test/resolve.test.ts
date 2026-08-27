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

describe("catalog", () => {
	const resolver = resolverFor(WITH_CUSTOM_ICONS);

	it("展示名去掉注册前缀，并标出来源", () => {
		const catalog = resolver.catalog();
		expect(catalog).toHaveLength(WITH_CUSTOM_ICONS.length);
		expect(catalog).toContainEqual({
			id: "lucide-sun",
			label: "sun",
			source: "builtin",
		});
		expect(catalog).toContainEqual({
			id: "CI-mdi-home",
			label: "mdi-home",
			source: "custom-icons",
		});
	});

	it("惰性建立且缓存，invalidate 后重建", () => {
		const getIconIds = jest.fn(() => [...BUILTIN_ONLY]);
		const lazy = new IconResolver(getIconIds);

		lazy.catalog();
		lazy.catalog();
		expect(getIconIds).toHaveBeenCalledTimes(1);

		lazy.invalidate();
		lazy.catalog();
		expect(getIconIds).toHaveBeenCalledTimes(2);
	});
});

describe("catalogFor：写了来源段之后只列那个来源", () => {
	const resolver = resolverFor(WITH_CUSTOM_ICONS);
	const labelsOf = (source: string | null) =>
		resolver
			.catalogFor(source)
			.map((candidate) => candidate.label)
			.sort();

	it("ci: 列全部用户 SVG，label 是 CI- 之后的整段", () => {
		expect(labelsOf("ci")).toEqual([
			"lucide-sun-medium",
			"mdi-account-circle",
			"mdi-home",
			"my-logo",
			"ph-home",
		]);
	});

	it("lucide: 内置 + CI-lucide-* 图标包，label 各自去掉前缀", () => {
		expect(labelsOf("lucide")).toEqual([
			"alarm-clock",
			"home",
			"sun",
			"sun-medium",
		]);
		expect(
			resolver
				.catalogFor("lucide")
				.find((candidate) => candidate.label === "sun-medium"),
		).toEqual({
			id: "CI-lucide-sun-medium",
			label: "sun-medium",
			source: "custom-icons",
		});
	});

	it("lucide: 同名时内置胜出（与解析链的两级回退一致）", () => {
		const withBoth = resolverFor([...WITH_CUSTOM_ICONS, "CI-lucide-sun"]);
		expect(
			withBoth
				.catalogFor("lucide")
				.filter((candidate) => candidate.label === "sun"),
		).toEqual([{ id: "lucide-sun", label: "sun", source: "builtin" }]);
	});

	it("包 id: 只列那个包，label 去掉 CI-<packId>-", () => {
		expect(labelsOf("mdi")).toEqual(["account-circle", "home"]);
		expect(labelsOf("ph")).toEqual(["home"]);
	});

	it("认不出的来源段给空列表（补全自然什么都不显示）", () => {
		expect(resolver.catalogFor("nope")).toEqual([]);
	});

	it("不写来源段就是完整候选池", () => {
		expect(resolver.catalogFor(null)).toEqual(resolver.catalog());
		expect(resolver.catalog()).toHaveLength(WITH_CUSTOM_ICONS.length);
	});

	it("每个来源各自缓存一次，invalidate 一起作废", () => {
		const getIconIds = jest.fn(() => [...WITH_CUSTOM_ICONS]);
		const lazy = new IconResolver(getIconIds);

		lazy.catalogFor("mdi");
		lazy.catalogFor("mdi");
		lazy.catalogFor("ci");
		expect(getIconIds).toHaveBeenCalledTimes(1);

		lazy.invalidate();
		lazy.catalogFor("mdi");
		expect(getIconIds).toHaveBeenCalledTimes(2);
	});

	it("列出来的每一条都真能被「来源段 + label」解析回自己", () => {
		for (const source of ["ci", "lucide", "mdi", "ph"]) {
			for (const candidate of resolver.catalogFor(source)) {
				expect(
					resolver.resolve(token(`icon:${source}:${candidate.label}`)),
				).toBe(candidate.id);
			}
		}
	});
});

describe("tokenFor：补全写进文件的形态", () => {
	const resolver = resolverFor(WITH_CUSTOM_ICONS);

	it("取最短形态，并且带上那一对反引号", () => {
		expect(resolver.tokenFor("lucide-sun")).toBe("`icon:sun`");
		expect(resolver.tokenFor("CI-my-logo")).toBe("`icon:my-logo`");
	});

	it("名字被别处抢先时退一步钉死来源", () => {
		// 用户导入了一个也叫 sun 的 SVG：单段的 icon:sun 会解析到内置的 lucide-sun，
		// 所以这个用户 SVG 必须写成钉死形态才能指到它自己
		const withCollision = resolverFor([
			...WITH_CUSTOM_ICONS,
			"CI-sun",
		]);
		expect(withCollision.tokenFor("CI-sun")).toBe("`icon:ci:sun`");
		expect(withCollision.resolve(token("icon:ci:sun"))).toBe("CI-sun");
		expect(withCollision.resolve(token("icon:sun"))).toBe("lucide-sun");
	});

	it("包图标的完整 body 不与内置撞名，所以仍是最短形态", () => {
		expect(resolver.tokenFor("CI-mdi-home")).toBe("`icon:mdi-home`");
		expect(resolver.resolve(token("icon:mdi-home"))).toBe("CI-mdi-home");
	});

	it("写出来的记号一定解析回同一个 id（往返校验）", () => {
		for (const id of WITH_CUSTOM_ICONS) {
			const body = resolver.tokenFor(id).slice(1, -1);
			expect(resolver.resolve(token(body))).toBe(id);
		}
	});

	it("跟随自定义前缀", () => {
		expect(resolver.tokenFor("lucide-sun", { prefix: "ico" })).toBe(
			"`ico:sun`",
		);
	});

	it("用户自己写了来源段就保留它，不改写成更短的形态", () => {
		expect(
			resolver.tokenFor("CI-mdi-home", {}, { source: "mdi", name: "home" }),
		).toBe("`icon:mdi:home`");
		expect(
			resolver.tokenFor("CI-my-logo", {}, { source: "ci", name: "my-logo" }),
		).toBe("`icon:ci:my-logo`");
	});

	it("来源段拼不回同一个 id 时忽略它，退回最短形态", () => {
		expect(
			resolver.tokenFor("CI-mdi-home", {}, { source: "ph", name: "home" }),
		).toBe("`icon:mdi-home`");
	});
});
