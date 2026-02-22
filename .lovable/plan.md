

# Persist Action Intelligence to Supabase

## Overview
Create a new `ayamakna_action_edges` table in Supabase to store precomputed action intelligence for all 6236 verses. The app will load action edges from Supabase instead of recomputing them client-side, significantly reducing initial load time.

## What Changes

### 1. New Supabase Table: `ayamakna_action_edges`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | Format: `action:{verseId}:{wordId}` |
| `verse_id` | `text` NOT NULL | FK to `ayamakna_verses.id` |
| `actor_type` | `text` NOT NULL | One of 10 actor types |
| `action_root` | `text` NOT NULL | Arabic root of the verb |
| `target_type` | `text` | Actor type or raw root/text |
| `tense` | `text` NOT NULL | past/present/future/imperative |
| `verb_text` | `text` NOT NULL | Actual Arabic verb word |
| `english_meaning` | `text` | From root translations |
| `root_frequency` | `integer` | Corpus-wide count |
| `semantic_cluster` | `text` | One of 10 clusters or null |
| `polarity` | `text` NOT NULL | positive/negative/neutral |

- RLS enabled with public SELECT-only policy (same pattern as other tables).

### 2. Seed Script: `scripts/seed-action-edges.mjs`

- Loads verses, root lookups, and root translations from Supabase.
- Runs the tokenizer + action engine (same logic as client-side) in Node.js.
- Inserts all action edges into `ayamakna_action_edges` in batches.
- Run once after table creation; requires temporary INSERT policy.

### 3. Data Loader Update (`src/lib/dataLoader.ts`)

- Add `fetchAll` call for `ayamakna_action_edges`.
- Map to `ActionEdge[]` and include in `LoadedData`.

### 4. Store Update (`src/store/semanticStore.ts`)

- Accept preloaded action edges from Supabase data.
- Skip `buildActionIndex()` in precompute when Supabase action edges are available.
- Still run `autoLinkByAction()` on the loaded edges for graph linking.
- Action queries (`getVerseActions`, `getActionsByCluster`, etc.) work unchanged -- they read from `_semanticCache.actionEdges` which is now Supabase-sourced.

### 5. Precompute Pipeline Update (`src/engine/semantic/precompute.ts`)

- Accept optional pre-built action edges parameter.
- When provided, skip `buildActionIndex()` and use the supplied edges directly.
- Bump `DB_VERSION` to 8 to invalidate stale IndexedDB cache.

### 6. Supabase Types Update (`src/integrations/supabase/types.ts`)

- Add `ayamakna_action_edges` table type definition.

### 7. Memory Files Update

- `PROJECT_OVERVIEW.md`: Add `ayamakna_action_edges` table to data pipeline section.
- `FILEMAP.md`: Add seed script entry.
- `SESSION_LEARNINGS.md`: Document the migration.
- `CODE_RULES.md`: No changes needed (existing rules already cover this pattern).

## Technical Details

```text
Current flow:
  Supabase fetch --> tokenize --> buildActionIndex() --> cache
                                  (client-side, ~2-3s)

New flow:
  Supabase fetch (incl. action_edges) --> use directly --> cache
                                          (0ms compute)
```

- Expected row count: ~15,000-25,000 action edges (one per verb occurrence across 6236 verses).
- The seed script reuses the same deterministic engine logic, ensuring consistency.
- `autoLinkByAction()` still runs client-side since verse links are graph-specific and lightweight.

