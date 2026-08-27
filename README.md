English | [中文](https://github.com/Raven-Pensieve/obsidian-inline-icons/blob/master/README.ZH.md)

# Inline Icons

Write an icon into the body of a note. `` `icon:sun` `` renders as an icon, inline with the surrounding text, at the surrounding font size and colour.

> **Status: in development.** The M1 feature set is written — both rendering pipelines, the suggester and the insert command — but **none of it has been verified inside Obsidian yet**, and the plugin is not on the community plugin list. See [`dev/roadmap.md`](dev/roadmap.md) for the verification checklist.

![GitHub Socialify](https://socialify.git.ci/Raven-Pensieve/obsidian-inline-icons/image?description=1&font=Rokkitt&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

## Syntax

The token is an ordinary inline code span, so a note stays readable even with the plugin disabled or uninstalled. **What gets written is the real icon id, verbatim:**

```md
Weather is `icon:lucide-sun` today, remind me at `icon:lucide-alarm-clock` nine.

`icon:lucide-sun`                    Obsidian's built-in Lucide icon
`icon:CI-mdi-outlined-1k`            an icon from an installed icon pack
`icon:CI-vscode-icons-default-file`  ditto
`icon:CI-我的图标`                     an SVG you imported — the id comes from the file name, so it may be non-ASCII
```

The id is exactly what Custom Icons / Obsidian registered — no prefix is added or stripped, so a token can never point at the wrong icon.

Shorthands are accepted too (the plugin tries `<name>`, then `lucide-<name>`, then `CI-<name>`), and while typing you can narrow by source. The suggester still writes the full id:

```md
`icon:sun`                  shorthand for lucide-sun
`icon:ci:mdi-outlined-1k`   only Custom Icons' own registry
`icon:mdi:outlined-1k`      only the "mdi" pack
`icon:lucide:sun`           built-in first, icon pack as fallback
```

- The `icon` prefix is configurable.
- An unknown name **keeps the original text** rather than rendering a blank box, so a typo is visible.
- To show a token without rendering it, wrap it in double backticks: ``` ``` `icon:sun` ``` ```.
- Only the code-span form renders. Bare `icon:sun` in prose is always left alone.

### Colour and size

Append modifiers after a comma, **in any order**:

```md
`icon:lucide-sun,1.5em`           1.5× the surrounding font size
`icon:lucide-sun,#e5a50a`         a specific colour
`icon:lucide-sun,1.5em,red`       both
`icon:lucide-sun,--text-accent`   a theme variable, so it follows light/dark mode
```

- **Size**: `1.5em` / `20px` / `1rem` / `12pt` / `2ch` / `3ex` — **the unit is required**. Defaults to `1em`, i.e. the surrounding font size.
- **Colour**: hex (`#e5a50a`), CSS colour names (`red`), space-separated colour functions (`rgb(255 0 0)`, `oklch(0.7 0.1 60)`),
  and theme variables (`--text-accent`, or spelled out as `var(--text-accent)`). Defaults to the surrounding text colour.
- An unrecognised modifier is **simply ignored** — a typo in the colour never makes the whole token fall back to plain text.
- The comma is the separator, so the comma form `rgb(1,2,3)` cannot be used; write `rgb(1 2 3)` or hex instead.

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
