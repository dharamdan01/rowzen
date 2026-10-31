
# Data Rehearsal Web App
## System Architecture

Rowzen's presentation foundation uses `src/lib/theme/tokens.ts` as the single light/dark semantic color source. The root layout emits its static CSS variables in the head before the existing theme-preference script; Tailwind v4 aliases in `globals.css`, dependency-graph fallbacks and standalone schema SVG colors consume those tokens. `components/brand/rowzen-brand.tsx` supplies the accessible wordmark/original grid mark; app icon assets preserve the favicon route. Geist and all state owners, engines, API/auth/data boundaries are retained. See [branding foundation](rowzen-branding-foundation.md).

The existing Dialog primitive also supplies the mobile Drawer presentation. Client dialog owners share `components/ui/dialog-focus.ts` for Tab boundaries; native dialogs retain modal inertness and cancellation. MobileNavigation owns only open/scroll-lock UI state, outside the workspace owner. AccountMenu uses the shared Button, an explicitly expanded disclosure and an always-mounted hidden action panel, preserving SignOutButton state. Pathname access remains inside the existing Suspense boundary; no workspace key/route/data-owner changes are made. See [shell/control refinement](rowzen-primitives-shell.md).

Feature 3 Step 6 mounts SmartRepairPlanner inside the existing CorrectionWorkspace. UploadWorkspace supplies canonical report/evidence/configuration and live owner revisions; a browser-local bridge adds UI scope/intent invalidation. The headless Step 5 pipeline remains authoritative, Preview reveals its existing deterministic result, and fresh confirmed Apply delegates to the shared manual correction/activity callback with automatic revalidation. Scope mismatches hide stale output before layout cleanup revokes it. See [UI ownership and data flow](ai-smart-repair-workspace.md).

Feature 3 Step 5 adds the approved provider's typed repair-strategy task and a shared-lifecycle headless session. Sealed metadata includes verified categories and bounded aggregate evidence; accepted strategy selection remains separate from local candidate resolution and canonical What-if verification. Plans require explicit future approval and are revoked on cancellation/retry/context changes. No UI/Apply/backend endpoint is added. See [AI repair integration](ai-smart-repair-integration.md).

Feature 3 Step 4 reuses `previewCellCorrection()` with optional finding details and the existing canonical revalidation runner. Separate browser-local verification handles retain impact/finding data, cancellation and fresh future-Apply eligibility checks; simulation never commits temporary correction/history state. No UI/provider/Apply integration is added. See [deterministic verification](ai-smart-repair-verification.md).

Feature 3 Step 3 adds a pure local resolver for confirmed boolean/date conventions. The Step 2 sealed context exposes a narrow browser-only source-cell bridge; candidates keep values in private memory and recheck revisions/expected text when read. No provider/UI/approval integration or What-if execution is added. See [local resolver](ai-smart-repair-resolver.md).

Feature 3 Step 2 adds isolated smart-repair recommendation/verification contracts and sealed browser-local reference/revision guards. No planner UI, provider method, transformation or correction integration is mounted. See [Smart Repair contracts](ai-smart-repair-contracts.md).

Dashboard navigation isolates its pathname read inside a Suspense boundary with a route-neutral navigation shell. With Cache Components enabled, unknown saved-report IDs can suspend `usePathname()` during partial prerendering; the page-level loading boundary does not cover navigation in the parent layout. The resolved navigation retains the existing active links, breadcrumbs, theme controls and sign-out behavior.

Feature 2 Step 4 mounts `RootCauseAnalyzer` in Review Summary. UploadWorkspace now owns the stable impact revision owner, publishes report/analytics-bound evidence from completed manual/automatic validation and invalidates alongside existing report-clearing paths. Scope changes replace/cancel client request contexts. Optional controlled evidence scopes and focused-analysis callbacks reuse IssueExplorer; correction locations continue through the existing validated helper/handle. Shared AI status presentation retains foundation defaults. No backend or persistence contract changes. See [Review integration verification](ai-root-cause-review.md).

Feature 2 Step 3 adds a sealed root-cause context projection, strict response/grounding validation, fixed evidence-linked explanations and a generic-session wrapper. The existing Ollama transport exposes a typed analysis method; no new backend route is added. Counts, readiness and impact facts remain application-owned. Workspace/Review integration remains a later step. See [root-cause contracts and measured model results](ai-root-cause.md).

Feature 2 Step 2 adds a pure impact-evidence library and a revision owner using existing AiVersion counters. The owner projects canonical report/analytics/configuration metadata into a strict opaque-ID contract; private lookups retain local labels/locations and existing static corrective advice. Existing readiness and dependency algorithms remain authoritative. Serialization rejects stale/oversized evidence and never includes CSV values or issue prose. UploadWorkspace, model transport and saved-summary APIs are not integrated in this step. See [impact evidence contract and verification](ai-impact-evidence.md).

Feature 1 presentation/approval refinement: local profile summaries retain expandable evidence in the existing assistant. The AI layer computes effective setting deltas after strict validation; both its pure candidate builder and the existing workspace owner reject identical metadata commits before result invalidation. No raw records enter this comparison. See [quality verification](ai-feature1-final-quality.md).

### 1. Architecture Overview
Data Rehearsal uses a Next.js-based full-stack architecture with browser-side CSV validation and a server-side layer for authentication, user management, and saved report metadata.

### 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Next.js Route Handlers |
| Authentication | Better Auth |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation Engine | TypeScript |
| Unit Testing | Vitest |
| End-to-End Testing | Playwright |
| Version Control | Git and GitHub |

### 3. High-Level Architecture

User
  |
  v
Next.js Frontend
  |
  +--> CSV Upload and Parsing
  |         |
  |         v
  |    Schema Configuration
  |         |
  |         v
  |    Validation Engine
  |         |
  |         +--> Required Field Checks
  |         +--> Data Type Checks
  |         +--> Primary Key Checks
  |         +--> Foreign Key Checks
  |         +--> Dependency Analysis
  |         |
  |         v
  |    Rehearsal Report
  |
  +--> Next.js API
            |
            +--> Better Auth
            |
            +--> Prisma ORM
                      |
                      v
                 PostgreSQL

### 4. Frontend Responsibilities
The frontend handles:
- Authentication UI
- Dashboard
- File selection
- CSV preview
- Schema configuration
- Validation progress
- Error reporting
- Report export

### 5. Validation Engine
The validation engine is a standalone TypeScript module responsible for checking CSV datasets against configured schemas.

Core modules:
- CSV Parser
- Schema Validator
- Required Field Validator
- Data Type Validator
- Primary Key Validator
- Foreign Key Validator
- Dependency Graph Builder
- Import Order Calculator
- Report Generator

The engine should remain independent of React components and database operations.

### 6. Dependency Analysis
Table relationships are represented using a directed graph.

Example:

Users -> Orders -> OrderItems

For an acyclic graph, the system determines a valid import order using topological sorting.

If a dependency cycle exists, the engine reports the affected tables and explains that a simple dependency-based order cannot resolve the cycle.

### 7. Backend Responsibilities
The backend handles:
- Authentication and sessions
- User authorization
- Saved rehearsal metadata
- Report ownership
- Database access
- Secure API responses

### 8. Database Responsibilities
PostgreSQL stores application data such as:
- Users and authentication records
- Rehearsal metadata
- Schema configurations, when saved
- Sanitized or privacy-safe reports
- Timestamps and status information

Raw uploaded CSV rows are not persisted by default.

### 9. Data Flow
1. User selects CSV files.
2. Browser parses the CSV data.
3. User configures table schemas.
4. Validation engine processes the datasets.
5. Engine identifies validation and dependency issues.
6. Frontend displays results.
7. User exports the report.
8. If requested, the application saves permitted report metadata through the authenticated API.

### 10. Architectural Principles
- Separation of concerns
- Modular components
- Deterministic validation
- Secure API boundaries
- Privacy by default
- Testable business logic
- Maintainable project structure

### 11. Important Limitations
The MVP provides logical, schema-based import simulation.

It does not execute SQL imports or fully reproduce database-specific constraints, triggers, transactions, or runtime behavior.

### Dashboard Shell
The existing dashboard layout shares a desktop sidebar, a top header, and an inline mobile navigation disclosure. Navigation links preserve `/dashboard`, `/projects`, `/upload`, and `/results`; breadcrumbs identify the current section. Mobile navigation supports keyboard activation and Escape to close with focus returned to the toggle. A skip link targets the main content. The header reuses the existing sign-out component without changing authentication or server authorization.

Layout regression checks should cover 360px, 768px, and 1280px widths, active links, closed-menu tab order, Escape focus return, skip-link focus, and horizontal overflow. Use synthetic data for any populated-workspace checks.

### Reusable UI Primitives
`src/components/ui/primitives.tsx` provides native-prop Button, Input, Select, Card, Table, Dialog, LoadingState, and EmptyState wrappers. The upload workspace and issue table adopt these wrappers without changing validation, exports, API payloads, or event handlers. Table scroll regions have accessible names and keyboard focus; callers retain responsibility for field labels and table headers/captions.

Dialog is an optional native `<dialog>` wrapper, with no new product workflow. Give it an accessible name and use its forwarded ref with `showModal()` and `close()` for modal focus management and Escape behavior. The native `open` prop alone is non-modal. Loading and empty states preserve caller-provided messages. Run `npm run test` for prop-forwarding, semantic markup, and untrusted-text regression checks.
### Phase 9 design-system foundation

The existing blue-and-neutral palette remains the brand foundation. Global semantic tokens distinguish decorative dividers (`border`) from accessible form/button boundaries (`control-border`), with green success, amber warning, red danger, and blue information surfaces. Geist is loaded through Next.js font optimization and exposed through the existing Tailwind sans token. Browser font requests are self-hosted by Next.js.

Shared controls retain their native props, refs, handlers, and submit semantics. Controls use a 44px minimum height and 8px radius; cards retain 16px/24px responsive padding and 12px radius with no added default shadow. Disabled buttons do not acquire enabled hover styles; invalid fields retain their red boundary on hover. Focus outlines also cover native disclosure summaries. Tables retain named keyboard-scroll regions, restrained headers, and contained horizontal overflow. Page layouts, validation, authentication, persistence, and export contracts are unchanged.

The saved-history form adopts the existing Button/Input/Select wrappers without changing query parameters or submission behavior. `tests/e2e/design-system.public.spec.ts` renders the real shared components against the compiled application stylesheet, checking contrast, interaction states, 44px controls, and overflow at 360/768/1280px without authentication or a production showcase route.

### Phase 9 application shell

The shell keeps the four existing destinations and the original SignOutButton authentication/logout behavior. Sidebar active sections use a blue surface, heavier label, and leading indicator. Nested summary routes retain Results as the active section and show Dashboard → Results → Saved summary without exposing identifiers. The sidebar scrolls independently on short screens. Header and main content share a 1280px maximum width and aligned responsive gutters.

Mobile navigation uses a native details/summary disclosure, preserving keyboard activation and excluding closed links from the tab order without JavaScript. React handlers close it on Escape with focus returned to the summary and on link selection. A pathname key resets it after navigation. The menu is a non-modal disclosure, so it does not trap focus. The header keeps a direct account sign-out action; no profile/settings destinations or placeholder actions were added.

PageHeader standardizes existing page titles/descriptions and IDs without changing page bodies, data access, or workspace state. tests/layout.test.tsx covers routes, breadcrumbs, disclosure handlers, skip targets, and heading semantics. tests/e2e/layout.public.spec.ts covers isolated presentation and native disclosure at 320/390/768/1024/1440px; this fixture does not exercise authenticated page behavior. tests/e2e/layout.auth.spec.ts exercises hydrated Escape/route selection only when a genuine configured authenticated session is available.

### Phase 9 upload presentation

The existing upload workspace retains its parsing, validation, correction, persistence, and replacement state transitions. The file picker keeps its native multiple-file input, same-file reselection reset, drag handlers, and disabled-drop guard. A compact dataset list links to focusable configuration anchors without navigating away or claiming that parsed data has passed validation.

UploadFeedback preserves the existing loading/error messages and live roles; the busy state is applied to the picker rather than enclosing the live feedback. CsvPreview shows the same first five original source rows, now with physical CSV line headers, preserved multiline text, an accessible caption, and a named keyboard-scroll region. The existing single Run Validation callback and condition are retained in a clearer action row. Shared shell, parser, backend, and validation modules are unchanged.

Focused tests cover file callback identity, reselection, disabled drops, escaped untrusted text, original-data immutability, and physical line numbers. Isolated Chromium presentation checks cover 320/390/768/1280px and empty/loading/error states; genuine-session upload tests remain required to verify the hydrated full workflow.

### Phase 9 schema mapping presentation

SchemaMapping groups each original CSV column, target name, existing data-type selector, and Required checkbox in one responsive row. Existing accessible control names and parent callbacks are retained. Single-column primary keys are identified from the current rule configuration. The remaining key and required-column controls keep their original values and handlers.

Mapping feedback reuses applyMapping with explicit dataset metadata and empty records, so it applies the existing blank/duplicate/source checks without remapping or reading CSV cell values during typing. Feedback is associated with the group and target controls and does not disable validation, alter mappings, normalize stored target edits, or persist anything. The interface explicitly explains the existing rule-reset consequence of renaming a target; the reset behavior itself is unchanged.

Focused tests cover target callback values, type/required rule preservation (including required fields absent from CSV), canonical mapping feedback, escaped text, and metadata-only validation. Isolated browser checks cover source/target clarity, types, required indicators, tab order, feedback associations, and overflow at 320/390/768/1280px. Genuine-session tests remain necessary for the complete hydrated workspace workflow.


### Rehearsal configuration and execution presentation

The browser workspace presents dataset configuration, optional relationships, the validation action, the existing report, and then correction tools. Section anchors and the report link use native fragment navigation. Correction components remain keyed direct children of the same workspace so result changes do not intentionally reset their local drafts or history.

`RehearsalExecution` is a stateless presentation of current report outcomes, file-reading availability, and existing error details. The canonical validation runner is synchronous and has no progress events: the interface shows no timer, percentage, simulated stages, or invented running state. A cleared report is described as having no current result; configuration-error outcomes preserve unevaluated row validity. All validation, correction revalidation, configuration handlers, and API contracts are unchanged.


### Results presentation

The current browser report presents canonical readiness and summary counts before recommended investigations and the searchable issue list. Dataset totals follow; issue distribution, correction comparison and dependency details use native disclosures. Existing report, analytics, filtering, sorting, pagination, export and correction algorithms are unchanged. Investigation text is visible in each issue row or compact mobile list item; technical identifiers remain available in a disclosure. Null validity is always unevaluated, never coerced to zero. Error and warning styling includes text labels.

Saved history retains its existing server filters, pagination and ownership checks. `SavedSummary` is a presentation-only extraction from the owned detail route; it accepts the same selected summary metadata and does not fetch or calculate validation results. Saved summaries cannot provide per-dataset findings or an error/warning split; their UI directs users to upload files and validate again for those details.

Results browser regression fixtures use synthetic CSVs with the real preflight/analytics functions and the production stylesheet. They mount the actual issue explorer and chart with the existing Vite toolchain's installed bundler to exercise client filtering and responsive chart disclosure without a new application route, backend mock or manufactured login session. Authenticated route and persistence checks still require a genuine configured session.


### Correction workspace presentation

The correction grid keeps source columns and physical CSV line identities, with a bounded two-axis scroll region, sticky headers and line numbers frozen on larger screens. Mobile editors scroll fully into view without a frozen line-number overlay. Existing issue-to-source mapping determines error and warning cell highlights; corrected values use an information treatment and never imply validity. The parent supplies optional current validation status/error metadata from the same canonical report. Missing results remain explicitly unvalidated.

Editor focus moves only when the cell address changes, returns to the corresponding Edit action after Apply/Cancel, and safely skips cells removed by record/dataset navigation. Escape cancels only the local draft. Predicted impact uses the existing what-if function; its review controls remain adjacent and a focused prediction can return to the editor. History stays mounted inside a native disclosure, preserving its filter/page state. Activity timestamps retain original instants and display PKT. Export controls keep the existing approved-snapshot, formula-protection and download behavior. No correction, undo/redo, revalidation or export algorithm is changed.


### Dependency diagram presentation

`DependencyGraph` retains `buildReadinessInsights` as its sole source of dependency edges, cycle groups, downstream blockage and advisory import order. The coordinate helper in `components/validation` assigns visual positions only; it neither analyzes dependencies nor changes the report. An edge is styled as cyclic only when both endpoints belong to the same canonical cycle group. Inter-group bridges remain ordinary dependencies.

The responsive SVG diagram supports bounded zoom, pointer dragging, pan buttons and keyboard arrows/Home. Node selection highlights only its existing incident edges; focusing an off-screen node brings it into view. Fit and Reset affect viewport state only. Canonical order/cycle warnings stay outside the diagram, and a native text disclosure preserves the exact parent-to-child relationships and full dataset names. No physics layout, animation, graph dependency, backend contract or calculation change is introduced.


The validated report embeds the diagram through `DependencyGraphSection`, which is open by default and can be collapsed manually. Browser graph fixtures mount this same wrapper so they cover initial visibility instead of forcing an independent fixture disclosure open.


### Phase 9 focused refinements

`ProjectsPage` remains server-authorized and selects only owned project IDs, names and descriptions for `ProjectsView`. The client view provides create/edit controls in `ProjectEditor`, a native modal dialog. It sends project metadata to the existing POST/PATCH APIs and updates the visible card only after a successful response. It adds no persistence mechanism, auth bypass or dataset upload. Failed saves retain the draft and existing card. Native Cancel/Escape behavior and focus return are retained; closing is disabled during an active request.

`DashboardPage` loads at most three recent owned project IDs/names for the compact `DashboardOverview`; the dashboard shows project work and direct CSV validation actions, without derived or fabricated metrics. Both pages retain server authentication before their database reads.

SVG paints use existing semantic variables with explicit matching color fallbacks, so a cached stylesheet missing new tokens cannot turn nodes black or remove relationship strokes. Initial/resized graph cameras fit the existing layout; Reset/Home still restore 100%. These are presentation changes only. Saved history uses constrained columns, wrapping null-count labels and a named keyboard-scroll region with visible scrolling guidance. Report metric emphasis, natural plurals, distinct metadata-export descriptions, compact correction rows and shorter mapping/relationship guidance preserve existing callbacks and calculation/export contracts.

Browser fixtures cover 320, 375, 390, 768, 1024 and 1440 pixels with before/after captures under ignored `playwright/.cache/phase9-refinement/`. Project form fixtures intercept requests to synthetic IDs for UI contract verification; server route tests independently check existing authorization/ownership and schema enforcement. These checks do not claim a genuine-session database round trip. Authenticated page/persistence tests still require a real login state.


### CW4 transactional CSV replacement

The upload workspace prepares the complete candidate selection with the unchanged `readCsvFile`, identity mappings, initial rules, sample relationship and immutable correction snapshots before committing any active session fields. Rejection changes only dedicated upload feedback; datasets/configuration, reports/analytics, project context, corrections and the correction-session key remain unchanged. The unchanged key preserves child-local drafts, previews and activity history. Cancellation returns before parsing or state changes. Successful replacement updates the session in one synchronous React batch, resets its report/history/configuration as before and retains project context.

A synchronous ref lock makes the first accepted file selection own its asynchronous read. Further selections while it is pending are ignored, matching the disabled picker. The lock is released on success or rejection. In-flight reads from a rejected Promise.all batch may finish, but cannot commit state; no CSV data is sent to a server or persisted. Existing confirmation conditions and wording are retained. Validation/mapping/correction algorithms and backend contracts are unchanged.


### Phase 9 CW6: required-column editing

`UploadWorkspace` retains each dataset's raw comma-separated required-column text while editing. Existing rule normalization (split, trim, remove empty entries and deduplicate) still updates canonical `DatasetRules.required` on input, keeping Required checkboxes, templates and validation current. Blur discards the display draft and shows canonical names. Checkbox changes replace the draft; unrelated type/key edits retain it. Template loading, existing mapping resets and successful CSV replacement clear the relevant drafts. Rejected/cancelled replacement preserves them. Missing target names remain in canonical rules so existing schema validation reports them. Drafts remain in browser memory; no API contract or CSV persistence changes.


### Phase 9 CW5: deliberate mapping commits

`UploadWorkspace` owns dataset-specific target-name drafts separately from canonical mappings. Draft changes do not invalidate reports, analytics, correction previews or saved-summary metadata. SchemaMapping displays canonical type/required values while those controls are disabled during a rename, and identifies that validation and templates still use the applied mapping. Cancel drops only that dataset's draft. Apply validates the complete candidate using the existing metadata-only `applyMapping` checks before committing. An effective no-op drops its draft without invalidating results. A genuine rename uses the existing reset policy for that dataset's primary/required/type/composite/unique settings and clears stale report/preview context; CSV values, correction state/history and relationships remain unchanged. The pending UI explains these consequences and the need to review relationship targets. Replacement success and template load discard mapping drafts; rejected/cancelled replacement preserves them. No CSV persistence or API changes.


### Phase 9 CW1: safe login continuation

Login uses the same validated `next` destination for GitHub OAuth's callback and the signed-in Continue link. `loginDestination` allows existing Dashboard/Projects/Upload/Results pages (including a report detail), preserves their query/hash, rejects external/auth/API/unknown paths and encoded separator ambiguity, and defaults to Dashboard. The existing client session hook remains inside a Suspense boundary required for `useSearchParams`. This is continuation validation, not authorization: existing server ownership/session checks remain authoritative. No cookies, provider settings or persistence contracts change.


### Phase 9 CW7: browser-memory departure safeguards

An uploaded dataset makes the CSV workspace transient user work, regardless of saved-summary status. `WorkspaceDepartureGuard` installs unload/link/sign-out guards only while datasets exist, owns no CSV copies, and renders a notice distinguishing summary metadata from CSV storage. Cancel leaves records/configuration/corrections/history intact. Same-page anchors, downloads and new-tab actions do not discard the current session and are not intercepted. Accepted internal departure links perform a full document navigation with one-time unload approval; ordinary navigation outside an active workspace remains unchanged. Sign-out asks before any API call, and only a successful sign-out permits the subsequent unload. Rejected/failed sign-out leaves guards armed.

`src/instrumentation-client.ts` installs a small inert history-event bridge before hydration, ahead of App Router listeners. The active workspace registers a traversal callback. Using browser-owned Navigation API indices, Cancel stops downstream router handling and returns to the existing history position; no sentinel entries or Next history-state mutation are introduced. This early ordering is required because a later window listener cannot protect state already unmounted by an earlier router listener. Without indexed history, native full-document unload remains the fallback; same-document Back protection cannot be guaranteed there. Native refresh/tab-close prompts have browser-controlled text and can be suppressed by mobile/process lifecycle limitations. No autosave, raw-CSV persistence or restore guarantee is introduced. Saving a validation summary never disables the guard.


### Phase 9 NL3: Results History return state

History detail links carry a normalized `returnTo` built from the displayed history page and existing filters. The detail page passes this through to SavedSummary, which validates that it refers only to `/results` and reparses the existing bounded filter schema before producing the return link. Unknown query fields and external/other-route targets are discarded. This preserves list state without browser storage, raw CSV data or ownership changes. Direct detail visits still return to unfiltered Results History.


### Phase 9 RP3: exact project report scope

Project Reports links pass `projectId`, independently of mutable/non-unique project names. History parsing bounds the optional identifier and retains it in form submissions, pagination and detail return state. Reset filters keeps the selected project; Show all projects explicitly clears scope. The server applies exact `projectId` AND the existing authenticated project-owner relation in both count and row queries. An unknown/foreign project cannot broaden the query. Existing name/status filters remain available within that scope; no API endpoint, model or authentication contract changes.


### Phase 9 CW9: template-list feedback

MappingTemplateControls distinguishes pending/ready/error list states from save/load/delete statuses. Responses are tied to the active project and AbortController; old-project success/error cannot replace current options. Unavailable lists disable dependent actions, failure offers keyboard-accessible retry, and an empty successful response is explicitly empty. Fetch/retry never applies configuration or clears CSV/report/correction state. Existing project ownership APIs and compatibility/confirmation logic remain unchanged.


### Phase 9 CW11: contextual configuration findings

Structured SCHEMA findings are mapped to existing required/key/relationship controls by presentation-only `configurationIssueLocation`. It uses canonical rule identities, never prose matching or a second validator. Known controls receive stable IDs, associated error text and aria-invalid; a linked summary near Run Validation moves keyboard focus to the control. Unknown identities fall back honestly to a focusable dataset/relationship section. Findings derive only from the current canonical result and disappear when existing state transitions invalidate it. No validation calculations, rules or report contracts change.


### Phase 9 CW13: real issue-to-record navigation

IssueExplorer offers an action only when a DATA finding resolves to an existing physical CSV line and, where specified, an applied target-to-source column mapping. Parent-owned data remains unchanged. The correction workspace exposes an optional imperative location handle while retaining ownership of its selected dataset, page, editor and history. A location computes its page from rowNumbers.indexOf, not a physical-line arithmetic assumption. Column findings open/focus the source editor; composite findings without a column focus the real row header without inventing a field. Switching away from a changed draft requires confirmation. Navigation never approves a correction, rewrites a record or resets history; existing Apply/Cancel/What-if/Undo/Redo semantics remain authoritative.


### Phase 9 CW10: known relationship-column suggestions

Existing relationship text inputs receive native datalists derived from applied mappings for their selected datasets. Composite suggestions replace only the final token, preserving preceding positional fields and allowing comma-delimited extension. Free-text values and existing validation handlers remain unchanged; choosing a dataset does not silently rewrite columns. Suggestions omit names containing commas because the existing composite entry format cannot represent them as one token; users can rename such targets before configuring a composite key. No FK algorithm or declaration semantics change.

### Phase 9 Step 7: project deletion control

The Projects presenter exposes the existing owner-checked DELETE endpoint through a native confirmation dialog. The dialog explains existing cascade deletion of saved summaries and mapping templates, starts with Cancel focused, blocks repeated submission/dismissal while pending, and retains the card on rejection. Only a successful response removes the local card. Focus moves to New project after the dialog unmounts; cancellation uses native trigger restoration. No server routes, database models, validation algorithms or browser CSV storage behavior change. Other open workspace tabs keep transient CSV data; later persistence requests still use the existing server ownership checks.

### Phase 9: appearance and actual pending states

A self-contained theme runtime in `src/lib/theme/preference.ts` executes synchronously in the root head. It resolves an allowlisted local appearance preference plus matchMedia into HTML `data-theme`/`data-theme-preference`, listens for system/storage changes, and accepts selector events. The reusable native ThemeSelector subscribes through useSyncExternalStore with a stable server snapshot, preventing hydration mismatches without adding an app-wide state provider or remounting workspace data. A server-false/client-true hydration snapshot keeps its native select disabled until React can handle and persist user changes. Existing Tailwind v4 `@theme` tokens resolve against unchanged light values or explicit dark overrides. SVG graph colors already use these variables; chart axes, grid and tooltip now do too.

Shared Button adds an optional pending prop and reduced-motion spinner while preserving native props/refs/handlers. Static PageLoading shapes are hidden from assistive technology and expose a real status label. Route loading files cover suspended dashboard/project/history/summary/workspace page data; the existing session branch uses the same primitive. A protected-route error fallback uses the installed Next retry API and never renders exception details. History uses Next Form with the same GET query fields, preserving the app shell during server navigation and reusing route fallbacks; no independent fake form progress is tracked.

Existing component state owners retain mutation/error/cancellation behavior. Immediate refs prevent duplicate project/template/summary writes, and pending labels disable only relevant controls. Workspace project fetching gains abort-on-cleanup and independent loading/error/retry state, preserving datasets, reports, corrections and history while retrying. Templates keep their existing abortable list fetching and compatibility checks; local template application, validation, what-if, automatic revalidation and exports remain synchronous and gain no artificial loader. Parsing feedback continues to reflect actual file reading. No new dependencies, backend/API changes, database schema changes or validator changes are introduced.

### Phase 9: product-led public landing page

The existing homepage remains a static server page. Small landing-only client islands provide native responsive navigation and accessible screenshot tabs; they reuse ThemeSelector and Button. Product visuals are lossless real workspace captures with synthetic CSV inputs, generated by `scripts/capture-landing-assets.ts` and served as local desktop/mobile WebP assets with explicit dimensions. Theme visibility is CSS-driven from the existing root data-theme, avoiding duplicate theme state or hydration changes. Landing selectors are explicitly scoped to data-landing-page because the existing CSS pipeline does not provide the expected CSS-module class map; shared config is untouched. Landing components do not import the CSV parser/engine, report calculator, correction state, Prisma or auth provider. CTA destinations and protected-route authorization remain unchanged.


### Phase 9.1: guided CSV workspace presentation

The existing UploadWorkspace remains the sole owner of parsed original datasets, immutable correction snapshots, applied/draft mappings, validation settings, relationships, canonical reports/analytics and project-summary state. A pure step model and controlled responsive WorkspaceStepper provide Upload, Configure, Validate, Review, optional Correct and Export views. Native hidden panels keep existing children mounted across navigation; dataset/session/project keys retain their original replacement semantics. Correction drafts, What-if snapshots, activity history, issue filters, template selections and graph viewport state are not keyed by the current step.

Navigation updates presentation state only. Existing same-document links reveal the required panel, dataset and Review subsection before focus/scroll; issue location uses the correction workspace's existing confirmation/physical-record resolver before revealing Correct. Its additive active prop defers requested editor/row focus until the panel becomes visible. The existing synchronous runner opens Review only after returning its actual report. Configuration handlers retain their existing stale-result invalidation and mapping Apply/Cancel boundary. ReportAnalyticsDashboard gains an optional view prop, defaulting to its prior all-sections behavior for other consumers.

A single original preview and selected dataset configuration reduce visible document height. Review separates Summary, Issues, Dependencies and Analytics without duplicating report calculations or IssueExplorer instances. Existing exports/save controls move to Export; optional download-start callbacks update presentation completion only. Successful summary metadata saving never implies raw CSV persistence or disables WorkspaceDepartureGuard. Pending file reads, template mutations and summary saving block cross-step navigation using their existing immediate locks plus an additive template notification. No backend, auth, Prisma, parser, validator, correction/export algorithms, storage policy or dependencies change.


### Feature 4 schema descriptor

Feature 4 Step 1 adds an independent, unmounted metadata projection in `src/lib/schema-diagram`. It reuses applied mapping checks on empty metadata datasets, workspace key parsing and existing preflight contracts; it retains full column-level FK declarations rather than dependency edges. It neither reruns validation nor reads CSV rows/history. Descriptor identities are owned by the workspace session/configuration lifecycle; optional current report annotations are code/location-only. No UI, diagram export or persistence is integrated in this step. See [schema descriptor](schema-diagram-descriptor.md).

Step 2 adds pure `layout.ts` and `svg.ts`: variable-height table/column geometry, separate per-pair FK routing outside nodes, complete text details and fixed-vocabulary native SVG serialization with explicit theme colors. Generated ordinal IDs are independent of user labels. The modules stay unmounted and perform no downloads or browser operations. See [layout, safety and executed checks](schema-diagram-layout.md).

Step 3 mounts an optional Schema view in Review. A memoized metadata-only source is the generation scope; configuration/session changes invalidate it, drafts suspend it, and current-report annotations refresh without resetting the canvas. The Schema section remains mounted across Review/step navigation. Existing correction/report ownership is unchanged. A bounded interactive SVG viewport reuses existing graph patterns, themes and native inspection/table controls; only the reviewed serializer supplies SVG markup. See [Review lifecycle and verification](schema-diagram-review.md).

Step 4 prepares standalone SVG from the full descriptor/layout, independent of the interactive DOM/camera. Committed live-scope guards surround serialization and Blob/anchor publication; export bounds, fixed draft filenames, current resolved palette and delayed URL cleanup are local presentation concerns. No report or correction calculation is changed. PNG remains unmounted after a separate offline feasibility probe. See [export lifecycle and limits](schema-diagram-export.md).

Final verification preserves the separation between column-level child-to-parent ER references and the existing dataset-level parent-first dependency graph. Canonical validation/rules/FK/key/graph engines remain unchanged; both independent engine tests and graph/browser regressions pass. The build and public fixtures used actual production-served assets, with real inference run separately from mocked provider cases. The final addition is an offline browser regression, not an engine/runtime rewrite. See [Feature 4 completion and local-demo boundaries](feature-4-completion.md).

### Shared local AI foundation

This section records the foundation at initial delivery; the Configure integration below extends its original unmounted scope.

The optional foundation lives in src/lib/ai and is deliberately not mounted in application routes yet. Existing UploadWorkspace state ownership, deterministic validation, mappings, corrections, What-if, exports, authentication and owner-checked APIs remain unchanged. No AI business features or database/diagram builders are implemented here.

The context adapter accepts the existing VerifiedCorrectionReport and TemplateConfiguration types, validates the existing strict template schema, reuses report-export consistency checks, checks dataset membership and requires matching report/current version stamps. It constructs a fresh allowlist of numeric/enum facts and opaque references. Names, headers, descriptions, row/cell values, free-form issue text, assumptions, project/user identifiers and history are excluded. A private WeakMap holds the serialized bounded payload; only adapter-created context objects can be submitted. The public context is frozen and carries no CSV records.

The local provider uses native fetch to an explicitly configured HTTP loopback origin. It checks installed model manifest digests and local-only metadata before generation, then performs one non-streaming structured foundation acknowledgement. This diagnostic is not schema mapping, root-cause analysis or repair planning. Output is parsed with strict Zod schemas and checked against current fact IDs both at transport and session boundaries. No model text is rendered.

A per-owner in-memory session exposes idle, loading/checking-model, loading/generating, ready, error, cancelled and stale states. Requests require explicit local-metadata consent, duplicates are ignored, cancellation aborts transport, and context changes invalidate pending/displayed output. Late results are ignored by request identity and version. Retry is an explicit new request, not automatic. AiRequestStatus reuses Button/LoadingState and restores keyboard focus after Cancel; it has no app route or auto-connect action.

Consumers added in future feature work must capture the version when the canonical validator returns, advance configuration/correction/report counters on actual transitions (including Undo/Redo/Restore), create a fresh sessionId for project/session replacement, and call setContext(null) immediately when a result becomes stale. These stamps are client lifecycle guards, not server authentication or independent proof of business correctness. Disposed sessions must not be reused, including after React StrictMode setup/cleanup cycles. Full implementation, setup and verification: docs/ai-foundation.md.

### AI Feature 1 in Configure

Semantic refinement: the existing profiler adds format-intent observations from labels, approved configured/template types and value shapes; canonical matching and inferred/compatible types are unchanged. Structured diagnostics drive warning emphasis and explanations. Only aggregate detected-format counts enter the sealed wire context. The UI filters true no-op rows after complete response/evidence validation, retaining useful identity type/rule changes. Saved-template compatibility and approval/state ownership remain unchanged; see `ai-semantic-profile-improvements.md`.

Response-contract follow-up: the existing provider classifies each bounded parse stage with fixed safe diagnostic tags, then runs the same Zod/context/evidence validators. The native `format` and schema-grounded prompt share one generated schema. Per-source grammar choices exclude unsupported template reasons, including mixed candidate-target sets; runtime checks still validate the actual selected target. No context or state-owner change is needed. See `ai-response-contract-fix.md`.

25 October correction: `column-profile.ts` reads the current approved snapshot locally, reusing canonical type checks and trimmed-string equality. `schema-mapping.ts` projects only aggregate facts into the sealed context, keeps inferred/configured types distinct, constrains source-specific targets/settings and validates semantic evidence at transport/session/approval boundaries. Ambiguous or insufficient-evidence output becomes non-actionable abstention. Current records are passed from the existing correction owner; Apply/Undo/Redo refresh profiling through existing revisions. Raw values are never serialized. See `ai-schema-evidence-fix.md` for actual limits/results; the initial header-only acceptance below is historical.

UploadWorkspace retains its full existing state ownership. A memoized metadata configuration plus identity-based revision captures applied settings, drafts, immutable correction snapshots, canonical reports, project and selected template. SchemaMappingAssistant builds a separate sealed schema-label context with a fresh request version when those inputs or the selected dataset change. This does not serialize the revision object or CSV snapshots. Step/theme navigation alone does not invalidate it.

MappingTemplateControls optionally publishes the strictly parsed selected template associated with its current project; selecting for comparison never loads it. The schema adapter performs structural comparison and keeps the existing strict direct-load compatibility contract. Its explicit wire projection includes bounded selected-schema labels/rules, not raw rows or dataset/project names. The foundation's opaque report context is unchanged.

The same local transport and generic typed request lifecycle support foundation acknowledgement and schema suggestions. The feature uses exact runtime ID enums and unsure/yes/no/none wire values, then validates/decodes into nullable application settings. Fixed reason text replaces untrusted model prose. Pure approval builds a candidate through canonical applyMapping/template validation; the existing configuration loader commits only after explicit selection and confirmation, clearing reports while retaining correction state/history. Renames carry existing rules; relationships remain unchanged for explicit review. See `ADR/0003-schema-ai-metadata-consent.md` and `ai-schema-mapping.md` for limits and actual verification.

## Feature 5 shared export foundation

The unmounted src/lib/database-export library reuses the existing metadata capture and schema descriptor, with separate target capability checks rather than a universal SQL generator. Strict requests feed a pure plan/manifest builder; a client-owned session binds plans to workspace/configuration/correction/report identities and invalidates superseded/cancelled work. Canonical reports are consumed, never recalculated. Correction snapshots remain opaque references. No renderer, data encoder, UI, network, persistence, database execution or workspace-state restructuring is introduced. See [data boundaries and lifecycle](database-export-foundation.md).

### PostgreSQL schema-only adapter and Export UI

postgresql.ts extends the shared planning contracts with strict physical-type options and pure two-stage DDL rendering. The Export-only component owns target drafts and a private export session. UploadWorkspace adds canonical report bindings captured at manual/automatic validation completion; existing invalidation clears those bindings without changing validation, corrections or AI algorithms. Current-scope/option identity guards protect previews and Blob publication. PGlite appears only in optional synthetic engine tests, never product imports. See [PostgreSQL data flow and limits](postgresql-schema-export.md).

### PostgreSQL approved-record restore extension

The shared export session adds a consented synchronous consumer of its own current correction snapshot; the generic planner remains metadata-only. postgresql-values.ts performs bounded exact text/integer/decimal/date checks and hex encoding. postgresql-data.ts validates source shape and post-conversion key/FK equality, reuses graph ordering and frozen owned schema sections, then emits new tables/keys, all records and validated FK additions in one transaction. A child of the current schema preview owns record consent/output; live guards protect preparation and downloads. No parsing, validation, correction, AI, persistence or backend algorithm is changed. See [data boundary and lifecycle](postgresql-data-export.md) and [ADR 0004](ADR/0004-postgresql-local-restore.md).

### MongoDB deterministic document adapter

MongoDB has separate contracts, BSON value/name validation, metadata definitions and consented JSONL modules in src/lib/database-export. Only source metadata, revision ownership and CSV snapshot-shape checks are shared with SQL. The export session validates record consent against the actual target; Mongo-only omission/date choices do not alter PostgreSQL semantics. A separate Export component reuses the existing workspace report/configuration/correction bindings. No document nesting or FK enforcement is inferred. Native test tooling provisions/attests its own mongod and uses official mongoimport, outside product code. See [MongoDB boundaries](mongodb-export.md) and [ADR 0005](ADR/0005-mongodb-flat-ejson-export.md).

### MySQL dialect and import artifacts

`mysql-contracts.ts`, `mysql.ts`, `mysql-values.ts` and `mysql-data.ts` separately validate/render MySQL options, DDL and exact corrected records. They share only the configured schema descriptor, current export-session capabilities, source-shape checks and canonical dependency ordering. MySQL does not import PostgreSQL encoders or transaction assumptions. The session dispatches strict target-specific MySQL consent before record access. An additive `MysqlExport` panel consumes the existing workspace scope, keeps previews metadata-only and guards Blob publication against stale scope/settings/consent. Tables/keys precede inserts; FKs follow committed DML for cycles, explicitly disclosing non-atomic DDL. Optional official-client tests initialize and attest a fresh loopback MySQL process/data directory outside product code. See [implementation and native evidence](mysql-export.md) and [ADR 0006](ADR/0006-mysql-local-restore.md).

### Google and GitHub authentication

Server-only `oauth-options.ts` configures the existing Better Auth/Prisma instance with GitHub and optional complete Google credentials, explicit account-link policy and Google pre-provisioning validation. Client-safe `oauth-feedback.ts` builds sanitized error continuations and fixed wording. The existing login client calls `signIn.social` or authenticated `linkSocial`; the same callback handler, session store and user-ID ownership guards remain authoritative. No custom token exchange, credential-bearing client props, resource transfer or schema migration is added. See [flow and exact tests](google-github-authentication.md) and [ADR 0007](ADR/0007-explicit-oauth-account-linking.md).

### Rowzen public presentation

The home Server Component owns static capability copy and text-only page/OG/Twitter metadata. Existing landing header, CTA, theme-aware screenshot and keyboard-tab components remain the presentation boundary; all preview assets stay local and unchanged. The login Client Component adds a reusable local frame around its existing Suspense/session branches. Server route-layout metadata remains separate. Existing auth-client, safe-destination helper, OAuth initiation/link handler and pageshow recovery retain their ownership and behavior. No new route, provider, API, storage key, palette or dependency is introduced. See [files and verification](rowzen-public-views.md).

### Small public demo and explicit provider connection return

The /rehearsal client page owns ephemeral datasets, indexed column settings, explicit relationships and a current verified report. src/lib/demo/configuration.ts adapts these controls to identity mappings and the existing WhatIfConfiguration contract; it calls the canonical file reader and does not implement validation. revalidateCorrectionSnapshot continues to own mapping/preflight/analytics, and prepareReportExport owns safe report serialization. No public API or project/template access was added. The login UI uses a fixed /login connection-return helper and a ConnectedMethod component backed by Better Auth listAccounts; linkSocial remains an explicitly invoked framework action. Auth provider settings and authorization are unchanged. Existing landing CSS/client preview own small once-only, reduced-motion-aware reveal behavior. See [details](rowzen-public-demo-auth.md).

### Existing project views and detail dialog

Authenticated server page ownership queries remain unchanged. The dashboard client view receives the existing recent-three snapshot; reusable report/detail components read the existing owner-checked project/runs/templates endpoints. src/lib/projects/presentation.ts projects metadata through Zod, validates project identities and reuses history-return links. The keyed abortable useProjectResource lifecycle prevents stale selections from painting new views. The Projects detail is a native shared Dialog within /projects, not a new route. Existing editor/delete handlers and workspace/template owners retain their responsibility. See [files and limits](rowzen-dashboard-projects.md).
### Upload and Configure presentation boundary

The existing UploadWorkspace remains the sole state owner. Stepper, hidden mounted step/dataset panels, correction owner, configuration revisions and template/AI request lifecycles remain intact. Changes are limited to existing view components and an optional retained-data feedback prop. Type selectors represent missing rules with a disabled empty-value option; they do not create defaults. The same shared Textarea renders unique-key declarations. Local evidence uses existing profiling and drift comparison; optional Ollama advice retains the current consent, transport, allowlists and approval functions. See [preservation checks and tests](rowzen-workspace-upload-configure.md).
### Validate/Review presentation boundary

The existing UploadWorkspace and stepper remain unchanged. Report/status calculation, analytics/filters/readiness utilities, schema descriptor/layout/SVG serialization, viewport hook, correction engine, model provider/request sessions and owner-checked server routes retain their current implementations. Changes are in existing component presentation: bounded desktop issue-table scrolling, grouped filters/diagram controls, compact metrics/action lists, clearer saved-summary provenance and evidence/advice hierarchy. Existing keys, mounted panels, handlers, local-only snapshots and stale-download checks remain. See [preservation evidence](rowzen-validate-review.md).
### Correction presentation boundary

CorrectionWorkspace retains its existing state owner, keys, refs, handlers, expected-value checks and revision-scoped preview identity. The source editor now reuses shared Textarea with the same ref/events/value. Original/current presentation and private history are denser, with a bounded focusable history list. WhatIfPanel still receives canonical metrics/findings; SmartRepairPlanner still uses the existing local resolver, verification capabilities, consent/session lifecycle and approval functions. Only presentation and accessibility change; parser/mapping/correction/validation/AI contracts remain untouched. See [preservation evidence](rowzen-correction-workspace.md).
### Export/history/template presentation boundary

Export state ownership, prepared-plan/consent identities and target adapters are unchanged. Existing components gain grouped type choices, code previews, record-consent surfaces, readable warnings and clearer save/reuse headings. History remains server-filtered/paginated; its existing focusable table now has bounded vertical scrolling. Saved summaries remain metadata-only. Serializer/compatibility/session code, API routes, Prisma and authorization remain unchanged; no generic serialization layer, new endpoint or execution path is introduced. See [hash/handler preservation](rowzen-export-history-templates.md).

### Existing settings and recovery boundary

The single pre-paint theme runtime and ThemeSelector retain the original storage key, events and semantic tokens. A transient root data attribute reports only the last explicit preference-write result through the existing theme-change event; useSyncExternalStore keeps server snapshots deterministic. Shared NotFoundContent is used by root and protected-group not-found conventions; only the root view owns a main landmark. Error-boundary retry, protected-route guards, API status policy and workspace state ownership are unchanged. There is no Settings route or new backend. See [audit and verification](rowzen-settings-final-polish.md).
### Build reproducibility update — 30 October 2026

`npm run build` now runs `prisma generate --config prisma7.config.ts` before `next build`, so fresh Vercel checkouts do not depend on locally generated client files. Generation does not run migrations or connect to the configured database. Next.js and its ESLint configuration are pinned to 16.4.3. See [verified build repair](vercel-build-fix.md).
