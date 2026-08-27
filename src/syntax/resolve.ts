/**
 * 解析链：把 {@link IconToken} 变成一个**能渲染的 Obsidian 图标 id**。
 *
 * P1（裸装只有 Obsidian 自带图标）在这里**自然发生，没有任何特判**：
 *
 * ```
 * `icon:sun` 的单段解析顺序
 *   ① sun               原样（用户直接写完整 id 时也能命中）
 *   ② lucide-sun        Obsidian 内置图标的注册形式
 *   ③ CI-sun            Custom Icons 的用户 SVG
 *   ④ CI-<pack>-sun     Custom Icons 的图标包
 *   ⑤ 全落空 → null，调用方保留原文
 * ```
 *
 * 没装 Custom Icons 时 ③④ 天然全部落空，于是只剩内置图标——这就是基线。
 *
 * 本模块只依赖一个 `() => string[]`（生产环境传 obsidian 的 `getIconIds`），
 * 所以可以用假注册表完整单测。
 */
import {
	formatCodeSpan,
	SOURCE_CI,
	SOURCE_LUCIDE,
	type GrammarOptions,
	type IconToken,
} from "./grammar";

/** Custom Icons 注册进 Obsidian 的图标 id 一律带这个前缀。 */
export const CI_PREFIX = "CI-";

/** Obsidian 内置图标的注册前缀。 */
export const LUCIDE_PREFIX = "lucide-";

/** 图标 id 的来源，供补全分组用。 */
export type IconIdSource = "builtin" | "custom-icons";

/** 补全候选：一个可用图标的 id、展示名与来源。 */
export interface IconCandidate {
	/** Obsidian 注册表里的 id，如 `lucide-sun` / `CI-mdi-home`。 */
	id: string;
	/** 展示名：去掉 `lucide-` / `CI-` 前缀后的部分。 */
	label: string;
	source: IconIdSource;
}

/** 去掉注册前缀，得到给人看的名字。 */
export function labelOf(id: string): string {
	if (id.startsWith(CI_PREFIX)) return id.slice(CI_PREFIX.length);
	if (id.startsWith(LUCIDE_PREFIX)) return id.slice(LUCIDE_PREFIX.length);
	return id;
}

/** 收集某个前缀下的图标，label 取前缀之后的部分；**已存在的 label 不覆盖**。 */
function collectByPrefix(
	ids: Iterable<string>,
	prefix: string,
	source: IconIdSource,
	into: Map<string, IconCandidate>,
): void {
	for (const id of ids) {
		if (!id.startsWith(prefix)) continue;
		const label = id.slice(prefix.length);
		if (label === "" || into.has(label)) continue;
		into.set(label, { id, label, source });
	}
}

/** 注册表快照的提供者；生产环境就是 obsidian 的 `getIconIds`。 */
export type IconIdProvider = () => string[];

/**
 * 解析器。
 *
 * **必须缓存**：逐个图标包试前缀会在渲染热路径上重复很多次。
 * 注册表变化时（Custom Icons 装/卸包、被启用/禁用）调 {@link invalidate}。
 */
export class IconResolver {
	readonly #getIconIds: IconIdProvider;

	/** 注册表快照，惰性建立。 */
	#ids: Set<string> | null = null;

	/**
	 * `CI-` 图标的「名字后缀 → 完整 id」索引。
	 *
	 * `CI-<packId>-<name>` **不可逆向切分**（packId 与 name 都可含 `-`），
	 * 所以这里反过来做：把每个 `CI-` id 的所有可能名字后缀都登记一遍。
	 * 同名撞车时**先出现的 id 胜出**（`getIconIds()` 的顺序）。
	 */
	#packIndex: Map<string, string> | null = null;

	/** 补全候选池，按来源段分别缓存（`""` 代表「不写来源」）。 */
	readonly #catalogBySource = new Map<string, IconCandidate[]>();

	/** `source|name` → 命中的 id（`null` 表示确认解析不出来，同样要缓存）。 */
	readonly #cache = new Map<string, string | null>();

	constructor(getIconIds: IconIdProvider) {
		this.#getIconIds = getIconIds;
	}

	/** 丢掉注册表快照与解析缓存。注册表可能变化时都要调。 */
	invalidate(): void {
		this.#ids = null;
		this.#packIndex = null;
		this.#catalogBySource.clear();
		this.#cache.clear();
	}

	/** 解析不出来时返回 `null`——调用方必须**保留原文**，不要留白。 */
	resolve(token: IconToken): string | null {
		const key = `${token.source ?? ""}|${token.name}`;
		const cached = this.#cache.get(key);
		if (cached !== undefined) return cached;

		const resolved = this.#resolveUncached(token);
		this.#cache.set(key, resolved);
		return resolved;
	}

	/** 某个 id 是否在注册表里。 */
	has(id: string): boolean {
		return this.#idSet().has(id);
	}

	/**
	 * 全部可用图标，供补全与插入命令列表用。惰性建立，随 {@link invalidate} 一起作废。
	 *
	 * 顺序沿用 `getIconIds()`，调用方自己排序（最近使用优先等）。
	 */
	catalog(): readonly IconCandidate[] {
		return this.catalogFor(null);
	}

	/**
	 * **按来源段过滤**的候选池：用户已经写了 `icon:ci:` / `icon:lucide:` / `icon:mdi:`
	 * 时，补全只该列出那个来源里的图标。
	 *
	 * 关键在于 `label` 是**相对来源的名字**，也就是用户接着要敲的那一段：
	 *
	 * | 来源段 | 收哪些 id | label |
	 * | --- | --- | --- |
	 * | `null` | 全部 | 去掉注册前缀（`lucide-sun` → `sun`） |
	 * | `ci` | 全部 `CI-*` | `CI-` 之后的整段（`CI-mdi-home` → `mdi-home`） |
	 * | `lucide` | `lucide-*` ＋ `CI-lucide-*` | 各自去掉前缀；**同名时内置胜出**（与解析链一致） |
	 * | 其他（包 id） | `CI-<packId>-*` | 该前缀之后的部分（`CI-mdi-home` → `home`） |
	 *
	 * 认不出的来源段返回空列表——补全自然什么都不显示，比乱列一堆好。
	 */
	catalogFor(source: string | null): readonly IconCandidate[] {
		const key = source ?? "";
		const cached = this.#catalogBySource.get(key);
		if (cached !== undefined) return cached;

		const built = this.#buildCatalog(source);
		this.#catalogBySource.set(key, built);
		return built;
	}

	/**
	 * 给一个图标 id 生成**写进文件的记号**（含那对反引号）。
	 *
	 * 取「能解析回同一个 id 的最短形态」：
	 *
	 * 1. `preferred` —— 用户已经把来源段敲进去了（`icon:ci:`），就尊重它，别替人改写；
	 * 2. `` `icon:sun` `` —— 不写来源段，最好读；
	 * 3. `` `icon:ci:xxx` `` / `` `icon:lucide:xxx` `` —— 名字被别处抢先时（例如用户
	 *    导入的 `sun` 被内置的 `lucide-sun` 抢先）退一步钉死来源；
	 * 4. `` `icon:CI-mdi-home` `` —— 兜底写完整 id，解析链第一步就能命中。
	 *
	 * 每一步都用真实解析器做**往返校验**，所以不会写出一个渲染成别的图标的记号。
	 */
	tokenFor(
		id: string,
		options: GrammarOptions = {},
		preferred?: { source: string; name: string },
	): string {
		const label = labelOf(id);
		const pinned = id.startsWith(CI_PREFIX) ? SOURCE_CI : SOURCE_LUCIDE;
		const fallback: IconToken = { source: null, name: id, modifiers: [] };
		const candidates: IconToken[] = [
			...(preferred === undefined
				? []
				: [
						{
							source: preferred.source,
							name: preferred.name,
							modifiers: [],
						},
					]),
			{ source: null, name: label, modifiers: [] },
			{ source: pinned, name: label, modifiers: [] },
			fallback,
		];

		for (const candidate of candidates) {
			if (this.resolve(candidate) === id) {
				return formatCodeSpan(candidate, options);
			}
		}
		return formatCodeSpan(fallback, options);
	}

	/** 一个 id 来自哪里，供补全分组显示。 */
	static sourceOf(id: string): IconIdSource {
		return id.startsWith(CI_PREFIX) ? "custom-icons" : "builtin";
	}

	#resolveUncached(token: IconToken): string | null {
		const { source, name } = token;

		if (source === SOURCE_CI) {
			// 钉死用户导入的 SVG：只认 CI-<name>，不回退到图标包
			return this.#first([`${CI_PREFIX}${name}`]);
		}

		if (source === SOURCE_LUCIDE) {
			// 内置优先、包兜底：放开 lucide 保留字后（M2），两处都可能有
			return this.#first([
				`${LUCIDE_PREFIX}${name}`,
				`${CI_PREFIX}${SOURCE_LUCIDE}-${name}`,
			]);
		}

		if (source !== null) {
			// 钉死某个图标包
			return this.#first([`${CI_PREFIX}${source}-${name}`]);
		}

		return (
			this.#first([
				name,
				`${LUCIDE_PREFIX}${name}`,
				`${CI_PREFIX}${name}`,
			]) ?? this.#packLookup(name)
		);
	}

	/** 见 {@link catalogFor} 的表格：label 一律是「相对来源的名字」。 */
	#buildCatalog(source: string | null): IconCandidate[] {
		const ids = this.#idSet();

		if (source === null) {
			return [...ids].map((id) => ({
				id,
				label: labelOf(id),
				source: IconResolver.sourceOf(id),
			}));
		}

		if (source === SOURCE_CI) {
			return [...ids]
				.filter((id) => id.startsWith(CI_PREFIX))
				.map((id) => ({
					id,
					label: id.slice(CI_PREFIX.length),
					source: "custom-icons" as const,
				}));
		}

		if (source === SOURCE_LUCIDE) {
			// 内置优先、包兜底：同名时先登记的（内置）胜出，与解析链的两级回退一致
			const byLabel = new Map<string, IconCandidate>();
			collectByPrefix(ids, LUCIDE_PREFIX, "builtin", byLabel);
			collectByPrefix(
				ids,
				`${CI_PREFIX}${SOURCE_LUCIDE}-`,
				"custom-icons",
				byLabel,
			);
			return [...byLabel.values()];
		}

		const packPrefix = `${CI_PREFIX}${source}-`;
		return [...ids]
			.filter((id) => id.startsWith(packPrefix))
			.map((id) => ({
				id,
				label: id.slice(packPrefix.length),
				source: "custom-icons" as const,
			}));
	}

	#first(candidates: readonly string[]): string | null {
		const ids = this.#idSet();
		for (const candidate of candidates) {
			if (ids.has(candidate)) return candidate;
		}
		return null;
	}

	#packLookup(name: string): string | null {
		return this.#index().get(name) ?? null;
	}

	#idSet(): Set<string> {
		this.#ids ??= new Set(this.#getIconIds());
		return this.#ids;
	}

	#index(): Map<string, string> {
		if (this.#packIndex !== null) return this.#packIndex;

		const index = new Map<string, string>();
		for (const id of this.#idSet()) {
			if (!id.startsWith(CI_PREFIX)) continue;
			const segments = id.slice(CI_PREFIX.length).split("-");
			// 从 1 开始：完整 body 是「用户 SVG」的形态，已由 CI-<name> 直查覆盖
			for (let i = 1; i < segments.length; i++) {
				const suffix = segments.slice(i).join("-");
				if (!index.has(suffix)) index.set(suffix, id);
			}
		}

		this.#packIndex = index;
		return index;
	}
}
