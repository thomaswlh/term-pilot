# TermPilot MVP design

Date: 2026-11-06
Status: agreed in brainstorming, pending review of this file

TermPilot is a timetable planner for University of Macau add-drop. The student can build a timetable by hand and ask an agent to revise it. Search and hard rules decide which sections are legal. The model interprets wishes and explains results. A saved timetable changes only when the student adds a section or confirms a preview.

Visual design is out of this document. Impeccable owns color, type, spacing, and component styling. This document locks behavior and arrangement only: a grid of timetable notebooks, chat on the left, the weekly calendar on the right, and search on the calendar side.

## Goal

A usable planner for the 1st semester of academic year 2026/2027, with a small measured catalogue search. The demo must support manual add, a full plan from wishes, and a revision of an existing timetable.

## Stack

- Next.js application
- Clerk for email-and-password signup and sessions. Clerk's free Hobby plan is sufficient for the demo. Use demo email addresses. Do not put real student records in Clerk.
- PostgreSQL for the profile, timetables, and proposals, keyed by the Clerk user id
- CopilotKit for the chat panel and the tool-using agent. Package versions are chosen when dependencies are installed, from the current CopilotKit docs.
- shadcn/ui for components, styled in the later visual pass
- A hosted model API. The key stays on the server. A request may include the signed-in profile, the current timetable, and catalogue passages returned by search.

## Catalogue

Load only these add-drop workbooks from `docs/ref/add-drop`:

- `Class Schedules for 1st Semester of Academic Year 2026-2027  (2026-09-23) (1).xlsx`, sheet `Class Information`. This is the only source of sections and meetings.
- `Pre-requisite Requirements (2026-09-18) (3).xlsx`, sheet `Pre-requisite Requirements`. Ignore the `Macro1` sheet.
- `Major and Specialization Codes (2026-08-04) (1).xlsx`, sheet `Major & Spec List`. This supplies the major codes a profile may store.

Do not load `docs/ref/pre-enrollment`, the add-drop minor list, or the add-drop GE workbook. The class schedule already contains the GE sections. Do not port `docs/ref/App.jsx`.

A section identity is the course code plus the section number. One section has every meeting row with that identity. A meeting with a day and a start and end time can sit on the weekly grid. A meeting with no day or no time remains in search results and cannot be placed on the grid. When a section has both kinds of row, the grid shows only the timed meetings, and those timed meetings are added together.

## Profile and timetables

Clerk answers who the user is. The database stores everything else.

The profile is one row per account:

- Major code, chosen from the Major column of sheet `Major & Spec List`, such as `CLL19`. Ignore the `Macro1` sheet. Specialization is not stored.
- Completed course codes

Search works before the profile is complete. Manual add and planning do not. Both stay unavailable until major and completed courses are saved.

A timetable belongs to one account. It stores a title, a revision number that starts at 1, and the selected section identities. Creating a timetable makes an empty one titled "Untitled timetable" unless the student supplies a title. The home screen lists that account's timetables with title, last edited time, and section count. One account cannot read or write another account's profile, timetable, or proposal.

Three prepared example students live in the repo. Each has a major, completed courses, and a starter set of real sections. Choosing an example replaces the current account's major and completed courses with that example and adds one new timetable. It does not delete timetables already saved.

## Hard rules

A candidate set of sections is legal only when every check below passes. Hard rules are never relaxed to satisfy a wish.

**Whole section.** The set includes every timed meeting of each selected section. A student cannot keep only one day of a two-day section.

**Overlap.** Two timed meetings conflict when they fall on the same day and their time ranges overlap. A meeting that ends at the same minute another starts does not conflict.

**Class restriction.** Read the schedule's "Class For / Class Not For" text. Split it into major-code tokens such as `CLL19` and `JAP25`. Match the profile's major code to a whole token.

- Empty text: allowed.
- "Class for": allowed only when the student's major token is present.
- "Class not for": blocked when the student's major token is present.
- Both phrases in one text: both checks apply.

**Simple prerequisite.** Group the prerequisite rows for a course by Group No. Use a row when "Pre-requisite For" is `ALL`, or when it is `MAJOR` and the student's major code equals a whole token in that row's Major List. Split that list on punctuation the same way as class-for text. Do not use a substring match.

- When "No. of Course Required" is 1, the student must have completed at least one course code in that group. Several codes in a need-1 group are alternatives. Having none of them blocks the save. `CHLL2004` needing one of `CHLL1003` or `CHLL1004` is this case.
- When "No. of Course Required" is greater than 1, do not block. Attach a warning that the group was not enforced. "Take 2 of these 4" is this case.
- When rows in one group disagree on the required count, warn and do not block on that group.
- A course with no applicable rows has no prerequisite block.
- Every applicable need-1 group must pass. Groups are combined with "and". Courses inside a need-1 group are combined with "or".

Credits are not checked. The class schedule has no credit column.

## Search

Each section is one document: course code, title, teacher, department, notes, and timed meetings written as text, such as `Tue 13:00-14:15`. BM25 ranks these documents. The search used by the calendar and the search used by the agent are the same function. A call returns the top 10 sections.

The measured set is `tests/retrieval/queries.json`: 20 queries, each with the section identities a person marked as relevant. The test runs those queries against the app's index and prints Recall@5 and MRR from that run. The test fails if the file is missing, a query has no judgments, or the index cannot answer. A low score does not fail the test. The model does not estimate the scores.

## Planner and agent

The agent may call these tools: search sections, read the profile, read the current timetable, plan, and validate. It cannot write a timetable. A user message allows at most 8 tool calls and 30 seconds. Reaching either limit stops the turn. The saved timetable stays as it was, and the chat says the plan did not finish.

The model turns a wish into a plan request:

- Topic queries to search
- Section identities to keep
- Section identities to drop
- Time ranges to avoid

The planner starts from the current sections, drops the requested ones, and forces the kept ones to remain. For each topic it walks the top 10 hits and adds the first section that passes the hard rules and sits outside the avoided times. It adds at most one section per topic. It does not add courses the student did not ask for.

Keep means the result must contain that section. A kept section that is not already on the timetable is added when it passes the hard rules. A keep or drop that names an unknown section produces no proposal. A request that changes nothing produces no proposal.

If a time wish eliminates every legal hit for a topic, the planner still returns a preview that passes the hard rules and names the wish it could not keep. If no hit passes the hard rules, it returns no proposal and names the failed topic or rule.

`plan` stores a proposal and returns its id and summary. `validate` reports pass or fail and the reasons. Neither tool changes the timetable.

A proposal stores its owner, timetable id, the timetable revision it was built from, the resulting section identities, any dropped wishes, any warnings, and a status of open, applied, or discarded.

## Confirm and discard

The preview is drawn on the calendar. Confirm and discard are student actions, not tool results.

Confirm checks the owner, then checks that the timetable's current revision equals the proposal's base revision. It runs the hard rules again. On success it writes the sections, increases the revision by 1, and marks the proposal applied. The student chooses whether that write updates the current timetable or creates a new timetable. A new timetable starts at revision 1 and leaves the previous one unchanged.

Confirming an already applied proposal returns success and does not add the sections again. Confirming after a newer save is refused. The student can ask for a new plan. Discard marks the proposal discarded and leaves the saved timetable unchanged.

Manual add uses the same hard rules against the saved timetable. Success increases the revision by 1. Failure does not write and states the rule that failed.

## Failures

Tool errors, timeouts, step limits, empty search, and illegal plans leave the saved timetable unchanged. Empty search for a topic yields no proposal, and the chat names that topic. An illegal plan is not offered. The chat names the rule that failed.

Catalogue text and chat text are data. They do not change server instructions. When the model is unavailable, search, manual add, and the hard-rule checks still work.

## Tests

Rule tests use no model. They cover whole sections, overlap including a boundary touch, class-for, class-not-for, a need-1 alternative group, a need-2 warning that still saves, an untimed meeting refused by the grid, discard, one-time confirm, a second confirm, a stale confirm, and a cross-account refusal.

Search tests load `tests/retrieval/queries.json`, run it against the app index, and print Recall@5 and MRR. They fail when the file or a judgment is missing. They do not fail because a score is low.

Agent tests use a fake model. A timeout, a step limit, a broken tool result, and a chat message that tries to instruct the server do not change the saved timetable.

When a UI exists, a browser pass walks through sign-in, profile, manual add, preview, confirm, discard, and refresh. That pass checks behavior. It does not decide visual design.

## Later

These are not part of this MVP:

- Pre-enrollment mode and its chat
- Review comments from umeh.top or any other source
- Screenshot import of a personal timetable
- Signing in to the university with student credentials to fetch a real enrolment
- Credit totals
- Dense retrieval or a second ranker
