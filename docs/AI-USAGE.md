# AI usage

## 2026-11-10 — offline retrieval pool

- Model: Xenova/all-MiniLM-L6-v2
- Revision: 751bff37182d3f1213fa05d7196b954e230abad9
- Dtype: q8
- Package: @huggingface/transformers@4.3.2 (devDependency; offline pool command only)
- Purpose: offline course-retrieval pool for human labeling
- Generation: `npm run retrieval:pool` embeds catalogue text in batches of 32, scores 12 frozen discovery queries with legacy BM25, repaired BM25, dense cosine, and RRF hybrid, then writes `tests/retrieval/pool.json` and an empty `tests/retrieval/labeling-sheet.csv`.
- Human verification: pool row fields, `proposedBy` ranks, and absence of relevance labels were checked against the catalogue before labeling begins.
- Relevance labels are human. This command does not write them.

## 2026-11-10 — retrieval study audit remediation

- Scope: address independent audit findings S1–S11 on branch `course-retrieval-study` without changing frozen discovery queries or the labeling sheet.
- Planner: topic satisfaction now requires course code, prefix, section key, or instructor token match; title-only BM25 hits no longer satisfy a topic wish.
- Pool: `fusionInputs` (depth-50 bm25 and dense lists) added to `tests/retrieval/pool.json` so hybrid ranks are reproducible without re-embedding.
- Metrics: decision brief adds `Precision@returned` alongside unchanged Recall@k, plus documented methodological limits (short-list coverage, k from sheet cap, legacy c4 artifact, dense c3 floor).
- BM25 tokenizer: kept `[a-z0-9]+(?::[0-9]{2,3})?` so `13:00` does not false-match `09:13-10:00`; `TUE 13:00`, end-time-only `13:00`, and bare `13` remain known gaps.
- Human verification: full Vitest suite, typecheck, lint, and production build re-run after edits; labeling sheet SHA-256 unchanged.

## 2026-11-10 — scheduling copilot design

- Model: Grok 4.7, in Cursor.
- Purpose: turn the 2026-11-10 AI planner audit into a design for natural-language timetable requests, verified GE marks, and verified credits.
- Generation: the design was discussed section by section and written to `docs/superpowers/specs/2026-11-10-scheduling-copilot-design.md`. A read-only probe matched all 570 offered course codes to `courseDetailUG` credit values. No application code was changed.
- Human verification: the planner behaviour, the credit and GE data sources, the tool and failure behaviour, and the scope boundary were approved in conversation before the spec was written. The spec file was approved on 2026-11-10. The implementation plan is `docs/superpowers/plans/2026-11-10-scheduling-copilot.md`. No application code was changed for the plan.
- DeepSeek reasoning check, same day: official thinking-mode guide documents chat `reasoning_effort` as `low`, `high`, or `max`, with thinking on by default. Installed `@ai-sdk/openai` 3.0.138 sends that field and does not round-trip `reasoning_content`. The design adds low effort plus a fetch echo. Higher effort is not part of the change.
- Implementation on 2026-11-10. Models used: Composer 2.5 Fast, Grok 4.7 High Fast, and Claude Opus. The credit snapshot was fetched by `npm run credits:refresh` from courseDetailUG for the 570 offered codes. The 7-credit planner tie-break test expects BBB1000 plus CCC1000 rather than the plan's sample AAA1000 plus CCC1000 because the earlier candidate index wins.

## 2026-11-10 — planner GE count and credit target

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 6 from `.superpowers/sdd/task-6-brief.md` (planner selection, GE count, credit target, `storePreview`).
- Generation: failing planner tests were written first from the brief, `npx vitest run tests/planner.test.ts` was observed failing, then `src/domain/planner.ts` and `src/app/api/proposals/route.ts` were updated. The same Vitest command was rerun with `--exclude '**/.worktrees/**'` because the first invocation also collected `.worktrees`. ESLint on the touched files and `npx tsc --noEmit` passed.
- Human verification: not yet done. The student still needs to review the diff and the credit, GE, and preview behaviour.

## 2026-11-10 — agent plan request, preview base, and limits

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 7 from `.superpowers/sdd/task-7-brief.md` (structured `plan` fields, preview base, 12-call / 60-second limits).
- Generation: failing agent tests were written first, `npx vitest run tests/agent.test.ts --exclude '**/.worktrees/**'` was observed failing, then `src/agent/turn.ts` and `src/app/api/copilotkit/[[...slug]]/route.ts` were updated. The same Vitest command passed. `npx tsc --noEmit` and ESLint on the touched files passed. `providerOptions.openai.reasoningEffort` was left at `none`.
- Human verification: not yet done. The student still needs to review the tool result, the preview base, and the limit sentences.

## 2026-11-10 — official credit snapshot refresh

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 9 from `.superpowers/sdd/task-9-brief.md` (refresh command and the full undergraduate credit snapshot).
- Generation: the failing test was written first. `npx vitest run tests/credit-refresh.test.ts --exclude '**/.worktrees/**'` failed because `scripts/credits-refresh` was missing, then failed again on snapshot coverage after the parser existed. `npm run credits:refresh` fetched each offered course code from `courseDetailUG` (browser User-Agent, ADF `_afrLoop` second GET, four at a time) and wrote `src/domain/data/credit-snapshot.json`. Official `MATH1001` credit is 3, so the search-panel and course-group assertions were left unchanged. The four-file Vitest command passed (28 tests). `npx eslint` on the new script and test, and `npx tsc --noEmit`, passed.
- Human verification: not yet done. The student still needs to review the snapshot, the five printed title mismatches, and that a request never calls the refresh command.

## 2026-11-10 — low DeepSeek reasoning and reasoning echo

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 10 from `.superpowers/sdd/task-10-brief.md` (`reasoningEffort: "low"` and a fetch wrapper that echoes `reasoning_content`).
- Generation: `tests/deepseek-reasoning.test.ts` already matched the brief. `npx vitest run tests/deepseek-reasoning.test.ts --exclude '**/.worktrees/**'` failed because `src/agent/deepseek-reasoning.ts` was missing. The wrapper and the CopilotKit route were then added. `npx vitest run tests/deepseek-reasoning.test.ts tests/agent.test.ts --exclude '**/.worktrees/**'` passed (20). `npx tsc --noEmit` and ESLint on the touched files passed. Effort stays `low`. `high` and `max` were not set. Turn limits stayed at 12 calls, 60 seconds, and 12 steps.
- Human verification: not yet done. The student still needs to review the echo map and that reasoning text is not shown in the chat.

## 2026-11-11 — scheduling copilot defect fixes

- Model: Grok 4.7, in Cursor.
- Purpose: fix confirmed audit defects A1–A6 in the scheduling copilot. A saved course inside an avoid window must not gain a second section. Backend tool errors must show as failures. An unchanged plan must return the credit report. GE count is by course. The credit snapshot stays on the server.
- Generation: failing tests were written first for the duplicate-course rule, the avoid wish, the unchanged-keys credit report, the `Error:` tool result, and hit-based credit labels. Implementation followed in the planner, rules, confirmation, week highlighting, search fit, chat tool view, and credit loading. The committed credit snapshot was not regenerated.
- Verification: `npx vitest run --exclude '**/.worktrees/**'` passed 272 tests (1 skipped). `npx tsc --noEmit` and `npx eslint src tests scripts` passed. `npx next build` compiled all 18 routes. No client chunk under `.next/static` contains `courseDetailUG`. No signed-in browser session was available, so the editor, shared page, and search badge were not clicked through.
- Human verification: not yet done. The student still needs to review the duplicate-course rule, the avoid wish, the credit report for an unchanged timetable, the tool-error title, and that source URLs are not in the browser bundle.

## 2026-11-11 — scheduling copilot quality pass

- Model: Grok 4.7, in Cursor.
- Purpose: correct the explanations and GE-count behaviour called out after the A1–A6 remediation. A request for another section of a chosen course must say the course is already on the timetable. An avoid window must be reported even when no topic is named. A positive `geCount` is the final count unless `geAtLeast` is set. A plan that stores no preview is titled as a check. The planner reuses its section index.
- Generation: failing planner and tool-title tests were written first. The planner, the section validator's optional index, the `plan` tool schema and prompt, the tool title, and the scheduling spec were then updated. No credit snapshot was fetched or rewritten. `POST /api/proposals` was left unchanged.
- Verification: `npx vitest run --exclude '**/.worktrees/**'` passed 285 tests (1 skipped). `npx tsc --noEmit` passed. ESLint passed on the touched planner, rules, CopilotKit route, tool-title, panel, and test files. An isolated 12-candidate `planRequest` took about 110ms; the regression ceiling in the suite is 1000ms because a parallel run reached 545ms. No live model turn and no signed-in browser session were run.
- Human verification: not yet done. The student still needs to review the already-selected wish, the avoid-only wish, an exact GE count versus `geAtLeast`, and the "Checked this timetable" title in a signed-in chat.

## 2026-11-11 — academic context design

- Model: Grok 4.7, in Cursor.
- Purpose: design the next TermPilot slice for student-reported academic context and a small set of source-backed UM enrolment cards.
- Generation: the current catalogue loader, profile, planner, rules, and scheduling-copilot path were read before the design. The local Course Enrolment Handbook PDF (modified 14 September 2026, no academic year in the title) and the Registry general-information page retrieved 11 November 2026 were used for the card sources. The design was agreed section by section. No application code was changed.
- Human verification: the profile, claim, scheduling, policy-card, form, planning-surface, validation, and later-slice sections were approved in conversation on 2026-11-11. Three clarifications were then added: `NULL` versus an empty course list, a source on every policy card, and persistence, migration, ownership, and share regressions. The implementation plan is `docs/superpowers/plans/2026-11-11-academic-context.md`. No application code was changed.

## 2026-11-11 — prerequisite checker reads claims

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 3 from `.superpowers/sdd/task-3-brief.md`. `validateSections` reads prerequisite claims. A recognized waiver or transfer can satisfy a one-course group and produces a student-reported warning. A completed claim in the same group wins and adds no warning.
- Generation: the three claim tests and the `warningSentence` test were written first and observed failing. `completedClaims` was added beside `coursesFromCompleted`. Callers convert `completed: string[]` at the `validateSections` call. `planRequest` still accepts completed codes. No commit.
- Verification: `npx vitest run --dir tests tests/rules.test.ts tests/planner.test.ts tests/week.test.ts tests/confirm.test.ts` passed 121 tests. The same filter without `--dir tests` also loads `.superpowers/sdd/snapshots/task-3-base`, whose copies cannot import `../src` and exit 1. `npx tsc --noEmit` passed. ESLint passed on the touched files. Agent and example tests that call `validateSections` also passed.
- Human verification: not yet done. The student still needs to review the claim rule, the warning sentence, and that saved proposal warnings still store only the non-enforcing shape.

## 2026-11-11 — profile courses, ownership, and shares

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 4 from `.superpowers/sdd/task-4-brief.md`. Persist course records, year, admission cohort, and interests on the existing `profiles` table. SQL `NULL` in `course_records` stays uninitialized. A JSON array, including `[]`, is authoritative. A public share still returns only title, section keys, and updated time.
- Generation: store and share tests were written first and observed failing on the old `completed` profile. Persistence then followed in `schema.sql`, the memory store, and the Postgres store. Callers that still had `saveProfile` or `profile.completed` were updated. `planRequest` still receives completed-status codes. No commit.
- Verification: `npx tsc --noEmit` passed. `npx vitest run tests/store.test.ts tests/share-isolation.test.ts tests/postgres-store.test.ts tests/agent.test.ts` passed the project tests (store 5, share 1, agent 23) and skipped the Postgres test because `DATABASE_URL` was unset. The same filter also ran the older `.worktrees/course-retrieval-study` copies. Example, proposal-flow, and section-lock tests passed (15). ESLint passed on the touched TypeScript files.
- Human verification: not yet done. The student still needs to review the nullable `course_records` column, the empty-list save, and that the share page does not read the profile. The legacy Postgres row was not executed.

## 2026-11-11 — planner holds and direct requests

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 6 from `.superpowers/sdd/task-6-brief.md`. A course the student reported stays off an automatic pick. Naming that course places the first legal section and records a declared-status warning. Waived and transfer claims stay on the saved proposal.
- Generation: planner and confirmation tests were written first. The first planner run threw because `planRequest` still read `completed`. After the profile argument accepted course records but still skipped completed codes, three new planner assertions failed. An agent assertion then failed because saved warnings were empty. The planner, warning sentence, proposal storage, manual-add response, and claim callers were updated after those failures. No commit.
- Verification: `npx vitest run tests/planner.test.ts tests/agent.test.ts tests/confirm.test.ts` passed the project files (planner 45, agent 24, confirm 31). The filter also ran the `.worktrees/course-retrieval-study` copies, 155 tests in total, 0 failed. `npx tsc --noEmit` passed. ESLint passed on the touched files. Proposal-flow, section-lock, and memory-store tests passed.
- Human verification: not yet done. The student still needs to review a named held course, a prefix that skips a held code, a GE count that does not invent a held GE, and that declared-status and student-reported warnings remain on the saved proposal.

## 2026-11-11 — saved proposal prerequisite claims

- Model: Grok 4.7, in Cursor.
- Purpose: the timetable page validated each saved proposal with completed-status claims only. It now uses `prerequisiteClaims(profile.courses)`, so a waived or transfer course that recognizes a prerequisite is not drawn as a hard conflict.
- Generation: the page call was changed to match planning and confirmation. The page-source test now requires `claims: prerequisiteClaims(profile.courses)` and rejects `completedClaims`. No commit.
- Verification: `npx vitest run tests/timetable-page-props.test.ts tests/confirm.test.ts` passed 4 files, 61 tests. `npx tsc --noEmit` passed.
- Human verification: not yet done. The student still needs to confirm a saved proposal that is legal only because a waived or transfer course has `recognizesPrerequisite: true` is no longer marked as a prerequisite conflict.

## 2026-11-11 — profile form

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 7 from `.superpowers/sdd/task-7-brief.md`. The profile page collects year, admission cohort, interests, and course records with status. Save posts that body. Example buttons still post only the example id.
- Generation: the empty-English test was added first and passed without changing `addPresetCourses`. The profile render test was then pointed at the new props and failed because `initialCompleted` was gone. The form and profile page were updated after that failure. No commit.
- Verification: `npx tsc --noEmit` passed. `npx vitest run tests/academic.test.ts tests/profile-form.test.tsx` passed the project files (academic 5, profile form 1) and failed the older `.worktrees/course-retrieval-study` profile-form copy with a pre-existing duplicate React `useContext` error. That worktree file fails on its own as well.
- Human verification: not yet done. The student still needs to save an empty course list, a waived row with the recognition checkbox, and confirm an example button does not fill year, cohort, interests, or waivers.

## 2026-11-11 — editor status line

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 8 from `.superpowers/sdd/task-8-brief.md`. A catalogue course that is on the student profile shows `statusLine` under its title. A successful manual add shows each `warningSentence` and still adds the section.
- Generation: the waived `warningSentence` literal was not asserted, so that expectation was added to `tests/rules.test.ts` and passed immediately because the sentence already existed. A search-panel render test was added next and failed because the status line was absent. The timetable page, editor, and search panel were updated after that failure. No commit.
- Verification: `npx vitest run tests/share-isolation.test.ts tests/rules.test.ts` passed the project files (share isolation 1, rules 31) and also passed the older `.worktrees/course-retrieval-study` rules copy (23). `npx vitest run tests/course-search-panel.test.tsx --exclude '**/.worktrees/**'` passed 13 tests.
- Human verification: not yet done. The student still needs to search for a reported course, confirm the status line sits with the fit, conflict, and restriction badges, and confirm a manual add with a student-reported warning still adds the section.

## 2026-11-11 — assistant profile and policy tools

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 9 from `.superpowers/sdd/task-9-brief.md`. `readProfile` returns the saved academic profile and every held course code. `readPolicy` returns each policy card with its cohort binding. The assistant prompt tells the model when to call those tools. No live model call.
- Generation: agent tests were written first. `npx vitest run tests/agent.test.ts` failed 4 tests: `readProfile` still returned `completed`, `TOOL_NAMES` had no `readPolicy`, and the CopilotKit route had neither the tool nor the new prompt sentences. The waived-candidate plan assertion passed in that run because the planner already skips held codes. Tools and prompt sentences were added after that failure. A follow-up run failed only because the test spelled the handbook file `Enrol` instead of `Enrolment`; the tool already returned the card URL. The assertion was corrected. No commit.
- Verification: `npx vitest run tests/agent.test.ts` then passed 2 files, 40 tests. That is 28 tests in `tests/agent.test.ts` and 12 older tests in `.worktrees/course-retrieval-study/tests/agent.test.ts`, which import that worktree's own source. `npx tsc --noEmit` passed.
- Human verification: not yet done. The student still needs to confirm a signed-in turn can call `readProfile` and `readPolicy`, and that a plan still runs when those tools were not called first.

## 2026-11-11 — academic context verification

- Model: Grok 4.7, in Cursor.
- Purpose: Task 10 from `.superpowers/sdd/task-10-brief.md`. Run the full project checks on the academic-context work already in the tree. No redesign and no commit.
- Generation: no application code changed. This entry was appended after the three checks passed.
- Verification: `npx vitest run --exclude '**/.worktrees/**'` exited 0 (55 files passed, 1 skipped; 315 tests passed, 1 skipped). The skipped test is `tests/postgres-store.test.ts` because `DATABASE_URL` was unset. `npx tsc --noEmit` exited 0. `npx eslint src tests` exited 0. No fix was required.
- Human verification: not yet done. The student still needs to review the academic-context diff and these three check results.

## 2026-11-11 — academic context review fixes

- Model: Grok 4.7, in Cursor.
- Purpose: apply two final-review fixes. `keep` of a newly added reported course records the same `declared-status` warning as a named topic, and only when that section remains on a returned proposal. The assistant instructions say TermPilot has no reviewed statement when no card covers the question. No live model call and no commit.
- Generation: the planner test and the existing agent source assertion were extended, then the keep warning and the instruction sentence were added. Exact section-key placement, profile parsing, stores, and the form were left unchanged.
- Verification: `npx vitest run tests/planner.test.ts tests/agent.test.ts` exited 0 (4 files, 102 tests).
- Human verification: not yet done. The student still needs to confirm a kept reported course shows the declared-status sentence, and that a key already on the timetable does not.

## 2026-11-12 — profile column drift

- Model: Grok 4.7, in Cursor.
- Purpose: stop the Next.js PostgresError popup (`column "course_records" does not exist`) on pages that load a profile. The running `termpilot` database still had the older `profiles` table.
- Generation: `src/db/schema.sql` was applied to the existing database. No tables were dropped. `src/db/server-store.ts` now reads that file from the project directory and runs it once per process before the first Postgres store call. The memory store does not read the file. Direct `postgresStore()` tests still apply the file themselves.
- Verification: `profiles` now has `course_records`, `year_of_study`, `admission_cohort`, and `interests`. Row counts stayed at 1 profile, 2 timetables, 6 sections, and 10 proposals. `course_records` is null, and `getProfile` returned the saved profile with completed course `CSCI1001`, plus both timetables and the open editor's 6 sections. `npx tsc --noEmit` passed. ESLint passed on `src/db/server-store.ts` and `tests/server-store.test.ts`. `npx vitest run --exclude '**/.worktrees/**'` exited 0 (55 files passed, 1 skipped; 316 tests passed, 1 skipped). The skipped test is `tests/postgres-store.test.ts` because `DATABASE_URL` was unset. An unsigned browser session for `/`, `/profile`, and `/timetables` redirected to `/sign-in` and did not show the Postgres overlay. The signed-in pages were not clicked because that browser had no Clerk session.
- Human verification: not yet done. The student still needs to refresh the signed-in home, profile, gallery, and open timetable and confirm the popup is gone and the existing timetable data is still there.

## 2026-11-12 — programme-aware recommendation design

- Model: Grok 4.7, in Cursor.
- Purpose: design reliable, programme-aware course recommendations from the 2026-11-12 academic-context and recommendation-relevance audit. No application code was changed.
- Generation: the audit, the approved academic-context and scheduling-copilot specs, and the 1st-semester restriction texts were read. Class-restriction phrases were grouped from the schedule workbook. Major codes were read from the major workbook. The design was decided section by section and written to `docs/superpowers/specs/2026-11-12-programme-aware-recommendations-design.md`.
- Human verification: not yet done. The student still needs to review that spec before an implementation plan is written.

## 2026-11-12 — programme-aware recommendation refinements

- Model: Grok 4.7, in Cursor.
- Purpose: refine the approved recommendation design on three points, then write the implementation plan. No application code was changed.
- Generation: the existing 12-course subset search in `src/domain/planner.ts` was read. The spec now keeps that exact subset check, labels a heuristic gap separately from an impossible one, ranks faculty interest matches before other faculty courses, and adds `compulsory-general-education` as its own study-plan kind. The plan is `docs/superpowers/plans/2026-11-12-programme-aware-recommendations.md`.
- Human verification: not yet done. The student still needs to review the updated spec and the plan before implementation starts.

## 2026-11-12 — whole-project architecture and engineering audit

- Model: Composer 2.5 Fast, in Cursor (with parallel read-only explore agents on agent, domain, persistence, and frontend).
- Purpose: independent holistic architecture and engineering audit of TermPilot AI—implemented vs planned behavior, data and control flow, risks, and prioritized recommendations. Documentation only.
- Generation: repository sources, specs under `docs/superpowers/`, prior audits under `docs/audits/`, and installed Next.js 16.4.5 resolver behavior were reviewed. `npm run build` was run to confirm which edge auth bundle is emitted. Full `npm test` was not re-run. Report written to `docs/audits/2026-11-12-termpilot-architecture-audit.md`. No application code, tests, datasets, or git state were changed.
- Human verification: not yet done. The student should read the audit report and confirm findings before acting on recommendations.

## 2026-11-12 — profile faculty, search hit unit, and readStudyPlan

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 5 from `.superpowers/sdd/task-5-brief.md`. Show the section unit and department, the saved major's name and programme, and a read-only reviewed study plan. No live model call and no commit.
- Generation: failing search and agent assertions were written first. `npx vitest run tests/search.test.ts tests/agent.test.ts` failed on the missing fields, the missing tool name, and the missing chooseCourses sentence. The hit projection, `readProfile`, `readStudyPlan`, the plan `stream` field, the four prompt sentences, and the study-plan trace title were then added. The same command passed. BM25 tokenization, `documentText`, topic identity matching, the tool-call budget, and the planner's course choice were left unchanged. No study-plan JSON file was added.
- Human verification: not yet done. The student still needs to review the four prompt sentences, the study-plan message, and that a missing plan does not change a saved timetable.

## 2026-11-12 — Stage 2 ranker

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 6 from `.superpowers/sdd/task-6-brief.md`. Rank Stage 2 additions by plan, interest, and faculty with a 12-course exact subset and a gap reason. No live model call and no commit.
- Generation: `tests/recommend.test.ts` was written first. `npx vitest run tests/recommend.test.ts` failed because `src/domain/recommend.ts` did not exist. `rankAdditions` and the `planRequest` call were added after that failure. The same recommend file and `tests/planner.test.ts` then passed.
- Human verification: not yet done. The student still needs to confirm a chosen timetable shows each added course's basis and the gap sentence when the credit target is not met.

## 2026-11-12 — unknown chosen credits in Stage 2

- Model: Grok 4.7, in Cursor.
- Purpose: a null credit on an already chosen course was making `rankAdditions` return no additions and `gapReason: "none"`. No live model call and no commit.
- Generation: the failing recommend test was written first. `npx vitest run tests/recommend.test.ts` failed because `CSCI1001` was not placed. The chosen-credit total, the `{code} has unknown credits.` wish, and the duplicate gap-wish sentence were then changed. `npx vitest run tests/recommend.test.ts tests/planner.test.ts` passed (3 files, 84 tests).
- Human verification: not yet done. The student still needs to review the diff and confirm a chosen course with unknown credits does not block a verified compulsory that fits the known remainder.

## 2026-11-12 — checked study-plan files

- Model: Grok 4.7, in Cursor.
- Purpose: implement Task 7 from `.superpowers/sdd/task-7-brief.md`. Transcribe study-plan rows only from faculty pages that were opened. No live model call and no commit.
- Generation: `tests/study-plan-files.test.ts` was written first. `npx vitest run tests/study-plan-files.test.ts` passed while `src/domain/data/study-plans/` had no JSON file. The CIS bachelor URL was opened and redirects to a 404, so `CPS19.json` was not added. The FAH Chinese Language and Japanese Studies pages were opened, and their study-plan PDFs were read. `CLL19.json` and `JAP25.json` copy the coded compulsory and required-elective rows. Printed codes were compared with `loadCatalogue().sections`. Unnamed GE, language, community, and free-elective lines were not turned into rows. `npx vitest run tests/study-plan-files.test.ts tests/study-plan.test.ts` then passed. The report is `.superpowers/sdd/task-7-report.md`.
- Human verification: not yet done. The student still needs to check the two PDFs against the JSON rows, and decide whether `CPS19` should stay missing while its faculty URL returns 404.

## 2026-11-12 — programme-aware recommendations, controller verification

- Model: Grok 4.7, in Cursor, coordinating Composer 2.5 Fast for the catalogue faculty task, the search-fit task, and the study-plan loader.
- Purpose: execute the approved plan and check the integrated result. No commit and no merge.
- Generation: task reviews are recorded in `.superpowers/sdd/progress.md`. After Task 7, PDFKit text from the opened CLL19 and JAP25 PDFs was compared with the JSON. All 34 and 36 course codes match, with the same compulsory or required-elective kind and the same year. Neither PDF names a GE course code. `npx tsc --noEmit` passed after replacing two invalid `null as const` assertions in the search-panel test. `npx eslint . --ignore-pattern .worktrees --ignore-pattern .superpowers` passed. `npx vitest run --exclude '**/.worktrees/**' --exclude '**/.superpowers/**'` passed 358 tests and skipped 1. `npx next build` compiled. No live model call was made.
- Human verification: not yet done. A signed-in browser session and a real assistant turn are still needed.
