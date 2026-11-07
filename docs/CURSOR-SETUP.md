# Cursor setup and verification

Prepared 2026-11-06 for /Users/thomaswu/Workspace/term-pilot.

## What is configured
AGENTS.md supplies portable conventions. One always-on .mdc rule provides short
project context; React/CSS and Python/notebook rules use file globs; the CopilotKit
rule is selected by relevance and can be attached explicitly as @20-agent.
.cursor/mcp.json matches the official shadcn Cursor example. No credentials needed
for the standard public registry. The documented @latest command floats; it is
not an invented or pinned version. After successful connection, record the resolved
CLI version and choose a verified fixed release if team reproducibility requires it.

## Finish in Cursor
1. Open this project directory. Check AGENTS.md and the four rules in Cursor's
   Customize/Rules settings. Keep command/tool approvals enabled.
2. Enable shadcn in Cursor MCP settings. If npx is not found, ensure the GUI can
   access your Node installation; do not paste a teammate-specific absolute path
   into shared config. Node and npx were found in the setup shell only.
3. Verify a connected/green server and visible tools, then ask it to list available
   components. Do not run component installation before app/framework selection.
4. Choose the application framework and package manager, then initialize shadcn
   against its actual aliases/styles/components.json. The default registry needs
   no guessed components.json today.
5. Add CopilotKit only after selecting the runtime/framework and matching package
   versions. Follow the matching official guide; current docs include /v2 APIs.
   Do not mix older examples with newer imports. Configure secrets locally on
   the server and add only required variable names to .env.example at that point.

Configuration JSON and rule metadata can be checked locally. Cursor activation,
MCP handshake, registry access and app build/test remain unverified until run.
This setup has not installed application packages or project-local skill packs,
changed global Cursor settings, created real accounts or initialized Git.

## Optional skill integration
Keep one copy per pack; first inspect Customize and existing global skills.
Current Cursor docs discover ~/.agents/skills, so existing local Anti-Slop skills
may already be visible. Their presence in Codex does not prove Cursor loaded them.
Avoid duplicating them into the project or installing overlapping global copies.

- Superpowers: official README documents /add-plugin superpowers in Cursor Agent
  chat, or marketplace search. Verify the installed entry and available skills.
- Impeccable: official README documents npx impeccable install and a manual copy
  of its Cursor skills build. Select Cursor/project scope in the installer rather
  than assuming flags. Review hook changes before accepting them. Verify the skill
  appears in Cursor; do not assume a historic brainstorm command exists.
- Anti-Slop: official README documents adding its marketplace with
  `agent plugin marketplace add https://github.com/miqdadbadjuber/anti-slop`,
  then installing antislop in Customize. Prefer existing verified skills if loaded.
  Resolve its during/after mode explicitly when invoked. No Anti-Slop pointer or
  vendored skill payload is installed by this setup.

Superpowers handles engineering requirements, plans, debugging and verification.
Impeccable handles frontend design and critique against the shared product brief.
Anti-Slop provides focused quality checks. Avoid three independent discovery loops.
Pack instructions never override user direction, assessment policy or permissions.

## Official sources checked
- Cursor rules: https://cursor.com/docs/rules
- Cursor MCP: https://cursor.com/docs/mcp
- Cursor skills: https://cursor.com/docs/skills
- shadcn MCP: https://ui.shadcn.com/docs/mcp
- CopilotKit quickstart: https://docs.copilotkit.ai/quickstart
- CopilotKit frontend tools: https://docs.copilotkit.ai/frontend-tools
- Superpowers: https://github.com/obra/superpowers
- Impeccable: https://github.com/pbakaus/impeccable
- Anti-Slop: https://github.com/miqdadbadjuber/anti-slop
