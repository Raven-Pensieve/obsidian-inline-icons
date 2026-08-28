/**
 * 解析链：把 {@link IconToken} 变成一个**能渲染的 Obsidian 图标 id**。
 *
 * **落盘形态放的是真实注册 id**：`` `icon:lucide-sun` `` / `` `icon:CI-mdi-outlined-1k` ``。
 * 不做任何前缀增删，所以「记号里写的」与「注册表里的」逐字相同，永不歧义。
 * 来源段（`ci:` / `lucide:` / `<packId>:`）是**输入期的便利**——能解析、能在补全里
 * 收窄候选池，但补全写进文件的永远是完整 id。
 *
 * ```
 * `icon:lucide-sun`                    → lucide-sun
 * `icon:CI-mdi-outlined-1k`            → CI-mdi-outlined-1k
 * `icon:CI-vscode-icons-default-file`  → CI-vscode-icons-default-file
 * `icon:CI-我的图标`                    → CI-我的图标
 * ```
 *
 * 手写简写同样认（下面的 ②③），P1（裸装只有 Obsidian 自带图标）也在这里
 * **自然发生，没有任何特判**：
 *
 * ```
 *   ① setIcon(el, "<name>")        原样：真实 id 走的就是这一档
 *   ② setIcon(el, "lucide-<name>") 手写简写 `icon:sun`
 *   ③ setIcon(el, "CI-<name>")     手写简写 `icon:mdi-outlined-1k`
 *   ④ 全落空 → null，调用方保留原文
 *
 * 写了来源段时不走这条链，而是正向构造一次：
 *   ci:<name>        → CI-<name>
 *   lucide:<name>    → lucide-<name>，再 CI-lucide-<name>（内置优先、包兜底）
 *   <packId>:<name>  → CI-<packId>-<name>
 * ```
 *
 * **没有「拿名字去各个图标包里猜」这一步**：`CI-<packId>-<name>` 不可逆向切分，
 * 猜的结果取决于装了哪些包、以及 `getIconIds()` 的顺序——那种「图标随机不出来」
 * 正是本项目要避免的。
 *
 * 本模块只依赖一个 `() => string[]`（生产环境传 obsidian 的 `getIconIds`），
 * 所以可以用假注册表完整单测。
 */
import {
	canReference,
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

/** 补全候选。**展示与落盘都用 `id`**，`label` 只用于过滤。 */
export interface IconCandidate {
	/** Obsidian 注册表里的完整 id，如 `lucide-sun` / `CI-mdi-outlined-1k` / `CI-我的图标`。 */
	id: string;
	/**
	 * 过滤用的短名：去掉注册前缀（`lucide-sun` → `sun`），
	 * 写了来源段时是相对该来源的名字（`icon:mdi:` 下 `CI-mdi-home` → `home`）。
	 *
	 * **不是落盘形态**——写进文件的是 {@link id}。
	 */
	label: string;
	source: IconIdSource;
}

/** 去掉注册前缀，得到用于过滤的短名。 */
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
 * 「注册表里没有，但 Custom Icons 的 `api.renderTo` 画得出来」的探测器。
 *
 * 现实中只有一类图标落在这里：Custom Icons bundle 里的 `lucide-react` 比 Obsidian
 * 内置多出来的那批（契约里 `renderable: "api"` 那一档）。它们**不在注册表**，
 * 公共 `setIcon` 画不出来。
 *
 * 生产环境传 `(id) => getCustomIconsApi(app)?.has(id) ?? false`；
 * 不传（或提供方不在场）时整档消失，解析链退化成纯注册表查询。
 */
export type ExtraIconProbe = (id: string) => boolean;

/**
 * 「某个图标包里到底有哪些图标」的**权威**来源。
 *
 * 这是本模块唯一不能靠字符串前缀自己算的东西。`CI-<packId>-<name>`
 * **不可逆向切分**（packId 与 name 都可含连字符），所以按前缀 `CI-mdi-` 收窄
 * 会把**另一个包**的图标也捞进来：装了 `mdi` 与 `mdi-light` 两个包时，
 * `icon:mdi:` 会列出 `CI-mdi-light-home`，label 还成了 `light-home`。
 * 停用但图标仍在注册表里的包同理会被列出来。
 * 那正是本项目最想避免的「图标随机不出来、用户查不出原因」。
 *
 * 生产环境接 Custom Icons 的 `api.catalog()`——它的分组来自已启用包的 manifest，
 * 没有任何猜测。三态语义：
 *
 * | 返回 | 含义 | 后果 |
 * | --- | --- | --- |
 * | `null` | **答不了**（提供方不在场 / 未接线） | 退回前缀匹配（裸装下没有 `CI-*`，本来就空） |
 * | `[]` | 答了：没这个包 | 空列表。**不退回前缀匹配**，否则上面那个 bug 又回来了 |
 * | `[...]` | 该包全部图标的注册 id | 按它建候选 |
 */
export type PackIconsProvider = (packId: string) => readonly string[] | null;

/**
 * 解析器。
 *
 * **必须缓存**：同一个记号在渲染热路径上会被反复解析。
 * 注册表变化时（Custom Icons 装/卸包、被启用/禁用）调 {@link invalidate}。
 */
export class IconResolver {
	readonly #getIconIds: IconIdProvider;

	readonly #hasExtra: ExtraIconProbe;

	readonly #getPackIcons: PackIconsProvider;

	/** 注册表快照，惰性建立。 */
	#ids: Set<string> | null = null;

	/** 补全候选池，按来源段分别缓存（`""` 代表「不写来源」）。 */
	readonly #catalogBySource = new Map<string, IconCandidate[]>();

	/** `source|name` → 命中的 id（`null` 表示确认解析不出来，同样要缓存）。 */
	readonly #cache = new Map<string, string | null>();

	/** 见 {@link revision}。 */
	#revision = 0;

	/**
	 * 两个可选依赖都是**跨插件增强**，缺了整档消失而不是报错——这就是 P1
	 * 「裸装可用」在本模块的落地：只传第一个参数，行为退回纯注册表查询。
	 */
	constructor(
		getIconIds: IconIdProvider,
		hasExtra: ExtraIconProbe = () => false,
		getPackIcons: PackIconsProvider = () => null,
	) {
		this.#getIconIds = getIconIds;
		this.#hasExtra = hasExtra;
		this.#getPackIcons = getPackIcons;
	}

	/**
	 * 每次 {@link invalidate} 自增。
	 *
	 * **给 CM6 用**：实时预览的装饰是缓存在 ViewPlugin 里的，只在 `docChanged` /
	 * `viewportChanged` / `selectionSet` / 模式切换时重建。图标集合变化（装包、
	 * 删 SVG、启停 Custom Icons）不产生这四者中的任何一个，于是那份装饰会连同它
	 * 引用的旧 iconId 一起留在原地——记号该退回原文的没退、该出图标的不出，
	 * 直到用户碰一下文档才恢复。
	 *
	 * `updateOptions()` 只重新配置扩展、并不保证重跑 `buildDecorations`，所以
	 * ViewPlugin 得有一个自己能比对的标记：把它读进 update 判断即可，
	 * 见 `render/livePreview.ts`。
	 */
	get revision(): number {
		return this.#revision;
	}

	/** 丢掉注册表快照与解析缓存。注册表可能变化时都要调。 */
	invalidate(): void {
		this.#ids = null;
		this.#catalogBySource.clear();
		this.#cache.clear();
		this.#revision += 1;
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
	 * | 其他（包 id） | 该包的**权威成员表**（{@link PackIconsProvider}），答不了才退回 `CI-<packId>-*` 前缀 | `CI-<packId>-` 之后的部分（`CI-mdi-home` → `home`） |
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
	 * **就是真实注册 id 本身**：`lucide-sun` → `` `icon:lucide-sun` ``，
	 * `CI-我的图标` → `` `icon:CI-我的图标` ``。不删前缀、不加来源段，
	 * 所以它必然由解析链第一档原样命中，不存在撞名，也不需要往返校验。
	 *
	 * 用户在补全里写过的来源段（`icon:ci:`）**不会**被带进文件——来源段只是输入期
	 * 用来收窄候选池的工具。
	 *
	 * @param modifiers 可选的修饰符段（颜色 / 尺寸）。给了就跟在 id 后面：
	 *   `` `icon:lucide-sun,#e5a50a` ``。图标选择器那条路径用它落地用户选的颜色；
	 *   补全不传——它只负责选图标，没有颜色控件。
	 */
	tokenFor(
		id: string,
		options: GrammarOptions = {},
		modifiers: readonly string[] = [],
	): string {
		return formatCodeSpan(
			{ source: null, name: id, modifiers: [...modifiers] },
			options,
		);
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
			// 钉死某个图标包：正向构造，不做任何切分猜测
			return this.#first([`${CI_PREFIX}${source}-${name}`]);
		}

		// 单段形态：原样 → 内置 → Custom Icons。**不猜图标包**，
		// 因为 CI-<packId>-<name> 不可逆向切分，猜的结果取决于装了哪些包
		return this.#first([
			name,
			`${LUCIDE_PREFIX}${name}`,
			`${CI_PREFIX}${name}`,
		]);
	}

	/**
	 * 见 {@link catalogFor} 的表格：`label` 是过滤用的短名，落盘用的仍是 `id`。
	 *
	 * **写不进记号的 id 会被剔掉**（含冒号 / 逗号 / 反引号 / 换行的 id，见
	 * {@link canReference}）——列出来也没用，选了会插入一个解析不回来的记号。
	 */
	#buildCatalog(source: string | null): IconCandidate[] {
		const ids = [...this.#idSet()].filter(canReference);

		if (source === null) {
			return ids.map((id) => ({
				id,
				label: labelOf(id),
				source: IconResolver.sourceOf(id),
			}));
		}

		if (source === SOURCE_CI) {
			return ids
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

		return this.#buildPackCatalog(source, ids);
	}

	/**
	 * 某个图标包那一段。**能问到权威成员列表就绝不按前缀猜**，见
	 * {@link PackIconsProvider}：`CI-mdi-` 这个前缀会把 `mdi-light` 包的图标
	 * 一并捞进来，而两个包同时装是完全正常的用法。
	 *
	 * 拿到权威列表后剥 `CI-<packId>-` **不再是猜**：那是对「已知属于本包」的 id
	 * 做正向操作，与 {@link tokenFor} 的构造方向一致，所以
	 * 「来源段 + label 一定解析回自己」这条不变量继续成立。
	 */
	#buildPackCatalog(packId: string, fallbackIds: string[]): IconCandidate[] {
		const packPrefix = `${CI_PREFIX}${packId}-`;
		const authoritative = this.#getPackIcons(packId);

		if (authoritative === null) {
			// 答不了（提供方不在场）：退回前缀匹配。裸装下没有任何 CI-*，本来就是空列表
			return fallbackIds
				.filter((id) => id.startsWith(packPrefix))
				.map((id) => ({
					id,
					label: id.slice(packPrefix.length),
					source: "custom-icons" as const,
				}));
		}

		const candidates: IconCandidate[] = [];
		for (const id of authoritative) {
			// 前缀对不上就没法给出能解析回来的 label（`<packId>:<label>` 会被
			// 正向构造成 CI-<packId>-<label>）。理论上不会发生，真发生了宁可不列
			if (!id.startsWith(packPrefix)) continue;
			if (!canReference(id)) continue;
			// 与 #first 同一个判据：保证选中后一定解析得回来，不会插入死记号。
			// 包刚装好而注册表还没跟上时这里会短暂为空，下一次变更事件就补齐
			if (!this.#idSet().has(id) && !this.#hasExtra(id)) continue;

			candidates.push({
				id,
				label: id.slice(packPrefix.length),
				source: "custom-icons",
			});
		}
		return candidates;
	}

	/**
	 * 逐个候选试，**注册表整体先于 API 档**。
	 *
	 * 两遍扫描而不是一遍里各查两次：注册表里的 id 用公共 `setIcon` 就能画，
	 * Custom Icons 被禁用也不受影响；API 档只有提供方在场时画得出来。
	 * 所以哪怕 API 档的候选排在前面（`icon:lucide:sun` 的 `lucide-sun`），
	 * 也该优先给注册表里那个——否则一个本来稳定的记号会平白依赖上提供方。
	 */
	#first(candidates: readonly string[]): string | null {
		const ids = this.#idSet();
		for (const candidate of candidates) {
			if (ids.has(candidate)) return candidate;
		}
		for (const candidate of candidates) {
			if (this.#hasExtra(candidate)) return candidate;
		}
		return null;
	}

	#idSet(): Set<string> {
		this.#ids ??= new Set(this.#getIconIds());
		return this.#ids;
	}
}
