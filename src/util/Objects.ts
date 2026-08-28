export class Objects {
	static exists(obj: unknown): boolean {
		return obj !== null && obj !== undefined;
	}

	static isNullOrUndefined(obj: unknown): boolean {
		return obj === null || obj === undefined;
	}

	/**
	 * 按点分路径读取嵌套值，路径中任一段不存在则返回 `undefined`。
	 *
	 * 数组用下标段访问（`advanced.bookmarks.0.name`）：JS 里数组下标本就是字符串键，
	 * 无需特殊处理。
	 */
	static getByPath(source: unknown, path: string): unknown {
		let current = source;
		for (const part of path.split(".")) {
			if (current === null || typeof current !== "object") {
				return undefined;
			}
			current = (current as Record<string, unknown>)[part];
		}
		return current;
	}
}
