
# Data Rehearsal Web App
## Security Guidelines

### Separate release blocker: Next.js dependency security

Rowzen Phase 1 visual and functional verification does not remediate the installed Next.js 16.4.0 advisory. The [official 14 October 2026 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) identifies 16.4.1 as patched; this application enables Cache Components. Production release remains blocked until a separately scoped security upgrade and its regression verification are completed. A successful build or Playwright run does not clear this blocker. No dependency upgrade, configuration workaround or advisory suppression is part of Phase 1 verification.

Rowzen is a public presentation name, not an identity migration. Package/storage/event names, Prisma entities, server-only credentials, OAuth IDs/callbacks, routes and ownership checks remain DataRehearsal-compatible. Shared theme CSS is generated only from trusted static constants, never CSV/user labels; SVG icons contain no scripts or external resources. Theme initialization still stores only the existing allowlisted appearance preference. No data is added to persistence, AI requests, telemetry or downloads by the rebrand. See [foundation verification](rowzen-branding-foundation.md).

The shell/control refinement adds no credentials, account claims, API calls or stored preferences. AccountMenu retains the existing sign-out component and departure approval; cancel/dismiss changes only disclosure state. Modal focus/scroll management is local UI state, with native inertness, Escape and existing pending-operation cancellation guards retained. Labels/error messages remain escaped React text; no CSV persistence, auth policy, ownership, validation or correction logic is changed. The separate Next.js security release blocker remains unresolved. See [verification](rowzen-primitives-shell.md).

Feature 3 Step 6 keeps candidate values and canonical investigation prose in the browser and excludes them from model requests, summaries and persistence. AI suggestions are rendered only after strict grounding/local resolution; Apply requires a visible eligible preview, explicit native confirmation and repeated fresh capability/expected-value checks before the existing synchronous correction callback. Consent/output are scoped to the current finding, interpretation and workspace; navigation, drafts, corrections and revalidation revoke retained previews. Local React text rendering escapes values/labels. No new AI endpoint, credential or paid dependency is added. See [UI trust boundaries](ai-smart-repair-workspace.md).

Feature 3 Step 5 reuses pinned loopback Ollama transport with explicit metadata consent. Dynamic structured output and runtime grounding accept only current opaque references and offered strategies/input/guidance/abstention; values, private labels/prose/history and executable output are excluded. Selection does not authorize a change, and cancellation/context replacement revoke retained plan/verification handles. No backend AI endpoint or plan persistence is introduced. See [integration trust boundaries](ai-smart-repair-integration.md).

Feature 3 Step 4 binds What-if verification to current candidate revisions and expected cell text, rechecking before publication, reads and any future Apply guard. Cancelled/stale/forged handles cannot qualify. Reduced finding details remain browser-local; raw values and details are not added to inference or persistence. No simulation state is committed. See [verification boundaries](ai-smart-repair-verification.md).

Feature 3 Step 3 keeps constructed expected/replacement values behind browser-local candidate handles. Explicit review-data reads recheck the current context; that sensitive data is excluded from inference metadata and must not be logged or persisted. There are no provider/network/storage calls or automatic edits. See [resolver privacy and freshness boundaries](ai-smart-repair-resolver.md).

Feature 3 Step 2 defines a values-free opaque metadata projection and strict single-cell strategy recommendations. Raw replacements, executable operations and model-owned verification claims are rejected; local coordinate lookup requires current sealed evidence and workspace revisions. There are no inference or persistence calls in this step. See [Smart Repair contracts](ai-smart-repair-contracts.md).

### 1. Security Objectives
The application must protect user accounts, application data, CSV datasets, and saved reports against unauthorized access or accidental disclosure.

### 2. Authentication
Better Auth will be used for authentication.

Requirements:
- Secure user registration and login.
- Proper password hashing.
- Secure session handling.
- HTTP-only cookies where applicable.
- Secure cookie configuration in production.
- Protection against authentication abuse.

### 3. Authorization
Authenticated users must only access resources they own or are explicitly authorized to access.

Rules:
- Protect private API endpoints.
- Check ownership on the server.
- Never trust client-provided user IDs.
- Prevent unauthorized report access.
- Prevent insecure direct object references.

### 4. CSV Privacy
CSV files may contain personally identifiable or confidential information.

Privacy requirements:
- Process CSV content in the browser by default.
- Do not upload raw CSV records to the backend without an explicitly approved feature requiring it.
- Do not persist raw CSV files by default.
- Do not include sensitive row values in application logs.
- Avoid storing sensitive values in saved reports.
- Clearly explain what data is retained.

### 5. File Upload Security
The system must:
- Restrict supported file formats.
- Enforce file size and row limits.
- Validate CSV structure.
- Handle malformed files safely.
- Prevent excessive memory consumption.
- Avoid executing uploaded content.

### 6. Input Validation
All API inputs must be validated on the server.

Validation should include:
- Required fields
- Data types
- Allowed values
- String lengths
- Identifier formats
- Schema constraints

### 7. Cross-Site Scripting (XSS)
The application must:
- Avoid rendering untrusted HTML.
- Escape user-controlled output.
- Avoid unsafe DOM manipulation.
- Use appropriate security headers.

### 8. CSV Formula Injection
Exported CSV reports may contain values beginning with spreadsheet formula characters.

The application must sanitize untrusted values in CSV exports so spreadsheet software does not interpret them as executable formulas.

### 9. Database Security
- Use Prisma for supported database operations.
- Avoid unsafe SQL string concatenation.
- Use parameterized queries when raw SQL is necessary.
- Follow least-privilege database access.
- Protect database credentials.

### 10. Environment Variables
Secrets must be stored in environment variables.

Examples:
- DATABASE_URL
- BETTER_AUTH_SECRET

Rules:
- Never commit secrets to Git.
- Maintain a safe .env.example file.
- Never expose server secrets using NEXT_PUBLIC_ variables.

### 11. Error Handling and Logging
- Never expose stack traces to production users.
- Use clear, safe error messages.
- Avoid logging passwords, tokens, or sensitive CSV values.
- Record relevant security events without storing sensitive payloads.

### 12. Security Testing
Security testing should cover:
- Unauthorized API access
- Cross-user resource access
- Invalid file uploads
- Oversized datasets
- XSS attempts
- CSV formula injection
- Authentication and session failures
- Malformed API requests

### 13. Security Principles
- Privacy by default
- Least privilege
- Defense in depth
- Secure defaults
- Input validation
- Server-side authorization
## Theme preference persistence (Phase 9)

The only new persistent browser value is `datarehearsal-theme`, containing exactly `light`, `dark` or `system`. It contains no account identifier, CSV data, mappings, corrected values or correction history and is never submitted to a project/report API. Unrecognized values resolve to System; blocked storage falls back to in-tab selection. A self-contained static head initializer applies appearance before paint; it interpolates no untrusted content. Root hydration suppression is limited to the intentional HTML appearance attributes. A future strict CSP must authorize this static initializer, rather than adding arbitrary inline permissions.

Loading feedback and retry do not bypass authentication or server ownership. Summary/template payloads remain metadata-only. Existing browser-memory CSV departure safeguards remain active after saved summaries and across theme changes. No raw datasets are restored by a theme preference or loading skeleton.


## Shared AI foundation privacy and trust boundary

This section records the original unmounted foundation boundary. Its acknowledgement adapter is unchanged; Feature 1's separate label projection is documented below.

AI is optional, local-only and unmounted by default. Raw CSV records, original/corrected values, history, labels, descriptions and free-form findings are never serialized by the context adapter. Counts and rule metadata may still be sensitive; every request requires an explicit consent flag scoped to the current context. No prompts/responses are persisted, logged or added to existing project/template/summary payloads.

The transport accepts only HTTP 127.0.0.1/localhost origins on explicit nonprivileged ports, rejects credentials/paths/queries/fragments and redirects, omits cookies, and sends only the private adapter payload. It never calls pull/create/cloud endpoints. Two reviewed Qwen model manifest digests are pinned; missing, changed or remote model metadata is rejected before context transmission. The operator must run a trusted local Ollama with OLLAMA_NO_CLOUD=1, loopback binding and exact allowed origins. A malicious local service, compromised same-origin JavaScript or OS cannot be attested by a browser library; a consent flag is not authentication. There is no claim that the application can configure or remotely attest the daemon's cloud setting.

All untrusted HTTP output is byte-bounded, decoded strictly and schema/reference validated; service error bodies and arbitrary exceptions are not echoed. Truncated output, unknown properties/IDs, code/HTML and tool calls are rejected. No model output executes code, changes data or approves validation. Current canonical report/configuration stamps and request identity prevent stale output publication when the owner invalidates its context. Backend Better Auth and ownership checks remain untouched; no public AI proxy or credential-bearing endpoint was added.

The real-model smoke uses synthetic inputs only and is a separate fail-closed command. Mocked/HTTP fixture tests do not establish actual model availability, quality or production readiness. Vercel cannot access a user's model via its own localhost; deployed browser loopback access additionally requires CORS/local-network compatibility testing.

## AI Feature 2 impact evidence — Step 2

Step 4 mounts inference only behind current-context consent and an explicit Review request. Private citation lookups are matched against the actual current report before navigation; model output cannot create URLs, cell coordinates, corrections or persistence writes. Existing correction navigation handles draft-discard confirmation. Report/configuration/correction/session invalidation now occurs in the workspace owner, with request-context identity/revision checks before display and cancellation on replacement/unmount. Evidence failure leaves canonical validation usable. Local labels render only as escaped React text and remain excluded from requests. Summaries/templates/exports retain their original contracts and never receive AI state. See `ai-root-cause-review.md`.

Step 3 inference consumes only the approved opaque evidence projection with explicit scope and unchanged byte limits. No labels, raw/corrected values, issue-message text, physical locations, credentials or persisted explanations enter the new path. Strict output allows only cited hypotheses/investigation codes and uncertainty; arbitrary prose/code, status/count overrides and unsupported impact claims are rejected. Displayable guidance is application-owned, potential impact retains null affected-record counts, and every use checks evidence revisions. Existing loopback/model/consent/timeout/cancellation/transport protections are reused. No cloud fallback, paid service, browser storage or server persistence is added. Future Review integration must forward real invalidation events. See `ai-root-cause.md`.

The unmounted impact-evidence builder serializes only explicit opaque identities, counts and enums. Dataset/column labels, original issue/rule identities, CSV line locations, relationship labels, raw/corrected values, issue-message text and correction history are excluded. Private local resolvers must never be passed to inference or persistence. Existing reviewed export advice supplies local action explanations. Full live report/analytics metadata is required; summary-only data cannot be promoted to detailed evidence. Revision capability checks reject stale reads, serialization and publication; the future workspace integration must report every relevant state transition. The library does not attest a forged caller, server validation, actual migration results or production inference readiness. No network, provider integration or storage is added. See `ai-impact-evidence.md`.

## AI Feature 1 schema-label consent

Semantic refinement: email/date diagnostics include counts only. Values, samples, hashes, row identifiers and correction history remain excluded from model requests and diagnostic messages. Format hints are never validation authority; the existing canonical matcher and strict type/key/reference gates still reject incompatible proposals before display/approval. Filtering no-op rows occurs after full validation and cannot conceal an unsafe item. See `ai-semantic-profile-improvements.md`.

Response-contract follow-up: diagnostic strings come only from a fixed enum; raw HTTP/model text, prompts, arbitrary errors, Zod issue messages, labels, unknown IDs and CSV values are never echoed or logged. Grammar constraints do not replace runtime Zod/evidence checks. False template claims are rejected rather than rewritten; Markdown/partial JSON is never repaired into accepted output. Native approval, stale-response rejection and local-only transport remain unchanged. See `ai-response-contract-fix.md`.

25 October correction: explicit consent now includes aggregate current-column evidence, never raw values/samples/hashes. Profiling stays in browser memory; the wire allowlist contains inferred format and counts only. Known IDs and valid JSON do not establish semantic safety: an additional local compatibility/key/target gate is required before display and again before approval. Ambiguous/insufficient-evidence output is normalized to no actions. Existing configured constraints are not automatically broadened to make invalid data pass. See `ai-schema-evidence-fix.md`; prior schema-only acceptance is superseded.

The optional Configure assistant extends metadata transmission only after a dedicated, context-scoped checkbox and explicit request. It discloses that column and candidate target names may be sensitive. Only selected-schema labels, configured type/required/key metadata and matching approved-template schema labels enter the sealed bounded context. Dataset/project/template names and IDs, descriptions, original/corrected values, raw records, correction history and credentials are omitted. The opaque foundation diagnostic still omits all labels. No model output or AI context is saved in summaries/templates, browser storage or server logs.

Use the existing pinned loopback-only provider with the same no-cloud/cookie/redirect/tool/pull policies, byte limits and deadlines. Exact source/target IDs and strict output schemas block fabricated target strings and executable content; fixed explanatory text avoids rendering arbitrary generated prose. Unknown or malformed output is rejected. Schema names remain untrusted data, not instructions. This does not attest a compromised local runtime.

Inference never changes settings or records. Per-row selection and native confirmation are required; rejection/cancellation retain mappings, corrections and history. Conflicting final target names and multiple approved primary-key candidates are blocked. Configuration/draft/correction/Undo/Redo/report/project/dataset/template changes invalidate pending/displayed suggestions. Existing server authentication/ownership checks and direct-template compatibility remain in force. Saved summaries remain metadata, never a raw CSV backup. Local real-browser verification does not establish production HTTPS-to-loopback permission or hosted-inference readiness.

## Feature 4 schema descriptor boundary

Feature 4 Step 1's schema descriptor is local metadata only. Explicit projection excludes rows, cell values, history, credentials, filenames and issue prose; existing report annotations contain only allowlisted schema codes and locations. Labels remain untrusted sensitive metadata and descriptor IDs are not DOM-safe IDs. No network, logging, browser persistence, inference or export is added. The owner must rotate session/configuration identity and later check freshness before display/export. See [the descriptor boundary](schema-diagram-descriptor.md).

Step 2's standalone SVG serializer uses generated ordinal DOM IDs, escaped text, allowlisted themes and finite numeric geometry. Only fixed SVG elements/attributes and internal marker/title references are emitted; no executable HTML/script, links, external resources, event attributes or arbitrary path strings are accepted. Invalid XML characters become visible replacement characters. Layout/rendering reads only descriptor metadata and omits owner configuration identity. No UI/download integration is added. See [SVG verification and limits](schema-diagram-layout.md).

Step 3 mounts that serializer behind explicit Review generation, with a metadata-only prop boundary, applied-scope identity checks and draft/stale inspection gates. The serializer's escaped, fixed-vocabulary result is the only HTML insertion source; no untrusted HTML or AI prose is inserted. Inspection events resolve generated ordinal SVG IDs to the current local scene. No new network, storage, inference, export or authorization path is introduced. Synthetic browser tests check hostile headers, private-value exclusion, unchanged storage and normal corrections/history through navigation. See [Review security/testing limits](schema-diagram-review.md).

Step 4 permits explicit local SVG metadata downloads only. Full descriptor serialization excludes CSV values/history/private prose/credentials and uses escaped native SVG with no scripts, event attributes or external resources. Sensitive schema names are disclosed in the UI before sharing. Live configuration/generation/report/activity guards are checked before publication; oversized exports fail closed without partial files. Fixed filenames and finally-scheduled Blob URL revocation follow existing download conventions. Exception text is never echoed. PNG is deferred, not silently downscaled or routed through a service. See [export safety and feasibility evidence](schema-diagram-export.md).

Final verification passed hostile-label/actual-file XML, request/storage privacy, draft/stale gates, URL cleanup, and fully offline generation/export cases using synthetic data. AI Foundation/Features 1–3 preserve strict validation and manual workflows; separate real local smokes passed without model/config changes. No authenticated session was fabricated, no real user CSV was tested, and finite local checks do not attest a malicious browser/OS/daemon or establish deployed cross-account security. The local production build passed; no backend/TLS setting was changed and no push/merge/deployment occurred. See [the completion report](feature-4-completion.md).

## AI Feature 3 verification evidence

The Smart Repair Planner uses opaque bounded metadata and browser-local value resolution, genuine candidate/verification capabilities, canonical What-if and explicit approval with fresh revision/expected-value checks. Step 7 tested instruction-bearing labels, private redo history and issue prose, forged verification/replacements, hallucinated aliases, code/bulk/prototype output, stale responses and offline manual exports. No bypass or privacy-canary leak was observed in this finite corpus; 26/26 controlled hostile replies were rejected. Real model quality remains limited despite valid structured output. See [the independent real versus mocked results and trust limits](ai-smart-repair-security.md); these results do not attest a malicious daemon, a deployed network path or universal absence of vulnerabilities.

## Feature 5 export foundation boundary

Database export planning projects schema metadata only and accepts strict target/choice/revision contracts, never arbitrary SQL, operations, credentials or cell values. Raw/corrected rows and history remain browser-local and are neither inspected nor serialized by this foundation. Record consent is explicit and target/revision-scoped; record generation is still blocked as unimplemented. Current-scope capabilities reject stale, cloned, superseded and cancelled plans. No database connection, inference, endpoint, persistence or destructive operation is added. Future database data encoders must be distinct from spreadsheet-safe CSV encoders: apostrophe formula protection deliberately changes database text and must never be applied as a database conversion. Existing spreadsheet exports retain their protections. See [security assumptions and limits](database-export-foundation.md).

### PostgreSQL schema export safety

The browser emits schema-only CREATE TABLE and FK ADD CONSTRAINT statements using strict physical-type contracts, pg_catalog-qualified builtins and per-component quoted identifiers. Reject oversize/invalid names, reserved system columns and incompatible FK choices rather than truncating or interpreting user SQL. Labels never enter comments or executable expressions. No records, credentials, production connections, migration/destructive actions, inferred cascades or automatic execution exist. Current scope/settings/session guards protect SQL and manifest downloads; delayed Blob URL cleanup remains local. Actual SQL-engine verification uses only disposable in-memory synthetic PostgreSQL fixtures. See [security boundary and verification limits](postgresql-schema-export.md).

### Consented PostgreSQL record files

Schema-only remains the default. Strict consent is checked before any current-record access; live consent/scope/settings/session guards are checked at preparation and Blob publication. Values enter SQL only as UTF-8 hex under fixed pg_catalog expressions and allowlisted casts; hex is reversible sensitive data, not encryption. Manifests and visible previews exclude cell values/history. Missing/NUL/invalid-Unicode, rounding, overflow, malformed shapes and converted key/FK violations reject the complete export. Existing spreadsheet-safe CSV remains unchanged and is never a database value source. No network, browser persistence, real database client/execution, destructive SQL or conflict-skipping behavior is added. Only isolated synthetic PostgreSQL imports run in tests. See [limits and verification](postgresql-data-export.md).

### MongoDB EJSON export boundary

MongoDB metadata defaults to record-free; documents require separate current target/revision consent and live publication guards. Flat records are explicitly projected through allowlisted BSON wrappers and JSON.stringify, never eval or JSON parsing of cell text. Dollar/dotted/control names and marker ambiguities are rejected without rewriting. Object.fromEntries safely preserves supported prototype-like own fields. Documents/manifests/instructions contain no credentials or executable user code; only consented JSONL contains values. No record network transmission, server persistence, AI path or automatic MongoDB import is added; users explicitly download local files. FKs/cascades are never represented as native enforced constraints. Native verification uses an attested owned PID/dbpath on loopback and official tools with synthetic data only. See [limitations and security verification](mongodb-export.md).

### Features 4–5 release verification, 26 October 2026

The [combined quality report](features-4-5-completion.md) separates deterministic safety checks, real-model quality failures and unexecuted release gates. Production-asset SVG/PostgreSQL/MongoDB tests pass, including fully offline preparation/download and fresh consented snapshot guards. Disposable SQL and official MongoDB importer checks are version-specific evidence, not a guarantee for arbitrary destinations.

Historical result on 26 October: Next.js 16.4.0 blocked release under the [official October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026). **30 October update:** Next.js and its ESLint configuration are now pinned to 16.4.3; a clean install/build passes without suppressing the security check. The current audit reports zero critical findings and five remaining findings (four high, one moderate) in other dependency chains. Genuine authenticated and distinct two-account browser gates remain NOT TESTED because legitimate session-state paths were not provided; anonymous/mocked ownership checks are not substitutes. Later references below to the old Next.js blocker describe those historical verification runs. See [the current build repair report](vercel-build-fix.md).

### MySQL export boundary

The separate MySQL adapter accepts strict type/profile/revision contracts, not custom SQL or executable operations. Backtick escaping, restricted BMP identifiers, fixed filenames, UTF-8 hex expressions and validated exact primitive literals protect SQL/client-command boundaries without reusing PostgreSQL or spreadsheet escaping. Explicit InnoDB/binary NO PAD settings, enforced BOOLEAN representation checks and strict limits reject unsupported conversions. Schema-only remains default; record consent is independently target/revision-bound and checked before accessing current corrected rows. Live guards surround serialization/Blob publication; no browser persistence, raw-record server transfer, AI request or automatic database connection/execution is added. MySQL DDL implicitly commits and failure can leave partial state; instructions require a new reviewed destination and stop-on-error, never destructive recovery or disabled constraints. Optional native tests use only an owned attested loopback process/data directory and synthetic records, with user option/login credential sources excluded. See [safety details and test limits](mysql-export.md).

### Google/GitHub identity boundary

Provider credentials stay in server environment configuration; the existing auth client contains none. Google requires verified provider email before persistence/session creation. Implicit linking, differing-email linking and trusted-provider verification bypasses are disabled; authenticated explicit connection preserves the original User ID/profile and framework account ownership checks. No email-based project lookup/transfer, custom cryptography, auth secret rotation or Prisma migration is added. Fixed UI feedback never echoes provider error descriptions or credentials; query hints are presentation only. Client import-graph/canary tests and an actual production-asset scan check credential exclusion. Real callback/consent and distinct-account authorization/concurrency tests remain separate release gates, not inferred from synthetic sessions or successful URL initiation. See [actual tests and trust limits](google-github-authentication.md).

### Rowzen public landing/login redesign boundary

Only presentation and public page metadata changed. Provider configuration, credentials, Better Auth callback route, explicit-linking policy, safe continuation, authorization and session handlers remain unchanged. Fixed callback feedback is still used rather than arbitrary provider prose. Public screenshots are existing local assets containing explicitly labeled sample CSVs; no live user records or remote image sources were added. No raw-record persistence, AI inference or database execution was added. Live Google/GitHub authorization URL initiation is tested separately from mocked UI states; complete real consent, returning-user, linking and two-account gates remain independent. The existing Next.js advisory remains a separate production release blocker. See [verification limits](rowzen-public-views.md).

### Public CSV demo and explicit connection recovery

Demo file/CSV safety gates reuse readCsvFile, including strict UTF-8, 1 MB per file, nonempty/case-insensitively distinct headers, valid record structure and physical lines. Up to two distinct datasets stay in React/browser memory; demo state is not sent to an API, log or storage. No authenticated project endpoints, AI inference or database execution are exposed. Record values remain strings and are not automatically repaired. Metadata exports reuse the allowlisted report serializer; labels and physical locations remain metadata users must review before sharing. Connection query hints authorize nothing: callback paths and providers are bounded, normal next destinations retain their existing allowlist, and every actual connection remains protected by Better Auth's authenticated linkSocial and verified-email policy. Connected status is fetched from the authenticated provider list rather than trusted from a callback query. See [real versus simulated verification](rowzen-public-demo-auth.md).

### Dashboard/project presentation boundary

Server authentication/owner filtering and API contracts remain unchanged. New UI reads are same-origin, no-store and limited to existing project endpoints. Response projections discard unused configuration/record fields; mismatched project IDs or invalid payloads become explicit errors rather than zero data. Closing/changing a view aborts its old reads. No new CSV/model/storage transfer occurs. Deletion text names existing cascaded metadata; the deletion handler is unchanged. Legitimate authenticated and independent-account tests remain NOT TESTED when external session states are absent; fixtures cannot substitute for these release gates. See [actual results](rowzen-dashboard-projects.md).
### Upload and Configure privacy verification

Upload presentation does not add network, logging or storage calls. Original preview values remain browser-local; AI consent continues to disclose permitted column/candidate names, configured rules and aggregate evidence, while raw/corrected values and correction history remain excluded. Supplied CSV bytes are test inputs, not new persisted application data. Offline behavior uses controlled transport refusal without stopping the user's Ollama service. Browser component fixtures and synthetic project/template API responses do not establish real authenticated ownership or real-model quality. The existing Next.js security advisory remains a separate release blocker. See [verification scope](rowzen-workspace-upload-configure.md).
### Validate/Review privacy and evidence boundaries

Presentation changes add no network/storage calls or model inputs. Root-Cause output continues to resolve only current validated evidence; hypotheses remain advisory, and potential downstream impact identifies configured datasets rather than claiming affected records. All existing consent, strict output validation, cancellation, stale-response rejection and explicit correction approval remain. Full-diagram SVG downloads retain escaping, active-content exclusion, freshness and Blob URL cleanup. No PNG capability, raw-record persistence, database execution or auth policy change is introduced. Public browser fixtures and controlled provider refusal are distinct from real authenticated accounts and real model quality. The existing Next.js advisory remains a separate production release blocker. See [results and limits](rowzen-validate-review.md).
### Correction UI privacy and approval preservation

No new network, log, storage or AI input is added. Raw/current/corrected values and history remain browser-local. AI replacement values continue to come only from the deterministic permitted resolver, with user-confirmed source meaning where required. Model text cannot bypass What-if, freshness/expected-value guards or explicit approval. Values displayed for a supported candidate are keyboard-focusable local regions; ambiguous advice exposes investigation guidance without Apply. Corrected CSV retains the existing deliberate spreadsheet-safe transformations and disclosure; the in-memory original/current values are not sanitized in place. See [verification scope](rowzen-correction-workspace.md).
### Export presentation privacy and ownership

Schema/definition artifacts contain metadata by default. Sensitive SQL restores and MongoDB JSONL require the existing fresh artifact-specific consent and revision checks. Reversible SQL hex encoding is not encryption. Corrected CSV spreadsheet escaping remains separately disclosed; database records bypass that formatter. MongoDB does not enforce relational FKs, and unsupported constraints remain disclosed. No file is imported or executed automatically. Summary/template writes use unchanged owner-checked APIs and exclude CSV rows/history. Fixtures verify UI/request contracts; genuine authenticated persistence/two-account gates require legitimate sessions and are not replaced by mocks. See [exact verification scope](rowzen-export-history-templates.md).

### Appearance feedback and unavailable-page privacy

Appearance feedback persists only the existing allowlisted Light/Dark/System preference. Storage exceptions and private resource/API details are never echoed in recovery messages. Missing-resource views use generic copy and existing links; server authentication, ownership and deliberate 401/404 responses remain unchanged. No new 403 route, account API, CSV transmission or raw-data persistence is introduced. Browser fixtures and simulated 403/404 responses are not real authenticated/two-account evidence. The existing Next.js security advisory remains an independent production release blocker. See [verification limits](rowzen-settings-final-polish.md).
### Hosted inference failure diagnostics — 30 October 2026

The hosted API emits server-only fixed failure categories (`stage`, `code`, optional service and numeric upstream HTTP status) for 5xx responses. It does not log raw exception/provider bodies, credentials, headers, identifiers, URLs, CSV metadata or prompts. Browser responses retain fixed code/message only. Diagnostic sink failures cannot make a failed request succeed or skip the shared limiter. Groq request rejection and Redis credential rejection now map to configuration errors instead of generic transient advice; original validation, consent and correction boundaries remain unchanged. The reported deployed HTTP 503 remains unverified until its runtime stage is observed. See [runtime diagnosis and limits](hosted-ai-deployment.md#runtime-http-503-diagnosis--30-october-2026).
