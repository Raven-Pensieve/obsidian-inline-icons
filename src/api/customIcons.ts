/**
 * Custom Icons 跨插件 API 的**消费侧适配器**。
 *
 * 契约本身在 [`src/api/custom-icons-api.d.ts`](./custom-icons-api.d.ts)，
 * 那是从提供方仓库逐字复制来的 `.d.ts`（不发 npm 包是刻意的：零构建耦合，
 * 运行期靠 `version` 守卫）。本模块是它的运行时入口，把三件事收在一处：
 *
 * 1. **怎么取到 api**（非官方 `app.plugins.getPlugin` + 版本守卫）；
 * 2. **事件名的字面量**——`.d.ts` 故意只给类型不给值，所以常量得由消费方自己定义；
 * 3. **不缓存 api 引用**这条纪律，见 {@link getCustomIconsApi}。
 *
 * 提供方不在场（未装 / 已禁用 / 版本不符）时全部退化为 `null`，
 * 调用方走公共 `setIcon` 那条路——这就是 P1「裸装可用」在 API 层的落地。
 */
import { Events, type App, type EventRef } from "obsidian";
import type {
	CustomIconsApi,
	CustomIconsChangedPayload,
} from "@src/api/custom-icons-api";
import type { PackIconsProvider } from "@src/syntax/resolve";

/** 提供方的插件 id。 */
export const CUSTOM_ICONS_PLUGIN_ID = "custom-sidebar-icons";

/**
 * 图标集合变更事件。
 *
 * **必须写成字面量常量**：`custom-icons-api.d.ts` 是 `.d.ts`，不产出运行时代码，
 * 里面那个 `CustomIconsChangedEvent` 只是类型别名。从它 import 一个值会在打包后
 * 解析成 undefined。
 *
 * 监听一律用 `this.registerEvent(app.workspace.on(...))` 以自动回收。
 */
export const CUSTOM_ICONS_CHANGED = "custom-icons:changed";

/**
 * 取提供方的 api，拿不到就 `null`。
 *
 * **每次用时现取，绝不缓存这个引用**：提供方可能被禁用后重新启用，那时旧引用指向
 * 一个已经 `onunload` 过的插件实例——它的注册表早被 `removeIcon` 清空了，
 * `renderTo` 会画出空东西而不是老实返回 false。
 *
 * `app.plugins.getPlugin` 是**非官方 API**，类型由 `@obsidian-typings/…-catalyst`
 * 提供（签名 `getPlugin(id: string): null | Plugin`，其注释也说它优于直接读
 * `plugins.plugins[id]`）。
 */
export function getCustomIconsApi(app: App): CustomIconsApi | null {
	const provider = app.plugins.getPlugin(CUSTOM_ICONS_PLUGIN_ID) as
		| { api?: CustomIconsApi }
		| null;
	const api = provider?.api;
	// 版本守卫是契约的一部分：v2 会与 v1 并存一个大版本，届时这里要显式放行
	return api?.version === 1 ? api : null;
}

/**
 * 「某个图标包里有哪些图标」的权威查询，接契约的 `catalog()`。
 *
 * 为什么必须问提供方而不是自己按 `CI-<packId>-` 前缀筛：那个前缀会把**另一个包**
 * 的图标一并捞进来（装了 `mdi` 与 `mdi-light` 时，`CI-mdi-light-home` 也以
 * `CI-mdi-` 开头），也认不出「包已停用但图标还在注册表里」。契约的分组来自
 * 已启用包的 manifest，没有任何猜测——这正是那句「切分点由提供方回答」的用处。
 *
 * **按 `revision` 缓存**：`catalog()` 一次会摊出全部图标（装了几个 Iconify 包就是
 * 上万条），而补全每敲一个来源段就要问一次。`revision` 只在注册表真的动过之后才变，
 * 正好是这份索引的失效条件——契约把它设计成「给消费方的派生缓存打标」就是为了这个。
 * 不存盘（进程内单调递增，重启归零）。
 *
 * 三态返回值的语义见 `syntax/resolve.ts` 的 `PackIconsProvider`。关键是
 * **提供方在场但没有这个包时返回 `[]` 而不是 `null`**：那是「答了：没这个包」，
 * 退回前缀匹配会把上面那个 bug 又放回来。
 */
export function createPackIconsProvider(app: App): PackIconsProvider {
	let cache: {
		revision: number;
		packs: Map<string, readonly string[]>;
	} | null = null;

	return (packId: string) => {
		const api = getCustomIconsApi(app);
		// 提供方不在场 = 答不了，交给调用方退回前缀匹配（裸装下那也是空列表）
		if (!api) return null;

		if (!cache || cache.revision !== api.revision) {
			const packs = new Map<string, readonly string[]>();
			// 只收图标包那些段：`lucide` 与 `svg` 段的 packId 是 undefined，
			// 而它们对应的来源段（`lucide:` / `ci:`）前缀本来就无歧义，不需要问
			for (const group of api.catalog()) {
				if (group.packId) packs.set(group.packId, group.ids);
			}
			cache = { revision: api.revision, packs };
		}

		return cache.packs.get(packId) ?? [];
	};
}

/**
 * 订阅图标集合变更。**调用方要用 `this.registerEvent(...)` 包住返回值**以自动回收。
 *
 * 之所以要这个包装函数而不是直接写 `app.workspace.on("custom-icons:changed", …)`：
 * `Workspace.on` 声明了一长串**字面量事件名**的重载（`"window-open"` 等），
 * 自定义事件名一个都不匹配，tsc 会拿最后一个重载来报错。基类 `Events.on` 的签名
 * 才是 `(name: string, callback: (...data: unknown[]) => unknown)`，
 * 所以先把 workspace 看作 `Events` 再调用——这不是绕过类型检查，
 * 那个宽签名本来就是 Obsidian 给自定义事件留的口子（提供方的 `trigger` 同理）。
 *
 * 顺带把 payload 收窄回 {@link CustomIconsChangedPayload}，
 * 于是调用方不必自己面对 `unknown[]`。
 */
export function onCustomIconsChanged(
	app: App,
	callback: (payload: CustomIconsChangedPayload | undefined) => void,
): EventRef {
	return (app.workspace as Events).on(
		CUSTOM_ICONS_CHANGED,
		(...data: unknown[]) =>
			callback(data[0] as CustomIconsChangedPayload | undefined),
	);
}
