/**
 * 测试用例里用 `|` 标出光标位置，省得手数列号。
 *
 * 拆分只做一次并当场校验：写了两个 `|` 时直接报错，而不是悄悄只吃掉第一个
 * ——后者会让之后所有的 start/end 断言按错位的行文本去比，测试照样绿。
 */
export function splitCaret(lineWithCaret: string): {
	line: string;
	ch: number;
} {
	const ch = lineWithCaret.indexOf("|");
	if (ch < 0) throw new Error("测试用例里要用 | 标出光标位置");
	const after = lineWithCaret.slice(ch + 1);
	if (after.includes("|")) {
		throw new Error(`测试用例里只能有一个 |：${lineWithCaret}`);
	}
	return { line: lineWithCaret.slice(0, ch) + after, ch };
}
