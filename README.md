English | [中文](https://github.com/Raven-Pensieve/obsidian-inline-icons/blob/master/README.ZH.md)

# Inline Icons

Write icons into the body of a note. `` `icon:sun` `` renders as an icon, inline with the surrounding text, at the surrounding font size and colour.

![GitHub Socialify](https://socialify.git.ci/Raven-Pensieve/obsidian-inline-icons/image?description=1&font=Rokkitt&forks=1&issues=1&language=1&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

## Syntax

The token is an ordinary inline code span, so a note stays readable with the plugin disabled or uninstalled. What gets written to the file is the real icon ID, verbatim — no prefix is added or stripped, so a token can never point at the wrong icon.

```md
Weather is `icon:lucide-sun` today, remind me at `icon:lucide-alarm-clock` nine.

`icon:lucide-sun`                    an icon Obsidian ships with
`icon:CI-mdi-outlined-1k`            an icon from an installed icon pack
`icon:CI-my-icon`                    an SVG you imported (the ID comes from the file name)
```

Shorthands are accepted when you write them by hand — the plugin tries `<name>`, then `lucide-<name>`, then `CI-<name>` — and a source segment narrows the search to one origin:

```md
`icon:sun`                  shorthand for lucide-sun
`icon:ci:my-icon`           only your imported SVGs
`icon:mdi:outlined-1k`      only the "mdi" pack
`icon:lucide:sun`           built-in first, icon pack as fallback
```

- The `icon` prefix is configurable.
- An unknown name **keeps the original text** with a dotted underline, rather than rendering a blank box — so a typo, a disabled pack or a deleted icon is visible.
- Only the code-span form renders. Bare `icon:sun` in prose is always left alone; to show a token without rendering it, wrap it in double backticks.

### Colour and size

Append modifiers after a comma, in any order:

```md
`icon:lucide-sun,1.5em`                  1.5× the surrounding font size
`icon:lucide-sun,#e5a50a`                a specific colour
`icon:lucide-sun,1.5em,red`              both
`icon:lucide-sun,rgb(255, 0, 0)`         any CSS colour function, commas and all
`icon:lucide-sun,light-dark(#eee, #222)` one colour per light/dark mode
`icon:lucide-sun,--text-accent`          a theme variable, so it follows the theme
`icon:lucide-sun,clamp(1em, 2vw, 2em)`   a responsive size
```

- **Size** — any CSS length (`1.5em`, `20px`, `.5rem`, `3vw`, `2ch`) plus `calc()`, `min()`, `max()` and `clamp()`. The unit is required; `%` is not accepted. Defaults to `1em`.
- **Colour** — hex, CSS colour keywords, and every common colour function in either notation: `rgb(255, 0, 0)` and `rgb(255 0 0)`, `hsl()`, `oklch()`, `color-mix()`, `light-dark()`. Defaults to the surrounding text colour.
- **Theme variables** — write `--text-accent` or `var(--text-accent)`. A variable name says nothing about its type, so names that look like lengths (`--icon-l`, `--size-4-2`) are treated as sizes and everything else as a colour. To settle it yourself: `size:--my-length` or `color:--my-brand`.
- An unrecognised modifier is simply ignored — a typo in the colour never makes the whole token fall back to plain text.

Both defaults are CSS variables on `.inline-icon` (`--ii-icon-size`, `--ii-icon-color`), so you can change them globally in your own CSS snippet.

## Writing a token

You never type the backticks — the plugin writes them. Four paths, all landing on the same code:

| Path | What it does |
| --- | --- |
| **Suggester** | Type `i:su` (the alias is configurable) and pick from the list. Candidates carry a preview and their source; picking one writes the complete token. |
| **Insert icon** | A command with fuzzy search over every available icon. Insert only. |
| **Insert icon from the icon library** | Opens [Custom Icons](https://github.com/Raven-Pensieve/obsidian-custom-icons)' icon picker — grouped grid, favorites and recents shared across both plugins. Falls back to the fuzzy search when Custom Icons is not installed. |
| **Right-click menu** | On an existing token: change the icon or remove it, keeping the other modifiers. Elsewhere: insert. |

The two commands and the right-click menu treat a token under the cursor as "change", not "insert". There is also **Re-render icons in this note** for when something has not caught up.

## Which icons are available

| Installed | Available icons |
| --- | --- |
| Inline Icons alone | The icons Obsidian ships with (its bundled Lucide subset) |
| \+ [Custom Icons](https://github.com/Raven-Pensieve/obsidian-custom-icons) | \+ every SVG you imported and every icon pack you installed — Iconify's full catalogue (220+ sets) and any npm package of loose SVGs |

Custom Icons is not a dependency, it is an amplifier. The baseline needs no cross-plugin API at all: Custom Icons registers its icons as ordinary Obsidian global icons, and this plugin resolves names against Obsidian's registry. When it is present, its API adds three things — the Lucide icons Obsidian does not ship, authoritative pack membership for `icon:<packId>:`, and its icon picker — and each of them disappears cleanly when it is not.

Icon sets change without the plugin list changing (you delete an SVG, you disable a pack), so this plugin listens for Custom Icons' change event and re-renders. Disable Custom Icons and every `CI-*` token falls back to its original text immediately, rather than going blank.

## Where it renders

| Surface | Renders |
| --- | --- |
| Reading view, Live Preview | ✅ |
| Embeds `![[note]]`, hover preview, Canvas cards, PDF export | ✅ |
| Source mode | ❌ by design — you must be able to see what you wrote |
| Inside code blocks, inline code, frontmatter, math, link text | ❌ by design |
| File names, tab titles, outline, search result excerpts | ❌ — those are plain strings, not rendered Markdown |
| Obsidian Publish | ❌ — plugins do not run there |

Move the cursor onto a token in Live Preview and the original text comes back so you can edit it.

## Installation

### Community plugin market

[Click to install](obsidian://show-plugin?id=inline-icons), or open `Settings → Community Plugins`, search for "Inline Icons" and install.

### BRAT (beta versions)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Click "Add Beta plugin" in BRAT settings
3. Enter `Raven-Pensieve/obsidian-inline-icons`

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Raven-Pensieve/obsidian-inline-icons&type=Timeline)](https://www.star-history.com/#Raven-Pensieve/obsidian-inline-icons&Timeline)
