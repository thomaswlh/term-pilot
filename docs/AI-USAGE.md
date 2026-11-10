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
