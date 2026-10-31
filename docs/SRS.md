
# Data Rehearsal Web App
## Software Requirements Specification (SRS)

Rowzen branding acceptance requires consistent visible names, page metadata, accessible wordmarks and original SVG/ICO icons, with one semantic palette for light/dark/system. Theme initialization must occur before body paint, preserve the existing preference key and avoid hydration mismatches. The theme selector must remain disabled until hydration can handle preference changes, including with delayed JavaScript; a selected preference must survive immediate navigation. Existing routes, OAuth callbacks, APIs, user/project identities and privacy rules remain unchanged. See [foundation verification](rowzen-branding-foundation.md).

Shared UI/navigation acceptance requires 44px controls, preserved field constraints and error/status announcements, native named dialogs with Tab containment/Escape/focus restoration, and a mobile drawer that releases its scroll lock on close/unmount/desktop resize. Account dismissal must retain sign-out pending/error state. Verify project-scoped links, cancelled workspace departures and mapping drafts at 320/375/390/768/1024/1440px with Light/Dark/System. See [verification](rowzen-primitives-shell.md).

Feature 3 Step 6 acceptance requires explicit metadata consent, one relevant current finding, local-only supported candidate values, separate AI/What-if presentation, real resolved/introduced/remaining findings, native Apply confirmation and fresh revision/expected-value checks through the existing correction/history path. Cancel/Dismiss/navigation must preserve CSV/manual drafts/history and revoke old AI previews. Missing models, malformed output, timeout and retry must leave manual workflows usable. Keyboard and Light/Dark/System layouts are tested from 320px through desktop. See [UI behavior and verification](ai-smart-repair-workspace.md).

Feature 3 Step 5 acceptance requires shared approved local transport/lifecycle, strict metadata/output budgets, valid evidence/strategy references, no model values/code, local resolution and canonical effect verification, explicit future approval, stale/cancelled plan rejection and independent mocked/real inference verification. Model quality misses must be reported without weakening grounding. No paid dependency, backend AI endpoint or UI/Apply integration is introduced. See [integration and verification procedures](ai-smart-repair-integration.md).

Feature 3 Step 4 acceptance requires side-effect-free canonical What-if, identity-based resolved/remaining/introduced findings, unchanged CONFIG_ERROR/null semantics, explicit cancellation, preserved correction/history state and fresh revision/expected-value checks for future approval. Neutral/adverse/unevaluated previews cannot qualify for future Apply. No UI, AI or Apply operation is introduced. See [verification APIs and tests](ai-smart-repair-verification.md).

Feature 3 Step 3 acceptance requires unambiguous confirmed-format single-cell candidates, exact current expected values, approved original CSV locations, preserved immutable snapshots/undo/redo, stale-candidate rejection and deterministic explanations. Missing/ambiguous business values require user input; keys/references receive guidance. Resolution neither applies edits nor substitutes for What-if/approval. See [resolver boundaries](ai-smart-repair-resolver.md).

Feature 3 Step 2 acceptance requires strict allowlisted single-cell strategy contracts, approved browser-local references, current session/configuration/correction/report/workspace revisions, and rejection of generated values/operations and stale or unsupported recommendations. Model recommendations cannot substitute for deterministic verification or user approval. No UI, inference or persistence is introduced. See [contract boundaries and tests](ai-smart-repair-contracts.md).

### 1. Introduction

#### 1.1 Purpose
This document defines the functional and non-functional requirements of the Data Rehearsal Web App.

#### 1.2 Scope
The application provides schema-based CSV validation, relational integrity checks, dependency analysis, and import simulation reports.

### 2. Functional Requirements

#### FR-01: User Authentication
The system shall allow users to register, sign in, and sign out securely.

Acceptance Criteria:
- Users can create an account.
- Users can sign in with valid credentials.
- Invalid credentials are rejected.
- Protected routes require authentication.

#### FR-02: CSV Upload
The system shall allow users to select and parse supported CSV files.

Acceptance Criteria:
- Valid CSV files can be parsed.
- Invalid file formats are rejected.
- Malformed CSV data generates a meaningful error.
- Uploaded data can be previewed.

#### FR-03: Schema Configuration
The system shall allow users to define:
- Table names
- Column names
- Data types
- Required fields
- Primary keys
- Foreign key relationships

Acceptance Criteria:
- Users can configure schemas.
- Invalid schema definitions are rejected.
- Users can define relationships between uploaded tables.

#### FR-04: Required Field Validation
The system shall identify missing values in required columns.

Acceptance Criteria:
- Missing required values are detected.
- The report identifies the affected row and column.

#### FR-05: Data Type Validation
The system shall validate data against configured column types.

Acceptance Criteria:
- Invalid values are detected.
- Errors include expected and received types.

#### FR-06: Primary Key Validation
The system shall identify missing and duplicate primary key values.

Acceptance Criteria:
- Duplicate keys are reported.
- Missing primary keys are flagged.
- Affected rows are identified.

#### FR-07: Foreign Key Validation
The system shall validate foreign key references against the corresponding uploaded parent datasets.

Acceptance Criteria:
- Valid references pass validation.
- Missing parent references are reported.
- Nullable foreign keys follow schema rules.

#### FR-08: Dependency Analysis
The system shall analyze relationships between tables.

Acceptance Criteria:
- Dependencies are represented as a graph.
- A valid import order is generated for acyclic dependencies.
- Circular dependencies are detected and reported.

#### FR-09: Rehearsal Report
The system shall generate a report containing:
- Total records analyzed
- Validation errors
- Warning messages
- Affected rows and columns
- Dependency issues
- Recommended import order
- Overall rehearsal status

Acceptance Criteria:
- Results accurately reflect the configured validation rules.
- Each issue contains a clear explanation.

#### FR-10: Report Export
The system shall allow users to export validation results.

Acceptance Criteria:
- Users can download a supported report format.
- Exported reports preserve relevant validation information.
- Sensitive values are excluded or sanitized according to the privacy policy.

#### FR-11: Rehearsal History
The system shall allow authenticated users to view their saved rehearsal metadata and reports.

Acceptance Criteria:
- Users can access their own saved reports.
- Users cannot access another user's reports.
- Raw uploaded CSV content is not stored by default.

### 3. Non-Functional Requirements

#### NFR-01: Security
- Protected endpoints require authentication.
- Authorization is enforced on the server.
- User inputs and uploaded content are validated.

#### NFR-02: Privacy
- CSV processing should occur in the browser for the MVP.
- Raw CSV records must not be persisted by default.
- Reports must not unintentionally expose sensitive data.

#### NFR-03: Performance
- The application should remain responsive within documented file size and row limits.
- Validation should avoid unnecessarily blocking the user interface.

#### NFR-04: Usability
- The interface should be responsive.
- Validation errors should be understandable.
- The application should provide clear progress and status indicators.

#### NFR-05: Reliability
- Invalid inputs must not crash the application.
- Validation results must be deterministic for identical inputs and configurations.
- Errors must be handled gracefully.

#### NFR-06: Maintainability
- Code should be modular and readable.
- Business logic should be separated from UI logic.
- Automated tests should cover critical validation features.

### 4. Technical Constraints
- Next.js with TypeScript
- PostgreSQL
- Prisma ORM
- Better Auth
- Browser-side CSV processing
- Free-tier-compatible deployment where practical

### 5. Acceptance Testing
Each functional requirement must have test cases covering:
- Valid inputs
- Invalid inputs
- Boundary conditions
- Expected results
- Error handling

### 6. Completion Criteria
The MVP is complete when all approved functional requirements are implemented, critical tests pass, and the application can perform a complete CSV rehearsal without modifying an external database.
## Phase 9 theme and loading acceptance

- Accept exactly Light, Dark and System appearance preferences; persist only the allowlisted preference in `localStorage["datarehearsal-theme"]`. Follow live system changes only in System mode, synchronize tabs, and remain usable if storage is blocked.
- Resolve appearance synchronously in the document head before body rendering; preserve consistent server/client markup. Maintain existing light tokens and AA contrast for active semantic text, controls and focus in both themes.
- Expose keyboard-accessible native theme selection on existing public/app navigation. Theme changes must not remount the CSV workspace or alter data, mappings, corrections, history, validation or exports.
- Use static accessible skeletons for suspended route/session data and shared pending-button spinners for genuine network mutations. No fabricated progress, intentional delay, synchronous-validation spinner or new inference workflow.
- Guard duplicate writes before React state updates; preserve input/data on rejection, provide retry and retain existing cancellation confirmations. Project-list fetches abort on cleanup and expose loading/failure/retry without blocking local validation.
- Verify six viewport widths in both themes, reduced-motion feedback, graph/chart readability, persistence/reload/hydration, actual downloadable files and existing regressions. Genuine authenticated acceptance requires legitimate sessions; synthetic fixtures do not replace it.


## Phase 9.1 guided workspace acceptance

- Show exactly one primary workflow panel at a time; retain inactive stateful children using native hidden semantics, not unmount/remount on step changes.
- Provide labeled native mobile navigation and desktop step controls with current, completed, optional and unavailable states. Back/Continue and direct navigation must focus/scroll the destination heading and respect actual pending locks.
- Preserve originals, approved edits, unapplied drafts, Undo/Redo, history, What-if previews, mappings, rules, relationships, templates/project selections, issue filters, graph controls and canonical results when navigating only.
- Run the existing validator unchanged; open Review after a returned report, including CONFIG_ERROR with null row validity. Configuration changes must invalidate stale results, while draft mapping typing retains the existing Apply/Cancel boundary.
- Allow Review to Export without corrections. Keep existing corrected-CSV eligibility and all real exports/summary-saving contracts. A saved summary is never a CSV backup; native departure/refresh safeguards remain active.
- Reveal relevant configuration fields and correction records across hidden panels before focusing them. Respect existing draft-discard cancellation, original physical CSV lines and mapped source columns.
- Verify standard and correction workflows, transactional rejection/recovery, pending races, templates, exports and safeguards using actual components/engines at 320,375,390,768,1024,1440px in both themes. Report genuine-auth verification separately from synthetic project-metadata fixtures.


## Shared AI foundation acceptance

These foundation-only acceptance rules remain applicable to the acknowledgement adapter. Feature 1's explicitly consented label extension is specified below.

- Reuse existing report/configuration types and Zod configuration rules; accept a current canonical report/analytics pair with matching lifecycle stamps. Do not treat saved summary counts as a live report.
- Serialize only bounded numeric/enum facts and opaque IDs. Exclude rows, values, names, descriptions, free-form findings, history, credentials and account/project identity. Reject forged or cloned transport contexts.
- Require explicit local-metadata consent. Use only reviewed local models over a loopback transport with no cookies, redirects, cloud fallback, model pulls or arbitrary prompts/tools.
- Bound and validate all responses before publication, including output from future provider implementations. Reject unknown IDs/properties, invalid JSON/UTF-8, truncated output, tool calls, oversized responses and remote model metadata.
- Support unavailable/missing models, deadlines, cancellation, explicit retry, duplicates and disposed owners. Late/stale output must never replace the current result.
- Keep canonical algorithms, persistence contracts, API authorization and six-step behavior unchanged. No three-feature UI or autonomous repair is part of this increment.
- Test adversarial contexts, real HTTP transport fixtures and browser keyboard/status behavior. Run the real local-model smoke separately; record failures/pending availability honestly. Production readiness requires separate deployed-path and model-quality verification.

## AI Feature 2 impact evidence — Step 2

Step 4 acceptance: mount the optional consent-gated action in Review Summary; reuse current readiness/analytics/Issue Explorer and validated correction navigation. Separate hypotheses, verified citations and potential impact; never invent locations or downstream row counts. Scope citation navigation to actual current issue IDs, provide focused requests for budget limits, preserve READY/CONFIG_ERROR semantics and manual validation through model failure. Bind evidence at actual validation completion and invalidate at existing report-clearing transitions; discard pending/displayed output on relevant scope changes. Keep all state ephemeral. Verify responsive themes, keyboard/focus, errors/cancel/retry, stale responses and prior workflow regressions. See `ai-root-cause-review.md`.

Step 3 adds an optional typed root-cause task over the approved evidence only. Require strict JSON and in-scope citations, evidence-compatible hypotheses/investigations, explicit uncertainty, unmodified report counts/status and application-derived potential impact with unknown affected-record counts. Reject extra fields, unknown/repeated IDs, unsupported claims, stale revisions and malformed output. Preserve existing validation without a model. Use shared local transport/lifecycle, explicit consent/retry and no persistence or generated code/prose execution. Review UI integration remains separate. See `ai-root-cause.md` for contracts, limits and real versus mocked results.

Provide deterministic full-report evidence with opaque model-facing identities, canonical readiness/counts, distinct affected records, existing related findings/corrective actions and configured dependency metadata. Keep potential downstream dataset impact separate from observed row findings, with no inferred downstream row count. CONFIG_ERROR row validity is unevaluated; saved summaries cannot supply missing findings. Use stable report/configuration/correction/session revisions and reject stale handles/publications. Exclude values, labels, physical locations and sensitive message text from serialization. This library is unmounted until later Review integration; no model call, UI or persistence change is included. See `ai-impact-evidence.md` for contracts, caller obligations and executed tests.

## AI Feature 1 acceptance

Final quality refinement: compact verified column summaries with keyboard-expandable details; visible missing/invalid-format/duplicate/leading-zero counts; separate unverified recommendations containing only actual changes. Empty/ambiguous/unchanged responses show "No safe schema changes recommended" and cannot be applied. Equivalent primary keys and identical approvals preserve reports, analytics, corrections and history. See `ai-feature1-final-quality.md`.

Semantic profiling refinement: identify email/date-like intent separately from inferred/configured types; count incompatible populated values with existing canonical rules and blanks separately. Do not apply email/date types while incompatible values remain, infer missing-value sentinels or relax validation. Highlight missing/invalid counts without values, retain useful type/rule changes on identity mappings and hide true no-ops only after full validation. Verify approved saved-template mapping/drift, leading zeros, key protection, approval/cancellation and separate real-model trials; see `ai-semantic-profile-improvements.md`.

Response-contract follow-up: unsupported template reasons must be excluded from generation and still rejected at runtime. Diagnose malformed JSON, missing/invalid fields, unknown/duplicate IDs, truncation and false evidence claims separately without echoing model or CSV content. Valid supported responses require unchanged Zod/evidence checks and human approval; an AI failure must leave ordinary CSV validation usable. Record repeated real inference separately from service fixtures; see `ai-response-contract-fix.md`.

25 October semantic acceptance additions:

- Scan the complete current approved browser-memory snapshot using canonical supported-type checks; count blanks and exact trimmed-string duplicates. Do not serialize values, samples or hashes.
- Keep inferred formats distinct from configured types. Reject unsupported types, unrelated targets and key candidates without non-null/uniqueness/schema evidence before display and approval. Preserve leading-zero formatting and avoid unsafe numeric precision. Do not infer FKs from suffixes.
- Treat ambiguous/insufficient-evidence output as non-actionable abstention. Do not infer requiredness from complete data, automatically relax configured rules, or allow no-op suggestions to clear results.
- Regress the reported duplicate-ID CSV, mixed/null/leading-zero/ambiguous data, hallucinated output, correction/Undo/Redo refresh and privacy. Report real-model abstention separately from useful accurate suggestions; see `ai-schema-evidence-fix.md`.

- Mount optional assistance in Configure, reusing the design system and current state owner. Reuse the pinned local provider and request lifecycle; no new paid service, API or dependency.
- Require context-specific consent before transmitting schema labels and configured rules. Exclude raw/original/corrected CSV values, history, dataset/project/template identity and credentials. Treat names and all model output as untrusted.
- Compare only against a selected saved template with a matching dataset name. Identify added/removed/reordered original headers and explicit configured-type conflicts; label model-proposed renames as uncertain. Preserve exact direct-template compatibility checks.
- Validate bounded output against strict schemas and known source/target IDs. Present reasons and uncertainty without arbitrary model prose. Suggestions do not prove types, requiredness or uniqueness.
- Never apply on inference. Support per-row selection, explicit confirmation, Cancel and Reject. Preserve current records/corrections/history; retain untouched rules and other datasets. Block conflicting final mappings and multiple approved primary-key candidates. Invalidate reports on approval.
- Invalidate pending/displayed suggestions on configuration, draft, correction/Undo/Redo, report, project, dataset and template changes. Provide unavailable, error, cancellation and explicit retry feedback; keep manual validation available without a model.
- Verify unit/integration, keyboard/mobile/light/dark browser fixtures and real local inference separately. Keep production acceptance and genuine authenticated browser verification distinct. See `ai-schema-mapping.md`.

## Feature 4 schema descriptor acceptance

Feature 4 Step 1 acceptance: describe applied CSV metadata independently of template-saving eligibility, preserve complete primary/unique groups and ordered parallel/composite/self FKs, retain unresolved declarations with diagnostics, and expose unspecified types as `Not configured`. Require session/configuration identity, exclude row values/history/private prose, and never infer SQL/cardinality semantics or run validation during projection. The library remains unmounted; see [descriptor contracts and limitations](schema-diagram-descriptor.md).

Step 2 acceptance: preserve every column and relationship pair in deterministic native SVG geometry, including cycles/self-references and incomplete declarations; wrap full identifiers, retain accessible descriptions, avoid fabricated endpoints, use independent safe IDs and explicit theme colors, and escape all schema labels. Unit-test bounds, parallel lanes, hostile labels and large column lists. React integration and downloads remain out of scope; see [layout verification](schema-diagram-layout.md).

Step 3 acceptance: expose explicit Generate schema diagram in Review with a dedicated Schema section; preserve workspace/correction state and camera through navigation/report-only/theme changes; block pending drafts and stale configuration/session scopes. Allow BLOCKED/CONFIG_ERROR draft inspection with truthful diagnostics. Provide native keyboard/pointer pan, zoom, fit, entity/FK inspection and complete bounded table alternatives at 320/375/390/768/1024/1440px in Light/Dark, with System transitions. No AI calls, persistence, backend changes or schema downloads are added. See [Schema Review verification](schema-diagram-review.md).

Step 4 acceptance: download complete standalone SVG rather than the visible viewport, retaining every configured table/column/FK, relevant warnings and explicit draft disclosures. Preserve the current resolved appearance, escaped native text and local-only privacy boundary. Block stale/oversized downloads, clean Blob URLs and report safe retryable errors without changing workspace state. Test actual files, hostile labels, offline themes and resource limits. Enable PNG only after a separate reliable feasibility gate; currently deferred. See [export verification](schema-diagram-export.md).

Final acceptance evidence: 108 focused diagram cases, 151 independent canonical-engine cases plus four legacy-rule cases, the full 1,381-test suite, and 140 production-asset public Chromium cases passed. The added offline-before-generation regression proves loaded-workspace schema generation and SVG download require no Ollama/network request. TypeScript, lint and production build passed; one separate live repair UI smoke and Feature 1/2 real synthetic smokes also passed. Overlapping groups are not additive. Authentication/cross-browser limits and the recovered initial timeout are recorded in [the completion report](feature-4-completion.md).

## AI Feature 3 quality and security verification

Step 7 acceptance evaluates strict strategy selection separately from local candidate resolution, canonical What-if and explicit one-cell approval. Unsafe, stale, forged and unsupported proposals must remain non-actionable; manual corrections, validation, Undo/Redo, history and exports must work without AI. Record real inference separately from mocked security cases, and treat incorrect generic abstention as a quality failure. The 2026-10-26 results support a conditional local synthetic demonstration only: 55/69 expected model outcomes, 33/33 verified improvements, 26/26 controlled hostile responses rejected. See [the scenario matrix, measurements and limitations](ai-smart-repair-security.md).

## Feature 5 shared export foundation acceptance

Strict requests must default to schema-only, retain complete column/key/FK metadata and diagnostics, reject unknown operations/references and stale scopes, and bind record consent to target/current revisions. Non-native constraints must remain disclosed after acknowledgment. The manifest must state database compatibility is NOT_VERIFIED; no destructive operations or automatic execution are permitted. Record requests remain blocked until separate encoders exist. Tests must cover target-specific compatibility, configuration failures, privacy, correction/Undo/Redo/report revisions and cancellation without changing existing workflows. See [foundation evidence](database-export-foundation.md).

### PostgreSQL schema-only acceptance

Generate only allowlisted pg_catalog types and safely quoted identifiers, preserve effective key groups and every ordered FK, reject ambiguous types/unresolved configurations, and create all tables before adding FKs. Require explicit target choices and acknowledgement of semantic differences. Local preview/download must exclude values, reject stale revisions/options/drafts, preserve corrections/history and provide useful errors. A disposable PostgreSQL engine must verify syntax/catalog constraints where available; preflight and synthetic execution are not production database compatibility guarantees. See [executed verification](postgresql-schema-export.md).

### PostgreSQL corrected-data export acceptance

Record access must require current target/revision consent and a genuine current schema plan. Use only the approved corrected snapshot, reject missing/unsupported/out-of-range values and target key/FK violations, preserve text bytes and explicit NULL policies, and never repair or omit records. Produce guarded local restore/metadata/instructions downloads with dependency-aware ordering and FK validation after cyclic loads. Verify actual disposable imports of Unicode, multiline/quoted text, NULL/empty, large integers/decimals, composite/FKs/cycles and approved corrections. No spreadsheet sanitization or real user database execution is permitted. See [supported limits and executed results](postgresql-data-export.md).

### MongoDB export acceptance

Use strict target-specific primitive/empty/identity choices, preserve current approved records after explicit consent, and reject unsafe field names, stale capabilities, unsupported conversions and converted key collisions. Preserve FK declarations only as metadata and state foreignKeyEnforcement NONE. Optional validators/indexes must use actual MongoDB semantics; no destructive import flags or automatic real-server import is allowed. Verify EJSON syntax/precision, NULL/missing, special names, identities, native constraints and official mongoimport round trips where tools exist. Preserve existing PostgreSQL and correction behavior. See [executed acceptance evidence](mongodb-export.md).

### MySQL export acceptance

Use a separate strict MySQL dialect and explicit approved physical/empty/profile choices, defaulting to schema-only. Preserve supported PK/composite/unique and every ordered FK; reject nonunique/incompatible endpoints and unsupported indexed text rather than dropping constraints or inventing prefix indexes. Validate exact signed ranges, DECIMAL precision/scale, BOOLEAN 0/1 representation, DATE 1000–9999, Unicode and explicit NULL/empty semantics. Require fresh revision-bound consent before current-row access, recheck before local downloads, preserve originals/corrections/Undo/Redo/history and never apply spreadsheet transformations. Disclose MySQL DDL implicit commits/partial failure; generate no destructive defaults or automatic connection/execution. Verify actual official-client imports only into owned disposable infrastructure where available, and retain NOT_VERIFIED destination manifests. See [exact tests and supported limits](mysql-export.md).

### Dual-provider authentication acceptance

Preserve GitHub and add configured Google through the existing Better Auth client/handler. Require Google verified email before provisioning/session creation, explicit authenticated same-email linking and unchanged stable User IDs/resource ownership. Reject implicit/different-owner linking, malformed/replayed callbacks and unsafe return origins without weakening framework checks. Keep errors fixed/private, both actions mutually disabled while pending, restoration/retry accessible and themes/responsive controls intact. Test new/returning identities, cancellation, safe next URLs, explicit links in both directions, no sequential duplicate users/accounts, sign-out and authorization. Actual provider consent/token exchange and real two-account gates must be reported independently from synthetic tests. See [executed results and remaining live gates](google-github-authentication.md).

### Rowzen public-view acceptance

Public landing/login must retain real CTA destinations, safe internal OAuth continuation, existing sign-in/linking/sign-out handlers, pending guards and fixed cancellation/error feedback. Captured sample data must be labeled; copy must distinguish configured preflight checks and local artifacts from actual database execution. Verify six widths, light/dark/System, keyboard focus, metadata, image loading and local links. Real provider initiation and fixture-driven session tests must be reported separately; initiation alone is not successful identity verification. See [actual results](rowzen-public-views.md).

### Public demo and connection recovery acceptance

Reject malformed/empty/non-UTF-8/duplicate-header/oversized files through the canonical parser. One independent CSV must work; no filename, header, type or FK assumption may be mandatory. Disclose unconfigured checks; retain CONFIG_ERROR/unevaluated-row semantics. Rule/file changes invalidate downloads, and older file reads cannot restore cleared/replaced state. Records remain browser-local; metadata-only JSON uses the existing report serializer with a demo-scope notice. Recovery callbacks carry only an allowlisted provider and safe destination. A query hint must never link an account or prove connection success; the latter requires Better Auth's authenticated account list. See [tests and limits](rowzen-public-demo-auth.md).

### Dashboard and project-view acceptance

The authenticated `/projects` route must mount the existing `ProjectsView` with the complete owned metadata list. New project (including the first-project empty-state action), Edit and Delete must remain visible and use the existing dialogs and API handlers; successful mutations update the displayed list without a reload. Route-level regression coverage must verify this integration, authentication gating and query failure propagation.

Preserve existing create/edit/delete payloads, owner-scoped server reads, pending/cancel guards and project-linked templates/reports. Distinguish loading/errors from verified zero and no search matches. Reject malformed or mismatched project-resource data; abort old reads on selection/close. Preserve search/sort and restore keyboard focus when filtered edits remove their trigger. Deletion warnings disclose dataset metadata, summaries and templates without implying CSV persistence. Use actual scoped counts and dates only. Real authorized/two-account checks must be reported separately from fixtures. See [actual checks](rowzen-dashboard-projects.md).
### Upload and Configure presentation acceptance

Keep all six step panels and dataset configuration panels mounted. Preserve native file re-selection/drop behavior, canonical 1-5 file / 1 MiB UTF-8 limits, original previews and physical CSV lines. A failed replacement retains prior data, configuration, reports and corrections. Display an unset type as Not configured without assigning a validation rule. Preserve mapping Apply/Cancel, template confirmation/compatibility, AI Apply/Reject, request cancellation and stale-output rejection. Test the supplied CSV pack and six viewport widths; report mocked provider/API checks separately from real authenticated/inference gates. See [actual evidence](rowzen-workspace-upload-configure.md).
### Validate and Review presentation acceptance

Preserve READY/READY_WITH_WARNINGS/BLOCKED/CONFIG_ERROR, all canonical counts including null row validity, issue scopes, search/filter/sort/page behavior and real issue-to-record locations. Retain mounted Review panels and filters/camera across section/theme navigation. Saved summaries must continue to disclose that CSV records, individual findings and correction history are absent. AI explanation failure must not affect deterministic validation, navigation or exports; hypotheses and potential downstream impact must not imply verified affected records. Preserve ordered composite FK pairs, parallel declarations, keyboard controls and fresh full-diagram SVG export. Test supplied clean/blocked/composite/cycle CSVs, invalid settings and actual downloaded files. See [actual verification](rowzen-validate-review.md).
### Correction presentation acceptance

Preserve one physical source-cell edit at a time, current/original snapshots, mapped issue-to-cell navigation, expected-value/revision checks, draft cancellation, Undo/Redo, activity history and automatic revalidation. Manual positive/neutral/negative What-if must leave state unchanged until explicit Apply. AI Apply remains unavailable for ambiguous, unsupported, stale or non-improving proposals and requires a current verified preview plus explicit confirmation. Keep drafts/previews/history mounted across step and appearance changes. Retain multiline/Unicode/leading-zero values and disclose spreadsheet-safe CSV export transformations without altering the browser-memory snapshot. See [checks and limitations](rowzen-correction-workspace.md).
### Export presentation acceptance

Preserve all dialect-specific serializers, constraints, warnings, explicit type/empty-value choices, schema-only defaults, record consent and revision freshness. Database artifacts must use approved current values directly, never spreadsheet-sanitized CSV. Full report prose and privacy-safe metadata downloads remain distinct. Keep saved-summary metadata-only limits, scoped history pagination, template compatibility/confirmation and load/error/empty states. Verify actual CSV/SVG/SQL/JSONL/manifest downloads, offline generation and stale-file refusal. Do not expose unimplemented formats or claim import/database compatibility from file generation alone. See [results](rowzen-export-history-templates.md).

### Appearance persistence and page recovery acceptance

Explicit theme selection must preserve focus, use the existing allowlisted preference key, follow OS appearance in System mode and synchronize across tabs. Announce actual storage success; visibly disclose failed persistence without blocking the current tab. Root 404 must have one main landmark, a meaningful Rowzen title, noindex metadata and working recovery links. Protected missing-resource recovery must reuse the existing shell without nesting main or revealing private resource identity. Responsive, reduced-motion, keyboard, zoom and metadata checks are recorded in [the final polish verification](rowzen-settings-final-polish.md); fixture coverage is not authenticated ownership evidence.

### Concise assistance copy and fixture readiness

Lead with actions and results. Keep metadata categories, processing destination, sensitivity and consent visible before an AI request; put model names, local endpoints and processing policy details in keyboard-accessible disclosures. Preserve unverified suggestions, possible causes, verified findings, preview/approval requirements and all generating/error/unavailable states. Avoid repeated optional/provider marketing copy. Local and hosted provider contracts and snapshot-scoped consent remain unchanged.

Component browser fixtures must wait for the landing heading, hydration-enabled appearance control and loaded styles before replacing the page. Network silence is not fixture readiness. Blocked-schema coverage must still inspect the complete draft relationships and reject import-readiness claims while an unrelated background request remains pending. See [verification](rowzen-ui-copy-e2e.md).
