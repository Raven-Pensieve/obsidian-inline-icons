/**
 * **唯一写盘口**：把「用户选了图标 X、颜色 Y」落成编辑器里的一次改动。
 *
 * 四条输入路径（补全 / 插入命令 / 图标选择器 / 右键菜单）最终都收在这里，
 * 于是三条不变量各自只有一处实现：
 *
 * 1. **反引号由插件补**（P2）——经 `resolver.tokenFor()`，从不手拼；
 * 2. **只写真实注册 id**——来源段是输入期的便利，不落盘；
 * 3. **记一次「最近使用」**。
 *
 * 收拢之前每条路径各自 `replaceSelection`，再加一条「替换某个区间」就会变成
 * 四处写盘，而修饰符保留规则只要有一处漏掉就会**静默吃掉用户写的颜色或尺寸**。
 *
 * ## 插入态与编辑态的分野
 *
 * 区别全在 {@link IconEditTarget} 是否为 `null`，而**受影响的是颜色语义**：
 * 契约里 `color: undefined` 意为「未改动，调用方应保留原值」。插入态没有原值，
 * 所以它退化成「不写颜色段」；编辑态才第一次真正有意义——必须**原样留下**
 * 用户已经写好的那一段（可能是 `--text-accent` 这种传不进色板的写法）。
 */
import { LL } from "@src/i18n/i18n";
import type InlineIconsPlugin from "@src/main";
import { canReference, type IconToken } from "@src/syntax/grammar";
import { locateTokenAt } from "@src/syntax/locate";
import { replaceColorModifier } from "@src/syntax/modifiers";
import { Notice, type Editor, type EditorPosition } from "obsidian";

/**
 * 只有 `#rrggbb` / `#rgb` 这类十六进制值才落成颜色修饰符。
 *
 * 提供方的色板是 `<input type="color">`，产出的一定是 `#rrggbb`，所以这条校验
 * 平时不会拦下任何东西——它挡的是**将来**：若提供方哪天改成能给 `var(--x)`
 * 这类**含义会随主题漂移**的写法，那不该由一次「点色板」的动作静默写进用户笔记。
 *
 * 注意这不是「修饰符层只认 hex」——它认得的写法多得多（`rgb(1,2,3)`、`oklch()`、
 * `color-mix()`，见 `syntax/modifiers.ts`）。**用户手写什么都行**，
 * 而本常量约束的是「提供方通过回调递过来的值」，两件事口径本来就不同。
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * 要改写的那个已存在的记号。`null` 表示**插入态**（在光标 / 选区处新写一个）。
 *
 * 区间 `[from, to)` **含那对反引号**，来自 `syntax/locate.ts` 的 `locateTokenAt`。
 */
export interface IconEditTarget {
	from: EditorPosition;
	to: EditorPosition;
	/** 原记号，其 `modifiers` 是「保留用户已写内容」的依据。 */
	token: IconToken;
}

/**
 * 把选中的图标写进编辑器。
 *
 * @param target `null` = 插入；否则整段替换那个记号。
 * @param color 契约的三态：`undefined` 未改动 / `""` 显式重置 / `#rrggbb` 选了色。
 */
export function applyIconPick(
	plugin: InlineIconsPlugin,
	editor: Editor,
	target: IconEditTarget | null,
	id: string,
	color: string | undefined,
): void {
	if (!canReference(id)) {
		// 含冒号 / 逗号 / 反引号的 id 写不进记号（那几个字符有结构含义）。
		// 补全的候选池会提前剔掉它们，但图标选择器是提供方的，列的是全部图标
		new Notice(LL.commands.pickIcon.unreferenceable({ id }));
		return;
	}

	const text = plugin.resolver.tokenFor(
		id,
		plugin.grammarOptions,
		nextModifiers(target, color),
	);

	if (target === null) {
		editor.replaceSelection(text);
	} else {
		editor.replaceRange(text, target.from, target.to);
		// 光标停在记号之后：接着打字不会落进记号里把它破坏掉。
		// 记号不含换行，所以终点必然与起点同行
		editor.setCursor({
			line: target.from.line,
			ch: target.from.ch + text.length,
		});
	}

	void plugin.rememberIcon(id);
}

/** 整段删除一个记号（含那对反引号）。菜单的「移除图标」与弹窗的「清除图标」共用。 */
export function removeIconToken(
	editor: Editor,
	target: IconEditTarget,
): void {
	editor.replaceRange("", target.from, target.to);
}

/**
 * 光标处落在哪个已存在的记号里；不在任何记号里时返回 `null`（= 插入态）。
 *
 * 菜单与命令**共用这一份**：两条路径若各自判定，就会出现「右键说能改、命令却插了一个新的」。
 *
 * **`includeEdges: true`**：实时预览里记号被折叠成 widget（`Decoration.replace`），
 * 右键点在图标上时 caret 落在**被替换区间的边界**而不是内部——按开区间判定的话，
 * 右键点图标永远定位不到自己那个记号。副作用是紧贴外侧一个字符处也会命中，
 * 那只是多一个菜单项，比漏掉「点图标本身」轻得多。
 *
 * 用 `getCursor("from")` 而不是 `getCursor()`：用户可能拖选了一段，
 * 取选区起点比取 head 端稳定（反向选区的 head 在左边）。
 */
export function locateIconTarget(
	plugin: InlineIconsPlugin,
	editor: Editor,
): IconEditTarget | null {
	const cursor = editor.getCursor("from");
	const { syntax, suggest } = plugin.settings;

	const located = locateTokenAt(
		editor.getLine(cursor.line),
		cursor.ch,
		[syntax.prefix, suggest.alias],
		{ includeEdges: true },
	);
	if (located === null) return null;

	return {
		from: { line: cursor.line, ch: located.start },
		to: { line: cursor.line, ch: located.end },
		token: located.token,
	};
}

/**
 * 新记号该带哪些修饰符——**本方案唯一容易做错的地方**，见 `dev/context-menu-editing.md`
 * 的保留矩阵。
 *
 * | 场景 | target | color | 结果 |
 * | --- | --- | --- | --- |
 * | 插入，没碰颜色 | `null` | `undefined` | 无修饰符 |
 * | 插入，选了色 | `null` | `#123456` | `,#123456` |
 * | 换图标，没碰颜色 | 有 | `undefined` | **原样保留**旧的全部修饰符 |
 * | 换图标，选了色 | 有 | `#123456` | 颜色换掉，尺寸与认不出的段都留着 |
 * | 换图标，点重置 | 有 | `""` | 颜色段消失，其余留着 |
 *
 * 「默认色不写修饰符」不只是省字符：记号里没有颜色段时，图标会跟随所在段落
 * （标题、加粗、链接色）与深浅色主题变化，而写死一个 hex 就把它钉住了。
 */
function nextModifiers(
	target: IconEditTarget | null,
	color: string | undefined,
): string[] {
	const previous = target?.token.modifiers ?? [];

	// 未改动：插入态没有原值可留（→ 空），编辑态则原样保留用户已写的一切。
	// 这一支是 `--text-accent` 这类传不进色板的写法能活下来的原因
	if (color === undefined) return [...previous];

	const trimmed = color.trim();
	// 显式重置（`""`），或提供方给了本层不认的写法：都当作「回到跟随正文色」。
	// 编辑态要真的把旧颜色段删掉，所以不能直接返回 previous
	if (trimmed === "" || !HEX_COLOR.test(trimmed)) {
		return replaceColorModifier(previous, null);
	}

	return replaceColorModifier(previous, trimmed.toLowerCase());
}
