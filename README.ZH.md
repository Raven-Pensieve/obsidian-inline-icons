中文 | [English](https://github.com/Raven-Pensieve/obsidian-inline-icons/blob/master/README.md)

# Inline Icons

把图标写进笔记正文。`` `icon:sun` `` 会渲染成一个图标，与周围文字同行、同字号、同颜色。

> **状态：开发中。** M1 的功能已经写完（两条渲染管线、补全、插入命令），但**还没有在 Obsidian 里验证过一条**，
> 也尚未上架社区插件列表。验证清单见 [`dev/roadmap.md`](dev/roadmap.md)。

![GitHub Socialify](https://socialify.git.ci/Raven-Pensieve/obsidian-inline-icons/image?description=1&font=Rokkitt&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

## 语法

记号就是一段普通的行内代码，所以即便插件被禁用或卸载，笔记依然是可读的：

```md
今天天气 `icon:sun` 很好，记得 `icon:alarm-clock` 九点提醒我。

`icon:sun`            自动解析（内置 Lucide → Custom Icons 的 SVG → 图标包）
`icon:lucide:sun`     钉死 Lucide
`icon:ci:my-logo`     钉死你导入 Custom Icons 的某个 SVG
`icon:mdi:home`       钉死某个图标包
```

- 前缀 `icon` 可以在设置里改。
- 名字查不到时**保留原文**，而不是留一个空白方块——这样打错字是看得见的。
- 想展示语法本身而不渲染，用双反引号包起来：``` ``` `icon:sun` ``` ```。
- 只有带反引号的形态会渲染，正文里裸写的 `icon:sun` 默认不动（设置里有一个默认关闭的逃生开关）。

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
