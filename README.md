# TermPilot AI

TermPilot AI is an independent desktop university timetable planning tool built for the University of Macau 2026/2027 1st Semester add-drop period (CISC3014). It enables students to browse course offerings, validate enrolment rules, organize weekly schedules on an interactive calendar, and brainstorm with an AI planning assistant without risking unintended changes to their saved timetables.

## Key Features

- **Catalogue Ingestion & Fast Search:** Parses official Excel semester schedules directly, providing in-memory BM25 search for course codes, prefixes, and instructors.
- **Rules & Constraint Engine:** Strictly validates section completeness, time collisions, class restrictions, and prerequisite requirements.
- **Dual-Sidebar Timetable Workbench:**
  - **7-Day Calendar Grid:** Monday through Sunday schedule view (08:00–22:00) with stable course hues and visual conflict rings.
  - **Course Discovery Drawer (Right):** Grouped course sections with meeting times, proactive fit/conflict badges, two-tier preview (hover to peek, click to pin), keyboard stepper, quick filters, and proposal-locked mutation prevention.
  - **AI Planning Assistant (Left):** DeepSeek `deepseek-flash` via CopilotKit v2 with custom shadcn AI Elements (chat scroller, messages, bubbles, prompt input with mid-reply stop control, and tool call traces) and Streamdown markdown rendering. Five bounded agent tools with an 8-call and 30-second budget.
  - **Responsive Layout:** Mutual auto-collapse of sidebars on viewports < 1600px to keep the timetable legible.
- **Safe Proposal Flow:** AI proposals are ephemeral previews drawn with lighter dashed outlines. Student confirmation (`Apply`, `Save as new timetable`, or `Discard`) is strictly required before changing any saved timetable.
- **Timetable Gallery:** Notebook-style cards with title, last edited timestamp, credit totals, 7-day miniatures, deletion with modal confirmation, and blank timetable creation.
- **Student Profile & Synthetic Personas:** Manage major code and completed courses, or seed immediately with three synthetic example students.
- **Revocable Public Sharing:** Generate read-only `/s/[token]` URLs with owner revoke functionality.

## Prerequisites

- Node.js (v20+ recommended) and npm
- Docker (optional, only needed if running local PostgreSQL storage)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Set your Clerk development keys in `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Use demo email accounts for local development. Never enter real student records. Never commit `.env.local` to version control.

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your desktop browser. All routes except `/sign-in`, `/sign-up`, and public share links `/s/[token]` require authentication.

## Optional Configuration

### Persistent PostgreSQL Database

By default, the application runs with an in-memory store (`src/db/server-store.ts`) when `DATABASE_URL` is not set. In-memory data resets when the server restarts.

To run with persistent PostgreSQL storage:

1. Start the PostgreSQL container:

   ```bash
   docker compose up -d
   ```

   This launches PostgreSQL 16 on port 5432 with database `termpilot`, user `postgres`, and password `postgres` as configured in `docker-compose.yml`.

2. Set `DATABASE_URL` in `.env.local`:

   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/termpilot
   ```

3. Initialize the database schema:

   ```bash
   psql postgres://postgres:postgres@localhost:5432/termpilot -f src/db/schema.sql
   ```

### AI Planning Assistant

To enable conversational planning with CopilotKit in the editor, set a DeepSeek API key in `.env.local`:

```env
DEEPSEEK_API_KEY=sk-...
```

The assistant connects to DeepSeek `deepseek-flash` via `@ai-sdk/openai` Chat Completions. Keep this key server-side.

If `DEEPSEEK_API_KEY` is not set, the chat interface displays:
> "The assistant is unavailable. Search and manual add still work."

Catalogue search, manual timetable creation, constraint validation, and proposal actions remain fully functional without an API key.

## Verification and Testing

Run the verification commands:

```bash
npm test          # Run Vitest test suite (186 tests)
npm run typecheck # Run TypeScript compiler check (tsc --noEmit)
npm run lint      # Run ESLint check (eslint .)
npm run build     # Verify production Next.js build
```

Tests run in memory and do not require Docker or an active database connection.

## Documentation and References

- [docs/PROJECT.md](docs/PROJECT.md): Project overview, architecture, feature inventory, and course boundaries.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): Workflow guidelines, verified scripts, and resolved package versions.
- [PRODUCT.md](PRODUCT.md): Core product vision, positioning, and student user journeys.
