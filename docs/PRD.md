
# Data Rehearsal Web App
The application's public brand is **Rowzen**: “Clean data. Confident imports.” Its original row/grid/check mark and neutral/indigo themes change presentation only. Existing CSV preflight, AI, correction and export capabilities retain their behavior; no new metrics or database execution is implied. Internal DataRehearsal identifiers remain unchanged. See [branding foundation](rowzen-branding-foundation.md).

The shared-control and shell refinement retains the four real navigation destinations and existing theme/account capabilities. Mobile navigation is a named modal drawer; an accessible account disclosure contains the existing sign-out control. Shared fields, status messages, tables, skeletons and empty states use the same design system. No settings route, inert link, new account feature or business workflow is introduced. See [UI and navigation verification](rowzen-primitives-shell.md).

Feature 3 Step 6 mounts an optional one-cell AI repair planner in Correct. Users choose a verified finding, confirm known source interpretation, consent to metadata-only local inference, review local values and deterministic What-if, then explicitly approve a fresh correction. Existing revalidation, Undo/Redo and activity history are reused. Ambiguous/unsupported findings receive local investigation guidance; navigation and workspace changes revoke old previews. See [Correction Workspace AI UI](ai-smart-repair-workspace.md).

Feature 3 Step 5 connected internal strategy planning to the existing optional local model. AI selects an allowed strategy or safe non-action outcome; browser-local resolution and deterministic What-if remain separate. Step 5 supplied the headless session; Step 6 above mounts its explicit approval UI. See [AI repair integration](ai-smart-repair-integration.md).

Feature 3 Step 4 added internal deterministic candidate previews with resolved/remaining/introduced finding details and cancellable revision-bound verification. Improvement means declared preflight checks improved; it does not certify business correctness or a real import. That step introduced no mounted planner, Apply or AI integration. See [Step 4 verification](ai-smart-repair-verification.md).

Feature 3 Smart Repair groundwork includes strict one-cell recommendation contracts and a deterministic browser-local boolean/date candidate resolver. Explicit user-input/guidance/unsupported outcomes remain separate from impact verification and approval. Those groundwork steps introduced no user-facing planner; Step 6 above provides the UI. See [Step 2 contracts](ai-smart-repair-contracts.md) and [Step 3 resolver](ai-smart-repair-resolver.md).

## AI issue explanations in Review (Feature 2)

The CSV workspace offers optional local AI explanations in Review alongside existing deterministic results. Users explicitly consent before sending opaque issue/dependency identifiers and aggregate counts to local Ollama; CSV values, dataset/column names and correction history are excluded. Possible causes are distinct from verified findings and potential downstream dataset impact. Citations open real Issue Explorer findings, and validated locations can open the existing correction editor without changing a value. READY, missing evidence, local-model failure and focused-analysis limits have clear feedback. Workspace changes invalidate prior analysis. No AI explanation is persisted and ordinary validation remains available without a model. See `ai-root-cause-review.md` for verification and limits.
## Product Requirements Document (PRD)

### 1. Project Overview
Data Rehearsal is a web application designed to help users validate and simulate CSV data imports before importing data into a real database.

The application identifies common data integrity issues, including missing required values, duplicate primary keys, invalid data types, broken foreign key references, and incorrect import dependencies.

### 2. Problem Statement
Importing CSV data into relational databases can cause failures due to invalid or inconsistent records.

Users often discover these issues only during the actual import process, resulting in additional debugging, manual corrections, and wasted time.

### 3. Proposed Solution
Data Rehearsal provides a browser-based environment where users can upload CSV files, define database schemas, validate records, and simulate the import process without modifying a production database.

### 4. Target Users
- Software developers
- Database administrators
- Data analysts
- Students learning relational databases
- Data migration teams

### 5. Core MVP Features
1. User registration and login.
2. CSV file upload and parsing.
3. Schema configuration.
4. Required field validation.
5. Data type validation.
6. Primary key and duplicate detection.
7. Foreign key validation across datasets.
8. Table dependency analysis.
9. Recommended import order.
10. Validation results and error reports.
11. Report export.
12. User dashboard and rehearsal history.

### 6. User Workflow
1. User signs in.
2. User creates a rehearsal.
3. User uploads CSV files.
4. User defines table schemas and relationships.
5. System validates the datasets.
6. System analyzes dependencies.
7. System generates a rehearsal report.
8. User reviews issues and recommended import order.
9. User exports or saves the report.

### 7. MVP Scope
The MVP focuses on static, schema-based CSV validation and import simulation.

The application will not:
- Connect directly to production databases.
- Execute real database migrations.
- Modify users' original CSV files.
- Guarantee successful execution in every database environment.

### 8. Product Goals
- Detect common data integrity issues before import.
- Reduce manual validation efforts.
- Provide clear and actionable validation reports.
- Protect sensitive uploaded data.
- Deliver an accessible and easy-to-use interface.

### 9. Future Enhancements
- Direct database connections.
- Advanced schema inference.
- Additional file format support.
- AI-assisted error explanations.
- Team collaboration.
- More detailed migration simulation.

### 10. Success Criteria
The MVP is successful when users can upload supported CSV files, configure relationships, run validation, identify integrity issues, and generate understandable reports without affecting an external database.
## Phase 9 appearance and wait feedback

Users can choose Light, Dark or System from the existing app header and public pages. Light retains the established baseline; System follows the operating system live. Only this appearance preference persists locally across reloads. Dataset values, corrections and history remain browser-memory only. Existing async actions expose contextual pending feedback, while server page loads and session checks have restrained skeletons. No AI inference workflow or Settings route is added.

## Phase 9 public product homepage

The existing `/` route explains DataRehearsal's actual CSV preflight workflow, grouped features, sample interface, browser-memory boundaries and next action. Header/footer links use existing routes and section targets; Get Started retains the current authenticated application flow. The landing-only screenshot viewer shows real interface captures with sample data and supports keyboard navigation and Light/Dark/System appearance. It adds no validation, import, AI, storage or authentication capability.


## Phase 9.1 guided CSV workspace

The CSV workspace uses six full-page steps: Upload, Configure, Validate, Review, optional Correct and Export. Users can revisit available steps, use Back/Continue and move directly from findings to their source records without losing browser-memory work. Upload and Configure show one selected dataset at a time; Review provides summary, issues, dependencies and analytics views. Applying configuration changes still invalidates stale results, and unapplied mapping drafts remain explicit. Corrected-CSV downloads retain the existing requirement for approved changes. Saved summaries contain metadata only and cannot restore CSV records after leaving or refreshing.


## Feature 4: configured CSV schema inspection

Feature 4 adds optional deterministic schema inspection in Review. Generate schema diagram opens a dedicated view of the applied CSV configuration, with pan/zoom/fit, entity and FK inspection, complete native tables and incomplete-configuration diagnostics. Drafts must be resolved before generation; configuration/dataset changes require regeneration. Blocked validation can be inspected without implying readiness. The feature stays browser-local and adds no AI request, persistence or download in Step 3. See [Schema Review](schema-diagram-review.md).

Step 4 adds a deliberate browser-local full-diagram SVG download in the current appearance. Incomplete/blocked snapshots are visibly marked as drafts and retain all unresolved declarations. Stale or oversized exports are rejected without changing the workspace. Files include sensitive schema metadata but no CSV values/history. PNG is deferred after a separate sizing/rendering feasibility check. See [diagram export](schema-diagram-export.md).

Final verification supports a scoped local demo of deterministic CSV schema inspection and SVG export, including model-independent operation. The production build, full 1,381-test suite, 140 production-asset browser regressions and separate real-AI compatibility smokes passed. PNG, authenticated deployment acceptance and exhaustive cross-browser/accessibility certification remain outside the sign-off. See [Feature 4 completion](feature-4-completion.md).

## Shared AI foundation scope

The following describes the initial foundation delivery. Feature 1 now extends it as described below.

An optional local-model foundation provides privacy-safe metadata context, pinned local-model transport, strict output validation and in-memory loading/error/cancellation/retry/versioning support. It exposes no new application action or navigation item and implements none of the three planned AI business features. Existing deterministic validation and browser-memory CSV behavior remain authoritative. A local connection smoke result must not be presented as production inference readiness or business-feature accuracy.

## AI Feature 1: optional schema assistance

25 October refinement: users see browser-local column evidence and a separate inferred/configured type distinction. Type and key suggestions must pass full current-snapshot evidence checks; duplicate/null columns cannot become new key candidates. An uncertain model can abstain. Neither profiling nor AI changes existing rules or records automatically. See `ai-schema-evidence-fix.md`.

Feature 1 extends the previously isolated foundation with a Configure-only assistant. After an explicit opt-in, a pinned local Ollama model receives schema labels and configured metadata, never CSV values. Users can compare against a selected saved template, review possible mappings/types/required fields/key candidates, and approve selected changes deliberately. Drift has no invented baseline; renames and constraints remain uncertain until reviewed and deterministically validated. Rejection/cancellation preserves the entire session. Existing template compatibility, correction history and manual workflows remain authoritative. No production-inference claim or other AI feature is added. See `ai-schema-mapping.md`.

## Feature 5: deterministic database export foundation

The shared, currently unmounted foundation plans exports from the applied CSV schema using separate PostgreSQL, MySQL, MongoDB and optional GraphQL capability profiles. Schema-only is the default; ambiguous conversions and non-equivalent constraints require explicit choices/acknowledgements. Canonical preflight and actual database compatibility remain distinct. No dialect files, record serialization, UI or database execution are implemented in this milestone. See [contracts, privacy and limitations](database-export-foundation.md).

### Feature 5 PostgreSQL schema-only delivery

The Export step now offers explicit PostgreSQL type/empty-policy choices, local schema preview and SQL/manifest downloads from current applied configuration. Full primary/composite/unique/FK declarations are retained; cyclic schemas use tables/keys before FK creation. Records and automatic database execution are excluded. Stale scopes and pending drafts block downloads. See [delivery and actual test limits](postgresql-schema-export.md).

### Feature 5 optional PostgreSQL corrected records

A current PostgreSQL schema preview now offers a separate explicit opt-in for approved current records. Local restore SQL includes new tables, every record and validated FKs, including cycles; manifests and instructions disclose sensitive reversible hex encoding, conversions and limits. Schema-only remains the default. No automatic execution or real database connection is added. See [record export and actual disposable imports](postgresql-data-export.md).

### Feature 5 MongoDB document export

Export now offers a separate deterministic flat MongoDB adapter, defaulting to metadata-only. Explicit BSON/NULL/missing/_id choices and separate record consent produce local EJSON v2 JSONL, optional validators/unique indexes, a manifest and manual mongoimport instructions. SQL foreign keys/cascades remain disclosed metadata with no automatic enforcement or embedding. No automatic import, backend, persistence or runtime dependency is added. See [MongoDB verification and limitations](mongodb-export.md).

### Feature 5 MySQL export

The Export step includes a separate deterministic MySQL adapter: explicit InnoDB/utf8mb4 physical types and empty policies, schema-only preview/download by default, and independently consented approved corrected-record restore SQL. Complete supported keys/FKs and cycles are preserved; incompatible types, index/row limits and invalid records reject the export. The UI/manifests disclose binary NO PAD comparisons, metadata-only application checks and MySQL's non-atomic DDL. No database connection, execution, destructive default, raw-record persistence or PostgreSQL behavior change is introduced. See [support and actual MySQL verification](mysql-export.md).

### Google and GitHub sign-in

The minimal themed login offers both social providers with provider-specific pending/error/cancellation states and safe internal continuation. Existing users explicitly connect another provider while signed in, using the same verified email; no implicit account merge, profile overwrite, user-ID replacement or project transfer occurs. Existing GitHub, protected pages, auth client/routes and sign-out/departure protection remain intact. Google requires verified identity and server-only credentials. See [setup, identity policy and actual verification](google-github-authentication.md).

### Rowzen public landing and sign-in presentation

The public landing now presents mapping, deterministic preflight checks, issue review/correction, optional AI advice and local exports in an original Rowzen layout, with genuine sample-run captures clearly labeled as a demo. Login uses a responsive split/compact presentation and both existing provider actions. This adds no import execution or authentication capability. See [implementation and actual verification](rowzen-public-views.md).

### Public custom-CSV demo and account connection recovery

The public /rehearsal route accepts one or two supported UTF-8 CSVs (1 MB each), with explicit optional types, required fields, primary/composite keys, single-column unique keys and cross-file relationships. Samples and their rules are optional examples. This is a small browser-local validation demo, not a second full authenticated workspace. Google same-email connection recovery returns users through their existing provider to an explicit Connect action; automatic merging remains disabled. Landing now offers a direct live-demo CTA and restrained reduced-motion-aware entrances. See [implementation and verification](rowzen-public-demo-auth.md).

### Rowzen dashboard and project presentation

Dashboard and Projects now use a coherent responsive presentation over existing owned data. Recent summaries come from the selected recent project's existing API; counts disclose their scope. Projects supports local name/description search, sorting and a native detail dialog with exact workspace/report/template navigation. No fake analytics, new backend or import execution is added. See [delivery and actual verification](rowzen-dashboard-projects.md).
### Upload and Configure presentation

The existing six-step workspace now presents upload requirements and failed-replacement recovery more clearly, bounds the original-data preview, and distinguishes unconfigured types from configured string validation. Mapping, key, relationship and project-template controls retain their existing handlers. Browser-local evidence is visually separated from optional AI advice. No parsing, mapping, validation, correction, provider or persistence behavior changes. See [scope and verification](rowzen-workspace-upload-configure.md).
### Validate, Review and report presentation

Existing validation execution, readiness, Issue Explorer, analytics, Dependencies, Schema Diagram and saved-report views now share denser controls and clearer hierarchy. Configured preflight outcomes, unevaluated rows and historical metadata limitations remain explicit. Optional AI hypotheses and potential dataset impact are visually separated from verified findings; counts and actual record navigation remain deterministic. Supported schema export remains browser-local SVG; PNG remains deferred. See [verification and preserved boundaries](rowzen-validate-review.md).
### Correction workspace presentation

The existing correction workspace now makes browser-local original/current/proposed values, deterministic What-if and applied changes easier to distinguish. It reuses the shared text editor, groups existing controls and bounds the keyboard-accessible history timeline. The optional AI planner continues to select allowlisted strategies only; local resolution, deterministic verification and explicit user approval remain separate. No automatic model edit or invented replacement value is introduced. See [actual verification](rowzen-correction-workspace.md).
### Export, history and template presentation

The existing Export step now separates full report explanations, privacy-safe metadata downloads, corrected CSV records and target-specific database artifacts more clearly. PostgreSQL/MySQL/MongoDB remain the implemented database adapters; schemas/definitions stay the default and records require separate explicit consent. History, saved-summary and template controls retain their existing ownership, pagination and reuse behavior. No GraphQL SDL or PNG exporter is exposed because neither is implemented. See [actual verification and limits](rowzen-export-history-templates.md).

### Existing settings and recovery states

Appearance remains the real Light/Dark/System preference in the existing navigation and public views. A failed device-storage write keeps the selected appearance for the tab and explains that it was not saved. Unmatched pages provide branded, accessible recovery through existing destinations. No Settings page or inert preferences are added. See [verification and measured findings](rowzen-settings-final-polish.md).
