# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js, with Clerk for email-and-password sessions, PostgreSQL for the profile, timetables, and proposals, CopilotKit for the chat panel and tool-using agent, and shadcn/ui as the component base. Package versions are chosen when dependencies are installed. A hosted model API is used; the key stays on the server.

## Users

A University of Macau student planning the 1st semester of academic year 2026/2027 during add-drop. One account has one profile and that account's timetables. Development and the course demo use synthetic profiles and demo email addresses. Real student records stay out of Clerk and out of external model requests.

## Product Purpose

TermPilot AI lets that student build a legal weekly timetable by hand and revise it by asking. Success for the demo is three jobs, all in scope: add a section manually, produce a full plan from wishes, and revise a timetable that already exists. A saved timetable changes only when the student adds a section or confirms a preview.

## Positioning

Search and hard rules decide which sections are legal. The model interprets a wish and explains the result. It cannot write a timetable. The student confirms a preview onto the current timetable or saves it as a new one. Discard leaves the saved timetable unchanged.

## Operating Context

The catalogue is the add-drop workbooks named in `docs/superpowers/specs/2026-11-06-termpilot-mvp-design.md`. The home screen lists the account's timetables with title, last edited time, and section count. Opening one shows chat on the left, the weekly calendar on the right, and search on the calendar side. The interface is for a desktop browser. Type is sized for someone sitting at the screen. Browser zoom covers a closer look. Small-screen editing is out of scope.

## Capabilities and Constraints

Confirmed in the MVP spec:

- Profile stores a major code from `Major & Spec List` and completed course codes. Specialization is not stored. Manual add and planning stay unavailable until that profile is saved. A confirmed empty completed-course list counts as saved. Search works before it is saved.
- A timetable stores a title, a revision number, and selected section identities. A new one starts empty at revision 1, titled "Untitled timetable" unless the student supplies a title.
- Hard rules cover the whole section, overlap, class restriction, and simple prerequisites. They are never relaxed to satisfy a wish. Credits are not checked.
- Calendar search and agent search are the same BM25 function and return the top 10 sections.
- The agent may search, read the profile, read the current timetable, plan, and validate. A turn allows at most 8 tool calls and 30 seconds. A proposal is a preview. Confirm and discard are student actions.
- Three prepared example students are a secondary shortcut. Choosing one replaces the current account's major and completed courses and adds one timetable. It does not delete timetables already saved.
- When the model is unavailable, search, manual add, and the hard-rule checks still work.

UI prototype, confirmed by Lua on 2026-11-07. `docs/ref/App.jsx` is the screen to build. It stays a prototype: demo data, no production accounts.

- Show a credit total on a timetable card, in the editor, and in the proposal review. The add-drop workbook has no credit column, so these numbers come from the prototype's own course data.
- Share copies a link for that timetable. The prototype shows a confirmation and does not send the link anywhere.
- The assistant drafts a plan in the chat. Review shows what would change. Apply to the current timetable, or save as a new timetable, writes it. Discard leaves the saved timetable unchanged.

Screen sequence, confirmed: profile, then the gallery of saved timetables, then one open timetable with chat on the left, the week on the right, and search on the calendar side.

## Brand Commitments

The product name is TermPilot AI. Branding and UI assets are independent of What2Reg.

Lua set the visual direction from the prototype in `docs/ref/App.jsx`, and asked for enhancements where the prototype is weak. The shell stays calm and warm: generous space, soft rounded sheets, restrained chrome, no mascots, and no indigo dashboard. Course blocks on the week and on gallery thumbnails carry a small set of softened colors. A proposal uses the same hue as a lighter, outlined block on the week. Gemini Notebook is a craft reference for the quiet shell, not a brand to copy. Demo catalogue names and credit numbers stay demo data.

## Evidence on Hand

- Behavior spec: `docs/superpowers/specs/2026-11-06-termpilot-mvp-design.md`.
- Approved UI spec: `docs/superpowers/specs/2026-11-07-termpilot-ui-design.md`. Approved theme study: `prototype/theme.html`.
- Catalogue workbooks under `docs/ref/add-drop/`. The major list is on sheet `Major & Spec List`. The schedule is on sheet `Class Information` and contains on the order of 2,500 meeting rows.
- `docs/ref/App.jsx` is the layout reference. It is not ported. No production UI exists yet.
- The three example students are specified and not yet stored as data files.
- Credit totals on screen are demo figures. Do not invent official credit counts, testimonials, enrolment totals, or review quotes. Course comments, pre-enrollment, screenshot import, and a live university login are outside this MVP.

## Product Principles

- A saved timetable changes only when the student adds a section or confirms a preview.
- Hard rules stay visible and are never bent to satisfy a wish.
- Manual construction, a plan from wishes, and revision of a saved timetable are all first-class.
- The student's own major and completed courses come before planning. Prepared examples are a shortcut.
- Design for a desktop browser. Do not spend the visual system on a phone editor.
