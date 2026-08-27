import { parseTokenBody, type IconToken } from "../src/syntax/grammar";
import { IconResolver, labelOf } from "../src/syntax/resolve";

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

	it("单段形态：原样 → 内置 → Custom Icons", () => {
		// home 同时存在于内置与两个包，单段只认内置
		expect(resolver.resolve(token("icon:home"))).toBe("lucide-home");
		// 用户 SVG 与图标包都走 CI-<name>，name 就是 CI- 之后的整段
		expect(resolver.resolve(token("icon:my-logo"))).toBe("CI-my-logo");
		expect(resolver.resolve(token("icon:mdi-account-circle"))).toBe(
			"CI-mdi-account-circle",
		);
		expect(resolver.resolve(token("icon:ph-home"))).toBe("CI-ph-home");
	});

	it("**不猜图标包**：单段的名字不会被拿去各个包里试前缀", () => {
		// account-circle 只有 mdi 包里有，但单段不猜 → 保留原文
		expect(resolver.resolve(token("icon:account-circle"))).toBeNull();
		// 要指它就写全 mdi-account-circle，或用来源段 mdi:account-circle
		expect(resolver.resolve(token("icon:mdi:account-circle"))).toBe(
			"CI-mdi-account-circle",
		);
	});

	it("写完整 id 也能命中（原样那一档）", () => {
		expect(resolver.resolve(token("icon:CI-my-logo"))).toBe("CI-my-logo");
		expect(resolver.resolve(token("icon:lucide-sun"))).toBe("lucide-sun");
	});

	it("ci: 钉死用户 SVG / 图标包里的那个 id，不做任何切分猜测", () => {
		expect(resolver.resolve(token("icon:ci:my-logo"))).toBe("CI-my-logo");
		expect(resolver.resolve(token("icon:ci:mdi-home"))).toBe("CI-mdi-home");
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

	it("光一个包 id 不是图标名", () => {
		expect(resolver.resolve(token("icon:mdi"))).toBeNull();
	});
});

describe("落盘形态放的是真实注册 id", () => {
	// 用户给的例子，注册表照着造；再加一个中文 id 的用户 SVG
	const resolver = resolverFor([
		"lucide-sun",
		"CI-mdi-outlined-1k",
		"CI-vscode-icons-default-file",
		"CI-我的图标",
	]);

	it.each([
		["icon:lucide-sun", "lucide-sun"],
		["icon:CI-mdi-outlined-1k", "CI-mdi-outlined-1k"],
		["icon:CI-vscode-icons-default-file", "CI-vscode-icons-default-file"],
		["icon:CI-我的图标", "CI-我的图标"],
	])("`%s` → %s（原样那一档）", (body, iconId) => {
		expect(resolver.resolve(token(body))).toBe(iconId);
	});

	it("补全写出来的就是真实 id，前缀原样留着", () => {
		expect(resolver.tokenFor("lucide-sun")).toBe("`icon:lucide-sun`");
		expect(resolver.tokenFor("CI-mdi-outlined-1k")).toBe(
			"`icon:CI-mdi-outlined-1k`",
		);
		expect(resolver.tokenFor("CI-vscode-icons-default-file")).toBe(
			"`icon:CI-vscode-icons-default-file`",
		);
		expect(resolver.tokenFor("CI-我的图标")).toBe("`icon:CI-我的图标`");
	});

	it("手写简写也认（去掉前缀的写法走 ②③ 档）", () => {
		expect(resolver.resolve(token("icon:sun"))).toBe("lucide-sun");
		expect(resolver.resolve(token("icon:mdi-outlined-1k"))).toBe(
			"CI-mdi-outlined-1k",
		);
		expect(resolver.resolve(token("icon:我的图标"))).toBe("CI-我的图标");
	});

	it("撞名时真实 id 一定指到自己（这就是不删前缀的意义）", () => {
		const withCollision = resolverFor(["lucide-sun", "CI-sun"]);
		expect(withCollision.tokenFor("CI-sun")).toBe("`icon:CI-sun`");
		expect(withCollision.resolve(token("icon:CI-sun"))).toBe("CI-sun");
		expect(withCollision.resolve(token("icon:lucide-sun"))).toBe(
			"lucide-sun",
		);
		// 简写形态才有先后之争
		expect(withCollision.resolve(token("icon:sun"))).toBe("lucide-sun");
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

	it("在来源里挑的，落盘也是真实 id（来源段不进文件）", () => {
		for (const candidate of resolver.catalogFor("mdi")) {
			const body = resolver.tokenFor(candidate.id).slice(1, -1);
			expect(body).toBe(`icon:${candidate.id}`);
			expect(resolver.resolve(token(body))).toBe(candidate.id);
		}
	});

	it("写不进记号的 id 会被剔掉（含冒号 / 逗号 / 反引号）", () => {
		const messy = resolverFor([
			"lucide-sun",
			"CI-a,b",
			"CI-a:b",
			"CI-a`b",
			"CI-正常的中文 id",
		]);
		expect(messy.catalog().map((candidate) => candidate.id)).toEqual([
			"lucide-sun",
			"CI-正常的中文 id",
		]);
	});
});

describe("tokenFor：补全写进文件的形态", () => {
	const resolver = resolverFor(WITH_CUSTOM_ICONS);

	it("就是真实 id，一字不改，并且带上那一对反引号", () => {
		for (const id of WITH_CUSTOM_ICONS) {
			expect(resolver.tokenFor(id)).toBe(`\`icon:${id}\``);
		}
	});

	it("写出来的记号一定解析回同一个 id（往返校验）", () => {
		for (const id of WITH_CUSTOM_ICONS) {
			const body = resolver.tokenFor(id).slice(1, -1);
			expect(resolver.resolve(token(body))).toBe(id);
		}
	});

	it("跟随自定义前缀", () => {
		expect(resolver.tokenFor("lucide-sun", { prefix: "ico" })).toBe(
			"`ico:lucide-sun`",
		);
	});
});

describe("API 补充档：只有 Custom Icons 的 api.renderTo 画得出来的那批", () => {
	/**
	 * 现实中落在这一档的只有 Lucide 差集：提供方 bundle 里的 lucide-react 比
	 * Obsidian 内置多出来的图标，**不在注册表**，公共 setIcon 画不出来。
	 * 这里用 `lucide-sparkles` 假装那批。
	 */
	const EXTRA = new Set(["lucide-sparkles"]);

	function withProbe(ids: readonly string[]): IconResolver {
		return new IconResolver(
			() => [...ids],
			(id) => EXTRA.has(id),
		);
	}

	it("注册表里没有、探测器说有 → 解析成功（差集因此可用）", () => {
		expect(withProbe(BUILTIN_ONLY).resolve(token("icon:lucide-sparkles"))).toBe(
			"lucide-sparkles",
		);
		// 简写也走得通：② 档构造出 lucide-sparkles 后由探测器兜住
		expect(withProbe(BUILTIN_ONLY).resolve(token("icon:sparkles"))).toBe(
			"lucide-sparkles",
		);
	});

	it("两边都没有仍然是 null（保留原文那条路不变）", () => {
		expect(withProbe(BUILTIN_ONLY).resolve(token("icon:nope"))).toBeNull();
	});

	it("不传探测器时整档消失——这就是提供方不在场的形态（P1）", () => {
		expect(
			resolverFor(BUILTIN_ONLY).resolve(token("icon:lucide-sparkles")),
		).toBeNull();
	});

	/**
	 * 这一条钉着 `#first` 的两遍扫描。注册表里的 id 用公共 setIcon 就能画，
	 * 提供方被禁用也不受影响；API 档只有提供方在场时才行。所以哪怕 API 档的候选
	 * 排在候选序列前面，也该优先给注册表里那个，否则一个本来稳定的记号会平白
	 * 依赖上提供方。
	 */
	it("注册表整体先于 API 档，即使 API 档的候选排在前面", () => {
		// lucide: 的候选序列是 [lucide-x, CI-lucide-x]：前者只有探测器有，
		// 后者真在注册表里 —— 该给后者
		const resolver = new IconResolver(
			() => ["CI-lucide-star"],
			(id) => id === "lucide-star",
		);
		expect(resolver.resolve(token("icon:lucide:star"))).toBe("CI-lucide-star");
	});

	it("探测结果同样进缓存，不会每次渲染都问一遍提供方", () => {
		let calls = 0;
		const resolver = new IconResolver(
			() => [],
			(id) => {
				calls += 1;
				return id === "lucide-sparkles";
			},
		);
		resolver.resolve(token("icon:lucide-sparkles"));
		const after = calls;
		resolver.resolve(token("icon:lucide-sparkles"));
		expect(calls).toBe(after);
	});
});

describe("包成员表：`icon:<packId>:` 该列哪些图标", () => {
	/**
	 * 这一组钉着**动手改的理由**：按 `CI-mdi-` 前缀筛会把 `mdi-light` 包的图标一并
	 * 捞进来，而两个包同时装是完全正常的用法。前缀不可靠是因为
	 * `CI-<packId>-<name>` 不可逆向切分——packId 与 name 都能含连字符。
	 */
	const TWO_PACKS = [
		"lucide-sun",
		"CI-mdi-home",
		"CI-mdi-light-home",
		"CI-mdi-light-account",
	];

	/** 提供方在场时的权威分组（对应契约 `catalog()` 里那两段）。 */
	const AUTHORITATIVE: Record<string, string[]> = {
		mdi: ["CI-mdi-home"],
		"mdi-light": ["CI-mdi-light-home", "CI-mdi-light-account"],
	};

	function withPacks(ids: readonly string[]): IconResolver {
		return new IconResolver(
			() => [...ids],
			() => false,
			(packId) => AUTHORITATIVE[packId] ?? [],
		);
	}

	const labelsOf = (resolver: IconResolver, source: string) =>
		resolver
			.catalogFor(source)
			.map((candidate) => candidate.label)
			.sort();

	it("两个包名互为前缀时不串味（这就是那个缺陷）", () => {
		const resolver = withPacks(TWO_PACKS);
		expect(labelsOf(resolver, "mdi")).toEqual(["home"]);
		expect(labelsOf(resolver, "mdi-light")).toEqual(["account", "home"]);
	});

	it("没有权威表时退回前缀匹配，缺陷复现——正是它证明修复有效", () => {
		// 同一份注册表，只是不接提供方：`mdi` 段会多出 mdi-light 的两个
		expect(labelsOf(resolverFor(TWO_PACKS), "mdi")).toEqual([
			"home",
			"light-account",
			"light-home",
		]);
	});

	it("包已停用但图标还在注册表里 → 不列（前缀匹配认不出这个）", () => {
		// 权威表里没有 ph 这一段 = 「答了：没这个包」，不该退回前缀匹配
		const resolver = withPacks([...TWO_PACKS, "CI-ph-home"]);
		expect(resolver.catalogFor("ph")).toEqual([]);
	});

	it("权威表里有、注册表还没跟上的条目会被剔掉（不列出画不出来的）", () => {
		const resolver = new IconResolver(
			() => ["CI-mdi-home"],
			() => false,
			() => ["CI-mdi-home", "CI-mdi-not-registered-yet"],
		);
		expect(labelsOf(resolver, "mdi")).toEqual(["home"]);
	});

	it("那批只有 api 画得出来的仍然列（与 resolve 的判据一致）", () => {
		const resolver = new IconResolver(
			() => [],
			(id) => id === "CI-mdi-api-only",
			() => ["CI-mdi-api-only"],
		);
		expect(labelsOf(resolver, "mdi")).toEqual(["api-only"]);
	});

	it("列出来的每一条仍然能被「来源段 + label」解析回自己", () => {
		const resolver = withPacks(TWO_PACKS);
		for (const source of ["mdi", "mdi-light"]) {
			for (const candidate of resolver.catalogFor(source)) {
				expect(
					resolver.resolve(token(`icon:${source}:${candidate.label}`)),
				).toBe(candidate.id);
			}
		}
	});

	it("按来源段缓存，不会每敲一次就问一遍提供方", () => {
		let calls = 0;
		const resolver = new IconResolver(
			() => [...TWO_PACKS],
			() => false,
			(packId) => {
				calls += 1;
				return AUTHORITATIVE[packId] ?? [];
			},
		);
		resolver.catalogFor("mdi");
		resolver.catalogFor("mdi");
		expect(calls).toBe(1);

		resolver.invalidate();
		resolver.catalogFor("mdi");
		expect(calls).toBe(2);
	});
});

describe("tokenFor：带修饰符（图标选择器那条路径用）", () => {
	const resolver = resolverFor(WITH_CUSTOM_ICONS);

	it("修饰符跟在 id 后面，用逗号分隔", () => {
		expect(resolver.tokenFor("lucide-sun", {}, ["#e5a50a"])).toBe(
			"`icon:lucide-sun,#e5a50a`",
		);
	});

	it("空修饰符列表等于不写（默认色不该在记号里留下痕迹）", () => {
		expect(resolver.tokenFor("lucide-sun", {}, [])).toBe("`icon:lucide-sun`");
		expect(resolver.tokenFor("lucide-sun")).toBe("`icon:lucide-sun`");
	});

	it("带修饰符的记号仍然解析回同一个 id", () => {
		const body = resolver.tokenFor("CI-mdi-home", {}, ["#e5a50a"]).slice(1, -1);
		const parsed = token(body);
		expect(resolver.resolve(parsed)).toBe("CI-mdi-home");
		expect(parsed.modifiers).toEqual(["#e5a50a"]);
	});
});
