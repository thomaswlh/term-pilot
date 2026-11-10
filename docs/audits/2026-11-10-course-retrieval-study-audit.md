# Course Retrieval Study — Independent Implementation Audit

| | |
|---|---|
| **Audited** | branch `course-retrieval-study` @ `7f9aa82` |
| **Worktree** | `.worktrees/course-retrieval-study` |
| **Divergence** | 11 commits ahead of `main` @ `7ef67d5` |
| **Audit date** | 2026-11-10 |
| **Scope** | Spec `docs/superpowers/specs/2026-11-10-course-retrieval-study-design.md`, plan `docs/superpowers/plans/2026-11-10-course-retrieval-study.md`, and the code they produced |
| **Type** | Audit only. No code, test, or labeling data was modified. |

**Not audited as "current work":** `main` contains none of this study — no `src/domain/search-legacy.ts`, no `src/domain/retrieval/`, no retrieval commands. Every finding below concerns the branch.

**State after audit:** worktree clean (`git status` empty); `tests/retrieval/labeling-sheet.csv` and `tests/retrieval/pool.json` byte-identical to HEAD. `retrieval:pool` was **not** run, no label was written, and `docs/retrieval/decision-brief.md` was not created. Probe scripts were kept outside the repo in `/tmp/audit/`. One scratch directory created accidentally inside the workspace was deleted and confirmed absent from `git status`.

---

## Executive summary

The study is **substantially implemented and mechanically sound**. All 218 tests pass, typecheck and lint are clean, the production build succeeds, the frozen legacy baseline is a verified byte-for-byte behavioral copy, and both BM25 and dense retrieval reproduce exactly from committed artifacts.

However, the audit contradicts two premises of the branch:

1. **A production behavior bug was hidden rather than fixed.** A planner fixture title was silently edited to make a test pass. With the original fixture, the repaired ranker causes the planner to report a course-wish satisfied by an unrelated course.
2. **The pool is not self-contained.** The stored hybrid rankings cannot be re-derived from `pool.json`'s own data for 6 of 12 queries.

Plus one methodological weakness large enough to change the study's conclusion: **BM25 is systematically penalized for returning fewer candidates than dense.**

Verdict: **safe to begin human labeling**, but the decision brief should not be treated as a ranker verdict until S4 is addressed, and S1/S2 should be fixed before the brief is written.

**Findings:** 1 critical-severity (S1), 2 high (S2, S3), 4 medium (S4–S7), 4 low (S8–S11).

---

## 1. What was actually implemented and verified

Re-run independently; not inferred from commit messages.

| Area | Method | Result |
|---|---|---|
| Test suite | `npm test` | **218 passed, 1 skipped** (46 files). Skip is the pre-existing Postgres test, unrelated. |
| Typecheck | `npm run typecheck` | Clean |
| Lint | `npm run lint` | Clean |
| Production build | `next build` | 18 routes compile. Only warning is a pre-existing Turbopack tracing note at `src/domain/catalogue.ts:54`. |
| Legacy baseline fidelity | Extracted `main:src/domain/search.ts`, diffed behavior against `search-legacy.ts` over **30 queries × 5 limits** | **0 mismatches**, including the intentional `csci1004:00` + `1` split |
| Repaired BM25 | Scored real catalogue | `CSCI1004:001` → section `001` first at 27.62 vs runner-up 7.37. `MATH1001` → both its sections in top 2. `CSCI 1004` → `CSCI1004:001` first. |
| Meeting-time queries | Probed `13:00`, `09:30`, `9:30`, `13` | `13:00`/`09:30` match; `9:30`/`13` do not. Regression test genuinely rejects a `13:30` meeting. |
| Index caching | `WeakMap` + post-mutation test | Reuses index for same object; does not rebuild |
| Course text & embeddings | Recomputed SHA-256 over all 570 embedding strings | **Matches `pool.json` exactly** (`128a761f3da7a137…`) |
| Vector validity | Checked cached vectors | 384-dim, **all L2 norms 1.000000**; course codes exactly match sorted catalogue |
| Dense reproducibility | Re-loaded MiniLM locally, re-embedded 12 queries, re-ranked offline | **0/12 mismatches** vs stored `runs.dense` |
| BM25 reproducibility | Recomputed legacy + repaired for all 12 queries | **Exact match** with `pool.json` |
| Pool/sheet integrity | Independent recomputation of every column | 172 rows, depth 10. All `proposedBy` strings correct. All title/department/instructor/notes cells match `courseFields()`. **0** duplicates, **0** missing rows, **0** column-count errors, **0** query-text mismatches, **0** ordering violations. |
| Human-label preservation | grep + `assertSheet` | No `relevant`/`irrelevant` anywhere. Guard runs **before** dynamic `import()` of `dense.ts`. |
| Metrics correctness | Verified `scoreCondensed` against spec | Unjudged dropped not zeroed; irrelevant keeps rank with gain 0; `null` on no relevant mark; IDCG = `min(k, #relevant)`. Exact-code reproduces locked `(18 + 5/7 + 5/8)/20 = 0.96696…` and MRR 1. |
| Production isolation | `rg` over `src/app`, `src/agent`, `src/domain/planner.ts` | **No** imports of `search-legacy`, `dense`, `hybrid`, or `model`. Search route still passes 20; agent and planner still pass 10. |
| Cache hygiene | Inspected commits | `.cache/` gitignored and **not** committed. No `docs/superpowers/`, no `next-env.d.ts` in any commit. |

**Conclusion:** dense and hybrid are genuinely offline-only, the label guard genuinely works, and the pool is genuinely reproducible for BM25 and dense. The core of the spec holds.

---

## 2. Findings, prioritized

### 🔴 S1 — Planner regression test was weakened to conceal a real behavior change

**Severity:** Critical — production behavior bug masked by a green test.

**Location:** `tests/planner.test.ts:369` · `src/domain/planner.ts:126`

The fixture title was changed from `"Switching lab exercise"` to `"Switching networks exercise"`. Plan Task 2 Step 3 authorized **only** the `NET:001` → `NET:002` expectation update. This edit is undisclosed and load-bearing.

**Reproduction** — original fixture, repaired ranker:

```
Topic 'LAB' → repaired hits:
   LAB:001  "laboratory bench skills"
   NET:002  "Switching lab exercise"      ← title word "lab" now matches
Topic 'LAB' → legacy hits:
   LAB:001  "laboratory bench skills"     ← only the real lab

planRequest → sections: LEGAL:002,NET:002
              droppedWishes: []           ← LAB wish silently "satisfied"
              summary: "added NET:002; removed LEGAL:001."
```

With each of the three title variants:

| `NET:002` title | `droppedWishes` | Test passes? |
|---|---|---|
| `Switching lab exercise` (original) | — (defect exposed) | ✗ |
| `Switching networks lab exercise` | — | ✗ |
| `Switching networks exercise` (committed) | `["LAB"]` | ✓ |

**Root cause:** `src/domain/planner.ts:126` treats *any* section returned by a topic search as satisfying that topic. Now that BM25 indexes titles, `LAB` returns `NET:002`, so the planner reports the lab wish satisfied while adding a networks course. A student asking for a lab receives a lecture. This was impossible before the change, because titles were not indexed.

**Impact:** The test now passes because the fixture was patched, not because the planner is correct. This is the most serious finding — the suite is green over a real defect.

---

### 🟠 S2 — Stored hybrid rankings are not reproducible from committed data

**Severity:** High — defeats the frozen-pool premise the scoring step depends on.

**Location:** `tests/retrieval/pool.json` · `scripts/retrieval-pool.ts:100-108` · `src/domain/retrieval/pool.ts:169-175`

`fuseCourses` consumes **50** courses from each list, but `cutRuns` stores only **depth (10)**. Re-deriving hybrid from the file's own `bm25` and `dense` lists fails on **6 of 12 queries**:

```
a3: hybrid contains JAPN1000 that recompute omits
c1: hybrid contains CSCI3024, CSCI1000, CSCI3023, CSCI2007
c2: hybrid contains GEST1012, GESB1012
c3: hybrid contains EDUC3007
c4: hybrid contains CSCI3024, CSCI3023, CSCI1000
```

The stored values are **correct** — verified as exactly `fuse(repaired@50, dense@50)` — but they are **unverifiable from the committed files alone**. Re-checking or re-scoring later requires re-running `retrieval:pool` and re-downloading the model.

The spec intends `pool.json` to be a frozen record the score command reads without re-ranking. That intent is not met.

**Fix:** store the depth-50 lists, or persist the fused input alongside the truncated output.

---

### 🟠 S3 — Tokenizer deviates from the spec, and the deviation changes semantics

**Severity:** High — undocumented deviation from an explicit spec constraint.

**Location:** `src/domain/search.ts:6` · commit `45a0c61`

| | Pattern |
|---|---|
| Spec | `[a-z0-9]+(?::[0-9]{3})?` |
| Implementation | `[a-z0-9]+(?::[0-9]{2,3})?` |

The spec also states "The legacy two-digit pattern is not used."

**Empirical effect:**

```
SPEC  query "13:00" → ["13","00"]
  doc "MON 09:13-10:00" → ["mon","09","13","10","00"] → MATCH   ← false positive
IMPL  query "13:00" → ["13:00"]
  doc "MON 09:13-10:00" → ["mon","09:13","10:00"] → no match    ← correct
```

The deviation genuinely **repairs a spec defect**: the literal spec matches any meeting containing hour `13` and minute `00` anywhere. That is good engineering.

But it is undocumented. Neither spec, plan, nor `docs/AI-USAGE.md` records it — despite `AGENTS.md:11` requiring generation steps to be logged. A future implementer working from the spec will get different results.

**Additional observations:**
- The fix is **incomplete**: `"TUE 13:00"` still matches (both `tue` and `13:00` appear), and `"10:00-13:00"` matches via the end time only.
- Bare `13` returns 0 hits while `13:00` returns 5. The time-query capability is narrow and undocumented in the UI.

---

### 🟡 S4 — Short candidate lists systematically depress BM25 scores relative to dense

**Severity:** Medium — the largest evaluation bias in the study; it tilts the headline comparison toward dense/hybrid.

**Location:** `src/domain/retrieval/metrics.ts:22-39`

`Recall@k` divides by **all** judged-relevant courses. A run returning only 4 candidates can never exceed 4/N. In this pool, repaired BM25 returns fewer than depth on **7 of 12** queries, while dense and hybrid always return 10:

| Query | bm25 | dense | hybrid |
|---|---|---|---|
| a1 | 4 | 10 | 10 |
| a2 | 3 | 10 | 10 |
| a4 | 8 | 10 | 10 |
| b1–b4 | 0 | 10 | 10 |
| others | 10 | 10 | 10 |

**Synthetic demonstration**, 6 relevant courses total:

| Run | Candidates | Recall | nDCG |
|---|---|---|---|
| short | 3 (all relevant) | **0.5** | 0.645 |
| long | 10 (same top 3, then padding) | **1.0** | 0.919 |

The short run found *every* relevant course available to it and still scored half. Dense receives 10 slots of free headroom on every query.

**Caveat:** part of this is a *true* difference — BM25 literally has fewer lexical matches, and the four category-B queries are legitimately unanswerable lexically. But conflating "returned fewer candidates" with "ranked them worse" will mislead the deciding reader.

**Mitigation:** cap all runs at an equal candidate count, or additionally report a metric restricted to each run's own returned length.

---

### 🟡 S5 — Depth was set by a row-count cap that silently becomes the metric cutoff

**Severity:** Medium — labeling-budget constraint leaks into evaluation design.

**Location:** `src/domain/retrieval/pool.ts:52`

`poolDepthFor` returns 10 for 172 rows. Correct per spec. But the 240-row cap exists to bound *sheet size*, and the resulting depth becomes `k` in every metric.

Consequence: labeling burden is very uneven — up to 24 candidates on category-C queries versus 10 on A and B. The sparse categories will dominate the variance of the category means, and the sheet-size budget silently fixes the evaluation cutoff.

---

### 🟡 S6 — Category C's legacy baseline is contaminated by a tokenizer artifact

**Severity:** Medium — risks a wrong conclusion in the brief.

**Location:** `src/domain/search-legacy.ts:6` (intentional, per spec)

For `c4` (`CSCI1004:001`), the legacy run's 7 hits are **all** `EDUC4001:*` with teacher `TBC_2026-1` — the bare `1` token matches. Confirmed: **188 sections** carry a digit in the teacher field.

This is spec-sanctioned (the legacy split is deliberately frozen), but it means `bm25-legacy` is not a meaningful competitor on `c4` — it is a null run returning garbage. Reporting it as a baseline row without a caveat invites "legacy was much worse here," when the honest statement is "legacy's tokenizer is broken on section keys, by design."

---

### 🟡 S7 — `c3` is unanswerable by dense, and one degenerate query is 25% of a category

**Severity:** Medium — category means rest on four queries each.

**Location:** `tests/retrieval/discovery-queries.json` (`c3` = `Haiwei Sun`)

Ground truth: exactly **one** section matches `SUN HAIWEI` — `MATH1001:002`.

| Run | Top result | Overlap with truth |
|---|---|---|
| bm25-legacy | `MATH1001` | ✓ |
| bm25 | `MATH1001` | ✓ |
| dense | `CHLL1001` (all top-10 are `CHLL*`) | **0** |
| hybrid | `MATH1001` | ✓ |

MiniLM maps "Haiwei Sun" to East Asian language titles. This is a legitimate finding about dense retrieval, but `c3` contributes nothing except a floor value for dense. With 4 queries per category, one degenerate query materially distorts the category mean.

---

### 🟢 S8 — Import-boundary test uses substring matching with a blind spot

**Severity:** Low.

**Location:** `tests/retrieval-import-boundary.test.ts:21`

| Sample import | Caught? |
|---|---|
| `@/domain/retrieval/dense` | ✓ |
| `../domain/retrieval/dense` | ✓ |
| `import type` variant | ✓ |
| dynamic `import()` | ✓ |
| `../../retrieval/dense` | **✗ MISSED** |

A relative import from a deeply nested file would slip through. Does not check `src/components` (arguably correct — the panel is a legitimate API consumer).

---

### 🟢 S9 — `loadCourseVectors` is dead code

**Severity:** Low — maintenance trap.

**Location:** `src/domain/retrieval/dense.ts:30`

Exported but never called. `scripts/retrieval-pool.ts` re-implements the same course grouping inline (`coursesInCodeOrder`, line 156). Two divergent copies of one algorithm, one of them untested.

---

### 🟢 S10 — Offline-only embedding stack is a production dependency

**Severity:** Low — install weight.

**Location:** `package.json:28`

`@huggingface/transformers@4.3.2` is in `dependencies`, pulling in:

| Package | Size |
|---|---|
| `onnxruntime-node` | 287 MB |
| `onnxruntime-web` | 140 MB |
| `@huggingface/*` | 15 MB |

Nothing on the request path imports it (verified). It belongs in `devDependencies`. The spec does not address dependency classification.

---

### 🟢 S11 — `AI-USAGE.md` entry has the wrong date and omits required detail

**Severity:** Low — course-policy completeness.

**Location:** `docs/AI-USAGE.md:3` · commit `7f9aa82`

The committed entry says `## 2026-11-09`; the commit is dated `2026-11-10 04:32 +0800`. Cause: `new Date().toISOString().slice(0,10)` is UTC, so a 04:32 local-time run yields the prior UTC date.

`AGENTS.md:11` also requires "important prompts or generation steps" and "human verification"; the entry records neither.

---

## 3. Missing tests / incomplete functionality

1. **No test for the planner cross-topic defect (S1).** This is the gap that let a patched fixture hide a real bug. A test asserting that topic `LAB` with only `NET:002` available yields `droppedWishes: ["LAB"]` would have caught it.
2. **No test that `pool.json` hybrid is reproducible from its own stored lists (S2).** A one-line recompute test at depth 10 would fail today and force the artifact to be self-contained.
3. **No test of the tokenizer against the spec's literal pattern (S3)** — so the deviation is invisible.
4. **No end-to-end test of `scripts/retrieval-score.ts`.** `renderBrief` and `assertSheet` are covered on fixtures, but the script's missing-file handling, exact-code computation, and "writes no brief on failure" behavior are unverified.
5. **No test for `writeAtomic`, `parseCsv` edges, or `isUsableCache`.** Manually probed: `parseCsv` handles RFC 4180 quotes, doubled quotes, embedded newlines, CRLF, trailing newline, and quoted-empty correctly; `isUsableCache` rejects wrong codes and widths. Nothing is locked.
6. **No test for the depth-5 fallback path.** `poolDepthFor` is unit-tested, but nothing proves the full command emits a coherent depth-5 sheet — the untaken branch.
7. **No test that a `relevant`/`irrelevant` string inside a quoted multi-line notes field cannot fool `sheetBlocksRewrite`.** Safe by construction (it reads the `label` column by index after parsing), but untested.
8. **`docs/retrieval/decision-brief.md` does not exist** — correctly, since no labels exist. The score command's happy path has **never run against real data**, only fixtures. Expected at this stage, but the brief's formatting over 172 real rows is unproven.

---

## 4. Readiness for human labeling

**Ready to label, with three caveats.** The mechanics are sound: no path was found where labeling corrupts state, and no path where a label gets fabricated.

**Solid:**
- Sheet is structurally perfect — 172 rows, correct fields, correct `proposedBy`, correct ordering, empty labels.
- The overwrite guard fires **before** the model loads.
- Score validation rejects unknown labels, out-of-pool labeled courses, duplicate rows, and invalid depth.
- Pool reproduces exactly for BM25 and dense; hash and normalization verified.

**Caveats before starting:**

1. **Do not read category means as a ranker verdict until S4 is addressed.** The short-list bias tilts the headline comparison toward dense/hybrid. Either cap all runs at an equal candidate count, or additionally report a metric restricted to each run's own returned length. Otherwise the study will "confirm" dense wins partly by construction.

2. **`c4` is a rigged baseline and `c3` is a dense floor.** Four queries per category means one degenerate query is 25% of a category mean. Note these in the brief rather than letting them move the mean silently.

3. **Label `b1`–`b4` carefully.** These are the only queries where BM25 returns nothing, so they carry the entire "semantic search matters" claim. `ML` returns marketing courses; `AI` returns `CIVL1000` (Computer Science) and `LAWS1015` (Enhancement Learning Activities). If these are mostly irrelevant, that is a real finding. If they are marked relevant merely because they appeared, the study is worthless.

**Blocking issues before the brief is written:**
- **S1** — production planner defect plus weakened test.
- **S2** — hybrid not reproducible from the frozen artifact.

**Neither blocks starting labeling.** The sheet is correct, and no fix for S1 or S2 would alter it, since both lie outside the sheet-generation path.

---

## Appendix — reproduction commands

All probes were run from the worktree; scripts were kept in `/tmp/audit/` and are not part of the repo.

```bash
cd .worktrees/course-retrieval-study

npm test                # 218 passed, 1 skipped
npm run typecheck       # clean
npm run lint            # clean
npm run build           # 18 routes

# S1 — planner cross-topic defect (original fixture)
npx tsx /tmp/audit/probe-planner-defect.ts

# S2 — hybrid not derivable from stored lists
npx tsx /tmp/audit/probe-hybrid-repro.ts

# S3 — tokenizer spec deviation
npx tsx /tmp/audit/probe-tok2.ts

# S4 — short-list metric bias
npx tsx /tmp/audit/probe-bias.ts

# Reproducibility: hash, normalization, dense re-embedding
npx tsx /tmp/audit/probe2.ts
npx tsx /tmp/audit/probe-dense.mts

# Sheet integrity
npx tsx /tmp/audit/probe4.ts
npx tsx /tmp/audit/probe-sheet2.ts

# Legacy baseline equivalence vs main
npx tsx /tmp/audit/probe-legacy-equiv.ts

# Import boundary blind spot
npx tsx /tmp/audit/probe-boundary.ts
```
