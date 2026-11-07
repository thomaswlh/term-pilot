# TermPilot AI — Project Context & Progress

Updated on 2026-11-07 to reflect the implementation progress of TermPilot AI, an independent university timetable planning application developed for CISC3014 (Academic Year 2026/2027, 1st Semester Add-Drop Period).

## Project Overview

TermPilot AI is a desktop web application combining manual timetable construction with conversational AI planning. It allows students to explore course offerings, validate complex university enrolment rules, compare sections on a weekly calendar, and collaborate with an AI planning assistant without risking accidental modifications to saved timetables.

The system is independent of What2Reg branding, UI assets, and dependencies.

## Architecture & Technology Stack

- **Framework:** Next.js 16.4.5 (App Router, Turbopack) & React 19.3.1
- **Styling & UI:** Tailwind CSS v4.3.5 with custom Slate Atelier cool-neutral tokens, shadcn/ui components (`Button`, `Input`, `Dialog`, `DropdownMenu`), Lucide icons
- **Authentication:** Clerk (`@clerk/nextjs`) with email/password authentication, route middleware, and custom account menu integration
- **Storage & Database:** Dual-mode persistence layer
  - **In-Memory Store:** `src/db/server-store.ts` pinned on `globalThis` for zero-configuration local development and deterministic testing
  - **PostgreSQL Store:** `src/db/postgres.ts` backed by `src/db/schema.sql` (Docker Compose setup provided in `docker-compose.yml`)
- **Catalogue & Search:** Local parser (`src/domain/catalogue.ts`) directly ingesting University of Macau 1st Semester 2026/2027 Excel workbooks (`docs/ref/add-drop/`), backed by a custom BM25 retrieval engine (`src/domain/search.ts`)
- **Rules Engine:** Domain constraint validator (`src/domain/rules.ts`) checking section completeness, time collisions, class restrictions, and course prerequisites
- **AI Planning Assistant:** CopilotKit v2 (`@copilotkit/react-core` & `@copilotkit/runtime` 1.85.0) wired to DeepSeek (`deepseek-flash`) via `@ai-sdk/openai`, with headless agent hooks driving custom shadcn AI Elements and Streamdown markdown rendering
- **Testing & Tooling:** Vitest 5.1.0, TypeScript 5, ESLint 9 (`eslint-config-next/core-web-vitals`)

## Key Product Invariants

1. **State Isolation:** AI proposals are strictly ephemeral previews drawn with lighter dashed outlines on the calendar. An AI proposal cannot alter a saved timetable autonomously. Applying to the current timetable or saving as a new timetable requires explicit student confirmation.
2. **Hard Constraints:** Prerequisite checks, schedule conflicts, section completeness, and class restrictions are strictly evaluated. The AI assistant cannot relax rules to satisfy wishes.
3. **Dual First-Class Workflows:** Manual timetable editing (browsing, searching, adding, removing) and AI-assisted conversational planning are both first-class citizens.
4. **Data Privacy & Course Policy:** Real student records remain strictly out of external services. Development uses synthetic profiles and demo email accounts. Secrets are kept server-side and never exposed.

## Implemented Features & Modules

### 1. Student Profile & Example Personas (`/profile`)
- Major code selection and completed course code tracking.
- Three synthetic student shortcuts (FST Computer Science Year 2, FBA Global Business Management Year 1, FAH English Studies Year 3) for instant seeding.
- Unlocks timetable planning once saved.

### 2. Timetable Gallery (`/timetables`)
- Notebook-style card grid inspired by Gemini Notebook.
- Each card displays timetable title, last edited timestamp, demo credit total, and a 7-day Monday–Sunday miniature preview.
- Context menu supporting timetable renaming, public share link generation/copying, and deletion with an accessible modal dialog confirmation.
- Creation of new blank timetables with automatic navigation to the editor.

### 3. Dual-Sidebar Timetable Editor (`/timetables/[id]`)
- **7-Day Weekly Grid:** Monday through Sunday schedule view (08:00–22:00) with stable course hue assignments and conflict ring highlighting.
- **Collapsible Course Discovery Drawer (Right):**
  - Instant BM25 catalogue search for course codes, letter prefixes, and instructor names.
  - Grouped course cards with section matrices, meeting times, and proactive fit/conflict badges.
  - Two-tier preview: hover to peek candidate section on the grid, click to pin with ArrowUp/ArrowDown keyboard stepper.
  - Quick filters (`All`, `Fits schedule`, `Morning`, `Afternoon`).
  - Proposal-lock safety: manual section additions and API mutations are locked out while an AI proposal is open.
- **AI Planning Column (Left):**
  - Resizable and collapsible chat panel with custom width persistence in `localStorage`.
  - Built with shadcn AI Element primitives: message scroller, bubbles, tool call execution traces, and prompt input with mid-reply Stop/Cancel button.
  - Streamdown markdown rendering for assistant explanations.
  - Five bounded tools: `searchSections`, `readProfile`, `readTimetable`, `plan`, and `validate`.
  - Budget enforcement: maximum 8 tool calls and 30-second deadline per turn.
- **Responsive Dual-Sidebar Management:** Mutual auto-collapse on viewports narrower than 1600px to safeguard calendar readability.
- **Proposal Review Bar:** Review open AI proposals, inspect dropped wishes or failure notices, and explicitly `Apply`, `Save as new timetable`, or `Discard`.

### 4. Revocable Public Sharing (`/s/[token]`)
- Generates unguessable share tokens for clean, read-only public timetable views without requiring authentication.
- Owner retains control to stop sharing and revoke access at any time.

## Verification & Test Coverage

- **Automated Test Suite:** 186 unit and integration tests across 32 test files passing (Vitest).
- **Static Analysis:** TypeScript compiler (`tsc --noEmit`) passes with zero errors.
- **Linting:** ESLint (`eslint .`) passes with zero warnings or errors.
- **Production Build:** Next.js production build (`next build`) compiles all static and dynamic routes cleanly with Turbopack.

## Course References & Source Boundaries

- Course Syllabus: CISC3014 Fall 2026.
- Catalogue Workbooks: `docs/ref/add-drop/` containing `Class Schedules for 1st Semester of Academic Year 2026-2027`, `Pre-requisite Requirements`, and `Major and Specialization Codes`.
- Audit Log: All AI prompts, models, and verification steps are maintained in `docs/AI-USAGE.md`.
