import CPlugin from "@src/main";
import { DEFAULT_SETTINGS, IPluginSettings } from "./IPluginSettings";

export default class SettingsStore {
	#plugin: CPlugin;
	#subscribers = new Set<() => void>();

	#store = {
		subscribe: (callback: () => void) => {
			this.#subscribers.add(callback);
			return () => this.#subscribers.delete(callback);
		},
		getSnapshot: (): IPluginSettings => this.#plugin.settings,
	};

	constructor(plugin: CPlugin) {
		this.#plugin = plugin;
	}

	get settings() {
		return this.#plugin.settings;
	}

	get store() {
		// 必须返回稳定引用：useSyncExternalStore 用 subscribe 的引用相等性判断是否
		// 需要退订重订，每次返回新对象会让组件每次渲染都退订再重订
		return this.#store;
	}

	get plugin() {
		return this.#plugin;
	}

	get app() {
		return this.#plugin.app;
	}

	#notifyStoreSubscribers() {
		this.#subscribers.forEach((callback) => callback());
	}

	/**
	 * 以默认值的结构为准合并已存盘的设置，使新增字段自动补齐、类型不符的值回退。
	 */
	#mergeWithDefaults<T>(saved: unknown, defaults: T): T {
		// 默认值是对象（且非数组）：递归按默认结构构建结果
		if (
			defaults !== null &&
			typeof defaults === "object" &&
			!Array.isArray(defaults)
		) {
			const result: Record<string, unknown> = {};
			const defaultRecord = defaults as unknown as Record<
				string,
				unknown
			>;
			const savedRecord = (saved ?? {}) as Record<string, unknown>;
			for (const key of Object.keys(defaultRecord)) {
				result[key] = this.#mergeWithDefaults(
					savedRecord[key],
					defaultRecord[key],
				);
			}
			return result as unknown as T;
		}

		// 基元或数组：类型不匹配或未提供则回退到默认值
		const isArrayDefault = Array.isArray(defaults);
		const isArraySaved = Array.isArray(saved);
		if (
			saved === undefined ||
			(typeof defaults !== typeof saved && !isArrayDefault) ||
			(isArrayDefault && !isArraySaved)
		) {
			return defaults;
		}
		return saved as T;
	}

	async loadSettings() {
		const saved: unknown = await this.#plugin.loadData();
		const merged = this.#mergeWithDefaults(saved ?? {}, DEFAULT_SETTINGS);

		this.#plugin.settings = merged;

		await this.#plugin.saveSettings();
		this.#notifyStoreSubscribers();
	}

	async updateSettings(settings: IPluginSettings) {
		this.#plugin.settings = Object.assign({}, settings);
		await this.#plugin.saveSettings();
		this.#notifyStoreSubscribers();
	}

	/**
	 * 按点分路径更新单个设置值，例如 `syntax.prefix`。
	 *
	 * @throws 路径在现有设置里不存在时抛出。
	 */
	async updateSettingByPath<T>(path: string, value: T) {
		const newSettings = JSON.parse(
			JSON.stringify(this.#plugin.settings),
		) as IPluginSettings;
		const pathParts = path.split(".");
		let current: unknown = newSettings;

		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i];
			if (
				typeof current === "object" &&
				current !== null &&
				part in current
			) {
				current = (current as Record<string, unknown>)[part];
			} else {
				throw new Error(`Invalid setting path: ${path}`);
			}
		}

		const finalPart = pathParts[pathParts.length - 1];
		if (
			typeof current === "object" &&
			current !== null &&
			finalPart in current
		) {
			(current as Record<string, unknown>)[finalPart] = value;
		} else {
			throw new Error(`Invalid setting path: ${path}`);
		}

		await this.updateSettings(newSettings);
	}

	/**
	 * 按点分路径删除单个设置值。路径不存在时静默返回。
	 *
	 * @throws 路径的中间段不存在时抛出。
	 */
	async deleteSettingByPath(path: string) {
		const newSettings = JSON.parse(
			JSON.stringify(this.#plugin.settings),
		) as IPluginSettings;
		const pathParts = path.split(".");
		let current: unknown = newSettings;

		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i];
			if (
				typeof current === "object" &&
				current !== null &&
				part in current
			) {
				current = (current as Record<string, unknown>)[part];
			} else {
				throw new Error(`Invalid setting path: ${path}`);
			}
		}

		const finalPart = pathParts[pathParts.length - 1];
		if (
			typeof current === "object" &&
			current !== null &&
			finalPart in current
		) {
			delete (current as Record<string, unknown>)[finalPart];
			await this.updateSettings(newSettings);
		}
	}
}
