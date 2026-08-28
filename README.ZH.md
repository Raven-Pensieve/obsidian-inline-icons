中文 | [English](https://github.com/Raven-Pensieve/obsidian-inline-icons/blob/master/README.md)

# Inline Icons

把图标写进笔记正文。`` `icon:sun` `` 会渲染成一个图标，与周围文字同行、同字号、同颜色。

![GitHub Socialify](https://socialify.git.ci/Raven-Pensieve/obsidian-inline-icons/image?description=1&font=Rokkitt&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

## 语法

记号就是一段普通的行内代码，所以插件被禁用或卸载后笔记依然可读。写进文件的是真实的图标 id，一字不改、不增删前缀，因此一条记号永远不会指到别的图标上。

```md
今天天气 `icon:lucide-sun` 很好，记得 `icon:lucide-alarm-clock` 九点提醒我。

`icon:lucide-sun`                    Obsidian 自带的图标
`icon:CI-mdi-outlined-1k`            某个已安装图标包里的图标
`icon:CI-我的图标`                     你导入的 SVG（id 取自文件名，可以是中文）
```

手写时简写也认（依次尝试 `<名字>`、`lucide-<名字>`、`CI-<名字>`）；写上来源段则只在该来源里查：

```md
`icon:sun`                  lucide-sun 的简写
`icon:ci:我的图标`            只在你导入的 SVG 里找
`icon:mdi:outlined-1k`      只在 mdi 这个包里找
`icon:lucide:sun`           内置优先，图标包兜底
```

- 前缀 `icon` 可以在设置里改。
- 名字查不到时**保留原文**并加一条虚线下划线，而不是留一个空白方块——这样打错字、包被停用、图标被删都是看得见的。
- 只有带反引号的形态会渲染，正文里裸写的 `icon:sun` 一律不动；想展示语法本身而不渲染，用双反引号包起来。

### 颜色与尺寸

在记号后面用逗号追加修饰符，顺序随意：

```md
`icon:lucide-sun,1.5em`                  放大到 1.5 倍字号
`icon:lucide-sun,#e5a50a`                指定颜色
`icon:lucide-sun,1.5em,red`              两者一起
`icon:lucide-sun,rgb(255, 0, 0)`         任意 CSS 颜色函数，逗号写法照样能用
`icon:lucide-sun,light-dark(#eee, #222)` 深浅色主题各给一个色
`icon:lucide-sun,--text-accent`          用主题变量，跟着主题自动换
`icon:lucide-sun,clamp(1em, 2vw, 2em)`   响应式尺寸
```

- **尺寸** —— 任意 CSS 长度（`1.5em` / `20px` / `.5rem` / `3vw` / `2ch`），另认 `calc()` / `min()` / `max()` / `clamp()`。单位要写出来；不认 `%`。默认 `1em`。
- **颜色** —— 十六进制、CSS 颜色名，以及全部常用颜色函数，两种写法都行：`rgb(255, 0, 0)` 与 `rgb(255 0 0)`、`hsl()`、`oklch()`、`color-mix()`、`light-dark()`。默认跟随周围文字颜色。
- **主题变量** —— 写 `--text-accent` 或 `var(--text-accent)`。变量名本身不说明自己是颜色还是长度，所以名字看起来像尺寸的（`--icon-l` / `--size-4-2`）判成尺寸，其余判成颜色。想自己点明就加前缀：`size:--my-length` 或 `color:--my-brand`。
- 认不出的修饰符**只是被忽略**，图标照常显示——不会因为颜色打错而整条记号退回原文。

两个默认值是 `.inline-icon` 上的 CSS 变量（`--ii-icon-size`、`--ii-icon-color`），可以在自己的 CSS 片段里统一改。

## 怎么写进去

反引号一律由插件补，不需要自己敲。四条输入路径，最终都汇到同一处写盘口：

| 路径                 | 作用                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **补全**             | 敲 `i:su`（别名可改）弹出候选，带图标预览与来源，回车即写入完整记号                                                                                     |
| **插入图标**         | 命令，模糊搜索全部可用图标。只插入                                                                                                                      |
| **从图标库插入图标** | 借 [Custom Icons](https://github.com/Raven-Pensieve/obsidian-custom-icons) 的图标选择器——分组网格，收藏与最近跨插件共享。它不在场时退回上面那个模糊搜索 |
| **右键菜单**         | 光标在已有记号上：更换图标或移除，保留其余修饰符。其他位置：插入                                                                                        |

两个命令与右键菜单在光标落在已有记号里时都是「更换」而不是「插入」。另有 **重新渲染本笔记的图标** 一条，用于哪里没跟上时手动刷。

## 能用哪些图标

| 装了什么                                                                   | 可用图标                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 只装 Inline Icons                                                          | Obsidian 自带的那些图标（它内置的 Lucide 子集）                                                        |
| \+ [Custom Icons](https://github.com/Raven-Pensieve/obsidian-custom-icons) | \+ 你导入的每个 SVG，以及你安装的每个图标包——Iconify 全量目录（220+ 集合）与任意提供散装 SVG 的 npm 包 |

Custom Icons 不是依赖，而是增幅器。基线完全不需要跨插件 API：Custom Icons 把图标注册成普通的 Obsidian 全局图标，本插件只是拿名字去注册表里查。它在场时，它的 API 额外带来三样东西——Obsidian 未内置的那批 Lucide、`icon:<packId>:` 的权威成员表、它的图标选择器——各自在它不在场时整档消失。

图标集合会在插件集不变的情况下发生变化（删个 SVG、停用个包），所以本插件监听 Custom Icons 的变更事件并重渲染。禁用 Custom Icons 后，全部 `CI-*` 记号会立刻退回原文而不是留白。

## 哪些界面会渲染

| 界面                                                  | 渲染                                     |
| ----------------------------------------------------- | ---------------------------------------- |
| 阅读模式、实时预览                                    | ✅                                        |
| 内嵌 `![[note]]`、悬浮预览、Canvas 卡片、导出 PDF     | ✅                                        |
| 源码模式                                              | ❌ 故意不渲染——你必须能看到自己写下的原文 |
| 代码块 / 行内代码 / frontmatter / 公式 / 链接文本内部 | ❌ 故意不渲染                             |
| 文件名、标签页标题、大纲、搜索结果摘要                | ❌ 那些是纯字符串，不走 Markdown 渲染     |
| Obsidian Publish                                      | ❌ 插件不在那里运行                       |

在实时预览里把光标移到记号上，原文会露出来供你编辑。

## 安装

### 社区插件市场

[点击安装](obsidian://show-plugin?id=inline-icons)，或打开 `设置 → 第三方插件`，搜索 “Inline Icons” 并安装。

### BRAT（测试版本）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 在 BRAT 设置中点击「添加测试插件」
3. 输入 `Raven-Pensieve/obsidian-inline-icons`

## 许可证

GPL-3.0 —— 详见 [LICENSE](LICENSE)。

## Star 历史

[![Star 历史图表](https://api.star-history.com/svg?repos=Raven-Pensieve/obsidian-inline-icons&type=Timeline)](https://www.star-history.com/#Raven-Pensieve/obsidian-inline-icons&Timeline)
