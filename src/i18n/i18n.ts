import { getLanguage } from "obsidian";
import type { Locales, TranslationFunctions } from "./i18n-types";
import { i18nObject, isLocale, loadedLocales } from "./i18n-util";
import { loadAllLocales } from "./i18n-util.sync";

/** typesafe-i18n 的封装，跟随 Obsidian 的语言设置，不受支持时回退到 `en`。 */
export class I18n {
	private static instance: I18n;
	private currentLocale: Locales;
	private LL: TranslationFunctions;

	private constructor() {
		loadAllLocales();

		const obsidianLang = getLanguage();
		this.currentLocale = isLocale(obsidianLang) ? obsidianLang : "en";
		this.LL = i18nObject(this.currentLocale);
	}

	public static getInstance(): I18n {
		if (!I18n.instance) {
			I18n.instance = new I18n();
		}
		return I18n.instance;
	}

	/** 翻译函数对象，形如 `LL.ui.sourceBuiltin()`。 */
	public get L(): TranslationFunctions {
		return this.LL;
	}

	public getLocale(): Locales {
		return this.currentLocale;
	}

	public isLocaleLoaded(locale: Locales): boolean {
		return !!loadedLocales[locale];
	}
}

export const i18n = I18n.getInstance();

export const LL = i18n.L;
