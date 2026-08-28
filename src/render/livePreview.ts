import { syntaxTree } from "@codemirror/language";
import {
	RangeSetBuilder,
	type EditorSelection,
	type Extension,
} from "@codemirror/state";
import {
	Decoration,
	ViewPlugin,
	WidgetType,
	type DecorationSet,
	type EditorView,
	type PluginValue,
	type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";
import type InlineIconsPlugin from "@src/main";
import {
	formatTokenBody,
	parseTokenBody,
	type IconToken,
} from "@src/syntax/grammar";
import { editorLivePreviewField } from "obsidian";
import { createIconEl, UNRESOLVED_CLASS } from "./renderIcon";

/**
 * 实时预览管线（CM6）。
 *
 * 三条不能省的规则：
 *
 * 1. 只扫 `visibleRanges`，代价与可见行数成正比而非与文档长度成正比；
 * 2. 光标 / 选区与记号有交叠就不装饰，否则记号无法编辑（点进去就被 widget 吃掉）；
 * 3. 源码模式一律不渲染（`editorLivePreviewField` 为 false），否则用户没有任何
 *    办法看到自己写的原文。
 *
 * 节点判定不自己写正则，而是问 Obsidian 的语法树：`node.type.name` 是下划线拼接的
 * token 串（如 `inline-code_formatting_formatting-code`），split 成 Set 后判断，
 * 比正则判断「是否在代码块里」可靠得多。
 */
export function inlineIconsExtension(plugin: InlineIconsPlugin): Extension {
	return ViewPlugin.define(
		(view) => new InlineIconsViewPlugin(plugin, view),
		{ decorations: (value) => value.decorations },
	);
}

class InlineIconsViewPlugin implements PluginValue {
	decorations: DecorationSet;

	readonly #plugin: InlineIconsPlugin;

	/**
	 * 上次构建装饰时的解析器修订号。
	 *
	 * {@link update} 里那四个 CM6 信号都只描述文档 / 视图的变化，而图标集合变化
	 * （装包、删 SVG、启停 Custom Icons）一个都不触发：`updateOptions()` 会让 CM6
	 * 重新配置扩展，但已缓存的 `decorations` 不会因此重算，于是旧装饰连同它引用的
	 * 旧 iconId 一起留在原地，直到用户碰一下文档。
	 *
	 * 比对 `resolver.revision` 是最省的补法：它只在 `invalidate()` 时动，
	 * 而每次动都意味着解析结果可能变了。
	 */
	#revision: number;

	constructor(plugin: InlineIconsPlugin, view: EditorView) {
		this.#plugin = plugin;
		this.#revision = plugin.resolver.revision;
		this.decorations = buildDecorations(plugin, view);
	}

	update(update: ViewUpdate): void {
		const modeChanged =
			update.startState.field(editorLivePreviewField) !==
			update.state.field(editorLivePreviewField);
		const revision = this.#plugin.resolver.revision;

		if (
			update.docChanged ||
			update.viewportChanged ||
			update.selectionSet ||
			modeChanged ||
			revision !== this.#revision
		) {
			this.#revision = revision;
			this.decorations = buildDecorations(this.#plugin, update.view);
		}
	}

	destroy(): void {
		// widget 里只有 setIcon 产出的静态 DOM，没有需要回收的组件或监听
	}
}

/**
 * 图标 widget。
 *
 * `toDOM` 必须用 `view.dom.ownerDocument`：popout 窗口是另一个 document。
 * `eq` 决定 widget 能否复用，不实现的话每次 update 都会重建 DOM。
 */
class IconWidget extends WidgetType {
	constructor(
		readonly iconId: string,
		readonly token: IconToken,
		readonly plugin: InlineIconsPlugin,
	) {
		super();
	}

	/**
	 * 修饰符也要参与比较：它们决定 DOM 上那两个 CSS 变量，漏掉的话把 `,1.5em`
	 * 改成 `,2em` 后 widget 会被判为「没变」而原样复用，尺寸不跟着动。
	 */
	eq(other: IconWidget): boolean {
		return (
			other.iconId === this.iconId &&
			other.token.source === this.token.source &&
			other.token.name === this.token.name &&
			sameModifiers(other.token.modifiers, this.token.modifiers)
		);
	}

	/**
	 * 画不出来时回落成原文那段代码，而不是留一个空 span。
	 *
	 * `buildDecorations` 已经问过解析链，走到这里还失败只可能是竞态（图标刚被删 /
	 * 包刚被停用，而变更事件还没把缓存冲掉）。CM6 的 `toDOM` 必须返回一个元素，
	 * 「这处不装饰」的判断在 builder 那一层，所以这里自行重建原文，
	 * 与阅读模式那条管线的表现对齐。
	 */
	toDOM(view: EditorView): HTMLElement {
		const doc = view.dom.ownerDocument;
		const el = createIconEl(this.plugin, doc, this.iconId, this.token);
		if (el) return el;

		return doc.win.createSpan({
			cls: UNRESOLVED_CLASS,
			text: `\`${formatTokenBody(this.token, this.plugin.grammarOptions)}\``,
		});
	}

	/** 返回 false：点击落回编辑器，光标能定位进记号，于是原文露出来可改。 */
	ignoreEvent(): boolean {
		return false;
	}
}

/** 逐段比较修饰符。数组短、绝大多数是空的，不值得为它建 Set 或拼字符串。 */
function sameModifiers(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((value, i) => value === b[i]);
}

function buildDecorations(
	plugin: InlineIconsPlugin,
	view: EditorView,
): DecorationSet {
	// 源码模式：原样显示记号
	if (!view.state.field(editorLivePreviewField)) return Decoration.none;

	const builder = new RangeSetBuilder<Decoration>();
	const options = plugin.grammarOptions;
	const tree = syntaxTree(view.state);

	for (const { from, to } of view.visibleRanges) {
		tree.iterate({
			from,
			to,
			enter: (node) => {
				const names = new Set(node.type.name.split("_"));
				// 反引号本身带 formatting，排除掉，只要内容体
				if (!names.has("inline-code")) return;
				if (names.has("formatting")) return;

				const span = codeSpanAt(view, node);
				if (span === null) return;

				// 光标贴着记号边缘也要露出原文
				if (overlapsSelection(view.state.selection, span.start, span.end)) {
					return;
				}

				const token = parseTokenBody(span.body, options);
				if (token === null) return;

				const iconId = plugin.resolver.resolve(token);
				if (iconId === null) {
					// 保留原文，只打一个可诊断的类名
					builder.add(
						span.start,
						span.end,
						Decoration.mark({ class: UNRESOLVED_CLASS }),
					);
					return;
				}

				builder.add(
					span.start,
					span.end,
					Decoration.replace({
						widget: new IconWidget(iconId, token, plugin),
					}),
				);
			},
		});
	}

	return builder.finish();
}

/**
 * 求出「含那对反引号」的完整范围与内容体。
 *
 * 语法树里 `inline-code` 节点通常只覆盖内容体，反引号是相邻的 formatting 节点；
 * 但不同版本也可能把反引号并进来。两种形状都认，认不出就返回 `null`——
 * 宁可这一处不渲染，也不要切错范围把用户的字吃掉。
 */
function codeSpanAt(
	view: EditorView,
	node: SyntaxNodeRef,
): { start: number; end: number; body: string } | null {
	const doc = view.state.doc;
	const raw = view.state.sliceDoc(node.from, node.to);

	if (raw.startsWith("`") && raw.endsWith("`") && raw.length >= 2) {
		return {
			start: node.from,
			end: node.to,
			body: raw.slice(1, -1),
		};
	}

	const start = node.from - 1;
	const end = node.to + 1;
	if (start < 0 || end > doc.length) return null;
	if (view.state.sliceDoc(start, node.from) !== "`") return null;
	if (view.state.sliceDoc(node.to, end) !== "`") return null;

	return { start, end, body: raw };
}

function overlapsSelection(
	selection: EditorSelection,
	from: number,
	to: number,
): boolean {
	return selection.ranges.some(
		(range) => range.to >= from && range.from <= to,
	);
}
