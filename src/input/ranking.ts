import type { IconCandidate } from "@src/syntax/resolve";

/**
 * 候选排序与最近使用列表——**纯函数，不碰 DOM、不 import obsidian**，所以可单测。
 */

/** 最近使用列表的长度上限。 */
export const RECENT_LIMIT = 20;

/**
 * 按 query 过滤并排序候选。
 *
 * 两档排序：
 *
 * 1. **最近使用过的排在最前**，彼此之间按最近程度（`recent` 数组的顺序）；
 * 2. 其余按命中质量：完全相同 → 前缀命中 → 包含命中；同分时短名字在前，再按字典序。
 *
 * **query 为空时默认返回空列表**——空 query 会一次列出上千个图标，那不是补全。
 * 例外是 `allowEmptyQuery`：用户已经写了来源段（`icon:ci:`）时候选池已经被那个来源
 * 收窄过了，此时应当直接列出来让他挑，排序退化为「最近使用优先，其余按字典序」。
 */
export function filterCandidates(
	catalog: readonly IconCandidate[],
	query: string,
	recent: readonly string[],
	limit: number,
	options: { allowEmptyQuery?: boolean } = {},
): IconCandidate[] {
	const needle = query.trim().toLowerCase();
	const browsing = needle === "";
	if (browsing && options.allowEmptyQuery !== true) return [];

	const scored: {
		candidate: IconCandidate;
		score: number;
		recentRank: number;
	}[] = [];

	for (const candidate of catalog) {
		const label = candidate.label.toLowerCase();

		let score = 0;
		if (!browsing) {
			if (label === needle) score = 0;
			else if (label.startsWith(needle)) score = 1;
			else if (label.includes(needle)) score = 2;
			else continue;
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
