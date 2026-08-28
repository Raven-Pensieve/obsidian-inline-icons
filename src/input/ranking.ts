/**
 * 候选排序与最近使用列表。纯函数模块，不碰 DOM、不依赖 obsidian。
 */
import type { IconCandidate } from "@src/syntax/resolve";

/** 最近使用列表的长度上限。 */
export const RECENT_LIMIT = 20;

/**
 * 候选数量上限。
 *
 * 不做成设置项：装了图标包后可选图标可达上万个，所以必须有个上限；但用户想收窄
 * 结果的动作是多敲一个字母，而不是去设置里把 30 改成 60。
 */
export const MAX_RESULTS = 30;

/**
 * 按 query 过滤并排序候选。
 *
 * 两档排序：最近使用过的排在最前，彼此之间按最近程度（`recent` 数组的顺序）；
 * 其余按命中质量，同分时短名字在前，再按字典序。
 *
 * query 为空是正常状态，不是「还没开始输入」：用户刚敲完 `icon:` 或 `icon:ci:`
 * 就该看到池子里有什么，而不是被迫先猜一个字母。数量由 `limit` 兜着。
 *
 * @param options.matchFullId 完整注册 id 是否参与匹配，默认参与，见 {@link matchScore}。
 */
export function filterCandidates(
	catalog: readonly IconCandidate[],
	query: string,
	recent: readonly string[],
	limit: number,
	options: { matchFullId?: boolean } = {},
): IconCandidate[] {
	const needle = query.trim().toLowerCase();
	const browsing = needle === "";

	const scored: {
		candidate: IconCandidate;
		score: number;
		recentRank: number;
	}[] = [];

	for (const candidate of catalog) {
		let score = 0;
		if (!browsing) {
			score = matchScore(candidate, needle, options.matchFullId !== false);
			if (score < 0) continue;
		}

		scored.push({
			candidate,
			score,
			recentRank: recent.indexOf(candidate.id),
		});
	}

	scored.sort((a, b) => {
		if (a.recentRank >= 0 || b.recentRank >= 0) {
			if (a.recentRank >= 0 && b.recentRank >= 0) {
				return a.recentRank - b.recentRank;
			}
			return a.recentRank >= 0 ? -1 : 1;
		}
		return (
			a.score - b.score ||
			// 纯浏览时不按长度排——那看起来像随机顺序，字典序更好翻
			(browsing
				? 0
				: a.candidate.label.length - b.candidate.label.length) ||
			a.candidate.label.localeCompare(b.candidate.label)
		);
	});

	return scored.slice(0, Math.max(1, limit)).map((entry) => entry.candidate);
}

/** 把 id 挪到最近使用列表最前面，去重并截断。 */
export function withRecent(recent: readonly string[], id: string): string[] {
	return [id, ...recent.filter((item) => item !== id)].slice(0, RECENT_LIMIT);
}

/**
 * 命中质量：0 完全相同 / 1 前缀 / 2 包含 / -1 不命中。中文 id 按包含匹配，不做分词。
 *
 * `matchFullId` 时短名与完整 id 都参与匹配，取更好的那个：敲 `sun` 命中
 * `lucide-sun`（短名前缀），敲 `CI-mdi` 也命中 `CI-mdi-outlined-1k`（完整 id 前缀）。
 * 没写来源段时就该这样，用户可能在敲任意一种形态。
 *
 * 写了来源段时必须关掉它，否则注册前缀会漏进匹配：`icon:ci:` 下候选全是 `CI-*`，
 * 完整 id 人人都含 `ci`，于是接着敲的每个字母都会拿去和 `CI-` / `CI-<packId>-`
 * 这段比，看起来就像按来源段做了一次模糊匹配。来源段已经把池子钉死，此时只有
 * `label`（用户接着要敲的那段）才该参与匹配。
 */
function matchScore(
	candidate: IconCandidate,
	needle: string,
	matchFullId: boolean,
): number {
	const label = scoreOne(candidate.label.toLowerCase(), needle);
	const best = matchFullId
		? Math.min(label, scoreOne(candidate.id.toLowerCase(), needle))
		: label;
	return best === Number.MAX_SAFE_INTEGER ? -1 : best;
}

function scoreOne(haystack: string, needle: string): number {
	if (haystack === needle) return 0;
	if (haystack.startsWith(needle)) return 1;
	if (haystack.includes(needle)) return 2;
	return Number.MAX_SAFE_INTEGER;
}
