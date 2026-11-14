# TermPilot AI — Scheduling Copilot Upgrade: Independent Audit

| | |
|---|---|
| **Audited** | `main` @ `2861c9f` plus the uncommitted working tree (38 modified files, 8 untracked files, `+1478 / −261`) |
| **Audit date** | 2026-11-11 |
| **Scope** | Scheduling Copilot upgrade: GE parsing, credit snapshot, structured `plan` request, planner selection and credit report, agent tools and limits, DeepSeek reasoning config, CopilotKit chat reporting, proposal lifecycle |
| **Sources of truth compared against** | `docs/superpowers/specs/2026-11-10-scheduling-copilot-design.md` (approved), `docs/superpowers/plans/2026-11-10-scheduling-copilot.md` (10 tasks), `docs/audits/2026-11-10-ai-planner-audit.md` (S1–S15) |
| **Type** | Audit only. No source, test, dataset, or user data was modified and no commits were created. |

**Method.** Every finding below was reproduced against the real 1,582-section catalogue (`loadCatalogue()`), the committed 570-record credit snapshot, the production planner, the real tool factory (`createTools`) with the real in-memory store, and the live University of Macau catalogue pages. Approximately 40 probe scripts were run from `/tmp` and deleted. `git status` at the end shows the same 38 + 8 entries it showed at the start, with one disclosed exception in §7.

**Verification baseline (reproduced):**

```
npx vitest run --exclude '**/.worktrees/**'   → Test Files 51 passed | 1 skipped (52)
                                                Tests 257 passed | 1 skipped (258)
npx tsc --noEmit                              → exit 0, no diagnostics
npx eslint src tests scripts                  → exit 0, no diagnostics
npx next build                                → succeeds, all 18 routes compile
npm test (no exclude)                         → 7 failed files / 19 failed tests (see S9)
```

---

## 1. Executive summary

The upgrade **substantially fixes the original planner failure**. Credits are now real, verified data. GE is a parsed attribute. `plan` is no longer all-or-nothing. Search hits carry the fields the model needs. The turn budget and its error messages are honest. The headline request from the original audit — *"18 credits, two GE courses, nothing before 8am"* — now produces a legal 6-course, 18-credit preview including two genuine GE courses, with a verified credit report and `gap: 0`.

Those three critical defects (S1, S2, S3) are **closed**. Seven of the fifteen original findings are closed outright; two more are improved; six remain, of which five are explicitly out of scope in the approved spec.

However, the upgrade introduces or leaves in place **three defects that a student can hit in normal use**, and one of them is severe:

1. **A time constraint can silently duplicate a course** (A1). "Keep CHLL1000 but nothing on Friday afternoon" produces a timetable containing *two sections of CHLL1000*, reported as a clean success at 3 credits. 73 real courses are reachable this way. This is the most serious new defect: it is a wrong timetable presented as correct, which is exactly the class of failure the original audit was written to eliminate.
2. **Tool failures still render as successes in the chat** (A2). CopilotKit delivers a thrown backend tool error as the tool message *content* `"Error: …"` with **no `error` field**, and the new panel reads only `result.error`. The 12-call limit message — written specifically to fix "empty responses" — is therefore never displayed; the trace reads "Drafted a proposal" in muted grey.
3. **"How many credits is my timetable?" is answered as a red failure** (A3). The spec requires the credit report to be returned when section keys are unchanged. The implementation returns `{proposal: null, reason: "Nothing to change."}` instead, which the panel paints as `failed`.

None of these three are covered by a test.

**Findings:** 1 critical (A1), 2 high (A2, A3), 4 medium (A4–A7), 5 low (A8–A12), 2 informational.

**Verdict: not merge-ready as-is.** A1 and A2 should be fixed before merge; A3 is a small, contained fix that belongs in the same pass. Everything else is either explicitly out of scope in the approved spec or safe to defer.

---

## 2. What was actually implemented

### 2.1 Data layer

**Course Type is parsed and preserved.** `resolveScheduleColumns` maps `Course Type`; `loadSection` copies it onto `Section.courseType`; the header-completeness check now *requires* the column, so a workbook without it fails loudly instead of silently losing GE. `courseType` is added to every test fixture helper.

Independently verified against the raw workbook rather than the parser's own output:

| Property | Workbook (raw rows) | Catalogue (parsed) | Match |
|---|---|---|---|
| Distinct section keys | 1582 | 1582 | ✅ |
| Sections marked `GE Course` | 123 | 123 | ✅ |
| Courses containing GE sections | 56 | 56 | ✅ |
| Section keys with conflicting Course Type values across meeting rows | 0 | — | ✅ |
| Meetings per section key | exact | exact | ✅ |
| GE keys present in one and not the other | 0 | 0 | ✅ |

Every course code in the workbook appears in the catalogue and vice versa (0 in either direction). No course mixes GE and non-GE sections. No GE-prefixed course is unmarked.

**The credit snapshot is real and correct.** `src/domain/data/credit-snapshot.json` holds 570 records with exactly the four specified fields. Distribution: `3 → 496`, `1 → 30`, `6 → 16`, `2 → 11`, `4 → 6`, `1.5 → 6`, `0 → 3`, `0.5 → 2`. All `retrievedAt` are `2026-11-10`; every `sourceUrl` matches its own course code.

I verified the snapshot **independently against the live source**, not against the refresh script: 570 codes fetched via the ADF two-request loop.

```
569/570 matched the snapshot exactly (credit value and echoed page course code)
1/570 (EDUC3013) failed on the first pass with a transient "fetch failed"; retried → credits 3, matches snapshot
credit-value mismatches: 0        page-code mismatches: 0
```

`demoCredits` is gone from the codebase. `rg demoCredits src/ tests/` matches only an assertion in `tests/proposal-bar.test.ts` that it is absent. The editor, gallery, course search panel, shared page and both timetable pages all read `creditReport` / `formatCredits` / `formatCourseCredits`.

**Five title mismatches** (workbook vs official page) exist and are cosmetic only: `CPED1001`/`CPED1002` (workbook lists per-activity variants such as "Physical Education I - Kinball"; official page gives the generic title), `EDUC2027` and `GPAD3010` (HTML entity `&#8217;` in the official page), `EDUC3000` (a genuine title difference). None affect credits or planning.

### 2.2 Planner

`planRequest` remains pure. The request gained `geCount`, `creditTarget`, `chooseCourses`, `candidates`. `PlanDraft` gained `credits` and `storePreview`. Selection is now:

1. Baseline legality gate on the starting keys (refuses rather than building on an illegal timetable).
2. `keep`/`drop` with unknown keys becoming unmet wishes.
3. Topics resolved through BM25 + `hitMatchesTopicIdentity`, **plus** an exact-course-code fast path that loads *every* section of that course, bypassing the 10-hit cap.
4. Per-topic refusal reasons are now distinct: `No sections found for X` / `No course identity for X` / `No timed section for X` / `No legal section for X. <rule sentence>` / `X overlaps a time to avoid`.
5. GE fill from `courseType === "GE Course"` only, then recommended candidates when `chooseCourses`.
6. Subset selection over up to 12 recommendations in half-credit units, honouring `creditTarget` without exceedance, tie-broken by smaller subset then earlier candidate index.
7. Credit report with `verifiedTotal`, `unknownCourseCodes`, `status`, `target`, `gap`.

**Verified good in the planner** (keep these):

- Partial plans: `topics: ["GELH1012","GESB1013","CSCI1004","MATH1001","NOPE9999"]` → 4 sections placed, one unmet wish, preview stored.
- Exact-course-code cap bypass: `TELC1012` (86 sections) plans correctly; exhaustive check over all 1,582 section keys confirms each key ranks inside its own top-10 query, and every one resolves.
- GE only from the GE mark: `geCount: 2` yields two `GE Course` courses, never `EELC1008` (teacher "GAO GE").
- Unknown credits block recommendations *and* suppress `gap` (verified with a partial credit book: topic with unknown credit → `status: "incomplete"`, `gap: null`, no candidate added).
- Over-target is stated, not silently trimmed: `Requested courses exceed the target by 6.`
- 0-credit courses: placed when identified as a topic, refused when recommended.
- Completed courses excluded, GE fill does not use completed courses.
- `storePreview` is false when keys equal saved keys.
- Prerequisite-not-enforced warnings reach the summary (`Prerequisite group 1 for PORT1001:001 was not confirmed.`).
- Performance is acceptable for the target case: GE fill to 10 courses is 3–11 ms; subset search with a populated seed is 4–26 ms.

### 2.3 Agent tools, limits, reasoning

`TOOL_NAMES` still has no write tool. The route registers exactly five tools and injects no others of its own. Verified by reading the route: `has write tool? false`.

```
maxCalls: 12   maxMs: 60_000   maxSteps: 12   reasoningEffort: "low"
```

`LimitError`/`ForbiddenToolError` now take and forward messages. `reserveToolCall` throws:

```
"This turn reached its 12-tool-call limit. Ask for a smaller change."
"This turn reached its 60-second limit. Ask for a smaller change."
```

verified by direct call. `plan` checks saved profile → major code → timetable, in that order, with distinct reasons. `baseProposalId` resolves only for an open proposal on the same timetable; anything else seeds `Unknown or closed preview.` and starts from saved keys.

**Reasoning configuration is correct for `@ai-sdk/openai` 3.0.138.** I traced the provider: `getOpenAILanguageModelCapabilities("deepseek-flash")` returns `supportedReasoningEfforts: undefined` and `isReasoningModel: false`, so `reasoning_effort: "low"` is written to the request body unsuppressed and no capability warning is raised. The `none` → `low` change is a real behavioural change, not a no-op. `createDeepSeekFetch` echoes `reasoning_content` keyed by `userId` and by tool-call id (or assistant text), and never writes that text to the response, a log, or a planner argument.

### 2.4 Chat reporting and proposal lifecycle

`src/components/plan-tool-state.ts` adds `toolTitle(name, phase)` with running/done/failed wording for all five tools, and `planToolView(data, errored)` returning `{failed, detail, proposalId, summary}`. The panel passes `running` to `Tool`, deletes the old `result ? null : null` dead ternary, and stops using past-tense titles for in-flight calls. Verified by direct call:

```
validate ok          → {failed:false, detail:null}
plan + credits       → {failed:false, detail:"Verified credits: 3."}
plan refusal         → {failed:true,  detail:"Save your profile before adding a section."}
validate no-sections → {failed:true,  detail:"Add at least one section before checking the rules."}
toolTitle("searchSections","running") → "Searching the catalogue"
```

Proposal lifecycle is unchanged and still sound: preview writes only to `proposals`; `decideConfirm` rejects a stale `baseRevision`, revalidates, and is the only path that writes section keys. Confirmed end-to-end that a plan does not touch `timetable.sectionKeys` and that Apply is required to commit.

`validateSections([])` now returns `{ok:false, failures:[{rule:"no-sections"}]}`. Two callers deliberately treat an empty key list as "clear the timetable" rather than a rule failure — `decideConfirm` filters `no-sections` when the proposal itself is empty, and `applyProposalDecision` substitutes a passing report for empty keys. Verified that an AI proposal clearing a timetable applies successfully (`sectionKeys: []`, revision +1).

---

## 3. Specification deviations and defects, by severity

### 🔴 A1 — A time constraint can silently duplicate a course and misreport its credits

**Severity:** Critical. Produces a nonsensical timetable reported as a clean success.

`chosenSatisfies` only treats an existing section as satisfying a topic when it is *also* outside every `avoid` window:

```259:266:src/domain/planner.ts
    return keys.some((key) => {
      const section = byKey.get(key);
      if (!section) return false;
      const matches = hitMatchesTopicIdentity(
        { courseCode: section.courseCode, sectionKey: key, teacher: section.teacher },
        topicTokenSet,
      );
      return matches && !sectionOverlapsAvoidRanges(key, catalogue, avoid);
    });
```

When the existing section *is* inside the window, the topic falls through to normal placement, which happily picks a **different section of the same course**. The planner never checks "is this course already chosen" at topic-placement time — only `geAlready` and the candidate path check that.

Reproduced against the real catalogue:

```
saved: CHLL1000:001  (TUE 16:00-17:15, FRI 16:00-17:15)
request: topics ["CHLL1000"], avoid [FRI 12:00-18:00]
result keys: [CHLL1000:001, CHLL1000:002]
dropped wishes: []
credits: { verifiedTotal: 3, status: "verified", gap: null }
summary: "added CHLL1000:002. Verified credits: 3."
```

A two-section, one-course timetable is presented as a legitimate addition worth 3 credits. `validateSections` does not treat two sections of one course as a conflict, so nothing downstream catches it:

```
validateSections(["CHLL1000:001","CHLL1000:002"]) → {"ok":true,"failures":[],"warnings":[]}
decideManualAdd(same pair)                        → ok, applies
```

Two independent problems compound here:

1. **The planner should emit an unmet wish** (`CHLL1000:001 is in a time you want to avoid`) or drop-and-replace, not append a second section.
2. **`validateSections` has no one-section-per-course rule at all.** That gap predates this upgrade (it is equally reachable by hand from the search panel), so the upgrade did not create it — but the upgrade is the first code path that *generates* the situation automatically.

**Reachability:** 73 of the 570 courses have two or more sections that can legally coexist, so the state space is large. The exact argument set required is `topics` naming an already-saved course whose saved section overlaps `avoid`. That is a natural interpretation of "keep X but nothing after 3pm" and the prompt does not steer the model away from it. **Confirmed** as a deterministic planner defect; **hypothesis** that a live model frequently emits that exact combination.

---

### 🟠 A2 — Backend tool errors still render as successes in the chat

**Severity:** High. This is the original audit's S6, only partly fixed, and it defeats the S5 fix.

The panel derives failure from the tool message's `error` field:

```176:181:src/components/copilot-panel.tsx
                  const running = !result;
                  const errored = Boolean(result?.error);
                  const view = planToolView(errored ? result?.error : textOf(result?.content), errored);
                  const phase = running ? "running" : view.failed ? "failed" : "done";
                  const title = toolTitle(call.function.name, phase);
```

But a tool that **throws on the backend** is not delivered with an `error` field. CopilotKit converts the AI-SDK `tool-error` stream part into a normal `TOOL_CALL_RESULT` whose *content* is `Error: <message>`:

```
node_modules/@copilotkit/runtime/dist/agent/converters/aisdk.mjs:286-292
yield { type: EventType.TOOL_CALL_RESULT, role: "tool", messageId: randomUUID(),
        toolCallId, content: `Error: ${formatToolError(p.error)}` };
```

and the client-side reducer that turns that event into a message copies only `id`, `role`, `toolCallId`, `content` — no `error`:

```
node_modules/@copilotkit/core/dist/index.mjs:5223-5229
const result = { id: event.messageId, role: "tool", toolCallId: event.toolCallId,
                 content: event.content };
```

(`error` is only ever set on the *frontend tool handler* path, `index.mjs:4795` and `4888`, which this app does not use — all five tools execute server-side.)

Consequences, verified by calling the pure helper:

```
planToolView("Error: This turn reached its 12-tool-call limit. Ask for a smaller change.", false)
  → { failed: false, detail: null, proposalId: null, summary: null }
  → panel renders title "Drafted a proposal", muted grey, no detail text
```

So when the turn hits the 12-call or 60-second limit, the student sees a **successful** "Drafted a proposal" with the reason discarded. `planToolView` already handles `errored === true` correctly; the flag is simply never set for this class of failure. `planToolView` also never inspects content for an `Error:` prefix.

Note the fix is small: detect a leading `Error:` (or pass `errored = running === false && typeof content === "string" && content.startsWith("Error:")`). There is no test for this path — `tests/copilot-panel-state.test.ts` only exercises `errored: true` and valid payloads.

---

### 🟠 A3 — A credit question with no change requested is returned as a failure

**Severity:** High for the feature's stated purpose; trivial to fix.

The spec is explicit:

> *"When the keys are unchanged, it stores nothing and still returns the credit report and any unmet wishes. The chat shows that report whenever `plan` returns one. A precondition failure or an already illegal starting timetable returns no preview and no credit report, only the reason."*

The implementation adds a fourth outcome the spec does not contain:

```460:463:src/domain/planner.ts
  if (setsEqual(keys, currentKeys) && droppedWishes.length === 0 && creditTarget === null) {
    return { proposal: null, reason: "Nothing to change." };
  }
```

Verified through the real tool with the real store on a 7-credit timetable:

```
tools.plan({ request: {} })
→ {"proposalId":null,"reason":"Nothing to change."}
→ panel view: {"failed":true,"detail":"Nothing to change.", ...}
→ title: "Could not draft a proposal" (rose)
```

The model is instructed to *"State only the credit total returned by plan"*. When the student asks "how many credits am I taking?", the only legal request is one that changes nothing — and that request is a refusal with no credit data. The `creditTarget: null` guard means a student who says "am I on track for 18?" is fine (a report is returned with `gap`), but the plain credit question fails. This also breaks the spec's promise that a report is shown "whenever `plan` returns one".

Two smaller consequences of the same branch: the "Nothing to change." refusal is indistinguishable in the UI from a precondition failure, and it makes the panel's failure colour the default outcome of a no-op turn.

---

### 🟡 A4 — `geCount` counts GE *sections*, not GE *courses*

**Severity:** Medium. Contract deviation with a small blast radius.

The spec defines `geCount` as *"How many GE courses the finished set should contain"*, and the tool schema repeats *"How many GE courses"*. The implementation counts sections:

```365:367:src/domain/planner.ts
  const geAlready = () =>
    keys.filter((key) => byKey.get(key)?.courseType === "GE Course").length;
```

Verified: a timetable holding `GELH1000:001` and `GELH1000:002` (one course, two sections) satisfies `geCount: 2` and the planner reports "Nothing to change" instead of adding a second GE course. With `geCount: 2` and a 12-credit target, it placed `GELH1000:001`, `GELH1000:002` + 3 non-GE courses and reported `gap: 0` — i.e. **the student was told they had two GE courses when they had one**.

In practice this is only reachable when the timetable already contains a duplicate section (A1, or a manual add from the search panel), so A1 is the root cause. Fixing A1 removes most of the reachability; the counting rule should still be `courseCodesOf(keys).filter(isGeCourse)` to match the contract.

---

### 🟡 A5 — The 101 KB credit snapshot ships in the browser bundle

**Severity:** Medium. Not a correctness bug; a packaging and privacy-hygiene defect.

`src/domain/credits.ts` imports `credit-snapshot.json` at module scope. `credits.ts` is imported by `course-group.ts`, `editor.tsx` (`"use client"`) and `shared-schedule.tsx` (`"use client"`). The snapshot is therefore bundled to the client. Confirmed in the production output:

```
.next/static/chunks/0uowco9-90_f3.js   91,412 bytes
  contains "GELH1012": true
  occurrences of "courseDetailUG": 570
```

All 570 course codes and their 570 external source URLs are shipped to every visitor, including on the public read-only `/s/[token]` page, which needs only the credits *of the sections actually shown*. Two costs: ~90 KB of unused JSON on an interactive route, and an unnecessary disclosure of the catalogue's external URL space.

The clean shape is to compute the credit *label* server-side (as `src/app/timetables/page.tsx` and `[id]/page.tsx` already do) and pass the label string down — which is exactly what `Editor`'s new `creditLabel` prop does, except see A6.

---

### 🟡 A6 — `Editor`'s new `creditLabel` prop is accepted and ignored

**Severity:** Medium (dead code + duplicated logic, and it defeats the A5 fix).

```196:199:src/components/editor.tsx
export function Editor({
  timetable,
  sections,
  creditLabel: _creditLabel,
  ...
```

`_creditLabel` is referenced exactly once in the file (its own destructuring). The live label is recomputed on the client:

```537:542:src/components/editor.tsx
  const liveCreditLabel = formatCredits(
    creditReport(live.sectionKeys.map(courseCodeOf), loadCreditBook()),
  );
  const proposalCreditLabel = selected
    ? formatCredits(creditReport(selected.sectionKeys.map(courseCodeOf), loadCreditBook()))
    : null;
```

The server computes a label, passes it, and the client ignores it and recomputes from the full snapshot. For the *live* label the recomputation is necessary (the panel supports optimistic edits), but for the initial render it is duplicate work and the reason the snapshot cannot be removed from the client bundle. Either use the prop for first paint and recompute only after local mutation, or drop the prop and accept A5. Leaving both is the worst of the two.

---

### 🟡 A7 — The planner rebuilds the full section index on every avoid check

**Severity:** Medium (performance headroom, not a failure).

`sectionOverlapsAvoidRanges` calls `sectionsByKey(catalogue)` — an O(1,582) map build — **per call**, and it is called once per topic hit, once per GE candidate, once per `lowestLegalSection` iteration and once per subset in `chooseSubset`. Measured:

```
4096 × full section-map rebuild  → 575 ms
plan: 12 candidates, creditTarget 36, empty seed  → 585 ms
plan: 12 candidates, creditTarget 40, 6 seeded    →  23 ms
plan: 12 candidates, no target                    →   4 ms
```

So the worst realistic request burns ~0.6 s of CPU inside a 60-second budget that also has to cover up to 12 DeepSeek round-trips. It is not currently a failure, but it is the only super-linear cost in the planner and it is trivially removable (`byKey` is already built at the top of `planRequest` and could be threaded through, or the helper memoised on the catalogue).

---

### 🟢 A8 — `formatCreditNumber` is a no-op, and "1 credits" is ungrammatical

```71:73:src/domain/credits.ts
export function formatCreditNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
```

Both branches are identical; the function exists only to be called. Verified outputs: `1 credits`, `0 credits`, `0.5 credits`, `0 credits verified, ZZZZ9999 unknown`. The plan document specified exactly this (so this is a faithfully-implemented spec flaw, not an implementation divergence), but the label still reads wrong on the many 1-credit courses (`GESB1001`, `LAWS1001`, all 30 of them) and on every empty timetable in the gallery.

### 🟢 A9 — `npm test` still collects the retrieval-study worktree

Confirmed unchanged from the original S9: `npm test` → 7 failed files / 19 failed tests, all under `.worktrees/course-retrieval-study/tests/`; `npx vitest run --exclude '**/.worktrees/**'` → 52 files, 257 passed. `vitest.config.ts` still has no `exclude`, `tsconfig.json` still has no `exclude` for `.worktrees`. The approved plan explicitly told implementers to work around this rather than fix it, so this is a known, accepted deviation — but it means "are the tests green?" still cannot be answered from the project's own `test` script.

### 🟢 A10 — `POST /api/proposals` cannot express the new request

`readPlan` still parses only `topics`/`keep`/`drop`/`avoid`, so `geCount`, `creditTarget`, `chooseCourses` and `candidates` are dropped on that path. The route is uncalled by the client and the spec explicitly scopes it out ("keep compiling", "do not invent a client"), and it does compile and honour `storePreview`. Noted only because it is now a *silently lossy* dual contract rather than a merely unused one.

### 🟢 A11 — Planner-level input validation is absent for negative and inverted values

`planRequest` accepts `creditTarget: -5` (returns a report with `target: -5`, no preview), a negative `geCount` (falls into the `Nothing to change` refusal), and an inverted `avoid` range (`startMinutes > endMinutes`, silently never matches). The agent path is protected by Zod (`creditTarget: z.number().min(0)`, `geCount: z.number().int().min(0)`); the planner itself is not. Low impact while the planner is only reached through the agent, but the "pure function, tested directly" design invites direct use.

### 🟢 A12 — Project documentation still describes the pre-upgrade system

`docs/PROJECT.md:57` says *"maximum 8 tool calls and 30-second deadline"* (now 12 / 60 s) and `:67` says *"186 unit and integration tests across 32 test files"* (now 257 / 52). `docs/AI-USAGE.md` records this honestly: each of the five implementation entries ends *"Human verification: not yet done."* The student-owned verification step the course requires is therefore genuinely outstanding, not merely undocumented.

### ℹ️ I1 — Multiple open proposals accumulate within one turn

Three successful `plan` calls in one agent turn create three `open` proposals, and the manual-add route refuses while *any* proposal is open. Verified: 3 calls → 3 open proposals, manual add blocked. `baseProposalId` gives the model a way to revise in place, and the prompt says to use it, so a well-behaved model will not accumulate. But nothing enforces it, and the previous proposal is never superseded. Pre-existing behaviour, now more reachable.

### ℹ️ I2 — The reasoning-echo map grows without bound

`termPilotDeepSeekReasoning` is a `globalThis` `Map` keyed `${userId}\0tool:<callId>` with no eviction, and `createDeepSeekFetch` clones and fully buffers every SSE response to extract reasoning. For a course project this is fine; it is worth one line in the limitations rather than a fix.

---

## 4. Are the original AI Planner failures resolved?

| # | Original finding | Status | Evidence |
|---|---|---|---|
| S1 | Credits fabricated (`count × 3`) | ✅ **Fixed** | 570-record snapshot; 570/570 verified against the live catalogue; `demoCredits` gone from all surfaces |
| S2 | GE dropped at parse; "GE" matched lecturers | ✅ **Fixed** | `courseType` parsed; 123 sections / 56 courses match the workbook exactly; `geCount` uses only the GE mark |
| S3 | `plan` atomic and lossy | ✅ **Fixed** | 4 good + 1 bogus → 4 sections + 1 unmet wish. Duplicate topics collapsing is now *specified* ("a course already chosen satisfies a repeated topic") |
| S4 | Hits lack meetings/credits/restrictions | ✅ **Fixed** | Hits carry `courseType`, `credits`, `meetings: ["TUE 13:00-14:15"]`, `restriction` |
| S5 | `LimitError` had an empty message | ✅ **Fixed** (message) / ⚠️ **not surfaced** | Messages correct and verified; the UI never shows them (A2) |
| S6 | UI failed-state logic wrong | ⚠️ **Partly fixed** | `planToolView`/`toolTitle` are correct and `running` is wired; backend errors still read as success (A2) |
| S7 | `validate([])` returned `ok:true` | ✅ **Fixed** | `{ok:false, failures:[{rule:"no-sections"}]}` |
| S8 | Multi-count prerequisite groups only warn | ⚠️ **Unchanged by design** | Out of scope; warnings now *do* reach the summary |
| S9 | `npm test` runs the worktree | ❌ **Not fixed** | 19 failures; `--exclude` still required |
| S10 | Two divergent plan entry points | ⚠️ **Worse in one way** | Out of scope; `/api/proposals` now silently drops the new fields (A10) |
| S11 | `maxSteps` / `maxCalls` independent | ⚠️ **Unchanged** | Both 12; still not reconciled |
| S12 | One generic refusal reason | ✅ **Fixed** | Five distinct reasons including the cited rule sentence |
| S13 | 10-hit cap hid legal sections | ✅ **Fixed** | `exactCourseCode` loads every section; `TELC1012` (86) works |
| S14 | `runTurn` test-only | ⚠️ **Unchanged by design** | Out of scope per spec |
| S15 | Budget `start` captured at construction | ⚠️ **Unchanged** | Still correct in practice, still unasserted |

**Net:** 8 of 15 closed, 2 improved-but-incomplete, 5 unchanged (4 of them explicitly scoped out by the approved design). The three critical findings that caused the reported failure are all closed, and the reported user journey now works.

Regression check on the properties the original audit said to preserve:

- **AI cannot write the timetable** — holds. Five tools, no write tool; verified a plan leaves `sectionKeys` untouched and that Apply is required.
- **Stale approval rejected** — holds (`baseRevision` check unchanged).
- **Revalidation at commit** — holds, with a deliberate empty-list exemption.
- **Deterministic rules** — unchanged; `no-sections` added, `week.ts` `conflictKeys` updated to skip it (otherwise a bare `no-sections` failure would have thrown on `failure.sectionKey`).
- **Retrieval quality** — **unchanged**. `documentText` does not gain `courseType`, so BM25 ranking is byte-identical: `Recall@5=0.96696… MRR=1`, matching the locked baseline. All 25 retrieval tests pass.
- **Manual editing** — unchanged paths, and `tests/editor-rail`, `course-search-panel`, `proposal-bar`, `section-mutation-lock` all pass. The one behavioural change is that an *empty* AI proposal can now be applied as "clear the timetable", which is intentional and tested.

---

## 5. Test coverage assessment

The suite grew from 225 to 257 passing tests, and the new tests are genuine behavioural tests for the planner, the credit book, the tool limits, the reasoning echo and the panel state mapping. Two structural gaps matter:

1. **No test drives a tool that throws through `planToolView`.** The one path that matters for A2 is untested. `tests/copilot-panel-state.test.ts` covers `errored: true` (the frontend-tool path, which the app does not use) and well-formed payloads.
2. **No test asserts one-section-per-course or avoid-window-vs-retained-section behaviour.** `A1` and `A4` are both invisible to the current suite. Every credit-target test starts from an empty seed, which is why the seeded-duplicate path was never exercised.

Tests are also still largely source-string assertions in the UI layer (`tests/copilot-panel.test.ts` reads the file and greps for substrings). That style cannot distinguish "the panel passes `running`" from "the panel shows the right thing when the backend throws", which is precisely the A2 failure.

No test is a scripted student conversation, as the plan required. The planner tests are structured requests, which is correct.

---

## 6. Merge readiness

**Not merge-ready as-is.** The upgrade is a real and largely successful remediation, and the deterministic core is in good shape, but one critical defect produces a wrong timetable that the UI calls correct, and one high defect makes every tool failure invisible in the chat. Both are squarely inside the failure class this upgrade exists to remove.

**Required before merge**

1. **A1** — when a topic's course is already on the timetable, treat the course as chosen and emit an unmet wish if the existing section is inside an `avoid` window, instead of placing a second section. In the same change, decide whether `validateSections` should reject two sections of one course (it should — that also closes the manual path).
2. **A2** — detect the `Error: ` content prefix (or set `errored` from it) so a thrown backend tool failure renders as failed with its message. Add the missing test.

**Strongly recommended in the same pass**

3. **A3** — return the credit report for an unchanged-keys request instead of `Nothing to change.`, per the spec; keep the refusal only for a genuinely empty request.
4. **A4** — count GE by distinct course code.
5. **A5/A6** — pick one: use `creditLabel` and stop importing the snapshot from client components, or delete the prop.

**Safe to defer**

A7 (perf), A8 (plural), A9 (worktree exclusion), A10–A12 (dead route, planner-level validation, stale docs), I1–I2.

**Verification this report could not perform**

- No live model run. `DEEPSEEK_API_KEY` is not present in this environment and `.env.local` is not readable by this audit. The three "is the prompt good enough to make the model emit the right request" questions (does it actually pass `geCount` rather than searching for "GE"; does it pass `avoid` without dropping the overlapping course, i.e. how often A1 fires; does it use `baseProposalId` to revise rather than accumulate proposals) remain **hypotheses**, not findings. A2 and A3 were verified at the message and helper level, not against a live stream.
- No browser session. The panel's rendering of A2 and A3 is derived by reading CopilotKit's message construction and calling the pure helpers, not by observing the screen.

---

## 7. Audit hygiene

- No source, test, dataset, or user data was modified. No commits were created. `git status` before and after shows the same 38 modified and 8 untracked entries.
- All probe scripts ran from `/tmp/tp-audit` and `/tmp/tp2` and were deleted. No scratch directory was created inside the repository (`.audit-scratch` was created and immediately removed during reconnaissance; it was never tracked or ignored).
- **One disclosed side effect:** `npx next build` was run to confirm the routes compile and to inspect the client bundle for A5. That command regenerated `.next/` (gitignored) and **reverted a pre-existing working-tree modification to `next-env.d.ts` back to its committed content.** That file was already modified when this audit began (the 2026-11-10 audit noted the same file as pre-existing dirt and left it alone). It is now byte-identical to `HEAD`. This audit did not preserve the earlier modification and should not have run a command with that side effect; the discrepancy is disclosed here rather than silently repaired.
- `npx eslint .` was attempted and reports 627 errors and 553 warnings (1180 problems). The project's `eslint.config.mjs` ignores only `.next`, `out`, `build`, `next-env.d.ts`, `.superpowers` and `docs/ref` — it does not ignore `.worktrees/`. **Confirmed by per-directory tally of the ESLint JSON output: all 1180 problems originate in `.worktrees` (627 + 553 = 1180 exactly), and none from `.agents`.** `npx eslint src tests scripts` (the application and its tests) exits 0 with no diagnostics. The scoped clean result is what this report relies on.
- No live network request carried any student data. The credit verification contacted only `courseDetailUG?courseCode=CODE` with no cookies, no profile, and no timetable, mirroring what `credits:refresh` is designed to do.
