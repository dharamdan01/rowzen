# Rowzen — Complete UI/UX Redesign & Rebranding Guide

> **Implementation specification for ChatGPT Plus + OpenAI Codex**  
> **Project:** Existing, fully functional DataRehearsal web application → **Rowzen**  
> **Design direction:** Linear-inspired calm productivity UX + Vercel-inspired clarity and precision  
> **Priority:** Premium, minimal, distinctive, responsive, accessible, usable, and secure  
> **Scope:** Improve the **existing application's presentation and user experience**. Preserve all working functionality, business rules, data and integrations.

---

## 0. Instructions to the AI coding agent — read first

You are a **Senior Product Designer, Staff Frontend Engineer, Accessibility Specialist, and Next.js/React Engineer** working **inside the existing project repository**.

**This document is the single source of truth for Rowzen's requested UI/UX direction.** Inspect the actual source code, package versions, routing, design components, and tests before editing. Treat the repository as the source of truth for *how the application currently works*. Do not assume example file paths or APIs in this document already exist.

### Required outcome

Transform the current DataRehearsal user interface into a consistent premium SaaS experience named **Rowzen**, with clear information architecture, polished interactions and fully responsive page layouts. Implement changes incrementally in the existing codebase and verify them against the real application.

### Non-negotiable constraints

1. **Do not create a new app, rewrite the existing app, or replace working business logic.** This is a rebrand and UI/UX redesign, not a rebuild.
2. **Preserve all user journeys, functionality, API contracts, database models, migrations, validation rules, auth and authorization, stored records and tests.** Preserve any capabilities not named here too.
3. **Never replace real data with sample/fake data.** Wire UI to existing sources; display proper loading, error and empty states.
4. **Do not rename database tables, Prisma models, API paths, environment variable names, authentication identifiers, storage keys or deployed resources purely for branding.** A visible product name can change without breaking internal names. Propose unavoidable internal renames separately with a migration and rollback plan; do not silently perform them.
5. **Do not change privacy/security behavior.** Uploaded raw data must follow the application's current privacy guarantees; do not log raw CSV content, leak dataset rows or relax ownership checks.
6. **Reuse present design primitives and libraries first.** Add dependencies only when necessary, compatible and justified. Do not duplicate installed UI, icon, chart, animation or table packages.
7. **No sweeping one-prompt redesign.** Audit first; implement the phases in Section 17 as small, logically separated, verifiable changes. If working autonomously, continue phase by phase after each passes checks. If blocked, document the blocker and do not fake completion.
8. **Do not delete or bypass tests** to get a green build. Fix regressions and add tests for new interactions when appropriate.
9. **Never claim a UI feature, success state or test has passed until actually verified.** Describe anything that could not be tested.
10. **Use original Rowzen visual identity**, inspired by patterns rather than copied from Linear or Vercel. Do not use their logos, illustrations or proprietary brand assets.
11. Use simple, concise, natural English across the actual UI. Avoid vague AI-generated marketing copy.
12. **Do not implement new AI features, new database execution workflows, billing, subscriptions or other unrelated product features** as part of this UI work.

### What to inspect before coding

- `package.json`: exact Next.js, React, Tailwind and dependency versions; available scripts.
- Actual route tree and layouts (including route groups).
- Existing global CSS, tokens, dark mode behavior, fonts and shared components.
- Existing authenticated/public navigation, forms, tables, dialogs, notifications, charts and screen states.
- Real validation, report, project, upload, mapping, corrections, template, history and export flows.
- API and authorization boundaries to avoid breaking them.
- Existing unit, integration, accessibility, TypeScript, lint, build and Playwright tests.
- Existing README and documentation before replacing or changing them.

**First deliverable:** A concise audit with actual file paths, findings, proposed file changes, risk assessment, and test plan. Then implement without introducing unnecessary changes.

---

## 1. Product positioning and the Rowzen brand

### Product definition

**Rowzen** is a data-import preflight and validation workspace. It helps users prepare CSV data, map columns to target schema fields, detect data-quality and relationship problems, correct data where supported, compare outcomes and evaluate readiness **before** a real database import.

**Do not suggest that a successful preflight run is an actual production database import.** Distinguish validation from execution throughout the interface.

### Brand identity

| Element | Final direction |
|---|---|
| Product name | **Rowzen** |
| Pronunciation | **Row-zen** |
| Primary tagline | **Clean data. Confident imports.** |
| Short supporting line | **Find data issues before they reach your database.** |
| Personality | Calm, precise, trustworthy, direct, modern, developer-friendly |
| Visual signature | Neutral surfaces + restrained indigo + meticulous type and spacing |
| Logo concept | Original minimal row/grid symbol with a subtle check or forward-path motif |

**Naming rules:**

- Replace visible “DataRehearsal” text with **Rowzen** in app navigation, headings, landing page, sign-in screens, browser title, metadata, accessible brand labels and user-visible emails/templates where appropriate.
- Keep the meaning of **data rehearsal / preflight validation** in explanations, tooltips and technical documentation when needed; this describes functionality, not the brand.
- Use **Rowzen** (capital R) in prose and `rowzen` only where a lowercase wordmark or URL slug is appropriate.
- Do not alter existing URLs, database identifiers, package names, OAuth settings, deployment project IDs, files or domains just to rebrand. Such changes require separate migration planning.
- Do not imply `rowzen.com` or any social handle is owned. Only use the actual configured domain.
- Make a simple original SVG logo with accessible text alternative, rather than depending on an external image URL or emoji.

### Voice and microcopy

- Confident, factual and human; favor short words over technical jargon when appropriate.
- Put **action before implementation details**: “Review issues”, not “Inspect validation operation output”.
- Differentiate *completed processing*, *passed checks*, *issues found* and *ready to import*.
- Never promise 100% safety, all issues detected, perfect data or a successful future database import.

---

## 2. Reference style and principles

### References (inspiration only)

- **Linear:** quiet sidebar, sharp hierarchy, compact density, contextual controls, subtle micro-interactions.
- **Vercel:** precise typography, neutral-first colors, consistent borders, strong focus on meaningful content.

**The final UI must remain recognizably Rowzen.** No cloned layouts, copied marks, identical marketing content or unnecessary imitation.

### Design principles (priority order)

1. **Clarity over decoration.** The current dataset, issue and next action must be obvious.
2. **One dominant action per view.** Support secondary actions without competing visual weight.
3. **Useful data density.** Show meaningful details, never clutter.
4. **Progressive disclosure.** Summary first, detailed records and technical rule context on demand.
5. **User control.** Visible Back, Cancel, Undo, Revalidate and confirmation for destructive actions.
6. **Transparent system state.** Loading, success, warnings, validation failure, request failure, empty data and permission errors must each be distinguishable.
7. **Predictable interaction.** Same component and wording patterns across every page.
8. **Accessibility by default.** Keyboard, screen reader, focus, readable contrast and motion preferences.
9. **Fast perceived and real performance.** Stable layouts and no heavy visual effects.
10. **No functionality regressions.** Existing feature behavior is more valuable than decorative polish.

---

## 3. Design tokens — colors

Implement **semantic tokens**, rather than scattering hex codes through JSX. Before adding these, inspect and consolidate the current Tailwind/CSS/shadcn token architecture. If the app already uses semantic variables, migrate their values rather than duplicating token systems.

### Light theme — default

| Token | Color | Meaning |
|---|---|---|
| `background` | `#FAFAFB` | Main canvas |
| `surface` / `card` | `#FFFFFF` | Panels, tables and dialogs |
| `sidebar` | `#F3F4F6` | App navigation |
| `foreground` | `#111827` | Primary text |
| `muted-foreground` | `#4B5563` | Secondary text |
| `border` | `#E5E7EB` | Dividers and boundaries |
| `primary` | `#5145CD` | Main CTA and focused brand accents |
| `primary-foreground` | `#FFFFFF` | Text on primary buttons |
| `success` | `#167347` | Checks passed |
| `warning` | `#9A5B00` | Review needed |
| `destructive` | `#B42318` | Errors and destructive actions |
| `focus-ring` | `#5145CD` | Keyboard focus |

### Dark theme

| Token | Color |
|---|---|
| `background` | `#0B0D12` |
| `surface` / `card` | `#171A22` |
| `sidebar` | `#11141B` |
| `foreground` | `#F4F5F7` |
| `muted-foreground` | `#B5BAC7` |
| `border` | `#2A2E38` |
| `primary` | `#A69BFF` |
| `primary-foreground` | `#11121A` |

Use suitable contrast-tested dark-theme colors for success, warning and destructive messages. Do not assume a light-theme semantic shade will work on dark surfaces.

### Use of color

- Neutral surfaces account for the majority of the interface.
- Indigo is for active navigation, selected elements, keyboard focus and one prominent primary action.
- Success/warning/error colors appear only where there is real semantic meaning.
- Pair status colors with **icons and text labels**; never communicate status by color alone.
- Do not use gradients behind dashboard content; an extremely restrained landing-page accent is optional.
- Avoid colorful badge collections, oversized glow effects, random icon backgrounds and heavy drop shadows.

### Reference token scaffold (adapt, do not overwrite blindly)

```css
:root {
  --background: #fafafb;
  --foreground: #111827;
  --card: #ffffff;
  --sidebar: #f3f4f6;
  --muted: #f3f4f6;
  --muted-foreground: #4b5563;
  --border: #e5e7eb;
  --primary: #5145cd;
  --primary-foreground: #ffffff;
  --success: #167347;
  --warning: #9a5b00;
  --destructive: #b42318;
  --focus-ring: #5145cd;
  --radius: 0.625rem;
}

.dark {
  --background: #0b0d12;
  --foreground: #f4f5f7;
  --card: #171a22;
  --sidebar: #11141b;
  --muted: #222630;
  --muted-foreground: #b5bac7;
  --border: #2a2e38;
  --primary: #a69bff;
  --primary-foreground: #11121a;
}
```

If using Tailwind v4, map semantic variables through the project's existing `@theme inline` setup. If the project uses another Tailwind version or shadcn token scheme, adjust accordingly. **Never copy this CSS in a way that breaks existing theme variables.**

---

## 4. Typography

### Font choices

- **Primary:** Geist Sans (navigation, buttons, headings, normal body content).
- **Technical:** Geist Mono (file names when useful, SQL types, IDs, row numbers, timestamps, code values).
- If Geist is already in the codebase, reuse it. Otherwise use supported `next/font` integration consistent with the installed Next.js version.
- Keep font fallbacks and font loading robust; do not introduce layout shifts.

### Type scale

| Element | Desktop | Mobile | Weight |
|---|---:|---:|---:|
| Landing H1 | 56–64px | 34–42px | 600 |
| Page H1 | 28–32px | 24–28px | 600 |
| Section heading | 18–20px | 17–18px | 600 |
| Body | 14–16px | 14–16px | 400 |
| Buttons/nav | 14px | 14px | 500 |
| Table cells | 13–14px | 13–14px | 400 |
| Metadata/help | 12–13px | 12–13px | 400 |

### Rules

- Default line-height: approximately 1.5–1.6 for body content, tighter for headings.
- Avoid giant hero text that breaks on narrow screens.
- Use sentence case: “Validation results”, not “VALIDATION RESULTS” everywhere.
- Use consistent heading levels for accessibility; no skipped hierarchy for visual styling.
- Align numeric KPIs and table counts with tabular numerals.
- Don't use monospaced text for all descriptions.

---

## 5. Layout, spacing and dimensions

Use a **4px base spacing system**. Prefer existing Tailwind spacing utilities instead of scattered pixel-specific values.

| Property | Target |
|---|---|
| Sidebar expanded width | ~240px |
| App top bar height | 56–64px |
| Main content max width | 1200–1280px, except data-heavy screens |
| Desktop page gutter | 32px |
| Tablet gutter | 24px |
| Mobile gutter | 16px |
| Section gap | 32–40px |
| Card padding | 20–24px desktop; 16px mobile |
| Card radius | 10–12px |
| Button/input radius | ~8px |
| Control height | 40–44px, comfortable touch sizing |
| Table row | 44–52px, variable for wrapped content |
| Standard border | 1px |
| Shadows | Light only for elevated dialogs/popovers |

### Visual composition

- Left sidebar anchors primary app navigation.
- Slim top bar provides breadcrumbs, project context and account controls.
- Each page has a consistent **header → context/subtitle → action → content** structure.
- Don't nest multiple cards simply to add borders.
- Ensure useful whitespace without hiding too much tabular information.
- Prefer side panels or drawers for inspecting records instead of navigating away unnecessarily.

---

## 6. Information architecture and navigation

**Proposed primary authenticated navigation:**

1. Overview
2. Projects
3. Upload
4. Results
5. Settings

**Do not remove existing routes or capabilities.** Place additional items, such as saved reports, history or mapping templates, in logical **contextual tabs, project subnavigation, or a grouped secondary section** based on the actual repository's architecture. Preserve deep links.

### Sidebar behavior

- Clear active state with both text/shape and subtle indigo indicator.
- Product wordmark at top, account/workspace settings at bottom.
- Icons must never replace labels on the normal expanded desktop sidebar.
- Avoid more than one conflicting navigation hierarchy.
- If the app already provides contextual project switcher or subnavigation, polish rather than remove it.

### Header behavior

- Breadcrumb: `Projects / [Project Name] / Results`.
- Show page name, optional dataset context and one relevant action.
- Search only when real search functionality exists.
- Keep account actions inside an accessible menu.
- Do not invent notifications, team management or global search as inert UI elements.

---

## 7. Landing page (public)

### Goal

Within a few seconds, a first-time visitor should understand **what Rowzen does**, **who it is for**, and **what to do next**.

### Recommended page sequence

1. **Minimal nav:** Logo; `Features`, `How it works`, `Sign in`, `Get started` (anchors/routes must work).
2. **Hero:** Clear promise, short supporting sentence, primary CTA and genuine/accurately marked interface illustration.
3. **Product preview:** Screenshot or interactive demonstration derived from the real UI; clearly label demos/sample data.
4. **Three benefits:** Catch issues, map fields, review readiness.
5. **How it works:** `Upload → Map → Validate → Review → Export`.
6. **Trust/privacy explanation:** Precisely state actual CSV handling and account isolation, not generic security claims.
7. **Final CTA:** “Check your data before import.”
8. **Footer:** Relevant product and legal/contact links if they exist; no dummy links.

### Final copy suggestions

**Hero H1:** `Catch data issues before import.`  
**Hero description:** `Validate CSV files, check schema mappings, fix issues, and review readiness before data reaches your database.`  
**Primary CTA:** `Get started`  
**Secondary CTA:** `How it works`  
**Three benefit titles:** `Find issues early` · `Map with confidence` · `Review what matters`

### Landing visual rules

- Hero centered or balanced split layout; responsive without text/image overlaps.
- Keep gradients extremely subtle, avoid gratuitous animations and stock photos.
- Use the real Rowzen UI preview rather than a made-up chart showing impressive but invented statistics.
- Navigation and CTAs must have meaningful targets.
- Do not claim Rowzen imports into a live database if its current engine only checks readiness.

---

## 8. Dashboard / Overview

### Goal

Help returning users find their projects and recent meaningful activity immediately.

### Layout

**Top:** Page title `Overview`, succinct subtitle, prominent `New rehearsal` / `Upload dataset` action as supported by the actual workflow.

**Metric row:** Actual project count, dataset count, validation-run count, and optionally issue trends if backed by existing analytics. Show helpful tooltips for unfamiliar metrics.

**Body:** Recent activity table, recent projects, readiness overview, and real charts only when useful. Avoid turning every count into its own chart.

### Data integrity requirements

- Read all statistics from authorized existing endpoints/storage.
- Use a skeleton while loading, meaningful retry state on request failure and a helpful first-use empty state.
- If a metric has no data, display an accurate `0` or `No data` only if that is the true state.
- Do not conflate “not loaded,” “not available,” and “zero.”
- Avoid unstable animations in analytics; use simple labels and legible axes.

### Empty-state example

**Title:** `No projects yet`  
**Body:** `Create a project to organize datasets and validation runs.`  
**Action:** `Create project`

---

## 9. Projects and project detail

### Projects list

- Page header: `Projects` + total count if available + `Create project`.
- Search, sort and filters **only if functional**, connected to actual data.
- Desktop: clean table/cards using project name, description (optional), dataset count, last activity and action.
- Mobile: vertically stacked, readable project entries.
- Row click and action menu must have separate clear hit targets.
- Empty search result is different from no projects.

### Project detail

- Show name, description, relevant project metadata and a clear next action.
- Use contextual tabs such as `Datasets`, `Validation runs`, `Reports`, `Templates` **only where supported by existing features**.
- Preserve current project ownership and scoped data retrieval.
- Delete actions: destructive appearance + confirmation + accurate consequences; no accidental one-click deletion.
- Avoid breaking project URLs or shared bookmarks.

---

## 10. Upload wizard and mapping

**Primary flow:** `Upload → Map fields → Validate → Review`.

### Upload step

- Responsive drag-and-drop area with an equally accessible `Browse files` button.
- Explain accepted file types and actual upload/file-size limits; do not invent limits.
- Show real file name, size, parsed rows and parser errors after selection.
- Clear feedback for invalid extension, unreadable CSV, unsupported encoding, missing headers or file limit errors **only where detected**.
- Show the actual privacy behavior accurately: client memory vs server persistence, if applicable.
- Restore useful wizard state on navigation where safely supported; do not retain raw files contrary to privacy rules.

### Mapping step

- Use an accessible table/grid: `Source column` → `Target field` → `Detected type` / `Expected type` → `Status`.
- Highlight required target fields and missing mappings.
- Clear inline indication for type incompatibilities and conflicts.
- Separate suggested mappings from confirmed ones.
- Preserve existing manual mappings and project-owned templates.
- `Back`, `Save mapping` (if supported) and `Continue` actions should be easy to locate.

### Validate step

- Show the genuine current status with accessible live announcements.
- Do not fake a progress percentage when no measurable progress exists.
- Differentiate backend/request failure from actual data validation failure.
- Avoid duplicate submissions; prevent accidental repeated runs.
- Keep validation-engine behavior and rule evaluation untouched.

### Review step

- Present concise readiness, rows checked, issues, warning counts and relevant next steps using real results.
- Link issues directly to the issue explorer and corrections UI.
- Explain if validation is a **preflight check** and not a database import.

---

## 11. Results, analytics and readiness reports

### First-screen questions

Results must immediately answer:

1. **Is this dataset ready under the configured rules?**
2. **What failed or needs attention?**
3. **Which rows and fields are affected?**
4. **What action should I take next?**
5. **What was not checked?** (when applicable)

### Results page hierarchy

1. Breadcrumb + dataset/project context.
2. Readiness summary panel (`Ready`, `Issues found`, `Review required`, etc. based on current semantics).
3. Focused metric tiles (rows checked, errors, warnings, relevant counts).
4. Primary CTA (e.g., `Review issues` or `Export report` depending on state).
5. Filterable issue explorer; issue types, severity, rules and record details.
6. Compact analytics and dependency visualization, where existing data supports them.
7. Reports, run metadata and export actions in a predictable location.

### Status semantics

- `Validation complete` means processing finished, **not** necessarily ready.
- `Ready for import` is only displayed when the current engine's rules justify it.
- Error, warning and informational statuses stay semantically distinct.
- Pass states must not hide untested constraints or unknown limitations.

### Charts

- Reuse existing Recharts/chart library if present; don't add another library by default.
- Use restrained semantic colors, readable axes, units, legends and explanatory labels.
- Put exact counts in accessible text outside charts.
- Include empty/loading/error states and keyboard/screen-reader alternatives.
- Avoid 3D charts, over-animated pie charts and decorative gauges with unclear meaning.

---

## 12. Issue explorer, inline corrections and what-if analysis

The existing product supports issue inspection, correction workflows, undo/redo, history, what-if scenarios and revalidation. **Retain their behavior and make their relationship obvious visually.**

### Issue explorer desktop

- Main area: dense-but-readable issues table.
- Right detail drawer or detail section for the selected issue.
- Filters for issue category, severity, file, row and column where currently supported.
- Visible sorting, pagination and result count; preserve current pagination semantics.
- Row selection should maintain surrounding context rather than triggering unexpected navigation.
- Keep user filters and scroll position after corrections/revalidation where feasible.

### Issue detail

Show, as supported by the engine:

- Plain-English issue title and rule explanation.
- Record/row/field references.
- Original value and proposed/corrected value clearly separated.
- Why it matters, and what the user can do.
- Correct edit action, with accessible controls and inline errors.

### Corrections

- Show whether an edit is local, saved, applied to the working dataset, or exported; do not imply remote DB writes if none occur.
- Make `Undo`, `Redo`, `Revalidate` and `Export corrected CSV` discoverable.
- Preserve immutable correction/history semantics and existing state behavior.
- For destructive/discard actions, show a clear confirmation when work could be lost.
- Do not silently auto-apply suggestions, alter values or claim fixes are correct without validation.

### What-if scenarios

- Visually distinguish **current result** from **simulated scenario**.
- Make it easy to compare counts and readiness changes.
- Clearly label when a scenario is hypothetical and not persisted.
- Preserve deterministic calculations and existing API behavior.

---

## 13. Saved reports, history and templates

### Reports

- Use a consistent report list with project, dataset, status, time and relevant actions.
- Provide clear action labels for `Open`, `Download CSV`, `Download JSON` or other currently supported exports.
- Never show controls for nonexistent export formats.
- Respect ownership checks for report access and exports.
- Keep reports easy to scan; technical detail belongs in a detail view.

### History

- Consistent date/time formatting and clear run status.
- Pagination/filtering behavior must survive the redesign.
- Use actual previous runs rather than illustrative activity.
- Include a helpful no-history state.

### Mapping templates

- Template names, ownership/project context and last-updated information where available.
- Clear `Apply template`, `Save template`, `Edit` and `Delete` actions according to existing capabilities.
- Show impacts of applying a template before overwriting a current mapping where appropriate.

---

## 14. Authentication, settings and secondary states

### Sign-in/login

- Minimal centered layout or restrained split layout.
- Clear Rowzen branding, short purpose statement and existing sign-in provider buttons.
- Preserve Better Auth/GitHub OAuth (or whichever authentication is in the actual repo).
- Do not alter redirect logic, callback URLs, session protection or access checks for visual reasons.
- Display helpful error and retry states; don't leak security-sensitive details.

### Settings

- Group existing settings logically (account, appearance, relevant preferences).
- Present appearance selection only if dark/light preference is actually implemented and persisted appropriately.
- Never add a fake team-management, billing or subscription screen.
- Show clear saved/saving/error feedback.

### Every page must handle

- Loading / skeleton
- No data
- No search results
- Validation issues
- Network/server error with retry where safe
- Unauthorized / forbidden
- Not found
- Confirm destructive action
- Success feedback

Use existing error boundaries and route-level loading/not-found handling where available.

---

## 15. Reusable component specifications

| Component | Style | Interaction and accessibility |
|---|---|---|
| Primary button | Indigo fill; restrained radius | Label clearly states action; pending/disabled states |
| Secondary button | Neutral border/surface | Visible hover and keyboard focus |
| Destructive button | Error semantic color | Confirmation if irreversible |
| Inputs/selects | 40–44px controls, clean borders | Associated label, help text and inline validation |
| Cards/panels | Subtle 1px border, little/no shadow | Correct semantic grouping |
| Data table | Compact, scan-friendly | Real sort, accessible headers, responsive overflow |
| Dialog | Focused surface, moderate shadow | Trap/restore focus, Escape support where appropriate |
| Drawer | Contextual panel | Accessible title, close, focus return |
| Tabs | Understated active indicator | Keyboard navigation and clear selected state |
| Badges | Neutral by default | Semantic text label plus color for true statuses |
| Toast | Short unobtrusive message | Not the only way errors are announced |
| File uploader | Simple drop zone | Keyboard accessible and standard file picker |
| Stepper | Clear progress | Current/completed states described in text |
| Skeleton | Mirrors real layout | Avoids large layout shifts |
| Empty state | Contextual and useful | One relevant call to action |
| Tooltip | Concise optional context | Not required to understand a form or critical error |
| Charts | No excessive decoration | Accessible summaries and exact values |

**Recommended order of reuse:** existing components → refine shared primitives → use existing accessible library wrappers → add a new compatible dependency only after clear justification.

### Feedback and micro-interactions

- Hover/focus transitions roughly **120–180ms**.
- Dialog/drawer transitions roughly **160–220ms**, where motion is enabled.
- Honor `prefers-reduced-motion`.
- Avoid blinking indicators, large parallax, animated backgrounds or constant number counters.
- Keep table row heights and page shells stable while loading.
- Don't animate error states in a distracting way.

---

## 16. Responsive design, accessibility and performance

### Responsive breakpoints (design intent, adapt to existing Tailwind values)

| Viewport | Layout behavior |
|---|---|
| 320–639px | Single-column mobile, navigation drawer, full-width actions |
| 640–1023px | Tablet, compact/collapsible navigation, 1–2 card columns |
| 1024–1439px | Desktop sidebar, multi-column content, tables |
| 1440px+ | Controlled content width, data-heavy areas may expand when useful |

### Mobile rules

- Navigation drawer with clearly labeled pages and reliable close behavior.
- No clipped headings or hidden critical CTAs at 320px.
- Tables: accessible horizontal scrolling where necessary, with a visible scroll affordance. Use mobile record-detail views for complex correction/editing rather than squeezing every column.
- Buttons/touch controls should be comfortably sized, preferably around 44px high.
- File selection must work without drag-and-drop.
- Wizard navigation stays visible and preserves entered values where appropriate.
- Dialogs may become full-screen sheets for data-intensive mobile editing.
- Charts must resize without tiny, unreadable text.

### Accessibility target: WCAG 2.2 AA

- At least **4.5:1 contrast for normal text** and **3:1 for large text**, where applicable.
- Visible keyboard focus; logical Tab order; no keyboard traps.
- Semantic headings, landmarks, form labels, table headers and meaningful button text.
- ARIA live regions/status messages for genuinely asynchronous validation and file processing.
- Accessible error summaries and field-level messages linked to controls.
- Never rely on color alone for warning/error/success meaning.
- Honor reduced motion.
- Restore focus after closing modals/drawers; announce destructive-action results.
- Test complete workflows using only the keyboard.

### Performance goals

- Avoid layout shift when data loads; use purposeful skeletons.
- Keep costly chart libraries and large table views out of unrelated routes where possible.
- Paginate or virtualize large datasets when warranted; preserve correct keyboard navigation and accessibility.
- Avoid redundant network requests and unnecessary re-render loops.
- Optimize only after checking actual performance behavior; do not introduce speculative complexity.
- Maintain the application's existing privacy and upload size/performance targets.

---

## 17. Implementation plan — execute in order

**Do not ask Codex to redesign all pages in one code change.** Each phase must be individually reviewed against the running app and tested. Create a safe feature branch when possible; do not erase or reset uncommitted user changes. Only commit when repository conventions and permissions allow.

### Phase 0 — Baseline and inventory (no redesign yet)

**Tasks**

- Inspect package versions, scripts, route map, components, auth, CSS, test configuration and current UI.
- Record existing screenshots or relevant baseline page states if available.
- List all routes and components; identify shared shell and main user flows.
- Record baseline results for available TypeScript, lint, build, unit/integration and E2E tests.
- Identify existing failures separately from newly introduced ones.
- Plan exact file changes for the next phase.

**Done when:** Existing UI and workflows are mapped, tests/baseline are documented, and no functionality has been changed.

### Phase 1 — Safe Rowzen rebrand and foundation

**Tasks**

- Replace **user-visible** product branding with Rowzen across app title, headers, metadata, auth page and UI copy.
- Add or refine original lightweight SVG wordmark/icon.
- Introduce consolidated semantic color variables, typography and spacing foundations.
- Keep internal database/API/auth/system identifiers unchanged.
- Confirm themes and branding do not break existing routes/tests.

**Done when:** Rowzen branding is consistent on public/authenticated screens, and no route, auth, data or API behavior changes.

### Phase 2 — Shared UI primitives

**Tasks**

- Standardize button, input, select, card, table, dialog, drawer, status text, toast, skeleton and empty state styling.
- Consolidate duplicated styles only where safe.
- Add accessible focus/error/disabled/loading states.
- Verify semantic variants are legible in light and dark themes.

**Done when:** Shared components look coherent, existing forms and interactions still work, and no new inaccessible states appear.

### Phase 3 — App shell and navigation

**Tasks**

- Polish authenticated sidebar, top bar, breadcrumbs and account controls.
- Implement responsive navigation drawer and mobile shell behavior.
- Keep all working route links, project context and sign-out redirects intact.

**Done when:** Every authenticated route is reachable via its appropriate navigation, desktop/mobile layout works, keyboard navigation succeeds.

### Phase 4 — Landing and authentication

**Tasks**

- Build focused Rowzen hero, product preview, workflow/benefits, accurate trust copy and functional CTAs.
- Improve login screens and auth errors without altering sign-in logic.
- Respect existing metadata, accessibility and SEO behavior.

**Done when:** Landing and login screens work across viewports and all CTAs lead to valid routes.

### Phase 5 — Dashboard and projects

**Tasks**

- Improve summary layout, real metrics, recent runs, empty/loading/error states.
- Polish project list, project detail, contextual tabs/actions, filters, menus and destructive confirmations.
- Keep all records authorized and scoped to their owners.

**Done when:** Counts and lists reflect actual data and project CRUD/navigation work without regression.

### Phase 6 — Upload, mapping and validation workflow

**Tasks**

- Polish file picker/drop zone, file info, error states, stepper, mappings, templates and progression controls.
- Keep CSV parsing, schema mapping and validation algorithms unchanged.
- Clearly distinguish validation status from import execution.

**Done when:** Full `Upload → Map → Validate → Review` flow works at mobile/desktop sizes and handles bad input gracefully.

### Phase 7 — Results, issues, corrections, what-if and reporting

**Tasks**

- Refine readiness summary, issue explorer, filters, table pagination, details, charts and exports.
- Preserve inline edits, immutable corrections, undo/redo, automatic revalidation, what-if, history, project templates and saved reports.
- Keep row/column context while inspecting and fixing issues where feasible.
- Maintain all API ownership and privacy boundaries.

**Done when:** Users can diagnose issues, correct them, revalidate, compare scenarios and export existing supported formats without data loss or misleading UI.

### Phase 8 — Settings, dark mode and polish

**Tasks**

- Complete remaining supported pages/states, responsive behavior, appearance settings if implemented, microcopy and consistent empty/error states.
- Remove visual inconsistencies and redundant animations.
- Respect reduced-motion preferences.

**Done when:** All actual routes use the same design language in supported themes and responsive layouts.

### Phase 9 — Security, accessibility and complete regression testing

**Tasks**

- Run TypeScript, lint, unit/integration, build and existing Playwright E2E scripts actually defined by the repository.
- Cover public/authenticated states, multiple screen sizes, keyboard flow and role/ownership checks.
- Test two-account isolation for projects, datasets, templates, reports and exports where feasible.
- Audit privacy-sensitive content in browser/network logs and error states.
- Fix regressions, report any pre-existing blockers and record final verification.

**Done when:** All available required checks pass, or remaining blockers are honestly documented. Do not declare completion with failing or skipped critical tests.

### Commit and progress report format

After **each phase**, provide:

```text
Phase: [name]
Files changed: [actual paths]
UI/UX changes: [concise summary]
Functionality preserved: [important flows checked]
Commands/tests run: [exact commands and actual results]
Manual viewport/accessibility checks: [actual results]
Risks or unresolved issues: [none or details]
Commit: [hash if created, otherwise not committed]
Next phase: [name]
```

Do not hardcode npm commands not supported by `package.json`. Discover and execute the project's actual available commands. Do not commit secrets, raw uploaded data or generated private content.

---

## 18. Required page-by-page acceptance checklist

The redesign is **not complete** unless all applicable items below are satisfied:

### Brand and consistency

- [ ] All user-visible product branding reads **Rowzen**.
- [ ] Browser title, favicon/logo and navigation use a coherent identity.
- [ ] Colors, typography, spacing, icons, buttons and cards are consistent.
- [ ] No borrowed Linear/Vercel logos or unlicensed assets.
- [ ] No fake metrics, fabricated activity or dummy functional controls.

### Pages and workflow

- [ ] Landing page communicates product purpose accurately and all CTAs work.
- [ ] Authentication preserves existing sign-in/sign-out and redirects.
- [ ] Dashboard uses actual project/run data with empty/loading/error states.
- [ ] Projects list and project detail preserve CRUD and ownership behavior.
- [ ] CSV upload works, including parsing errors and valid file selection.
- [ ] Field mapping works, including existing templates and validation.
- [ ] Validation and readiness states accurately represent engine output.
- [ ] Issues can be filtered and inspected using existing functionality.
- [ ] Corrections, undo/redo and revalidation still work.
- [ ] What-if comparisons remain clearly labeled and accurate.
- [ ] Saved reports, exports and history continue working.
- [ ] Any additional existing routes/features not listed are preserved.

### Responsive and accessible

- [ ] No unintended horizontal page scroll at 320, 375, 768, 1024 and 1440px.
- [ ] Data tables remain usable with intentional overflow or alternate layout.
- [ ] Forms and dialogs operate using keyboard only.
- [ ] Focus states, field errors, toasts and processing status are perceivable.
- [ ] Color contrast is checked in all supported themes.
- [ ] Mobile upload, mapping, issue review and corrections remain usable.
- [ ] Reduced-motion preferences are respected.

### Engineering and safety

- [ ] No API route contract or Prisma schema changes made only for UI branding.
- [ ] Authentication, ownership checks and private dataset boundaries remain intact.
- [ ] No raw CSV contents or personal data added to logs/analytics.
- [ ] No current data, migration or tests lost during redesign.
- [ ] TypeScript, lint, build, tests and available E2E checks pass.
- [ ] New relevant UI behaviors have appropriate tests.
- [ ] Final changelog, known limitations and verification evidence are documented.

---

## 19. Copy/paste master prompt for Codex or ChatGPT

Use this prompt **after placing this file in the repository as `README.md`**, or provide the entire document to your coding agent as context. If replacing the project's existing README, preserve the original contents in version control or another documentation file first.

```text
You are a Senior Product Designer and Staff Next.js/React Engineer.

My existing project is a fully functional DataRehearsal SaaS
application. Its new public product name is ROWZEN.

Read README.md completely and treat it as the final UI/UX
redesign and rebranding specification.

GOAL:
Redesign the existing app into a premium, minimal, distinctive,
responsive, accessible SaaS product inspired by Linear and Vercel,
without rebuilding or breaking the current product.

CRITICAL:
- Work in the existing repository, not a new scaffold.
- First inspect the real files, dependencies, routes and tests.
- Do not assume any example path or component exists.
- Preserve all backend APIs, database models, authentication,
  authorization, validation rules, existing features and data.
- Rebrand visible user-facing DataRehearsal text to Rowzen.
- Do not rename internal system identifiers without a separately
  justified safe migration plan.
- Do not add fake statistics, placeholder business data, dummy
  actions, or misleading preflight/import claims.
- Preserve the existing upload, mapping, validation, issue
  explorer, corrections, undo/redo, revalidation, what-if,
  reports, templates, history and exports where present.
- Respect privacy and two-account ownership isolation.
- Reuse installed libraries; avoid unnecessary dependencies.
- Keep interfaces accessible and fully responsive.
- Do not redesign everything in a single code change.

PROCESS:
1. Start with Phase 0 audit from README.md, naming actual paths.
2. Establish the baseline tests and identify risks.
3. Implement Phases 1–9 in order, in small coherent changes.
4. After each phase, run relevant actual project checks.
5. Fix regressions before proceeding.
6. Provide the phase report specified in README.md.
7. Never claim success for a check that was not run.

Please begin by auditing the existing repository and then
implement the first safe phase. Continue sequentially when
checks pass, but do not silently skip blocked steps.
```

---

## 20. Final definition of success

Rowzen is successfully redesigned when the UI looks consistent and distinctive **and** a real user can complete the whole current workflow without confusion:

**Create/open project → Upload CSV → Map fields → Run validation → Understand readiness → Review issues → Correct data → Revalidate → Explore results → Export the report or corrected dataset.**

At every step, the interface should make three answers obvious:

1. **What has Rowzen checked or done?**
2. **What needs attention, and why?**
3. **What should I do next?**

**The defining quality of Rowzen is clarity and trust in the data-validation workflow, not decorative animation.**
