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
import { SOURCE_CI, SOURCE_LUCIDE, type IconToken } from "./grammar";

/** Custom Icons 注册进 Obsidian 的图标 id 一律带这个前缀。 */
export const CI_PREFIX = "CI-";

/** Obsidian 内置图标的注册前缀。 */
export const LUCIDE_PREFIX = "lucide-";

/** 图标 id 的来源，供补全分组用。 */
export type IconIdSource = "builtin" | "custom-icons";

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

	/** `source|name` → 命中的 id（`null` 表示确认解析不出来，同样要缓存）。 */
	readonly #cache = new Map<string, string | null>();

	constructor(getIconIds: IconIdProvider) {
		this.#getIconIds = getIconIds;
	}

	/** 丢掉注册表快照与解析缓存。注册表可能变化时都要调。 */
	invalidate(): void {
		this.#ids = null;
		this.#packIndex = null;
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
