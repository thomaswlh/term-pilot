# TermPilot AI — Left-Side AI Planner: Independent End-to-End Audit

| | |
|---|---|
| **Audited** | `main` @ `2861c9f` (working tree; `next-env.d.ts` was already modified and is untouched by this audit) |
| **Audit date** | 2026-11-10 |
| **Scope** | AI Planner chat column: agent route, tool contracts, planner engine, rules engine, retrieval integration, budget/limits, UI progress states |
| **Type** | Audit only. No source, test, or data files were modified. |
| **Scenarios** | Student request: 18 credits, two GE courses, no classes before 08:00 |

**Not audited as current work:** `.worktrees/course-retrieval-study` (the retrieval-study branch). It is a separate worktree whose tests are picked up by a bare `npm test` from the repo root — see S9.

**Method:** Rather than reasoning from the transcript, every finding below was reproduced against the real 1,582-section catalogue (`loadCatalogue()`) with the production planner, rules and search modules. 23 probe scripts were run from a gitignored scratch directory and deleted afterwards; `git status` confirms no source change.

---

## Executive summary

The planner's **retrieval, rules and confirmation machinery is sound**. The failure is not in those. It is that **the product has no representation of the two things the student actually asked for** — a credit target and a GE requirement — and that the one tool that builds a proposal is **all-or-nothing and silently lossy**.

Three defects compound to produce exactly the observed transcript:

1. **Credits are fabricated.** `demoCredits()` returns `distinct course count × 3`. No credit data exists anywhere in the pipeline, and the catalogue workbook has no credit column. "18 credits" cannot be planned, checked, or displayed truthfully.
2. **GE is not a classifiable attribute.** `Course Type` is dropped by the parser. "GE" resolves through BM25 to two lecturers surnamed **GE** (`GAO GE`, `GE WEI`).
3. **`plan` is atomic and lossy.** One unresolvable topic fails the entire request; duplicate generic topics collapse to one course; title-only matches search fine but plan refuses them.

These are then amplified by budget and error-reporting bugs that turn a rejection into silence.

**Findings:** 3 critical (S1–S3), 4 high (S4–S7), 4 medium (S8–S11), 4 low (S12–S15).

**Verified good — preserve:** state isolation (an AI plan cannot write sections), the confirm/revalidate/stale-approval path, deterministic overlap/prereq/class-for rules, and the BM25 retrieval quality work.

---

## 1. Trace: user request → response

```
"18 credits, two GE courses, nothing before 8am"
        │
        ▼  agent reads INSTRUCTIONS + 5 tool schemas
    ┌───────────────────────────────────────────────────────────┐
    │ readProfile / readTimetable   → correct, 1 budget call ea. │
    │ searchSections("GE")          → 5 hits, all lecturers     │
    │                                   named GE  (S2)          │
    │ searchSections("general edu") → 10 hits, none are GE      │
    │ plan{topics:["GE","GE"],...}  → ONE section, not two (S3) │
    │ plan{topics:[...,"NOPE"]}     → whole request refused (S3)│
    │ plan{credit target}           → impossible: no such field │
    │                                   (S1)                    │
    │ validate([])                  → {"ok":true} (S7, low)     │
    └───────────────────────────────────────────────────────────┘
        │
        ▼  budget: 2 reads + 6 searches = 8 calls = maxCalls
   next tool call → LimitError with message "" → model sees "Error: " (S5)
```

Every step above was executed. The result of the reproduction in §2.5 is the exact shape of the reported failure: eight successful searches, then a silent error, then no proposal.

---

## 2. Findings

### 🔴 S1 — Credit requirements are structurally unrepresentable; displayed credits are invented

**Severity:** Critical — the headline requirement ("18 credits") cannot be satisfied or verified by any code path, and the UI reports a number that is not derived from data.

**Evidence (confirmed):**

`src/domain/credits.ts:20-22`
```20:22:src/domain/credits.ts
export function demoCredits(courseCodes: string[]): { total: number; label: "Demo credits" } {
  return { total: new Set(courseCodes).size * 3, label: "Demo credits" };
}
```

This is a hardcoded `× 3`. Consequences, verified:

- `Section.unit` is **not** credits. It is the **offering-faculty code**. Parsed distribution over the real catalogue: `FAH 421, FED 321, FBA 182, FSS 170, FLL 153, RC 143, …`. `GELH1012.unit === "FAH"`.
- The source workbook has **no credit column at all**. Header row 5 is: `Offering Unit, Offering Department, Course Code, Course Title, Section, Course Type, Medium of Instruction, Notes for Course Enrolment, Teacher Information, Lecture / Lab, Lab Information, Day, Time From, Time To, Classroom, "Class For / Class Not For" Information`. A regex for `credit|unit|point` finds only `Offering Unit`.
- `PlanRequest` is `{ topics, keep, drop, avoid }` only. There is **no credit field**, no min/max, no target. `planRequest` performs no arithmetic on course count.
- `validateSections` has no credit rule.

**Impact:** a plan for 18 credits is unfalsifiable. A 5-course and a 6-course timetable both "succeed". Worse, the editor renders the fabricated number as a real one ("Demo credits", `demoCredits(...)` at `src/components/editor.tsx:535`, `src/app/timetables/[id]/page.tsx:28`, `gallery.tsx:36`, `shared-schedule.tsx:14`), so a student can believe a 15-credit timetable is 18.

**Note:** the "Demo" label is an honest mitigation, but it is on the *label*, not the *number* — and the AI Planner never surfaces it, so nothing in the chat tells the student credits were not honoured.

---

### 🔴 S2 — GE classification is discarded at parse time; "GE" matches lecturers

**Severity:** Critical — "two GE courses" is the second headline requirement and resolves to a false-positive.

**Evidence (confirmed):**

The workbook marks GE explicitly. Row 5 column 5 is `Course Type`, and rows carry `"GE Course"`. The parser's `ScheduleColumns` (`src/domain/catalogue.ts:119-132`) **does not map `Course Type` at all**, and `Section` (`src/domain/types.ts:9-20`) has no field for it. Distribution in the workbook: `GE Course: 244 rows`, `"": 2303 rows`.

`SearchHit` is `{ sectionKey, courseCode, section, title, teacher }` — no course type reaches the model.

Reproduced against the real catalogue:

```
searchSections("GE") → 5 hits
  EELC1013:021  teacher="GAO GE"    University English III
  EELC1013:027  teacher="GAO GE"    University English III
  EELC1008:003  teacher="GAO GE"    Grammar and Writing Improvement I
  EELC1008:004  teacher="GAO GE"    Grammar and Writing Improvement I
  BMSC4002:001  teacher="GE WEI / ..."  Stem Cell Biology ...
```

`planRequest(topics:["GE","GE"])` returns:
```
{"proposal":{"sectionKeys":["EELC1008:003"],"droppedWishes":[],
 "summary":"added EELC1008:003."}}
```

A student asking for two GE courses is handed one ELC grammar course whose instructor happens to be surnamed Ge — and the summary reads as a clean success.

**Mitigating fact:** `"general education"` does **not** resolve to GE courses either (`plan → null, "No sections found for general education."`), and no title in the catalogue contains "general education". There is therefore **no wording** by which the model can express a GE wish that the planner satisfies correctly. The `hitMatchesTopicIdentity` fix (`src/domain/planner.ts:31-40`) correctly stopped *title* matches from satisfying a topic — but because GE has no identity signal, it left GE wishes with no satisfiable path at all.

**Impact:** the GE half of the request is either silently wrong (S2 above) or hard-fails (S3). Both were observed.

---

### 🔴 S3 — `plan` is all-or-nothing, duplicate-insensitive, and lossy

**Severity:** Critical — this is the direct cause of "failed to generate a usable proposal".

**Evidence (confirmed), all against the real catalogue:**

| Input | Result |
|---|---|
| `topics: ["GELH1012","GESB1013","CSCI1004","MATH1001","GEST1004"]` | ✅ 5 sections |
| Same 5 **plus** `"NOPE9999"` | ❌ `proposal: null, "No sections found for NOPE9999."` |
| Same 5 **plus** `"MATH1002"` (a real-looking code absent from the catalogue) | ❌ whole request refused |
| `topics: ["GE","GE"]` | ⚠️ 1 section, `droppedWishes: []` |
| `topics: ["GELH1012","GELH1012"]` | ⚠️ 1 section |
| `searchSections("statistics")` → 10 hits; `plan(topics:["statistics"])` | ❌ `"No sections found for statistics."` |

Two distinct failure modes:

1. **Atomic abort** (`src/domain/planner.ts:159-162`, `193-196`): the *first* unresolvable topic returns `{ proposal: null }` and discards every valid wish already accumulated. For an 18-credit request the model will naturally emit 6 topics; **any** one bad topic destroys the whole plan, and the user sees "Could not draft a proposal". The `droppedWishes` mechanism exists precisely to degrade gracefully, but it is only reached on a *temporal* conflict (line 197), never on a *resolution* failure.
2. **Silent duplicate collapse:** identical topics are not deduplicated with a warning; the second `"GE"` simply re-satisfies against a key already in `keys` (line 178-182 sets `topicSatisfied` and breaks). Two wishes produce one course and `droppedWishes` stays empty, so the loss is invisible.

**Contract inconsistency (verified):** `searchSections`' description is *"Search the semester catalogue by course code, course title, or instructor name"* (`route.ts:93`). Title search genuinely works — `searchSections("art appreciation")` returns 6 hits. But `plan` rejects every title-only topic (`hitMatchesTopicIdentity`, `planner.ts:31-40`). The model is told it can search by title, sees hits, then has those same topics rejected by `plan` with "No sections found". **This is a direct, reproducible false-negative that would drive a retry loop** and is the most likely mechanism behind the observed "repeatedly searched the catalogue" behaviour.

---

### 🟠 S4 — `searchSections` returns no meeting times, credits, or restrictions, so the model cannot reason about the 8am constraint

**Severity:** High — the third requirement is unplannable and the model cannot self-check.

`SearchHit` (`src/domain/search.ts:10-16`) is `{ sectionKey, courseCode, section, title, teacher }`. Verified JSON the model receives:

```json
{"sectionKey":"GELH1012:001","courseCode":"GELH1012","section":"001",
 "title":"Art Appreciation: A Close Reading of Masterpieces","teacher":"NG SAU WAH"}
```

No `meetings`, no `unit`, no `restriction`. Meanwhile the **right-hand panel** receives full sections from `/api/search` (`route.ts:46` returns `unit`). So the AI Planner is strictly less informed than the manual UI it sits beside.

Consequences:
- The model cannot see that a section is 08:00 or 08:30 to honour "no classes before 8am", and cannot report a time conflict to the student.
- The model cannot see `restriction`, so it cannot explain why a section was rejected for the student's major.
- `avoid` is the only channel for the 8am wish, and it is **advisory inside `plan` only**: `sectionOverlapsAvoidRanges` causes a topic to be marked as a dropped wish, but `validate` ignores `avoid` entirely, and `plan`'s own output can still *keep* an existing overlapping section (line 178-181 checks `!overlapsAvoid` before satisfying, so this specific path is guarded). The constraint is real but invisible and unexplainable.

**On "before 8am" specifically:** the catalogue's earliest meeting is **08:30**, and there are **zero** sections starting before 08:00 (start-hour histogram: `08:00 → 181`, `09:00 → 50`, `10:00 → 401`, …). The student's constraint is therefore **always trivially satisfiable** — but no tool or message ever says so, and the model has no data to confirm it, so it will keep re-planning against a constraint it cannot verify.

---

### 🟠 S5 — Budget exhaustion produces an empty error string; the model and the UI both lose the reason

**Severity:** High — converts a bounded, explainable limit into a silent dead end.

`src/agent/turn.ts:12-18`
```12:18:src/agent/turn.ts
export class LimitError extends Error {
  readonly name = "LimitError";
}

export class ForbiddenToolError extends Error {
  readonly name = "ForbiddenToolError";
}
```

No `message` is passed to `super()`. Verified: `new LimitError().message === ""`.

CopilotKit serializes a tool failure as `` `Error: ${formatToolError(part.error)}` ``, and `formatToolError` returns `error.message` for an `Error` instance (`@copilotkit/runtime/dist/agent/converters/aisdk.mjs:28-31`). So the model receives literally:

```
Error: 
```

**Reproduced end-to-end** with the real tools and `maxCalls: 8`:

```
call 1 readProfile: ok
call 2 readTimetable: ok
call 3..8 searchSections: ok          ← budget.calls = 8/8
call 9 plan: THREW LimitError message=""
   model sees tool result content: "Error: "
proposals created: 0
```

This is the exact shape of the reported conversation: several successful catalogue searches, then nothing. A two-requirement, six-course request needs at least `2 reads + 6 searches + 1 plan = 9` calls, so **the request cannot fit the budget by construction** — and when it overruns, the model is told nothing and will retry searches, burning the window.

**Additional:** the 30 s deadline (`maxMs: 30_000`) is checked but the *model latency* for 8 sequential DeepSeek tool round-trips is easily 20–40 s. `PlanDraft` compute is not the cost (`plan` for 5 topics: **45 ms cold, 21 ms warm**; catalogue cold load: **168 ms**). The deadline therefore mostly measures network latency, and when it trips it throws the same empty-message `LimitError`.

---

### 🟠 S6 — The model's own output path cannot distinguish "refused" from "succeeded" reliably, and the UI's failed-state logic is wrong

**Severity:** High — the planner's UI reports outcomes that did not happen.

`src/components/copilot-panel.tsx:203-211`:
```203:211:src/components/copilot-panel.tsx
const failed = Boolean(result?.error) || proposal?.proposalId === null;
const detail =
  proposal && proposal.proposalId === null
    ? proposal.reason
    : result
      ? null
      : null;
```

Verified problems:

1. `const detail = … : result ? null : null;` — both branches are `null`. The ternary is dead code: **`detail` can only ever be a `proposal.reason`, never a tool error.** Any non-`plan` tool failure shows no reason at all.
2. `proposalFrom()` only recognizes `plan` results. `validate` returning `{"ok":false,"failures":[{"rule":"prerequisite",…}]}` (verified real shape: `{"ok":true,"failures":[],"warnings":[]}`) is **never surfaced** — a failed validation renders as a successful "Checked the rules".
3. The `Tool` title is only overridden for `plan`: `failed && call.function.name === "plan" ? "Could not draft a proposal" : title`. A failed `validate` or `searchSections` keeps its success wording ("Checked the rules", "Searched the catalogue") while rendering in error colour.
4. `TOOL_TITLES.searchSections = "Searched the catalogue"` is past tense **before** the result exists — the trace claims completion for in-flight calls. `Tool` accepts `running` but the panel never passes it.

**Impact:** the transcript's "empty planning/validation responses" are partly a *rendering* defect: a `validate` that returned `ok:true` with zero failures is indistinguishable in the UI from one that returned nothing, and a `plan` refusal with a reason is only shown because of the special-cased `plan` branch.

---

### 🟠 S7 — `validate` accepts an empty key list and reports `ok: true`

**Severity:** High — a vacuous pass is a false statement about a timetable.

Verified: `validateSections([], profile, catalogue)` → `{"ok":true,"failures":[],"warnings":[]}`.

`validateSections` (`src/domain/rules.ts:182-251`) iterates keys and pushes failures only for keys that exist. An empty array has no failures, so `ok` is `true`. The tool's description is *"Check section keys against the hard scheduling rules"* — with no keys, it returns success.

This directly matters to the failure story: if the model calls `validate` with a key list it built from an empty/bad search, it receives `ok: true` and concludes the plan is legal. Combined with S3 (plan returned nothing, so the model may fall back to validating `[]`), this reproduces "validation responses appear empty" as **a passing validation of nothing**.

---

### 🟡 S8 — Constraint coverage gaps: multi-row prerequisites are warned, not enforced

**Severity:** Medium — the "hard constraints" invariant in `docs/PROJECT.md` is weaker than documented.

`src/domain/rules.ts:146-165`: when a prerequisite group has more than one distinct `requiredCount`, the rule emits `prerequisite-not-enforced` and `continue`s — no enforcement.

Verified against the real prerequisites workbook (729 rows): `requiredCount` distribution is `1: 581, 2: 73, 3: 21, 4: 12, … 25: 2`. The multi-count rows are **real data**, not parse noise — e.g. `ACCT3005` group 2 legitimately lists required-count `1..N` variants:

```
r57: ACCT3005 ... count=1 group=2 ACCT1000
r61: ACCT3005 ... count=2 group=2 ACCT1000
r65: ACCT3005 ... count=3 group=2 ACCT1000
```

**17 courses** (verified by running `validateSections` per section and collecting warnings) have prerequisites that are **not enforced at all**, announced only as a warning that the chat never displays (see S6).

Also medium: **27 courses are entirely untimed** (all 350 untimed sections across 28 courses; 27 courses have no timed section at all). For those, `plan` can never select them — `validateSections` returns `untimed` — but `searchSections` still returns them, and the model has no way to tell a satisfiable hit from an unsatisfiable one (S4).

---

### 🟡 S9 — A bare `npm test` from the repo root runs the retrieval-study worktree and reports 16 failures

**Severity:** Medium — misleads anyone assessing planner health, and contradicts `docs/PROJECT.md`'s "186 tests passing" claim.

Verified:

```
npm test                                    → Test Files 4 failed | 90 passed (96)
                                              Tests 16 failed | 432 passed (450)
npx vitest run --exclude '**/.worktrees/**' → Test Files 47 passed | 1 skipped (48)
                                              Tests 224 passed | 1 skipped (225)
```

The failing files are `.worktrees/course-retrieval-study/tests/course-search-panel.test.tsx`, `gallery.test.tsx`, `proposal-list.test.tsx`, `profile-form.test.tsx` — duplicated copies inside the worktree, resolved against `.worktrees/…/node_modules`. `vitest.config.ts` sets no `exclude` and `tsconfig.json` has no `exclude` for `.worktrees`. `docs/PROJECT.md` says 186 tests/32 files; reality is 225/48. The planner-relevant suites (`agent`, `planner`, `rules`) pass: **102/102**.

**Impact:** "is the planner broken?" cannot be answered from `npm test` as committed. Not a runtime defect, but it is why regressions here are hard to spot.

---

### 🟡 S10 — Two parallel planning entry points with divergent validation

**Severity:** Medium — architectural: one contract, two implementations that already differ.

- `POST /api/proposals` (`src/app/api/proposals/route.ts`) calls `planRequest` directly with hand-rolled body validation (`readPlan`).
- The CopilotKit route builds `createTools(...).plan` (`src/agent/turn.ts:103-150`), which calls `planRequest` *plus* profile/budget/timetable guards.

They already diverge: `/api/proposals` requires `profile.saved && profile.majorCode !== null` and returns 403; the agent's `plan` only checks `profile.saved` (`turn.ts:106`), then passes `profile.majorCode ?? ""` — so an empty major code flows into `evaluateClassRestrictions` and any `CLASS FOR` section fails with a confusing reason rather than a profile error.

`/api/proposals` has **no client caller** — `rg '/api/proposals'` in `src/` matches only `editor.tsx:723`, which is `/api/proposals/${proposalId}` (the POST-to-`[id]` decision route). The bulk `POST /api/proposals` endpoint is dead code with its own semantics.

---

### 🟡 S11 — `maxSteps` and `maxCalls` are independently configured and can disagree

**Severity:** Medium — two limits for one resource, silently.

`route.ts:128` sets `maxSteps: 8` (AI SDK `stepCountIs`) and `route.ts:80` sets `maxCalls: 8`. But a *step* is a model turn that may contain multiple tool calls, and `reserveToolCall` counts each call. Because `BuiltInAgent` also injects two state tools (`AGUISendStateSnapshot`, `AGUISendStateDelta`) and may inject A2UI/MCP middleware tools, the effective relationship between "8 steps" and "8 calls" is not 1:1 and is not asserted anywhere. `TOOL_NAMES` gates which tools the *agent* is given, but `reserveToolCall` is the only real guard — and it fails silently (S5).

---

### 🟢 S12 — `plan`'s refusal reason is generated per-topic, so it cannot express the real problem

`"No sections found for MATH1002."` (S3) is technically true but useless: MATH1002 is not offered this semester. The message does not distinguish *unknown course*, *course exists but untimed*, *course exists but no legal section*, *topic matched only a title*, or *topic matched a lecturer*. `planRequest` has no notion of course existence at all (`catalogueHasKey` checks section keys, not course codes). Every one of those five cases produces the same string.

### 🟢 S13 — `searchSections` caps at 10, but 19 courses have more than 10 sections

`searchSections(catalogue, query, 10)` (`search.ts:57`). Verified: `GELH1000` has **17** sections and the top-10 window returns 10 — so `plan` can miss a legal section purely because it fell outside the cap. Worst offenders: `TELC1012` (86), `CPED1000` (73), `CPED2001` (70). For GE courses with many sections this directly reduces the chance of satisfying "no classes before 8am".

### 🟢 S14 — `runTurn` is test-only; the production path bypasses every guard it implements

`runTurn` (`src/agent/turn.ts:162`) is imported by `tests/agent.test.ts` and nothing else — verified by `rg runTurn src/` → only `turn.ts` itself. The production route uses `BuiltInAgent` directly with `tools: TOOL_NAMES.map(...)`. So `runTurn`'s `ForbiddenToolError` allowlist, its `rejectIfTurnExhausted` pre-check, and its `"The plan did not finish."` fallback **never execute in production**. The safety properties they encode are only asserted in tests, not enforced at runtime (the real enforcement is `TOOL_NAMES` at construction, which is correct but different). This is a maintenance trap: the tested contract is not the shipped contract.

### 🟢 S15 — Budget `start` is captured at agent construction, not at turn start

`route.ts:76-82` sets `start: Date.now()` when the agents factory runs, and `cloneAgentForRequest` re-runs the factory per request, so the ordering is currently correct. But the budget is bound into tool closures at construction; any future path that reuses an agent instance across turns (a cache, a shared runtime, a resumed thread) would see an already-expired deadline and produce immediate empty-message `LimitError`s. Nothing asserts that `start` corresponds to the turn. This is a latent trap rather than a present bug.

---

## 3. Verified good — do not weaken during remediation

| Property | Evidence |
|---|---|
| AI cannot write the timetable | `TOOL_NAMES` has no write tool; `tests/agent.test.ts` asserts `writeSections`/`setProposalStatus` spied and never called; `decideConfirm` binds approval to `baseRevision` |
| Stale approvals rejected | `confirm.ts:91-92` returns `stale` when `timetable.revision !== proposal.baseRevision`; UI renders "Out of date" |
| Constraints re-validated at commit | `proposal-flow.ts:40-44` re-runs `validateSections` before `decideConfirm` |
| Deterministic rules | overlap / unknown-section / untimed / class-for / class-not-for / prerequisite(1-of-N) all pure and unit-tested; `rules.test.ts` + `agent.test.ts` 102/102 |
| Retrieval quality | BM25 with course-code/section-key token expansion; `searchSections` is the reason `GELH1012`, `CSCI1004`, `MATH1001` resolve rank-1 (verified) |
| Profile ownership at boundary | `readProfile`/`readTimetable` return only the signed-in user's rows (`agent.test.ts:379-420`); `getTimetable(userId, id)` is owner-scoped |
| Proposal is a preview | `plan` writes only to `proposals`; `sectionKeys` unchanged (asserted in `agent.test.ts`) |

**Preserve:** `hitMatchesTopicIdentity` (the cross-topic fix from the retrieval audit) is *correct* — it stops a title keyword from satisfying a course wish. S2/S3 must be fixed by giving GE and titles a **legitimate identity channel**, not by reverting that function.

---

## 4. Confirmed defects vs. hypotheses

**Confirmed by execution** (reproduced against the real catalogue):
S1, S2, S3, S4, S5, S6, S7, S8, S9, S11, S12, S13, S14.

**Hypothesis — stated as such, not proven:**

- **H1 — DeepSeek `deepseek-flash` may not honour `providerOptions.openai.reasoningEffort: "none"`** (`route.ts:129`). The model is reached through `@ai-sdk/openai`'s `chat()` against a DeepSeek base URL, so the `openai` provider namespace is being applied to a non-OpenAI endpoint. This would not fail loudly; it would be ignored or 400. I could not test it: `DEEPSEEK_API_KEY` is not present in the environment and `.env.local` is not readable by this audit. **This is the single highest-uncertainty item and should be probed first with a live key.**
- **H2 — the 30 s deadline is the binding constraint in practice.** Compute is 21–45 ms, so a 30 s wall-clock expiry implies ~3–4 s per model round-trip across 8 steps. Plausible but unmeasured; no production trace with timings exists in the terminal logs (they show only `GET /api/copilotkit/info` and the pre-existing 403 thread warnings).
- **H3 — the model's topic decomposition is what triggers S3.** I cannot see the actual `plan` arguments from the failed run (no transcript of the app-side conversation was recoverable; the only "18 credits" transcripts are IDE chats about the retrieval study). The observed behaviour is *consistent* with generic topics like `["GE","GE"]` or a 6-topic list containing one bad code, both of which I reproduced.
- **H4 — `AGUISendStateSnapshot`/`Delta` injection inflates step count.** Inferred from reading `BuiltInAgent`; not measured.

---

## 5. Prioritized, minimal remediation strategy

Ordered by *failure removed per line changed*. Each is the smallest change that closes the defect; none relaxes a constraint.

**P0 — makes the request expressible at all (fixes the reported failure)**

1. **Add a course-type channel (S2).** Map `Course Type` in `resolveScheduleColumns`, add `courseType` to `Section`, surface `isGE` on `SearchHit`, and add an explicit `ge: number` field to `PlanRequest` that `planRequest` satisfies from GE-marked sections only. This also fixes the "GE" → lecturer false positive without weakening `hitMatchesTopicIdentity`.
2. **Make `plan` partial, not atomic (S3).** Convert the two `return { proposal: null, reason: … }` sites at `planner.ts:161,195` into `droppedWishes.push(topic)` entries, and keep `proposal: null` only when *nothing* can be satisfied. Also dedupe identical topics into `droppedWishes` instead of silently re-satisfying.
3. **Give credits a real source (S1).** Until a credit dataset exists, remove the `× 3` from the AI Planner's reach: have `plan` return `courses: n` and let the UI state plainly that credits are unknown for this semester. Do not present a computed credit total as if it were checked.

**P1 — makes failures visible (fixes "empty responses")**

4. **Give `LimitError`/`ForbiddenToolError` messages (S5).** One line each: `super("This turn reached its 8-step limit. Ask for a smaller change.")`. This alone turns the observed dead end into an actionable message.
5. **Fix `detail` and the failed-state logic (S6).** Delete the `result ? null : null` ternary; pass `running` from the panel; derive failure from a typed result shape for both `plan` and `validate`; stop showing past-tense titles for in-flight calls.
6. **Make `validate` refuse empty input (S7).** `validateSections([], …)` should return `ok:false` with an explicit `no-sections` failure, and `plan` must never call `validate` with `[]`.

**P2 — makes the constraint honest**

7. **Include meetings on `SearchHit` (S4).** Add `day/startMinutes/endMinutes` (or a compact `"TUE 13:00-14:15"`), `unit`, and `restriction` so the model can honour and explain the 8am rule. Note in the tool result that the earliest catalogue start is 08:30 so the constraint is already satisfied.
8. **Distinguish refusal reasons (S12).** Split `"No sections found for X"` into `unknown-course` / `all-untimed` / `no-legal-section` / `title-only-match` / `instructor-only-match`.
9. **Raise the search cap for multi-section courses (S13).** Return all sections of a matched course, or raise the cap to the max section count (86), before `plan` filters.

**P3 — hygiene, do before the next audit**

10. **Exclude `.worktrees` from vitest/tsconfig (S9)** so `npm test` reports the real 225.
11. **Converge the two plan entry points (S10)** and delete the uncalled `POST /api/proposals`, or route the agent through it.
12. **Make the budget single-sourced (S11)**, and have `runTurn` either drive production or be deleted so the tested contract is the shipped one (S14).
13. **Probe H1 with a live key** before touching anything else; if `reasoningEffort: "none"` is rejected, that is an independent cause of turn failure and belongs at P0.

**Explicitly not recommended:** relaxing `hitMatchesTopicIdentity`, loosening `validateSections`, or adding a write tool. The safeguards in §3 are correct; the defects are all in *what the planner can express* and *how failure is reported*.

---

## Appendix — reproduction

Probes were run from a gitignored scratch directory using `npx tsx --tsconfig tsconfig.json` against `loadCatalogue()` (1,582 sections). The directory was deleted and `git status` shows only the pre-existing `next-env.d.ts` modification.

```bash
# S1 — credits are count × 3, unit is a faculty code, no credit column in workbook
# S2 — searchSections("GE") returns GAO GE / GE WEI lecturers
# S3 — plan atomicity: 5 good topics pass, 5+NOPE9999 refuses everything
# S5 — LimitError.message === ""; 8 searches then plan → "Error: "
# S7 — validateSections([]) → {"ok":true,"failures":[],"warnings":[]}
# S9 — bare npm test vs --exclude '**/.worktrees/**'  (16 failed vs 0 failed)
```
