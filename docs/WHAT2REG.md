# What2Reg community reviews

TermPilot reads public course opinions from the official What2Reg @ UM (澳大選咩課) MCP at `https://umeh.top/mcp`. It does not scrape `umeh.top`, does not bulk-export the comment bank, and does not read official University of Macau teaching evaluations.

The add-drop catalogue, hard registration rules, and `rankAdditions` still decide what is legal and what is prioritized. Reviews are notes about what a course is like.

## Authorization

Each student connects their own What2Reg account. The OAuth authorization server is What2Reg's Clerk instance, `https://clerk.umeh.top`, as advertised by `https://umeh.top/.well-known/oauth-protected-resource/mcp`.

- Scope: `umhelper:read` (required). TermPilot also requests `offline_access` because the authorization server documents the refresh-token grant.
- Flow: authorization code with PKCE (`S256`) and the resource indicator `https://umeh.top/mcp`.
- Consent page: What2Reg hosts it at `/oauth-consent`.
- Callback: `/api/what2reg/callback`.
- The access token and refresh token are stored for the signed-in Clerk user. They are never sent to the browser.
- Disconnect calls the revocation endpoint and deletes the local grant.
- In production, `WHAT2REG_TOKEN_KEY` is required before a grant can be saved. With Postgres, the grant is stored sealed in `what2reg_grants`. Without `DATABASE_URL`, it stays in the server process.

If the student has not connected, or authorization fails, timetable planning still works and reviews are absent. The course card links to `/what2reg` ("Connect 選咩課").

## Lookups, cache, and limits

Lookups happen only for a course the student has opened or for at most four courses just ranked into a proposal.

- `get_course` supplies grade, difficulty, and usefulness (`reward` in the MCP schema).
- `get_course_reviews` reads the first page only, at most five summaries, for at most three instructors on an open card and one instructor during planning.
- TermPilot does not follow `hasMore`. The card links to the original page instead.
- Successful lookups, including an empty public page, are cached for 24 hours. Errors are not cached.
- What2Reg's own limits are 60 calls per user per minute and 300 calls per tool per hour. A failure, a 401, a 403, or a 429 becomes "reviews unavailable". The proposal and the manual editor keep working.
- The assistant tool `readReviews` may run at most four times per turn, inside the existing tool budget. It returns the raw review page and, when understanding succeeded, a structured summary. The model is told to rewrite that summary for the student's question and must not drop a legal compulsory or required course.

## Understanding and request-specific reports

After a successful lookup, TermPilot may ask DeepSeek (`deepseek-flash` at `https://api.deepseek.com`, the same host as the planning assistant) for a JSON reading of the comments. The server keeps only pros and cons whose `groundedIn` text appears in a returned review. Grade, difficulty, and usefulness impressions come from the numeric scores. Uncertainty is `small-sample` when fewer than three comments came back, and `conflict` when comments disagree. That object is cached with the review text for 24 hours, so opening the same card does not call the model again.

The course card shows a short blurb from that object, then the raw comments, with the same attribution. Proposal notes use `rewriteForRequest` when `plan.reviewQuestion` is set, so a question about workload and a question about passing do not share one paragraph. A required course still only gains a note that the opinion does not remove it.

If `DEEPSEEK_API_KEY` is missing, or the model call fails or returns JSON that cannot be read, understanding is omitted. Raw reviews still show when the MCP lookup succeeded. Search, rules, and planning keep working. The model is not given a made-up summary.

## Attribution

The interface names the source as 澳大選咩課 / What2Reg @ UM and states that the opinions are not official University of Macau statements. Links are limited to `https://umeh.top/` and `https://www.umeh.top/`. TermPilot does not reuse What2Reg logos or other branding.

## Environment

Copy the placeholders in `.env.example`. Register `WHAT2REG_REDIRECT_URI` on the What2Reg OAuth client. No production secret is stored in this repository.

| Variable | Purpose |
| --- | --- |
| `WHAT2REG_CLIENT_ID` | OAuth client id from What2Reg |
| `WHAT2REG_CLIENT_SECRET` | OAuth client secret. Server only. |
| `WHAT2REG_REDIRECT_URI` | Callback URL, for example `http://localhost:3000/api/what2reg/callback` |
| `WHAT2REG_TOKEN_KEY` | Seals stored grants. Required in production. |
| `WHAT2REG_MCP_URL` | Defaults to `https://umeh.top/mcp` |
| `WHAT2REG_AUTHORIZATION_ENDPOINT` | Defaults to `https://clerk.umeh.top/oauth/authorize` |
| `WHAT2REG_TOKEN_ENDPOINT` | Defaults to `https://clerk.umeh.top/oauth/token` |
| `WHAT2REG_REVOCATION_ENDPOINT` | Defaults to `https://clerk.umeh.top/oauth/token/revoke` |
| `WHAT2REG_SCOPE` | Defaults to `umhelper:read offline_access` |
| `WHAT2REG_RESOURCE` | Defaults to `https://umeh.top/mcp` |

Leaving the client id or secret empty disables connect. Search, rules, and planning keep working.
