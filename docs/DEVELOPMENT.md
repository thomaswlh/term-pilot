# TermPilot AI — Development Workflow

## Project Boundaries & Ethics
Read `AGENTS.md` and `docs/PROJECT.md` before making substantive changes. Ensure full compliance with course academic integrity standards:
- Record all model usage, prompts, and verification evidence in `docs/AI-USAGE.md`.
- Never commit real student records, credentials, or private keys.
- Keep secrets server-side and configure local environment variables in `.env.local` using `.env.example` as a template.
- AI proposals must remain strictly isolated from saved state until student confirmation.

## Architecture Overview

- **Framework:** Next.js 16.4.5 (App Router, Turbopack), React 19.3.1, Tailwind CSS v4.3.5
- **Authentication:** Clerk (`@clerk/nextjs`) with route middleware protecting `/timetables`, `/profile`, and timetable editor routes. `/s/[token]` is public read-only.
- **Persistence:** Dual-store pattern. When `DATABASE_URL` is unset, `src/db/server-store.ts` provides a global in-memory store. When `DATABASE_URL` is configured, `src/db/postgres.ts` connects to PostgreSQL (schema in `src/db/schema.sql`).
- **Catalogue:** `src/domain/catalogue.ts` loads UM 1st semester 2026/2027 workbooks from `docs/ref/add-drop/`.
- **Search Engine:** `src/domain/search.ts` provides in-memory BM25 retrieval over section codes, prefixes, and instructor names.
- **Rules Engine:** `src/domain/rules.ts` evaluates prerequisites, class restrictions, schedule collisions, and section completeness.
- **CopilotKit Agent:** `@copilotkit/react-core` and `@copilotkit/runtime` 1.85.0 connected to DeepSeek `deepseek-flash` (`https://api.deepseek.com`) via `@ai-sdk/openai`. Five tools: `searchSections`, `readProfile`, `readTimetable`, `plan`, and `validate`. Budget: max 8 calls / 30s per turn.
- **UI Components:** Custom shadcn/ui compositions (`button`, `input`, `dialog`, `dropdown-menu`) and custom AI chat elements (`src/components/ai/`) with Streamdown markdown rendering.

## Verification Commands

Use the verified npm scripts from `package.json`:

```bash
# Run unit and integration tests (Vitest)
npm test

# Run TypeScript type check
npm run typecheck

# Run ESLint check
npm run lint

# Build for production (Next.js with Turbopack)
npm run build

# Start local development server
npm run dev
```

Run all verification checks prior to committing changes:

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

## Testing Conventions

- **Deterministic Tests:** Tests run in-memory without requiring network connectivity or external databases. PostgreSQL integration tests in `tests/postgres-store.test.ts` automatically skip when `DATABASE_URL` is not set.
- **Constraint Testing:** Validate section combinations, prerequisite rules, time overlaps, and proposal lifecycle (preview, apply, save-as-new, discard).
- **Agent Mocking:** Model and tool responses are mocked in tests to guarantee deterministic evaluation, budget limits, and error handling.

## Review and Handoff

- Record all AI interactions and tool invocations in `docs/AI-USAGE.md`.
- Ensure all automated checks pass before handoff.
- Verify that credentials and development dotfiles (`.env.local`, `.cursor`, `.agent`, `.impeccable`, etc.) are untracked and excluded by `.gitignore`.
