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
	it("空 query 不返回任何东西（否则一次列出上千个图标）", () => {
		expect(filterCandidates(CATALOG, "", [], 30)).toEqual([]);
		expect(filterCandidates(CATALOG, "   ", [], 30)).toEqual([]);
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
