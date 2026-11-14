# TermPilot AI — Scheduling Copilot Remediation: Adversarial Re-Audit

| | |
|---|---|
| **Audited** | `main` @ `2861c9f` plus the uncommitted working tree (50 entries: 38 modified, 12 untracked) |
| **Audit date** | 2026-11-11 |
| **Scope** | Independent, adversarial verification of the claimed A1–A6 fixes from `docs/audits/2026-11-11-scheduling-copilot-upgrade-audit.md`, plus a hunt for defects introduced by the remediation |
| **Type** | Audit only. No source, test, dataset, or user data modified. No commit, merge, or branch change. |

**Method.** Claims were checked against the code, then against runtime behaviour on the real 1,582-section catalogue (`loadCatalogue()`), the committed 570-record credit snapshot, the real `planRequest`, the real `createTools` factory driving the real in-memory store, and the real `applyProposalDecision` path. Passing tests were treated as a starting hypothesis, not as evidence: every A-item was independently re-derived, and the two most consequential claims (A2 error rendering, A5 bundle contents) were traced into `node_modules` and the production build output rather than inferred from the app source. Fifteen probe programs ran from `/tmp` and were deleted. `git status` at the end matches the start byte-for-byte (50 entries), and `next-env.d.ts` is unchanged (SHA-256 `1862ac4b…97db2b` before and after).

**Verification baseline (independently reproduced):**

```
npx vitest run --exclude '**/.worktrees/**'  → Test Files 51 passed | 1 skipped (52)
                                               Tests 272 passed | 1 skipped (273)
npx tsc --noEmit                             → exit 0, no diagnostics
npx eslint src tests scripts                 → exit 0, no diagnostics
npx next build                               → succeeds, all 18 routes compile
npm test (no exclude)                        → 7 failed files / 19 failed tests (all .worktrees)
```

---

## 1. Executive summary

**A1–A6 are genuinely fixed.** This is not a case of tests passing over unimplemented behaviour. Each claim was reproduced against the real catalogue and the real store, and each fix is enforced at more than one layer:

- **A1** now holds at five independent layers: `validateSections` has a real `duplicate-course` rule, the planner refuses to place a second section of a chosen course, manual add is rejected, the search panel labels the section `Already taking …`, and confirmation rejects a stored duplicate. The original headline defect — "keep CHLL1000 but nothing on Friday afternoon" producing two CHLL1000 sections reported as a clean success — **no longer reproduces**: it now yields one section, zero preview, and the wish `CHLL1000:001 is in a time you want to avoid.`
- **A2** holds. I traced the error delivery through the actual installed versions (`@copilotkit/runtime` 1.85.0 → `@ag-ui/client`), which I had to do because the previous audit cited a v1 converter path while this app uses the `/v2` entrypoint. Both paths converge on the same behaviour: a thrown backend tool error arrives as a plain `TOOL_CALL_RESULT` whose **content is `"Error: <message>"` with no `error` field**. The new prefix check in `planToolState` is therefore the correct detection point, and both limit messages now render as failures with their text.
- **A3, A4, A5, A6** all verified, including the parts that are easy to fake. The credit snapshot is **absent** from the client bundle; the totals agree across server and client paths.

However, the remediation is not clean. It trades a wrong timetable for a **wrong explanation**, and it leaves a hot path that is four times slower than the previous audit estimated:

1. **A student asking to switch section gets a nonsensical failure reason** (N1). `{"topics": ["CHLL1000:002"]}` on a timetable holding `CHLL1000:001` — the natural encoding of "switch me to section 002" — returns *"No legal section for CHLL1000:002. Add at least one section before checking the rules."* The A1 fix correctly prevents the duplicate, but the fallback reason cites the `no-sections` rule, which is false: the timetable has a section. The correct outcome is either a swap or a wish saying the course is already chosen. This is a **new** defect created by the fix.
2. **The credit-target subset search costs ~2.1 s of blocking CPU** (N2). Worse than A7's measured 585 ms, because the previous audit's candidate list was not fully eligible. At the documented maximum (12 eligible candidates plus a target) `planRequest` takes **2.07–2.13 s** deterministically, inside a 60-second turn that must also cover up to 12 model round-trips. Not a correctness bug, but it is the only super-linear cost and it sits on the exact request shape the prompt instructs the model to produce.
3. **A legacy duplicate blocks unrelated manual adds** (N3). Because `decideManualAdd` validates a temporary union, a timetable already holding two sections of one course now rejects adding *any* course, including unrelated ones. Recovery exists (remove one section, or plan a `drop`), but pre-existing user data can enter this state.

**Findings: 0 critical, 1 high, 3 medium, 4 low, 3 informational.** No defect produces an incorrect timetable any more. The remaining issues are explanation quality, performance, and legacy-data edge cases.

**Verdict: merge-ready, with N1 recommended in the same pass.** No blocker exists on the standard this audit was given — no wrong timetable is presented as correct, no tool can write the timetable, and A1–A6 are all verified closed. N1 is a one-branch fix in a fallback that this same change introduced.

---

## 2. A1–A6 verification

### A1 — One section per course — **Fixed**

Verified at every surface the brief names, using `CHLL1000` (the original reproducer course, TUE+FRI 16:00–17:15, two legal sections).

| Surface | Evidence | Result |
|---|---|---|
| Validation | `validateSections(["CHLL1000:001","CHLL1000:002"])` → `{ok:false, failures:[{rule:"duplicate-course", courseCode:"CHLL1000", sectionKeys:[…]}]}` | ✅ |
| Manual add | `decideManualAdd` → `{ok:false, reason:"Course CHLL1000 already has a section on this timetable (CHLL1000:001, CHLL1000:002)."}` | ✅ |
| Search panel | `evaluateSectionFit` → `{status:"duplicate", label:"Already taking CHLL1000"}`; hidden by the `Fits schedule` filter | ✅ |
| Planning (the A1 repro) | `topics:["CHLL1000"]` + `avoid` over the saved section → keys `["CHLL1000:001"]`, `storePreview:false`, wish `CHLL1000:001 is in a time you want to avoid.` | ✅ |
| Planning (defence in depth) | `topics:["CHLL1000","CHLL1000:002"]` and a `PREFIX` topic both stay at one section per course | ✅ |
| Proposal confirmation | A stored proposal with both sections → `{ok:false, reason:"illegal", detail:"Course CHLL1000 already has a section…"}`, for both `apply` and `save-as-new` | ✅ |
| Existing duplicates | Planning from a timetable that already holds a duplicate is refused with the same sentence rather than building on it | ✅ |
| Empty-timetable clearing | `drop` the last section → `sectionKeys:[]`, `storePreview:true`; `decideConfirm` with an empty proposal → `{ok:true, effect:"apply", sectionKeys:[], revision}` | ✅ |

The defence is structural, not incidental. `planner.ts:319` skips any hit whose course code is already chosen, `planner.ts:287–300` records an explicit avoid wish for the retained section, and `rules.ts:222–237` builds the `duplicate-course` failure from a de-duplicated key set so a repeated key alone is not treated as a duplicate. `week.ts` was updated in the same change to skip `no-sections` and to mark every key in a `duplicate-course` failure, so the new rule cannot throw on `failure.sectionKey` or under-highlight.

**Residual, not a defect:** with `avoid` and *no* `topics`, a saved section inside the window produces `No section changes. Verified credits: 3.` with **no wish at all**. Naming the course produces the wish. So the same intent ("nothing on Friday afternoon") yields different feedback depending on whether the model includes a topic. Pre-existing (the old code refused with `Nothing to change.`), but now presented as a success. See N6.

---

### A2 — Tool errors — **Fixed**

I verified this against the installed library rather than the app source, because the previous audit's citations were to a different code path than the one this app uses.

- Server tool execution: `@copilotkit/runtime/dist/agent/index.mjs:1039–1054` — the `tool-error` stream part becomes `{type: TOOL_CALL_RESULT, role:"tool", content: \`Error: ${formatToolError(part.error)}\`}`. No `error` field.
- Client reduction: `@ag-ui/client/dist/index.js` `EventType.TOOL_CALL_RESULT` handler builds `{id, toolCallId, role, content}` from the event and **does not** copy an `error` field. Confirms the field can only ever be set by the unused frontend-handler path.

So content-prefix detection is the only available signal, and `plan-tool-state.ts:69–76` implements it correctly, including leading whitespace (`"  Error: boom"` → detail `"boom"`).

End-to-end through the real tool factory and store:

```
12-call budget exhausted
  LimitError: This turn reached its 12-tool-call limit. Ask for a smaller change.
  content:    "Error: This turn reached its 12-tool-call limit. Ask for a smaller change."
  panel:      {failed:true, detail:"This turn reached its 12-tool-call limit. …"}

60-second budget exhausted
  panel:      {failed:true, detail:"This turn reached its 60-second limit. …"}
```

Both titles map to `Could not draft a proposal` / `Could not check the rules` etc. in the failed phase, for all five tools. A thrown error can no longer appear as a successful proposal: `failed:true` forces `proposalId:null`, so no `ProposalButton` is rendered.

**Verified non-regressions:** a successful payload whose `reason` merely *contains* `Error:` is not misclassified, because object payloads are inspected structurally and never passed through the prefix check. Empty string, whitespace, `null`, numbers and arrays all map to a neutral view rather than a failure — correct, since `readTimetable` legitimately returns `null`.

**Residual gap (informational):** a **run-level** `RUN_ERROR` (for example a provider 400 before any tool result) is emitted through CopilotKit's `emitError` path and never becomes a tool message, so it is not displayed by this panel. Unchanged by the remediation and outside its scope, but it means "every failure is visible" is still not literally true.

---

### A3 — Credit-only requests — **Fixed**

The `Nothing to change.` branch is gone. Through the real `plan` tool with the real store:

| Request | Result | Panel |
|---|---|---|
| `{}` on a 3-credit timetable | `proposalId:null`, summary `No section changes. Verified credits: 3.` | `failed:false`, detail shown |
| `{}` on an empty timetable | `No section changes. Verified credits: 0.` | `failed:false` |
| `{creditTarget: 18}` on 3 credits | `No section changes. Verified credits: 3. Target 18, gap 15.` + structured `credits` | `failed:false` |
| `{}` with an open proposal present | report returned, **no new proposal**, count stays 1 | `failed:false` |

No proposal is created in any of the four cases (verified via `listProposals`), the saved keys and revision are untouched, and `credits.status/target/gap` are structured in the tool result so the chat need not parse prose. Unknown-credit handling is consistent: `gap` is `null` and the summary says `Credit target not confirmed` (unit-tested and structurally present in `creditSentence`).

---

### A4 — GE counting — **Fixed**

`geAlready` is now `courseCodesOf(keys).filter(isGeCourse).length` (`planner.ts:382`), i.e. distinct **courses**.

Data verified independently against the parsed catalogue:

```
sections 1582 | GE sections 123 | distinct GE courses 56
courses mixing GE and non-GE sections: []      ← counting by section cannot inflate a course
Course Type values: "" (1459), "GE Course" (123)
sections with a teacher matching /\bGE\b/ that are NOT GE: 5 (EELC1008:003, :004, EELC1013:021, …)
```

The teacher false-positive path is still live search material but can no longer satisfy a GE count. `geCount: 2` from `["GEA1000:001"]` yields `["GEA1000:001","GEB1000:001"]` and never `GEA1000:002`; `geCount: 2` on an empty timetable yields `["GEGA1000:001","GEGA1001:001"]` — two distinct GE **courses**, credits 6, and the summary states the overage rather than trimming the count. Shortfall is stated honestly: `geCount: 56` places 14 legal GE courses and reports `Need 42 more GE course(s).` (only 53 of 56 GE courses are singly placeable for `CLL19`; the rest fail `class-for`).

---

### A5 — Credit snapshot absent from the client bundle — **Fixed**

Verified against a clean production build (`rm -rf .next && npx next build`), not against source imports:

```
.next/static/chunks/*.js (430 chunks)
  "courseDetailUG"        → 0 files
  "retrievedAt"           → 0 files
  "credit-snapshot"       → 0 files
  "snapshotRecords"       → 0 files
  chunks with >20 distinct "[A-Z]{4}\d{4}" literals → 0
```

The single `GELH1012` occurrence is in `examples.ts` seed data (`sectionKeys:["CSCI1004:001","GELH1012:001"]`), not snapshot content. `credit-snapshot.ts` — the only module importing the JSON — is reachable solely from server components and route handlers.

---

### A6 — `creditLabel` wired, totals consistent — **Fixed**

`Editor` now consumes the prop for first paint instead of ignoring it:

```569:575:src/components/editor.tsx
  const keysMatchServer =
    live.sectionKeys.length === timetable.sectionKeys.length &&
    live.sectionKeys.every((key, index) => key === timetable.sectionKeys[index]);
  const creditBook = creditBookFromValues(knownCredits);
  const liveCreditLabel = keysMatchServer
    ? creditLabel
    : formatCredits(creditReport(live.sectionKeys.map(courseCodeOf), creditBook));
```

The client recomputes only after a local mutation, using `creditsByCourse` (server-supplied per-course values for saved **and** proposal codes) topped up from search hits by `rememberCredits`. `creditBookFromValues` lives in `credits.ts`, which does not import the snapshot — this is what makes A5 possible.

Cross-surface agreement, same timetable, independently computed:

| Surface | Label |
|---|---|
| Server (`timetables/page.tsx`, `[id]/page.tsx`, `s/[token]/page.tsx`) | `7 credits` for `CHLL1000`, `GELH1012`, `GESB1001` |
| Client (`creditBookFromValues` from `creditValues`) | `7 credits` — **agree** |
| Editor proposal bar | `proposalCreditLabel` from the selected proposal's codes |
| Search panel | `creditsLabel` per group from `hit.credits` (`formatCreditValue`) |
| Public share page | server-computed `creditLabel` prop |

Snapshot integrity, re-verified rather than trusted:

```
570 records | 570 distinct codes | 0 duplicates
offered courses 570 | snapshot codes not offered: [] | offered codes missing: []
0 bad sourceUrls | 0 bad retrievedAt | 0 bad credit types | 0 unexpected fields
distribution: 3→496, 1→30, 6→16, 2→11, 4→6, 1.5→6, 0→3, 0.5→2
```

A4-adjacent gap worth stating: **every** offered course has a verified credit, so the "unknown credits" branch is reachable only through fixture data or a stale workbook. That is good news, but it means the unknown-credit UI path is effectively untested in production conditions.

---

## 3. Newly discovered defects and regressions

Ranked by severity, then reproducibility.

### 🟠 N1 — A section-switch request reports a false rule failure (new, introduced by the A1 fix)

**Severity:** High for explanation quality. Deterministic. No test covers it.

A student with `CHLL1000:001` asks for section 002. The realistic request shapes all fail to communicate what happened:

```
{"topics":["CHLL1000:002"]}
  → keys ["CHLL1000:001"], storePreview false
  → wish: "No legal section for CHLL1000:002. Add at least one section before checking the rules."
  → panel: failed:false, title "Drafted a proposal"

{"topics":["CHLL1000","CHLL1000:002"]}
  → identical output
```

Two separate problems compound:

1. **The cited rule is false.** `planner.ts:319` `continue`s past the hit because the course is already chosen, so `sawLegal`, `sawUntimed`, `sawOther` and `cited` all stay unset; `planner.ts:350` then falls back to `cited ?? {rule:"no-sections"}`, whose sentence is *"Add at least one section before checking the rules."* The timetable has a section. The student is told to add one.
2. **No swap is offered.** `drop` + `topics` works correctly (`["CHLL1000:002"]` after dropping `:001`), and so does `keep :002` + `drop :001`, so the capability exists — but the model has no way to know it must also emit a `drop`, and nothing in the wish says so.

The fallback `cited ?? {rule:"no-sections"}` is the specific regression: before the fix this input placed the duplicate (wrong, but it "worked"), and the new guard turned it into a wrong *sentence*. A distinct wish — for example *"CHLL1000 is already on this timetable as CHLL1000:001."* — is the correct output, and it is a one-branch change.

### 🟡 N2 — Credit-target subset search takes ~2.1 s, about 4× the A7 estimate

**Severity:** Medium. Deterministic. Not covered by any timing assertion.

```
12 eligible candidates, no target          →   5.3 ms
12 eligible candidates, creditTarget 36    → 2118.3 ms   (2068 / 2118 / 2125)
12 eligible candidates, target 36, avoid[] → 2069.3 ms
12 eligible candidates, target 18          → ~1375 ms
single topic                               →   4.7 ms
```

A7 measured 585 ms and called it "headroom". The gap is candidate *eligibility*: A7's list was not fully placeable, so `preselected` was short and `2^k` was small. At the documented maximum — `candidates` capped at 12, all eligible — the loop is the full `2^12 = 4096` masks, and the cost is two pre-existing per-item rebuilds:

- `validateSections` performs `catalogue.sections.find(...)` once per key (`rules.ts:199`), measured at `0.121 ms @ 6 keys`, `0.353 ms @ 18 keys`.
- `sectionOverlapsAvoidRanges` rebuilds the whole 1,582-entry map **per call** (`planner.ts:99–100`), measured at `145 µs` per build, invoked once per subset key (`planner.ts:557`).

`4096 × 0.35 ms ≈ 1.4 s` plus up to `4096 × 6 × 145 µs ≈ 3.6 s` in the pathological case matches the observed 2.1 s. This is synchronous and blocks the Node event loop for the duration, inside a 60-second turn budget that also has to cover up to 12 DeepSeek round-trips. `byKey` is already built at `planner.ts:225` and is not threaded into either helper, which is why the fix is cheap.

### 🟡 N3 — A legacy duplicate blocks unrelated manual adds and all planning

**Severity:** Medium. Deterministic, and reachable with pre-existing user data.

Before this build, users could create two sections of one course by hand. Those timetables are now in a state where:

```
timetable: ["CHLL1000:001","CHLL1000:002"], add "MATH1001:001"
  → {ok:false, reason:"Course CHLL1000 already has a section on this timetable (…)"}
plan from that timetable
  → {proposal:null, reason:"Course CHLL1000 already has a section …"}
```

The add of an *unrelated* course is rejected because `sections/route.ts` validates the union `saved + new`. The week does mark both sections with conflict rings (`week.ts` handles the new rule), but the editor's `failures` state is only populated from a failed add, so nothing explains the red until the student tries to act.

Recovery works and is reachable — `drop` the extra section through the planner, or remove it from the week (manual remove is unvalidated) — and `drop + topics` repairs and adds in one step. So this is a rough edge on legacy data, not a dead end. It is worth a decision either way: either the union should exclude the duplicate (validate only the new key against the *rest*), or the editor should surface the existing failure on load.

### 🟡 N4 — The `no-sections` fallback also corrupts the reason for other "already chosen" paths

Same root cause as N1, reported separately because the blast radius is wider than section switching: any topic whose best hits are all courses already on the timetable reaches the same fallback. `topics:["CHLL1000","CHLL1000:003"]` and a repeated prefix both produce the "Add at least one section" sentence. One fix (a dedicated "already on this timetable" wish) closes N1 and N4 together.

### 🟢 N5 — A credit-only answer is titled "Drafted a proposal"

The A3 fix makes the most common conversational outcome — "how many credits am I on?" — succeed with `proposalId:null`, yet `toolTitle("plan","done")` is `Drafted a proposal`. The trace reads as if a preview exists when it does not. Cosmetic, but it is the single most frequent `plan` outcome now, so it is visible often. A neutral done-title (or a phase keyed on `proposalId`) would fix it.

### 🟢 N6 — `avoid` with no topic gives no feedback at all

`{avoid:[FRI 15:00–18:00]}` against a saved FRI 16:00 section returns `No section changes. Verified credits: 3.` with an empty wish list, whereas naming the course produces the explicit avoid wish. The same intent is reported two different ways depending on a field the model may or may not send. Pre-existing behaviour, newly presented as success rather than a refusal.

### 🟢 N7 — Doubled period in every wish-bearing summary

`dropped wishes: CHLL1000:001 is in a time you want to avoid.. Verified credits: 3.` The wish strings end in `.` and `summarySentence` appends `.` to the joined list. Visible in the chat, in the proposal bar (same helper shape), and at the top of every preview that has a wish. **Pre-existing** — `git show HEAD:src/domain/planner.ts` has the identical `${parts.join("; ")}.` — so not a regression, but A1's fix makes wish-bearing summaries the *normal* case, so it is now on the main path.

### 🟢 N8 — `formatCreditNumber` is still a no-op, and "1 credits" is still wrong

```84:86:src/domain/credits.ts
export function formatCreditNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
```

Verified output: `1 credits` for `GESB1001` and the other 29 one-credit courses, and for every gallery card on a fresh one-credit timetable. Carried over unchanged from A8.

### ℹ️ I1 — Multiple open proposals still accumulate, and now also survive a credit question

Three `plan` calls create multiple `open` proposals, and any open proposal blocks manual add. The A3 fix adds a new way to reach the state: with a preview open, a credit question returns the report and **leaves the preview open** (verified: count stays 1 before and after, keys unchanged), so the student can get a "no changes" answer and still be locked out of manual editing. Pre-existing (old I1), newly reachable. Nothing supersedes the previous proposal.

### ℹ️ I2 — `POST /api/proposals` still silently drops the new request fields

`readPlan` parses only `topics/keep/drop/avoid`, so `geCount`, `creditTarget`, `chooseCourses`, `candidates` and `baseProposalId` are discarded on that path. Uncalled by the client and explicitly out of scope, but it is now a lossy dual contract rather than a merely unused one (unchanged A10).

### ℹ️ I3 — Planner-level input validation is still absent

Direct calls accept `creditTarget:-5` (summary: `Requested courses exceed the target by 8.`), `geCount:-2` (silent no-op) and an inverted `avoid` range (`startMinutes > endMinutes`, silently never matches). The agent path is protected by Zod; the pure function is not. Unchanged A11.

---

## 4. Regression and integration checks

Combinations were exercised, not just isolated cases.

| Check | Result | Evidence |
|---|---|---|
| Original 18-credit / two-GE / after-8am request | ✅ Valid | 6 courses, **18 credits**, `status:"verified"`, `gap:0`, 2+ genuine GE courses, **0** sections before 08:00, `validateSections` ok. (`geCount` deliberately produces 4 GE when asked for 2 — see note below.) |
| Invalid course must not discard valid selections | ✅ | `["GELH1012","GESB1013","CSCI1004","MATH1001","NOPE9999"]` → 4 placed, 1 wish `No sections found for NOPE9999.`, `storePreview:true` |
| No AI tool can modify the saved timetable | ✅ | Five tools, no write tool; after `plan` the store still shows `["CHLL1000:001"]`, revision 2, with 1 proposal |
| Apply revalidates and rejects stale | ✅ | Revision bumped → `{ok:false, reason:"stale"}`, saved keys unchanged |
| Apply/Save reject an invalid proposal | ✅ | Duplicate proposal → `illegal` + sentence, for **both** `apply` and `save-as-new`; no timetable created |
| Empty proposal clears the timetable | ✅ | `{ok:true, effect:"apply", sectionKeys:[], revision:6}` |
| BM25 retrieval unchanged | ✅ | `search.ts` ranking path untouched (only extra output fields added); suite reports `Recall@5=0.966964… MRR=1`, matching the locked baseline; all retrieval tests pass |
| Verified credit data unchanged | ✅ | 570/570 offered codes present, correct fields/dates/source URLs, unchanged distribution |
| Manual operations not regressed | ✅ | Add/remove/rename/share paths unchanged; `editor-rail`, `course-search-panel`, `proposal-bar`, `section-mutation-lock` pass; example timetables still validate |
| Keep/drop + avoid + GE + target + candidates combined | ⚠️ | The combined request only failed because it contained `keep :002` on a saved `:001` — that is N1's root cause, not an independent bug; `drop`+`topics` resolves it |
| GE fill shortfall | ✅ | `geCount:56` → 14 legal, `Need 42 more GE course(s).`, 53/56 GE courses singly placeable (rest `class-for`) |
| GE + small target overage | ✅ | `geCount:2, creditTarget:3` → 6 credits, `gap:null`, `Requested courses exceed the target by 3.` |
| Closed/foreign `baseProposalId` | ✅ | Falls back to saved keys with `Unknown or closed preview.` wish, still plans the new topic |

**Note on the 18-credit case:** the headline request is met exactly (18 credits, `gap:0`, two or more GE, nothing before 8am). When GE fill places four GE courses for a target of 18, that is the specified behaviour — requested GE count and topics are preserved even when they consume the target — and the chat is told the total, not a promise of a specific course mix.

---

## 5. Test results and coverage gaps

**Results:** 272 passing / 1 skipped across 51 files (up from 257). Typecheck, lint (scoped to `src tests scripts`) and production build all clean. `npm test` still collects `.worktrees` and reports 7 failed files / 19 failed tests — **all** under `.worktrees/course-retrieval-study/tests/`, and all of them stale copies asserting the *old* UI contracts (`{proposalCredits.total} credits`, `creditTotal`, `not.toContain("creditLabel")`). These are worktree artefact failures, not application failures: the same assertions in the main tree were deliberately updated, and `vitest.config.ts` still has no `exclude` (A9, unchanged).

**The new tests are genuine.** The A1 work is covered by real behavioural tests at four layers (`rules.test.ts` duplicate + repeated-key cases, `confirm.test.ts` manual-add + confirm + empty-clear, `week.test.ts` conflict marking, `planner.test.ts` avoid-vs-retained-section and refuse-from-duplicate). A3 has a real tool-level test asserting `not.toMatchObject({reason:"Nothing to change."})`, no stored proposal, and unchanged keys. A2's `Error:` prefix has a test that both limit sentences are classified as failures.

**Gaps that matter:**

1. **Nothing tests the message a student actually sees for a duplicate request.** N1/N4 are invisible to the suite because every duplicate test asserts the *refusal* path or the *avoid* path, never "the section I named is a second section of a chosen course".
2. **No timing assertion on the planner.** N2 would pass forever. A cheap ceiling on `planRequest` at 12 candidates + target would have caught a 4× regression relative to A7's own measurement.
3. **No test for legacy duplicate data.** N3 (unrelated add blocked, planner refuses) has no fixture.
4. **No test asserts `creditLabel` is *used*** — the fix is guarded only by `expect(editor).toContain("{liveCreditLabel}")`, a source-string assertion that would pass even if the ternary were inverted.
5. **UI layer still greps source.** `copilot-panel.test.ts` reads the file and matches substrings, including after being retargeted at `plan-tool-state.ts`. That style cannot distinguish "the panel passes `running`" from "the panel renders the right thing when the backend throws". A2 is verified here only because I drove the pure helper with real CopilotKit content.
6. **No browser or live-model run** (see §7).

---

## 6. Remaining limitations vs newly introduced problems

**Pre-existing, still open (unchanged by the remediation):**

- `npm test` collects `.worktrees` (A9).
- `formatCreditNumber` no-op and "1 credits" (A8/N8).
- Doubled period in wish-bearing summaries (N7).
- `POST /api/proposals` is a lossy unused contract (I2).
- Planner accepts negative/inverted inputs when called directly (I3).
- Multiple open proposals accumulate; nothing supersedes (I1).
- `docs/PROJECT.md` still says *"maximum 8 tool calls and 30-second deadline"* and *"186 unit and integration tests across 32 test files"*; actual is 12/60 s and 272/51.
- `docs/AI-USAGE.md` still records *"Human verification: not yet done"* for every implementation entry, including this remediation. The course-required student verification remains genuinely outstanding.

**New or newly reachable from this remediation:**

- **N1/N4** — the `cited ?? {rule:"no-sections"}` fallback produces a factually false reason for any request naming a section of an already-chosen course. Introduced by the same guard that fixes A1.
- **N2** — quantified on the documented request shape at ~2.1 s; roughly 4× A7's measurement, because A7's candidate list was not fully eligible. The subset search is new to this feature line.
- **N3** — legacy duplicate timetables now block unrelated adds and all planning.
- **N5** — the now-dominant credit-only outcome is titled "Drafted a proposal".
- **I1 extension** — a credit question no longer disturbs an open preview, but leaves it open and blocking manual edits.

**Quality bar reached:** no known path produces a timetable that is invalid while being reported as clean. That was the class of failure the previous audit escalated to critical, and it is closed.

---

## 7. Merge-readiness verdict

**Merge-ready. No blockers.**

The three defects the previous audit made merge-blocking are verified closed at the level of runtime behaviour, not just tests:

| Previous blocker | Status | Confidence |
|---|---|---|
| A1 critical — avoid window duplicates a course | **Fixed** | High: five enforcement layers, real catalogue, original reproducer |
| A2 high — tool failures render as success | **Fixed** | High: traced through installed `runtime` 1.85.0 and `@ag-ui/client`, then through the real tool factory |
| A3 high — credit question answered as failure | **Fixed** | High: real tool + real store, four scenarios, zero proposals created |

**Recommended in the same pass (not blocking):**

1. **N1/N4** — replace the `cited ?? {rule:"no-sections"}` fallback with a real "already on this timetable" wish. One branch, and it removes the only *new* misleading message this change introduced.

**Optional follow-ups, in value order:**

2. **N2** — thread the existing `byKey` into `sectionOverlapsAvoidRanges` and pre-resolve sections in `validateSections`; add a timing ceiling to the planner test. This is the difference between 2.1 s and low tens of milliseconds on the request shape the prompt asks for.
3. **N3** — decide the legacy-duplicate policy: validate only the candidate key against the rest, or surface the existing failure in the editor on load.
4. **N5** — neutral done-title for a plan that returned no proposal.
5. **N7** — strip the trailing period before joining.
6. **N8** — singular "1 credit".
7. **A9/I2/I3/docs** — as previously deferred.

**Verification this audit could not perform:**

- **No live model run.** `DEEPSEEK_API_KEY` is not present in this environment. Everything about model *behaviour* is inference, not observation: how often the model emits `keep :002` without `drop :001` (the N1 trigger), whether it passes `geCount` instead of searching for "GE", whether it reuses `baseProposalId`, and whether a 2.1 s planner stall ever contributes to a 60-second timeout in practice. N1 was verified as a deterministic planner outcome, not as a frequency.
- **No browser session.** The panel's rendering of A2, A3 and N5 is derived by driving `planToolView`/`toolTitle` with the exact content strings CopilotKit produces, and by reading the component's wiring — not by observing pixels. Class names, colours and the collapsed/expanded trace states were not exercised.
- **No live catalogue fetch.** The credit snapshot was validated for internal integrity and coverage against the workbook, not re-fetched from `courseDetailUG` (the previous audit did that and found 569/570 + 1 retry match; this audit did not repeat the network work).
- **No screen-reader or keyboard pass** on the new duplicate badge or the failed-state trace.

---

## 8. Audit hygiene

- No tracked file, test, dataset, or user data was modified. No commit, merge, rebase, or branch change.
- `git status --porcelain` and `next-env.d.ts` (SHA-256) were captured before any command with build side effects and re-checked at the end: **50 entries before and after, identical content; `next-env.d.ts` byte-identical.**
- `npx next build` was run to verify A5 against real output. It regenerated `.next/` (gitignored) and did **not** alter `next-env.d.ts` this time; the hash comparison above proves it.
- All fifteen probe programs ran from `/tmp/tp-audit2` and were deleted; no scratch path was created inside the repository. Probes imported application modules by absolute path and constructed their own `memoryStore` instances, so no store, profile, or timetable belonging to the running application was touched.
- `node_modules` was read (CopilotKit and AG-UI internals) to verify A2. That required leaving the default sandbox; no network request carried student data, and the only outbound-capable command was the build, which contacts no external service.
- `npm test` failures were attributed by file path: 7/7 failing files are under `.worktrees/course-retrieval-study/`, 0 in `tests/`.
