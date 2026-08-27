English | [中文](https://github.com/Raven-Pensieve/obsidian-inline-icons/blob/master/README.ZH.md)

# Inline Icons

Write an icon into the body of a note. `` `icon:sun` `` renders as an icon, inline with the surrounding text, at the surrounding font size and colour.

> **Status: in development.** The syntax and the scope are settled; the implementation is not shipped yet (milestone M1, see [`dev/roadmap.md`](dev/roadmap.md)). The plugin is not on the community plugin list, and `` `icon:…` `` does nothing until M1 lands.

![GitHub Socialify](https://socialify.git.ci/Raven-Pensieve/obsidian-inline-icons/image?description=1&font=Rokkitt&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

## Syntax

The token is an ordinary inline code span, so a note stays readable even with the plugin disabled or uninstalled:

```md
Weather is `icon:sun` today, remind me at `icon:alarm-clock` nine.

`icon:sun`            resolve automatically (built-in Lucide → Custom Icons → icon packs)
`icon:lucide:sun`     pin to Lucide
`icon:ci:my-logo`     pin to an SVG you imported into Custom Icons
`icon:mdi:home`       pin to a specific icon pack
```

- The `icon` prefix is configurable.
- An unknown name **keeps the original text** rather than rendering a blank box, so a typo is visible.
- To show a token without rendering it, wrap it in double backticks: ``` ``` `icon:sun` ``` ```.
- Only the code-span form renders. Bare `icon:sun` in prose is left alone by default (there is an opt-in escape hatch in the settings).

Typing it does **not** require typing backticks: type `i:su`, pick from the suggester, and the plugin writes `` `icon:sun` `` including the pair of backticks. There is also a command (bind your own hotkey) that opens a fuzzy search over every available icon.

## Which icons are available

| Installed | Available icons |
| --- | --- |
| Inline Icons alone | The icons Obsidian ships with (its bundled Lucide subset) |
| \+ [Custom Icons](https://github.com/Raven-Pensieve/obsidian-custom-icons) | \+ every SVG you imported, and every icon pack you installed — Iconify's full catalogue (220+ sets) and any npm package of loose SVGs |

Inline Icons works standalone — Custom Icons is not a dependency, it is an amplifier. There is no cross-plugin API involved: Custom Icons registers its icons as regular Obsidian global icons (prefixed `CI-`), and this plugin just resolves names against Obsidian's icon registry.

## Where it renders

| Surface | Renders |
| --- | --- |
| Reading view, Live Preview | ✅ |
| Embeds `![[note]]`, hover preview, Canvas cards | ✅ |
| Source mode | ❌ by design — you must be able to see what you wrote |
| Inside code blocks, inline code, frontmatter, math, link text | ❌ by design |
| File names, tab titles, outline, search result excerpts | ❌ — those are plain strings, not rendered Markdown |
| Obsidian Publish | ❌ — plugins do not run there |

Move the cursor onto a token and the original text comes back so you can edit it.

## Installation

### BRAT (while it is unreleased)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Click "Add Beta plugin" in BRAT settings
3. Enter `Raven-Pensieve/obsidian-inline-icons`
4. Enable the plugin

### Community plugin market

Not submitted yet.

## License

This project is licensed under the GNU GPL v3.0 — see the [LICENSE](LICENSE) file for details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Raven-Pensieve/obsidian-inline-icons&type=Timeline)](https://www.star-history.com/#Raven-Pensieve/obsidian-inline-icons&Timeline)
