# DESIGN.md

> **Design system:** ProShop Minimal-Tech
> **Format:** React 16 + react-bootstrap + CSS custom properties (no shadcn, no Tailwind — see §10)
> **Mode:** Light only (dark deferred)
> **Last updated:** 2026-05-25

---

## How this file is used

This is the **single source of truth** for the visual language of `proshop_mern`. AI agents (Claude Code) read it before generating UI. Designers and developers read it before touching colors, spacing, typography, or component patterns.

- All colors come from CSS custom properties on `:root` in `frontend/src/index.css`. **Never hardcode hex** in components.
- All spacing is a multiple of **8px**. Arbitrary values (14px, 22px, 18px) are forbidden.
- All typography uses **Space Grotesk** (UI) or **JetBrains Mono** (code / data).
- React-bootstrap is the component library, restyled via CSS variables and a thin layer of utility classes — not replaced.

The aesthetic is **minimal-tech**: monochrome surface (off-white background, near-black text), single restrained blue used only for focus and the `Testing` status, generous whitespace, no decorative shadows, no gradients.

---

## 1. Color Palette

Semantic tokens (use the variable name in code, never the raw hex):

| Role | Hex | Usage |
|------|-----|-------|
| `--background` | `#FAFAF9` | Page background (warm off-white, not pure #FFF) |
| `--foreground` | `#0A0A0A` | Primary text |
| `--card` | `#FFFFFF` | Card surface (subtle lift via contrast with `--background`) |
| `--card-alt` | `#F4F4F2` | Elevated / hovered card, table stripes |
| `--primary` | `#0A0A0A` | Primary action (buttons, CTAs) — monochrome |
| `--primary-fg` | `#FFFFFF` | Text on `--primary` |
| `--muted` | `#71717A` | Secondary text, hints, disabled state |
| `--muted-fg` | `#52525B` | Slightly darker muted, for labels |
| `--accent` | `#2563EB` | Focus ring + interactive accent. **Not** a brand color — used only for state, not decoration |
| `--destructive` | `#DC2626` | Errors, destructive actions |
| `--destructive-fg` | `#FFFFFF` | Text on `--destructive` |
| `--border` | `#E5E5E4` | Borders, dividers (1px max — see Anti-slop) |
| `--ring` | `#2563EB` | Focus ring (same as `--accent`) |

**Status colors** (Feature Dashboard + general semantic use):

| Status | Token | Hex | Notes |
|--------|-------|-----|-------|
| Enabled | `--status-enabled` | `#16A34A` | green-600 |
| Testing | `--status-testing` | `#2563EB` | blue-600 |
| Disabled | `--status-disabled` | `#71717A` | zinc-500 |

Each status has a paired tinted background (`--status-X-bg`) at ~12% opacity for badges:

| Token | Hex |
|-------|-----|
| `--status-enabled-bg` | `#DCFCE7` |
| `--status-testing-bg` | `#DBEAFE` |
| `--status-disabled-bg` | `#E5E5E4` |

**Dark mode strategy:** not in scope for M4. The token system is structured so a `.dark` override on `:root` can be added later without touching components.

---

## 2. Typography

**UI font:** `'Space Grotesk', system-ui, -apple-system, sans-serif`
**Mono font:** `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`

Import (in `index.css`):

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

Space Grotesk picked over Inter because: (a) spec forbids Inter, (b) Grotesk's slightly geometric shapes read as "modern tech" without the over-exposure of Inter, (c) it ships excellent number tabularity, which matters for the price + percentage UI all over ProShop.

**Scale** (rem-based, root = 16px):

| Step | Size | Line-height | Letter-spacing | Weight | Usage |
|------|------|-------------|----------------|--------|-------|
| Display | 48px | 1.1 | -0.02em | 700 | Hero headline (Home) |
| H1 | 32px | 1.2 | -0.015em | 700 | Page title |
| H2 | 24px | 1.25 | -0.01em | 600 | Section header |
| H3 | 20px | 1.3 | -0.005em | 600 | Card header |
| H4 | 16px | 1.4 | 0 | 600 | Subhead |
| Body | 16px | 1.6 | 0 | 400 | Main content |
| Small | 14px | 1.5 | 0 | 400 | Secondary text |
| Caption | 12px | 1.4 | 0.02em | 500 | Labels, metadata, badge text (UPPERCASE) |
| Mono | 14px | 1.6 | 0 | 400 | Code, IDs, percentages |

**Numbers must be tabular** (`font-variant-numeric: tabular-nums`) anywhere a column of digits is displayed (prices, traffic %, counts).

---

## 3. Spacing Scale

**Strict multiples of 8px only.** A `4px` micro step is permitted for icon-to-label gaps; nothing in between.

```
4px   — micro    icon + label, badge inner gap
8px   — xs       tight padding, between adjacent fields
16px  — sm       component inner padding (default)
24px  — md       card padding, gap between cards
32px  — lg       section internal padding
48px  — xl       between major page sections (desktop)
64px  — 2xl      page-top spacing
96px  — 3xl      hero / above-the-fold sections
```

**Generous spacing between sections** is mandatory (Anti-slop §11):
- Desktop: ≥ 48px between major sections
- Mobile: ≥ 32px between major sections
- Never 12–16px between sections.

---

## 4. Border Radius Scale

```
none: 0px      — tables, data grids, full-bleed containers
sm:   4px      — badges, chips, small buttons, code blocks
md:   8px      — buttons, inputs, form controls (default)
lg:   12px     — cards (default)
xl:   16px     — modals, popovers, large surfaces
full: 9999px   — pills, avatars, toggle switches, slider thumb
```

Avoid mixing radii on adjacent siblings (e.g. a `lg` card containing `xl` children).

---

## 5. Elevation / Shadow Approach

**Philosophy:** *No box-shadows.* Depth comes from background contrast and 1px borders. This is a deliberate minimal-tech move — shadows read "AI-default" (`shadow-lg` reflex) and don't survive light/dark mode cleanly.

Three-level elevation system:

- **Level 0 (page):** `--background` (`#FAFAF9`)
- **Level 1 (card):** `--card` (`#FFFFFF`) — surface lifts via 1% lightness against page
- **Level 2 (hover / modal):** `--card-alt` (`#F4F4F2`) or `--card` with a `--accent` border on hover

**Single exception** — focus ring uses a 2px outline (`outline: 2px solid var(--ring)`), not a shadow. Dropdowns / popovers may use a hairline border + slight `--card-alt` background instead of a drop-shadow.

---

## 6. Component Patterns

### Cards

```
Background:    var(--card)
Padding:       24px  (md)
Border radius: 12px  (lg)
Border:        1px solid var(--border)
Hover:         border-color → var(--foreground), background → var(--card-alt)
               transition: border-color 150ms ease, background 150ms ease
```

Forbidden: `border: 2px+`, double borders, drop-shadows on idle state.

### Buttons

```
Primary
  bg:        var(--primary)
  text:      var(--primary-fg)
  radius:    8px
  padding:   10px 20px   (mobile 8px 16px)
  font:      14px, weight 500, letter-spacing 0
  hover:     background brightens 8% (mix with --foreground)
  active:    transform scale(0.98)
  focus:     outline 2px solid var(--ring), outline-offset 2px

Secondary
  bg:        transparent
  border:    1px solid var(--border)
  text:      var(--foreground)
  hover:     bg var(--card-alt), border var(--foreground)

Danger
  bg:        var(--destructive)
  text:      var(--destructive-fg)

Ghost
  bg:        transparent
  text:      var(--muted)
  hover:     text var(--foreground), bg var(--card-alt)

Disabled (all variants)
  opacity 0.4, cursor not-allowed, no hover/active effects
```

### Inputs / textareas / selects

```
Background:    var(--card)
Border:        1px solid var(--border)
Border radius: 8px
Padding:       10px 14px
Font:          14px, weight 400
Placeholder:   var(--muted)
Focus:         border-color var(--ring), outline 2px solid var(--ring) at 30% opacity
Invalid:       border-color var(--destructive)
```

### Badges

```
Padding:       2px 10px
Border radius: 9999px (full)
Font:          12px, weight 500, UPPERCASE, letter-spacing 0.04em
Default:       bg var(--status-disabled-bg), text var(--status-disabled)

Variants:
  Enabled  → bg var(--status-enabled-bg),  text var(--status-enabled)
  Testing  → bg var(--status-testing-bg),  text var(--status-testing)
  Disabled → bg var(--status-disabled-bg), text var(--status-disabled)
```

### Toggle (switch)

```
Track:         36px × 20px, radius 9999px, bg var(--border)
Thumb:         16px × 16px, radius 9999px, bg var(--card), 2px offset
Checked:       track bg var(--status-enabled), thumb slides to right
Focus:         outline 2px solid var(--ring), outline-offset 2px
Transition:    transform 150ms ease, background-color 150ms ease
A11y:          role="switch", aria-checked, focusable, Space/Enter to toggle
```

### Slider (range)

```
Track:         full-width, 4px tall, radius 9999px, bg var(--border)
Filled:        bg var(--foreground) from 0 to value
Thumb:         16px circle, radius 9999px, bg var(--card),
               border 2px solid var(--foreground)
Focus:         thumb outline 2px solid var(--ring), outline-offset 2px
A11y:          role="slider", aria-valuenow / aria-valuemin / aria-valuemax,
               arrow keys to adjust
```

### Tables

```
Border:        none on outer, 1px solid var(--border) between rows
Header:        font 12px weight 500 uppercase, color var(--muted), pb 12px
Row padding:   12px 16px
Hover:         bg var(--card-alt)
Striping:      avoid — rely on row hover instead
```

### Skeleton (loading placeholder)

```
Block:         bg var(--card-alt), radius 8px
Shimmer:       linear-gradient animation 1.5s infinite linear
               (see §8 — shimmer keyframes)
Sizing:        match the real content's footprint (avoid layout shift)
```

---

## 7. Interactive States

**Every interactive element MUST define all of these.** This table is canonical — if a state is missing in code, it's a bug.

| Element | Default | Hover | Focus | Active | Loading | Empty / Disabled |
|---------|---------|-------|-------|--------|---------|------------------|
| Button | normal | bg shift +8% | outline 2px `--ring` offset 2px | scale(0.98) | spinner inline, opacity 0.7, click disabled | opacity 0.4, `cursor: not-allowed` |
| Input | normal | border `--foreground` | border `--ring` + 2px outline | — | — | bg `--card-alt`, `aria-disabled` |
| Card | normal | border `--foreground`, bg `--card-alt` | outline ring | — | skeleton shimmer | empty state component (icon + message + CTA) |
| Link | normal | underline | outline ring | color `--accent` | — | — |
| Toggle | normal | track brightens | outline ring | — | — | opacity 0.4 |
| Slider | normal | thumb scale 1.1 | thumb outline ring | — | — | opacity 0.4 |
| Table row | normal | bg `--card-alt` | outline ring (on row) | — | row-shaped skeleton | empty-state row (centered icon + message) |

**Empty states:** every list / table / feed MUST render an empty state (icon + short message + optional CTA). Never a blank panel.

**Loading states:** default to **skeleton shimmer**, not a spinner. Spinner only for action-triggered, short-lived async (button click).

**Error states:** inline error component (`role="alert"`) with `--destructive` text, `--destructive` left-border (4px), `--card` background. Always pair with a recovery action (Retry / Go back).

---

## 8. Animation / Transitions

**Philosophy:** purposeful, not decorative. Animation conveys a state change; if it doesn't, remove it.

```
Base transition:   150ms ease       (hover, focus, color shifts)
Slower transition: 200ms ease-out   (page-level fades, drawers)
Skeleton shimmer:  1.5s infinite linear
Stagger:           50ms between sibling list items (only on first paint)
```

**Never** use random decorative animations, parallax, transitions > 300ms, scale > 1.05, blur on idle.

**Reduced motion (required):**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Accessibility

**Contrast (WCAG AA):**
- Body text on `--background`: `#0A0A0A` on `#FAFAF9` ≈ 19:1 ✅
- Muted text on `--background`: `#71717A` on `#FAFAF9` ≈ 4.7:1 ✅
- White text on `--primary`: `#FFFFFF` on `#0A0A0A` ≈ 19:1 ✅
- Verify any new pairing with https://webaim.org/resources/contrastchecker/

**Keyboard:**
- Every interactive element reachable via Tab.
- Focus ring **always visible** — `outline: 2px solid var(--ring); outline-offset: 2px`. Never `outline: none` without a replacement.
- Tab / Shift+Tab / Enter / Space / Arrow keys behave per WAI-ARIA patterns for each role.

**ARIA:**
- Meaningful icons: `aria-label` or `aria-labelledby`. Decorative icons: `aria-hidden="true"`.
- Form inputs: `<label>` always; or `aria-label` if visually labelless.
- Dynamic updates: `aria-live="polite"` (or `"assertive"` for errors).
- Modal / dialog: `role="dialog"`, `aria-modal="true"`, focus trap, return focus on close.
- Toggle: `role="switch"` + `aria-checked`. Slider: `role="slider"` + `aria-valuenow/min/max`.

**Touch targets:** minimum 44 × 44px on mobile.

---

## 10. Format Declaration

```
Component library:  react-bootstrap 1.x  (kept — see deviation below)
CSS approach:       Custom properties on :root, applied via a thin override
                    layer in frontend/src/index.css
Token system:       CSS custom properties (no SCSS, no design-tokens package)
Icon set:           Font Awesome 5 (already bundled via CDN in public/index.html)
Font:               Space Grotesk (UI), JetBrains Mono (code/data)
```

**Deviation from M4 default stack:** shadcn/ui + Tailwind 4 is **not** used.

Why:
- The project is on **React 16** (CLAUDE.md flags it as legacy / deprecated; React 18+ patterns are not safe to introduce wholesale). shadcn requires React 18+ and modern React semantics.
- The project uses **react-scripts 3.4.3 + react-bootstrap 1.x**; bolting Tailwind 4 on top means a build-config overhaul that's outside the scope of M4 ("minimal in-style changes").
- The minimal-tech aesthetic translates 1:1 to CSS variables + restyled react-bootstrap, with much less surface area to break.

If/when the project upgrades to React 18+ (as `proshop-v2` already has), reintroducing shadcn + Tailwind is the right move. Until then, **CSS variables are the design tokens**.

### CSS variables location

`frontend/src/index.css`, scoped to `:root`. Values are kept in sync with this file by hand — there is no token-generation pipeline (intentional, for a 16-screen project).

---

## 11. Anti-AI-slop Guards (mandatory)

> Block copied from `aidev-course-materials/M4/anti-slop-supplement.md` Part 4 and adapted for this project. Each rule closes one of the 12 signs of AI-look that DESIGN.md tokens don't cover.

### Layout & composition
- **NO 2-column comparison blocks.** Forbidden patterns: "Without us / With us", "Before / After", "Old way / New way" side-by-side. Use single-column storytelling or 3-card grid instead. If comparison is unavoidable — use a table, not two columns.
- **ASCII wireframe first.** Before generating UI code for a non-trivial layout: produce an ASCII wireframe of the page (HERO / sections / cards / footer). Then generate code that matches the wireframe exactly. Do not invent additional sections "to fill space".
- **Generous spacing between sections.** Padding between major sections: minimum 48px on desktop, 32px on mobile. Section internal padding: minimum 24px. Never 12–16px between sections.

### Visual style
- **NO gradients on backgrounds, buttons, or hero blocks.** Use solid colors only — clean off-white / black / gray palette from `--*` tokens. Single exception: skeleton-loader shimmer animation (a linear-gradient sweep is part of the loading affordance, not decoration).
- **Cards: subtle elevation, NEVER heavy borders.** Use `1px solid var(--border)` or no border with background contrast. Forbidden: `border: 2px+`, `border: 3px solid black`, double borders.
- **No drop-shadows on idle surfaces.** Depth comes from `--background` vs `--card` contrast and `--border`. Shadows are an Anti-pattern in this system (see §5).
- **shadcn/ui is not used in this project** (see §10). If shadcn is ever introduced, it MUST be customized via TweakCN.com — never ship default slate/zinc.

### UX-first thinking
- **User journey before visual style.** Before generating any page, answer: (1) Who is on this page? (2) What are they trying to do? (3) Where is the primary CTA? (4) What is the next logical step? Visual decisions follow user journey, not the other way around.
- **Primary CTA must be above the fold.** Hero with full-screen height pushing content below fold = anti-pattern. Hero takes max 60vh, primary CTA visible without scroll on 1366×768 desktop.
- **Contrast ≥ 4.5:1 for body text always.** No light-gray text on white "because it looks aesthetic in screenshots". UX > screenshot beauty.

### Magic phrase (first line of any UI-generation prompt)
> "Be a human designer so it doesn't look like AI. With design taste."

---

*ProShop minimal-tech — M4 design system. Update this file before changing any visual rule; never improvise tokens inline.*
