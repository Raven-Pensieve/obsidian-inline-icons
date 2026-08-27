import { filterCandidates, RECENT_LIMIT, withRecent } from "../src/input/ranking";
import type { IconCandidate } from "../src/syntax/resolve";

const CATALOG: IconCandidate[] = [
	{ id: "lucide-sun", label: "sun", source: "builtin" },
	{ id: "lucide-sunrise", label: "sunrise", source: "builtin" },
	{ id: "lucide-sunset", label: "sunset", source: "builtin" },
	{ id: "CI-my-sun-logo", label: "my-sun-logo", source: "custom-icons" },
	{ id: "lucide-home", label: "home", source: "builtin" },
];

const labels = (items: IconCandidate[]) => items.map((item) => item.label);

describe("filterCandidates", () => {
	it("空 query 直接列出整池，按字典序（不按长度）", () => {
		expect(labels(filterCandidates(CATALOG, "", [], 30))).toEqual([
			"home",
			"my-sun-logo",
			"sun",
			"sunrise",
			"sunset",
		]);
		// 只有空白也算空 query
		expect(labels(filterCandidates(CATALOG, "   ", [], 30))).toEqual(
			labels(filterCandidates(CATALOG, "", [], 30)),
		);
	});

	it("完全相同 > 前缀命中 > 包含命中", () => {
		expect(labels(filterCandidates(CATALOG, "sun", [], 30))).toEqual([
			"sun",
			"sunset",
			"sunrise",
			"my-sun-logo",
		]);
	});

	it("同分时短名字在前", () => {
		const result = labels(filterCandidates(CATALOG, "sun", [], 30));
		expect(result.indexOf("sunset")).toBeLessThan(
			result.indexOf("sunrise"),
		);
	});

	it("只匹配真正包含 query 的名字", () => {
		expect(labels(filterCandidates(CATALOG, "suns", [], 30))).toEqual([
			"sunset",
		]);
	});

	it("最近使用过的排在最前，彼此按最近程度", () => {
		expect(
			labels(filterCandidates(CATALOG, "sun", ["CI-my-sun-logo"], 30)),
		).toEqual(["my-sun-logo", "sun", "sunset", "sunrise"]);

		expect(
			labels(
				filterCandidates(
					CATALOG,
					"sun",
					["lucide-sunrise", "CI-my-sun-logo"],
					30,
				),
			),
		).toEqual(["sunrise", "my-sun-logo", "sun", "sunset"]);
	});

	it("忽略大小写", () => {
		expect(labels(filterCandidates(CATALOG, "SUN", [], 30))).toContain("sun");
	});

	it("按上限截断，且上限至少给一条", () => {
		expect(filterCandidates(CATALOG, "sun", [], 2)).toHaveLength(2);
		expect(filterCandidates(CATALOG, "sun", [], 0)).toHaveLength(1);
	});

	it("查不到就是空列表", () => {
		expect(filterCandidates(CATALOG, "zzz", [], 30)).toEqual([]);
	});

	it("完整 id 也参与匹配（敲 CI- 开头也能命中）", () => {
		const catalog: IconCandidate[] = [
			{ id: "lucide-sun", label: "sun", source: "builtin" },
			{
				id: "CI-mdi-outlined-1k",
				label: "mdi-outlined-1k",
				source: "custom-icons",
			},
		];
		expect(labels(filterCandidates(catalog, "CI-mdi", [], 30))).toEqual([
			"mdi-outlined-1k",
		]);
		expect(labels(filterCandidates(catalog, "lucide-", [], 30))).toEqual([
			"sun",
		]);
	});

	it("中文 id 按包含匹配", () => {
		const catalog: IconCandidate[] = [
			{ id: "CI-我的图标", label: "我的图标", source: "custom-icons" },
			{ id: "lucide-sun", label: "sun", source: "builtin" },
		];
		expect(labels(filterCandidates(catalog, "我的", [], 30))).toEqual([
			"我的图标",
		]);
		expect(labels(filterCandidates(catalog, "图标", [], 30))).toEqual([
			"我的图标",
		]);
	});
});

describe("filterCandidates：浏览态（空 query）", () => {
	it("最近使用过的仍然排最前", () => {
		expect(
			labels(filterCandidates(CATALOG, "", ["lucide-sunset"], 30)),
		).toEqual(["sunset", "home", "my-sun-logo", "sun", "sunrise"]);
	});

	it("仍然守着上限", () => {
		expect(filterCandidates(CATALOG, "", [], 2)).toHaveLength(2);
	});
});

describe("filterCandidates：matchFullId", () => {
	// `icon:ci:` 下的候选池形态：label 是相对来源的名字，id 全都以 CI- 开头
	const CI_POOL: IconCandidate[] = [
		{ id: "CI-mdi-home", label: "mdi-home", source: "custom-icons" },
		{ id: "CI-tabler-star", label: "tabler-star", source: "custom-icons" },
	];

	it("关掉时只拿 label 匹配：来源段的字母不再漏进结果", () => {
		// 完整 id 人人都含 `ci`，但没有一个 label 含它
		expect(filterCandidates(CI_POOL, "ci", [], 30, { matchFullId: false }))
			.toEqual([]);
		// label 真的命中时照常给
		expect(
			labels(filterCandidates(CI_POOL, "home", [], 30, { matchFullId: false })),
		).toEqual(["mdi-home"]);
	});

	it("关掉后 label 里真含来源字母的仍然命中（不是无脑屏蔽 `ci`）", () => {
		const pool: IconCandidate[] = [
			{ id: "CI-mdi-circle", label: "mdi-circle", source: "custom-icons" },
		];
		expect(labels(filterCandidates(pool, "ci", [], 30, { matchFullId: false })))
			.toEqual(["mdi-circle"]);
	});

	it("默认开着：完整 id 参与匹配（没写来源段时的行为不变）", () => {
		expect(labels(filterCandidates(CI_POOL, "ci", [], 30))).toEqual([
			"mdi-home",
			"tabler-star",
		]);
	});
});

describe("withRecent", () => {
	it("挪到最前并去重", () => {
		expect(withRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
		expect(withRecent(["a", "b"], "x")).toEqual(["x", "a", "b"]);
	});

	it("截断到上限", () => {
		const long = Array.from({ length: RECENT_LIMIT + 5 }, (_, i) => `id-${i}`);
		const next = withRecent(long, "new");
		expect(next).toHaveLength(RECENT_LIMIT);
		expect(next[0]).toBe("new");
	});

	it("不改原数组", () => {
		const original = ["a", "b"];
		withRecent(original, "b");
		expect(original).toEqual(["a", "b"]);
	});
});
