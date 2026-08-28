import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * 契约 `.d.ts` 副本的漂移守卫。
 *
 * 全局共三份，提供方仓库那两份由它自己的 `test/contractSync.test.ts` 看着：
 *
 * | 文件 | 角色 |
 * | --- | --- |
 * | `obsidian-custom-icons/src/api/types.ts` | 权威源码 |
 * | `obsidian-custom-icons/docs/custom-icons-api.d.ts` | 给消费方复制的发布副本 |
 * | 本仓库 `src/api/custom-icons-api.d.ts` | 复制过来的那份，由本文件看着 |
 *
 * 缺了本守卫，提供方改契约时本仓库不会有任何反应：tsc 拿本地那份旧类型编译，
 * 一路绿灯，直到运行时才表现为「类型说有某个字段、实际没有」，而这类不一致的代价
 * 落在用户笔记里的 id 上。
 *
 * 单测读姊妹仓库是刻意的：它服务的是同时 checkout 两个仓库、正在改契约的人。
 * 姊妹仓库不在时整套 `describe.skip`，与提供方那条测试的处理方式一致。
 */

const ROOT = join(__dirname, "..");

/** 本仓库这份，也就是消费侧实际编译的那个文件。 */
const LOCAL_COPY = join(ROOT, "src", "api", "custom-icons-api.d.ts");

/**
 * 提供方仓库里那份「供消费方复制」的副本。
 *
 * 相对路径假设两个仓库是同级目录，这也是 dev/ 各文档互相引用的既有约定。
 * 优先 `docs/`：提供方的 `dev/` 整个被 gitignore，而 `docs/` 是它打算提交的发布
 * 副本——盯已提交的那份，才能在提供方发版时比出漂移。`dev/ecosystem/` 留作兜底。
 */
const UPSTREAM_CANDIDATES = [
	join(ROOT, "..", "obsidian-custom-icons", "docs", "custom-icons-api.d.ts"),
	join(
		ROOT,
		"..",
		"obsidian-custom-icons",
		"dev",
		"ecosystem",
		"custom-icons-api.d.ts",
	),
];

const UPSTREAM_COPY = UPSTREAM_CANDIDATES.find((path) => existsSync(path));

/**
 * 归一成「只剩声明」：注释是两边唯一该各写各的地方——上游那份讲「怎么复制过去」，
 * 本地这份将来若要补充消费侧的注解也不该因此报红。
 */
function declarationsOf(source: string): string[] {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "") // 块注释（含 JSDoc）
		.replace(/\/\/.*$/gm, "") // 行注释
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "");
}

const suite = UPSTREAM_COPY ? describe : describe.skip;

suite("契约副本与提供方仓库保持同步", () => {
	test("声明逐行一致（提供方改了契约就要重新复制过来）", () => {
		// 非空断言只在 describe.skip 分支下会是空，而那时本体不执行
		expect(declarationsOf(readFileSync(LOCAL_COPY, "utf8"))).toEqual(
			declarationsOf(readFileSync(UPSTREAM_COPY!, "utf8")),
		);
	});

	test("本地副本不含任何运行时值导出", () => {
		/*
		 * `.d.ts` 里的 const / function / class 导出对消费方是陷阱：打包后没有对应
		 * 实现，import 到的是 undefined。事件名常量正因如此住在
		 * `src/api/customIcons.ts` 里而不是这份类型文件里。
		 */
		const valueExports = readFileSync(LOCAL_COPY, "utf8").match(
			/^export\s+(const|let|var|function|class)\b/gm,
		);
		expect(valueExports).toBeNull();
	});
});
