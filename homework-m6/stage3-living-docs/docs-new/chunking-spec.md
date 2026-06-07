# Chunking Spec — `docs/project-data/` → `docs/chunks.jsonl`

Specification followed by chunking subagents to convert the markdown corpus in
`docs/project-data/` into vector-DB-ready chunks. The output is a single
JSONL file at `docs/chunks.jsonl`, one JSON object per line.

## 1. Target chunk sizing

Token counting uses the rough heuristic **1 token ≈ 4 characters** (good
enough for sizing; the exact tokenizer of the embedding model is not
material here).

| Bound | Tokens | Chars | Purpose |
|---|---|---|---|
| Target | ~400 | ~1600 | Default aim when packing paragraphs |
| Soft max | 600 | ~2400 | Above this, split |
| Soft min | 150 | ~600 | Below this, try to merge with adjacent sibling |
| Hard floor | none | — | A semantically complete tiny section (e.g. an ADR `Status:` block) may be left small if merging hurts coherence |

## 2. Splitting algorithm (semantic, top-down)

1. **Parse** the markdown file into a heading tree: `H1 → H2 → H3 (→ H4 if present)`.
   The `H1` is the file title. Content before the first `H2` (the
   "preamble", e.g. deprecation notice, intro paragraph) is treated as a
   virtual section with `parent_headings: []`.
2. **Walk leaf sections** (deepest heading + the content directly under it).
   For each leaf section:
   - If `tokens ≤ 600` → emit as **one chunk**, no splitting.
   - If `600 < tokens ≤ 1200` and the section contains `H3` (or `H4`) subheadings
     → split at those subheading boundaries; recurse into each subsection.
   - If `tokens > 1200` **or** the section has no internal subheadings → split
     by paragraph boundaries (blank line `\n\n`), greedily accumulating
     paragraphs until adding the next would exceed ~500 tokens. Start a new
     chunk and continue.
3. **Merging small siblings.** If two consecutive sibling sections each
   carry `tokens < 150` and share the same parent heading, merge them into
   one chunk. This commonly applies to short ADR sections
   (`Status`, `Date`, `Decision Makers`).
4. **Atomic units — never split inside**:
   - Fenced code blocks (```` ``` ... ``` ````).
   - Markdown tables (consecutive `|` lines).
   - Bullet or numbered lists up to ~400 tokens (treat the whole list as one unit
     when accumulating paragraphs; if the list alone exceeds 400 tokens, split
     between list items, never inside one item).
   - If a single atomic unit alone exceeds the soft max (600 tokens) — emit it
     anyway as one oversize chunk and record it in `report.md` under
     "oversize chunks".

## 3. Overlap

**Default: no overlap.** Semantic boundaries (heading / paragraph) already
preserve context.

**Exception:** when step 2 falls into the "split by paragraph" branch
(section > 1200 tokens or no subheadings), prepend the **last sentence** of
the previous chunk to the next chunk as overlap. This prevents cutting a
sentence mid-thought.

Overlap is therefore reserved for the rare long-text case, not used by default.

## 4. Breadcrumb prefix in `text`

The chunk's `text` field begins with a single breadcrumb line, then a blank
line, then the actual section content. The breadcrumb form:

```
# {title} > {H2} > {H3}
```

(omit segments that don't apply; the preamble of a file becomes just
`# {title}`). The original H1/H2/H3 headings inside the section content are
**preserved** below the breadcrumb. The breadcrumb is duplicated separately
in `metadata.parent_headings`, so downstream consumers can use either.

## 5. Metadata schema

Each line in `chunks.jsonl` is a JSON object with exactly these fields:

```jsonc
{
  "text": "string — breadcrumb + section markdown",
  "metadata": {
    "chunk_id":            "string — <path-slug>__NNN, e.g. 'features_checkout__003'",
    "source_file":         "string — basename, e.g. 'checkout.md'",
    "file_path":           "string — path relative to docs/project-data/, e.g. 'features/checkout.md'",
    "title":               "string — H1 of the file",
    "parent_headings":     ["string", ...],   // H2/H3 chain leading into this chunk; [] for preamble
    "kind":                "string — see Section 6",
    "keywords":            ["string", ...],   // 3-7 lowercased terms, agent-extracted
    "summary":             "string — ONE sentence describing what this chunk covers",
    "language":            "en" | "ru" | "mixed",
    "chunk_index":         1,                 // 1-based, per file
    "total_chunks_in_file": 7
  }
}
```

### `chunk_id` rules

- Slug = `file_path` lowercased, with `/` and `.md` replaced: `features/checkout.md → features_checkout`, `architecture.md → architecture`, `adrs/adr-001-mongodb-vs-postgres.md → adrs_adr-001-mongodb-vs-postgres`.
- Suffix = `__` + zero-padded 3-digit chunk index (`001`, `002`, …).
- Example: `features_checkout__003`.

### `language` detection

- File `features/checkout.md` and `features-analysis-ru.md` → `ru`.
- `glossary.md` mixes EN terms with RU explanations → `mixed` (decide per chunk).
- All others → `en`. Agent should sanity-check per chunk: if the chunk's prose is dominated by Cyrillic → `ru`; if it has substantial content in both → `mixed`; otherwise `en`.

### `keywords` and `summary`

- Agent generates both. `summary` is one sentence (≤ 25 words) describing
  what this chunk is *about*, not what's in it verbatim. Examples:
  - "How the multi-step checkout progress indicator is implemented and which screens enable which steps."
  - "Decision and rationale for choosing MongoDB over PostgreSQL at project start."
- `keywords`: 3-7 short lowercased tokens; prefer domain terms over
  generic words. No stopwords. Examples: `["jwt", "auth", "middleware", "bearer-token"]`.

## 6. `kind` taxonomy (by source folder / file)

| Source | `kind` |
|---|---|
| `adrs/*.md` | `adr` |
| `api/*.md` | `api` |
| `features/*.md` | `feature` |
| `pages/*.md` | `page` |
| `runbooks/*.md` | `runbook` |
| `incidents/*.md` | `incident` |
| `architecture.md` | `architecture` |
| `best-practices.md` | `best-practice` |
| `glossary.md` | `glossary` |
| `dev-history.md` | `history` |
| `feature-flags-spec.md` | `spec` |
| `features-analysis-ru.md` | `feature` |

`features.json` is **excluded** from this pass.

## 7. Output format

- Path: `docs/chunks.jsonl`.
- One JSON object per line, no trailing comma, no surrounding array, UTF-8,
  ASCII-safe escaping not required (preserve Cyrillic as-is).
- Ordering: by `file_path` (lexicographic), then by `chunk_index` ascending.
- Subagents write per-category files into `tmp/chunks/<category>.jsonl`;
  the orchestrator concatenates them in deterministic order.

## 8. Things to record in `report.md`

- Total chunks, total files, mean/min/max chunk tokens.
- Distribution by `kind`.
- Distribution by `language`.
- Oversize chunks (> 600 tokens) — list `chunk_id` and reason (typically a
  single large code block or table).
- Undersize chunks (< 150 tokens) that weren't merged — list and reason.
- Any files where the chunker had to fall back to paragraph splitting
  (i.e. used the overlap branch).
