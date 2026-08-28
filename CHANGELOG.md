# Changelog

## 1.0.0 (2026-08-28)


### ⚠ BREAKING CHANGES

* 落盘形态统一为 icon:{icon-id}

### ✨ 新增功能 (Features)

* icon:&lt;packId&gt;: 的候选池改问 Custom Icons 的 catalog() ([dea1872](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/dea18723a193f0f7a409cf9e4259f063fd6a0300))
* **suggest:** 候选行以短名当主、完整 id 弱化，插入命令两种形态都搜得到 ([6cf6ad0](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/6cf6ad09c0c5f5bd0842736000c17bc12f9679c5))
* **suggest:** 敲完 `icon:` 直接弹候选，来源段下不再拿注册前缀参与匹配 ([f78ed8b](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/f78ed8b79589153e21e6b1010dd8a452271b8eb6))
* 修饰符取值吃下全部常用 CSS 写法，修掉颜色被逗号切碎与尺寸变量被当颜色 ([4ee751e](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/4ee751e25d9a1a2c6557500101ef8e2f73c35d53))
* 修饰符落地，支持颜色与尺寸（逗号分隔） ([aed9745](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/aed9745c539c84296ce5633a814e0d2b20521182))
* 单字符别名也能光敲冒号直接触发补全 ([252f594](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/252f59499cd17a57aae88ce2394916905485b85c))
* 接上两条渲染管线与两条输入路径 ([a5a77be](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/a5a77bea8174bbd0906117340b6cb9121bca5c8d))
* 接入 Custom Icons 跨插件 API，修复图标失效不传播导致的空白记号 ([c849ca0](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/c849ca06ada99fe55f6a013b458f2c49553b8e3b))
* 编辑器右键菜单可插入/更换/移除正文图标 ([b4fb4c9](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/b4fb4c97f4f12a45e343188ad9c78ea4492f8c79))
* 落盘形态统一为 icon:{icon-id} ([30d0b68](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/30d0b68157c130e5e4e8c3c1b1dca5eb65192de3))
* 补全按来源段收窄候选池 ([6e69cbf](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/6e69cbf233755dc38feded6b4de2792238152810))
* 记号语法层与真实设置，清掉模板示例代码 ([c3ba72d](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/c3ba72da37ef08465b001982b981ffd6d96fa87b))


### 🐛 问题修复 (Bug Fixes)

* 修掉补全吃掉修饰符、全角冒号 id 指向错图标、实时预览不跟随图标集合变化 ([c6f01be](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/c6f01be5ba0a2cacd1b381b047b63d55e29b0e57))


### ♻️ 重构 (Refactor)

* **settings:** 砍到只剩三个真正会用的设置项，删掉裸形式与模板孤岛 ([a077d76](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/a077d76887d901edd36df821e86ef725e21b47a0))


### 📝 文档 (Documentation)

* 按 TS 规范整理注释，去掉开发史与碎碎念 ([5c7ebb5](https://github.com/Raven-Pensieve/obsidian-inline-icons/commit/5c7ebb5d67f02042a9fd8c4d710ec98a932b615e))
