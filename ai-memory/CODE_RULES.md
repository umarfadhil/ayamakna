# Code Rules

## Architecture
- Follow 3-layer separation: Linguistic → Semantic → Visualization.
- Engine code (`src/engine/`) must be pure functions with no UI dependencies.
- Each engine has its own `types.ts`, implementation files, and `index.ts` barrel export.
- `semanticStore.ts` is the single orchestrator connecting data → engines → graph.
- Precompute heavy semantic work on first load, cache in IndexedDB.

## TypeScript
- Use strict TypeScript interfaces for all data models.
- Use discriminated unions and literal types for enums (POS, LinkType, ActorType, Tense, SemanticMode).
- Avoid `any`. Prefer explicit types.

## React & UI
- Use React functional components and hooks.
- Use `useMemo` for expensive computations (graph data, stats).
- Use absolute imports with `@` alias for `src`.
- Style with Tailwind CSS utility classes.
- D3 for graph logic (Canvas-based, not SVG). Use spatial indexing for hit testing.
- Keep routes and providers in App.tsx.

## Data
- All data stored in **Supabase** (tables prefixed `ayamakna_`). App fetches on startup.
- Supabase client in `src/lib/supabase.ts`, data fetcher in `src/lib/dataLoader.ts`.
- Verse IDs: `surahId:ayahNumber` (e.g., `2:255`).
- Word IDs: `verseId:wordIndex` (e.g., `2:255:3`).
- Root lookup keys must be diacritics-stripped (critical bug fix).
- Static data files (`src/data/`) retained for seed script, NOT imported by app.

## Performance
- Precompute semantic links, don't compute at render time.
- Cache computed results with 24h TTL in IndexedDB.
- Treat empty/invalid cache payloads as stale for large corpus loads; clear and recompute.
- Bump IndexedDB `DB_VERSION` when cache compatibility/invalidation behavior changes.
- Use SpatialGrid for O(1) node hit testing in the graph.
- Debounce graph recalculations.
- Use Jaccard similarity for all set-based scoring.

## Actor Classification & Semantic Tagging
- Actor types use deterministic root/text indicator sets — no AI inference.
- Priority order for actor classification: divine > prophet > shaytan > angel > hypocrite > believer > disbeliever > mankind > human (fallback).
- Semantic clusters and polarity mappings are defined in `actionDictionaries.ts` as pure data dictionaries.
- New verb roots should be added to `ACTION_CLUSTER_MAP` and `ACTION_POLARITY_MAP` when extending coverage.
- Enriched ActionEdge fields (`verbText`, `englishMeaning`, `rootFrequency`, `semanticCluster`, `polarity`) are populated at precompute time, not at render time.
- `computeActionSummary()` is a pure function that works at any aggregation level (verse, concept, global).

## General
- Avoid magic values; use constants and enums.
- Keep business logic in engine and store files, UI logic in components.
- Document complex algorithms with inline comments.
- No over-engineering — build what's needed now.
