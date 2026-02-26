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

## Two-Layer Root Intelligence
- **Service A (Linguistic)** MUST only read from `ayamakna_verse_tokens` data. No concept/graph access. Returns `{ roots: string[] }`. File: `src/services/linguistic/linguisticService.ts`.
- **Service B (Semantic)** takes root list from Service A as input. Reads `ayamakna_root_concepts` + `ayamakna_concept_graph_edges`. File: `src/services/semantic/semanticDomainService.ts`.
- Every `SemanticDomain` MUST have a complete `trace: { from_root, via_concept, relation_strength }`. Domains missing trace fields are rejected before return.
- `from_root` in trace MUST be in the Service A root list — validated by `isTraceValid()`.
- Graph traversal in Service B is depth=1 ONLY (root→concept→neighbor). Never traverse deeper.
- No cross-leakage: Service A never imports from Service B or concept/semantic engine files. Service B never reads verse text directly.
- `validateDomains()` should be called in dev mode to catch violations.
- Service B output (SemanticDomainCard / AI-inferred domains) is NOT displayed in VerseDetail — it was removed. Service A roots are the sole root display.

## Search
- `getVerseSearchTokensForMode(verseId, mode)` builds mode-specific tokens for graph node highlighting.
- Root/similarity mode: root translations + root keywords (Service A roots) + verse EN + verse ID translations.
- Root source MUST be `getVerseLinguisticRoots(verseId)` (Service A), NOT `_tokenizedVerseMap`, to stay consistent with VerseDetail badge display.
- `isHighlighted(node)` in SemanticGraph splits the query on spaces and uses AND logic — all words must match.
- Animated typing placeholder in root mode (`useTypingPlaceholder`) cycles through `ROOT_PLACEHOLDER_WORDS` with pauseMs=9000 (~10s per word); returns `{display, currentWord}` — `currentWord` is non-empty only during the pause phase.
- `effectiveSearchQuery` in Index.tsx = `placeholderWord.toLowerCase()` when no user search is active in root mode; passed to SemanticGraph as `searchQuery` to auto-highlight matching nodes.
- **Search edges**: when `searchQuery` is active AND `isolatedNodes.length > 0`, SemanticGraph auto-generates dashed cyan edges between matched isolated nodes and their K=5 nearest matched neighbors. Edges are purely visual (not in D3 sim), fade in on query change, recompute positions every 60 frames. Matched isolated nodes that are edge endpoints render with cyan tint + radius 4.5.

## Concept Mode Graph Morphology (Two-Level Hierarchy)
- Concept mode uses TWO-LEVEL structure: Verse → Concept → Domain. Domain is the visual cluster unit.
- Node color = `hsla(domain_hue, sat, lightness, 0.9)` where lightness = `35% + (domain_order-1)*8%`. Darker = more central concept within domain.
- `getPrimaryCluster()` in concept mode MUST return `domain_id` (not `conceptId`) for radial layout to work.
- Concept links are precomputed as `ayamakna_concept_verse_links` (pure concept Jaccard). Do NOT reuse `similarityLinks` for concept mode.
- `_conceptFocusLevel` controls minimum similarity threshold: `broad=0.15`, `focused=0.30`, `deep=0.48`.
- `ConceptDomain` interface: `{ id, name, nameId, description, colorHue, displayOrder }`.
- `ayamakna_concepts` table has `domain_id` + `domain_order` columns (FK to domains table).
- Radial cluster force: concept mode uses same pattern as root mode — nodes pulled toward domain's angular position on ring (RADIAL_RADIUS=320).

## Root Mode Graph Morphology
- Root verse connections require: shared root AND that root maps to a semantic cluster in `ayamakna_root_concepts` (via `_rootConceptMap`). Unmapped roots are skipped.
- Root links are precomputed and stored in `ayamakna_root_verse_links`; fetched at startup and passed to `runPrecompute()` as `preloadedRootLinks` (skips client-side `autoLinkByRoot()`).
- Node size in root mode: `4 + min(sharedRootsCount / 40, 1) × 20` (sum of sharedRootsCount across all root edges touching the node).
- Node color in root mode: `getRootFrequencyColor(rootVerseFrequency)` — grey (≥500 verses, common root), light gold (≥150), gold/amber (≥40), brown (<40, rare root).
- Edge thickness in root mode: `0.5 + min(sharedRootsCount, 12) × 0.35`.
- Edge spring: distance = `max(35, 200 × (1 − strength × 0.85))` in root mode (high similarity → nodes closer).
- Radial cluster layout: custom alpha-based D3 force pulls each node toward its `semanticCluster` angular position (RADIAL_RADIUS=320, strength=0.035×alpha). Only active in root mode.

## General
- Avoid magic values; use constants and enums.
- Keep business logic in engine and store files, UI logic in components.
- Document complex algorithms with inline comments.
- No over-engineering — build what's needed now.
