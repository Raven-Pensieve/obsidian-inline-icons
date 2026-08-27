中文 | [English](https://github.com/Raven-Pensieve/obsidian-inline-icons/blob/master/README.md)

# Inline Icons

把图标写进笔记正文。`` `icon:sun` `` 会渲染成一个图标，与周围文字同行、同字号、同颜色。

> **状态：开发中。** M1 的功能已经写完（两条渲染管线、补全、插入命令），但**还没有在 Obsidian 里验证过一条**，
> 也尚未上架社区插件列表。验证清单见 [`dev/roadmap.md`](dev/roadmap.md)。

![GitHub Socialify](https://socialify.git.ci/Raven-Pensieve/obsidian-inline-icons/image?description=1&font=Rokkitt&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

## 语法

记号就是一段普通的行内代码，所以即便插件被禁用或卸载，笔记依然是可读的。**写进文件的是真实的图标 id，一字不改：**

```md
今天天气 `icon:lucide-sun` 很好，记得 `icon:lucide-alarm-clock` 九点提醒我。

`icon:lucide-sun`                    Obsidian 内置的 Lucide 图标
`icon:CI-mdi-outlined-1k`            某个已安装图标包里的图标
`icon:CI-vscode-icons-default-file`  同上
`icon:CI-我的图标`                     你导入的 SVG —— id 取自文件名，所以可以是中文
```

这里的 id 就是 Custom Icons / Obsidian 注册的那个，不加也不删前缀，因此一条记号永远不会指到别的图标上。

简写也认（插件会依次尝试 `<名字>`、`lucide-<名字>`、`CI-<名字>`）；输入时还能按来源筛选，但补全写进文件的仍是完整 id：

```md
`icon:sun`                  lucide-sun 的简写
`icon:ci:mdi-outlined-1k`   只在 Custom Icons 自己的注册表里找
`icon:mdi:outlined-1k`      只在 mdi 这个包里找
`icon:lucide:sun`           内置优先，图标包兜底
```

- 前缀 `icon` 可以在设置里改。
- 名字查不到时**保留原文**，而不是留一个空白方块——这样打错字是看得见的。
- 想展示语法本身而不渲染，用双反引号包起来：``` ``` `icon:sun` ``` ```。
- 只有带反引号的形态会渲染，正文里裸写的 `icon:sun` 一律不动。

### 颜色与尺寸

在记号后面用逗号追加修饰符，**顺序随意**：

```md
`icon:lucide-sun,1.5em`                  放大到 1.5 倍字号
`icon:lucide-sun,#e5a50a`                指定颜色
`icon:lucide-sun,1.5em,red`              两者一起
`icon:lucide-sun,rgb(255, 0, 0)`         任意 CSS 颜色函数，逗号写法照样能用
`icon:lucide-sun,light-dark(#eee, #222)` 深浅色主题各给一个色
`icon:lucide-sun,--text-accent`          用主题变量，跟着主题自动换
`icon:lucide-sun,clamp(1em, 2vw, 2em)`   响应式尺寸
```

- **尺寸**：任意 CSS 长度——`1.5em` / `20px` / `.5rem` / `3vw` / `2ch`，另外还认 `calc()` / `min()` / `max()` / `clamp()`。
  **单位要写出来**，默认 `1em`（跟随周围字号）。不认 `%`：百分比相对图标自己那个盒子算，写了没有意义。
- **颜色**：十六进制（`#e5a50a`）、CSS 颜色名（`red`），以及**全部常用颜色函数**，两种写法都行——
  `rgb(255, 0, 0)` 与 `rgb(255 0 0)`、`hsl(30, 100%, 50%)`、`oklch(0.7 0.15 60)`、
  `color-mix(in oklch, red 50%, blue)`、`light-dark(#eee, #222)`。默认跟随周围文字颜色。
- **主题变量**：写 `--text-accent`（简写）或 `var(--text-accent)`。变量名本身不说明自己是颜色还是长度，
  所以名字看起来像尺寸的（`--icon-l` / `--size-4-2` / `--nav-item-size`）判成尺寸，其余判成颜色。
  想自己点明就加前缀：`size:--my-length` 或 `color:--my-brand`。
- 写错的修饰符**只是被忽略**，图标照常显示——不会因为颜色打错而整条记号退回原文。

**输入时不需要自己敲反引号**：敲 `i:su` 弹出候选，回车后插件会把 `` `icon:sun` `` 连同那一对反引号整段写进去。另有一个命令（快捷键自己绑）打开模糊搜索，列出全部可用图标。

## 能用哪些图标

| 装了什么 | 可用图标 |
| --- | --- |
| 只装 Inline Icons | Obsidian 自带的那些图标（它内置的 Lucide 子集） |
| \+ [Custom Icons](https://github.com/Raven-Pensieve/obsidian-custom-icons) | \+ 你导入的每个 SVG，以及你安装的每个图标包 —— Iconify 全量目录（220+ 集合）与任意提供散装 SVG 的 npm 包 |

Inline Icons 可以独立工作 —— Custom Icons 不是依赖，而是增幅器。两者之间没有跨插件 API：Custom Icons 把图标注册成普通的 Obsidian 全局图标（前缀 `CI-`），本插件只是拿名字去 Obsidian 的图标注册表里查。

## 哪些界面会渲染

| 界面 | 渲染 |
| --- | --- |
| 阅读模式、实时预览 | ✅ |
| 内嵌 `![[note]]`、悬浮预览、Canvas 卡片 | ✅ |
| 源码模式 | ❌ 故意不渲染 —— 你必须能看到自己写下的原文 |
| 代码块 / 行内代码 / frontmatter / 公式 / 链接文本内部 | ❌ 故意不渲染 |
| 文件名、标签页标题、大纲、搜索结果摘要 | ❌ —— 那些是纯字符串，不走 Markdown 渲染 |
| Obsidian Publish | ❌ —— 插件不在那里运行 |

把光标移到记号上，原文会露出来供你编辑。

## 安装

### BRAT（未发布期间）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 在 BRAT 设置中点击「添加测试插件」
3. 输入 `Raven-Pensieve/obsidian-inline-icons`
4. 启用插件

### 社区插件市场

尚未提交。

## 许可证

本项目基于 GNU GPL v3.0 许可 —— 详情请参阅 [LICENSE](LICENSE) 文件。

## Star 历史

[![Star 历史图表](https://api.star-history.com/svg?repos=Raven-Pensieve/obsidian-inline-icons&type=Timeline)](https://www.star-history.com/#Raven-Pensieve/obsidian-inline-icons&Timeline)
