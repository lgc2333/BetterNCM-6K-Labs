---
version: alpha
name: 6K Labs Settings
description: Theme-agnostic settings-page identity for the 6K Labs BetterNCM plugin - translucent alpha surfaces that sit on any NetEase Cloud Music theme, NCM-red accents, quiet rows, one status voice.
colors:
  primary: '#C20C0C'
  primary-dark-host: '#FF5C5C'
  on-accent: '#FFFFFF'
  ok: '#14935C'
  ok-dark-host: '#3ECF8E'
  error: '#C93A52'
  error-dark-host: '#FF8091'
  warning: '#B26A0B'
  warning-dark-host: '#F0B357'
  text-primary: 'rgba(0, 0, 0, 0.88)'
  text-secondary: 'rgba(0, 0, 0, 0.55)'
  text-tertiary: 'rgba(0, 0, 0, 0.38)'
  text-primary-dark-host: 'rgba(255, 255, 255, 0.94)'
  text-secondary-dark-host: 'rgba(255, 255, 255, 0.62)'
  text-tertiary-dark-host: 'rgba(255, 255, 255, 0.40)'
  border: 'rgba(0, 0, 0, 0.10)'
  border-dark-host: 'rgba(255, 255, 255, 0.12)'
  surface: 'rgba(255, 255, 255, 0.55)'
  surface-strong: 'rgba(255, 255, 255, 0.78)'
  surface-dark-host: 'rgba(255, 255, 255, 0.07)'
  surface-strong-dark-host: 'rgba(255, 255, 255, 0.13)'
  control: 'rgba(0, 0, 0, 0.05)'
  control-hover: 'rgba(0, 0, 0, 0.09)'
  control-dark-host: 'rgba(255, 255, 255, 0.08)'
  control-hover-dark-host: 'rgba(255, 255, 255, 0.14)'
  error-surface: 'rgba(201, 58, 82, 0.10)'
  error-surface-dark-host: 'rgba(255, 128, 145, 0.12)'
typography:
  page-title:
    fontSize: 22px
    fontWeight: 700
    lineHeight: '1.3'
  section-label:
    fontSize: 11.5px
    fontWeight: 650
    lineHeight: '1.4'
    letterSpacing: '0.14em'
  row-title:
    fontSize: 14px
    fontWeight: 600
    lineHeight: '1.4'
  status-value:
    fontSize: 15px
    fontWeight: 600
    lineHeight: '1.4'
  body:
    fontSize: 14px
    fontWeight: 400
    lineHeight: '1.6'
  caption:
    fontSize: 12px
    fontWeight: 400
    lineHeight: '1.5'
  data-mono:
    fontSize: 11.5px
    fontWeight: 400
    lineHeight: '1.5'
rounded:
  sm: 10px
  md: 14px
  lg: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.lg}'
    padding: 16px
  card-dark-host:
    backgroundColor: '{colors.surface-dark-host}'
    textColor: '{colors.text-primary-dark-host}'
    rounded: '{rounded.lg}'
    padding: 16px
  row-icon:
    backgroundColor: '{colors.control}'
    textColor: '{colors.text-secondary}'
    size: 36px
    rounded: '{rounded.sm}'
  row-icon-dark-host:
    backgroundColor: '{colors.control-dark-host}'
    textColor: '{colors.text-secondary-dark-host}'
    size: 36px
    rounded: '{rounded.sm}'
  status-value-ok:
    textColor: '{colors.ok}'
  status-value-ok-dark-host:
    textColor: '{colors.ok-dark-host}'
  status-value-error:
    textColor: '{colors.error}'
  status-value-error-dark-host:
    textColor: '{colors.error-dark-host}'
  segmented-active:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-accent}'
    rounded: '{rounded.sm}'
    padding: 5px 11px
  ghost-button:
    textColor: '{colors.text-secondary}'
    rounded: '{rounded.sm}'
    padding: 7px 14px
  ghost-button-armed:
    backgroundColor: '{colors.error}'
    textColor: '{colors.on-accent}'
    rounded: '{rounded.sm}'
    padding: 7px 14px
  ghost-button-hover:
    backgroundColor: '{colors.control-hover}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.sm}'
    padding: 7px 14px
  ghost-button-hover-dark-host:
    backgroundColor: '{colors.control-hover-dark-host}'
    textColor: '{colors.text-primary-dark-host}'
    rounded: '{rounded.sm}'
    padding: 7px 14px
  error-card:
    backgroundColor: '{colors.error-surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.md}'
    padding: 12px
  error-card-dark-host:
    backgroundColor: '{colors.error-surface-dark-host}'
    textColor: '{colors.text-primary-dark-host}'
    rounded: '{rounded.md}'
    padding: 12px
---

# DESIGN.md

## Overview

6K Labs renders a settings page _inside_ NetEase Cloud Music, next to whatever theme plugin the user runs. The page therefore owns no background: every surface, border, and text color is an **alpha composite** that stays legible on light, dark, or saturated host backgrounds. Identity comes from three things: the NCM-red accent used sparingly, quiet icon-plus-title rows, and a single "status voice" - one card where all service health reads top-to-bottom.

## Colors

Two token sets exist per role: a **light-host** set (default name) and a **dark-host** set (`-dark-host` suffix). Components pick the set via a `data-theme` attribute on the page root; detection follows the host's stored theme (`currentTheme` v3, `NM_SETTING_SKIN` v2).

- **Primary `#C20C0C`** - NCM brand red. Drives the accent segmented control, text links, and the armed destructive state's hover. On dark hosts it lightens to `#FF5C5C`.
- **Ok `#14935C`** - healthy status values only (HTTP up, adapter running). Never used decoratively.
- **Error `#C93A52`** - failure values and error detail text; pairs with `error-surface` tint for the error card.
- **Warning `#B26A0B`** - reserved for transient/pending states; currently unused.
- **Text** - never solid black/white: `text-primary` (88% ink), `text-secondary` (55%), `text-tertiary` (38%) keep hierarchy on any host.
- **Surfaces** - `surface` is a 55% white glass for cards, `control` a 5% ink fill for chips/icons/inputs. Borders are 10-12% single-pixel rules; the page avoids solid fills entirely so host gradients show through.

## Typography

No `fontFamily` is declared anywhere: the page inherits NetEase Cloud Music's own font settings, so personality comes only from weight and scale. Hierarchy: `page-title` (22/700) → `section-label` (11.5/650, +0.14em tracking, all-caps feel) → `row-title` (14/600) → `body`/`caption` (14/12). **All status values share one size - `status-value` 15px/600** - color is the only differentiator between ok and error. `data-mono` (11.5px, inherited face) is reserved for URLs and numeric heartbeats.

## Layout

Single column, max-width 660px, 24px page padding. Vertical rhythm: section label (26px top / 10px bottom) → rows with 10px gaps. Inside the status card, items stack vertically with hairline dividers (12px padding each side). Status card rows are `label left / status value right`; auxiliary lines (heartbeat, query URL) sit under the value, right-aligned cluster for meta, URL row keeps copy/open icon buttons adjacent to the address.

## Elevation & Depth

No shadows. Depth = `backdrop-filter: blur(24px)` on cards over translucent surfaces, which is what makes the page feel grafted onto the host theme instead of painted over it. Focus rings use the primary color (2px, 2px offset).

## Shapes

`rounded.md` (14px) for rows and the status card; `rounded.lg` (16px) for panels; `rounded.sm` (10px) for icon tiles, segmented controls, inputs; `rounded.pill` for chips and the copy/open mini-buttons' hover states. Icons are 17px stroke SVGs at 2px width inside 36px `row-icon` tiles.

## Components

- `card` - the only container primitive: rows, status card, expanded help content all live in cards. Dark-host variant swaps the surface/text tokens.
- `row-icon` - 36px icon tile anchoring every row's left edge.
- `status-value-ok` / `status-value-error` - same `status-value` typography; color-only differentiation (unified size per design review).
- `segmented-active` - selected option of the two-option mode control; filled primary. Unselected options are plain `text-secondary` on transparent.
- `ghost-button` - outline-only quiet action (restart/refresh); `ghost-button-armed` is the two-step destructive confirm state for "stop service" (filled error red, reverts after 2.6s).
- Motion: a single 2.2s pulse ring on the healthy status card; disabled under `prefers-reduced-motion`. Nothing else animates.

## Do's and Don'ts

- **Do** keep all surfaces/borders/text as alpha composites - the page must fit any host theme without its own background color. Automated contrast linters compute alpha-on-alpha as 1:1; real contrast comes from the host backdrop under 88%-ink text (≈14:1 on white) - verify visually on light, dark, and saturated hosts instead.
- **Do** pair every light-host color change with its `-dark-host` sibling; never ship one half.
- **Do** keep status differentiation color-only (unified 15px values).
- **Don't** introduce solid fills, shadows, or a page background - they break host-theme blending.
- **Don't** use the accent red decoratively; it means "selected", "link", or "armed destructive".
- **Don't** add desc Text under rows that already have inline controls (ops/mode rows are title-only by design).
- **Don't** fold help content into collapsed sections - usage guide and credits stay expanded.
- **Don't** declare `font-family` (or a mono face) anywhere - the page inherits the host's font settings.
