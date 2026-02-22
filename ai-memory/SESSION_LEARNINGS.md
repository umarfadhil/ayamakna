# Session Learnings

## Full-Scale Implementation Complete
- Project fully transformed from topic-based graph to **Qur'anic Semantic Intelligence System**.
- All 3 layers implemented end-to-end: data → engines → store → graph → UI.
- Scaled from 35 curated verses to **all 6236 verses** across 114 surahs.
- Build passes cleanly (`tsc --noEmit` + `vite build`).

## Supabase Migration (Latest)
- **Active project**: `pkwvovoiljwjjgbythsp` ("AyaMakna"), region: ap-south-1, org: jgizbjemqbzcgnrzygjy.
- Tables: `ayamakna_surahs` (114), `ayamakna_verses` (6236), `ayamakna_root_lookups` (11682), `ayamakna_concepts` (29), `ayamakna_verse_concepts` (9092).
- RLS enabled with public SELECT-only policies. No INSERT policies (seeding done via MCP execute_sql or temp policies).
- App loads data async from Supabase on startup, then runs semantic engines.
- **Bundle size reduced from 3.1MB → 687KB** (data no longer bundled).
- Loading screen shown while fetching from Supabase + computing semantic cache.
- Seed script: `scripts/seed-supabase.mjs` — run `node scripts/seed-supabase.mjs` to re-seed.
  - Re-seeding requires temp INSERT policies — add via MCP migration, seed, then drop.
- Old project `tlkykpcznaieulbwkapc` (Petalytix org) is a different restaurant POS app — do not use.
- **MCP access**: project `.mcp.json` uses stdio Supabase MCP with personal access token.
- **Anon key**: `[REDACTED_SUPABASE_ANON_KEY]`

## Bug Fix: No Nodes (All Modes) — New Project Had No Data
- **Root cause**: `supabase.ts` pointed to new project (`pkwvovoiljwjjgbythsp`) which had no tables/data.
- **Fix**: Created tables via MCP migration + seeded all data. Bumped IndexedDB `DB_VERSION` 2→3 to invalidate stale empty cache.
- **Secondary cause**: Old key `sb_secret_*` was a secret key (not anon). Fixed to proper JWT anon key.

## Bug Fix: Root Lookup Diacritics Mismatch
- **Root cause**: `createRootLookupMap()` returned keys WITH diacritics, but tokenizer looked up with stripped keys → 0 root matches → 0 links → empty graph in all modes.
- **Fix**: Strip diacritics from keys in `createRootLookupMap()` and in `dataLoader.ts`.
- **Cache invalidation**: Bumped IndexedDB `DB_VERSION` from 1 → 2 to force recomputation.

## Data Pipeline (Full Quran)
- **6236 verses** from 114 surahs — Arabic (Uthmani) + English (Sahih International).
- **11,682 root lookup** entries extracted from Quranic Arabic Corpus morphological data.
- **29 concepts** with **9,092 verse-concept associations** covering 4,491/6,236 verses.
- Auto-generated via `scripts/generate-corpus.mjs` using:
  - `api.alquran.cloud` for Arabic text + English translation.
  - `mustafa0x/quran-morphology` GitHub repo for morphological data (ROOT, LEM, POS).
- Concept tagging uses `ROOT_TO_CONCEPT` mapping: roots → concept IDs algorithmically.

## Scale Optimizations
- **Root linking**: Inverted index approach — O(R × V_r²) instead of O(n²). Skips roots in >500 verses.
- **Similarity**: Sparse candidate-pair approach using root index. Caps at 15,000 results. Threshold 0.3.
- **Contrast detection**: Root→verse index for O(1) lookups. Caps at 200 links per contrast pair.
- **Action linking**: Caps at 5,000 total links. Skips patterns with >200 verses.
- **Cache**: IndexedDB for computed semantic results (24h TTL).
- **Graph rendering**: Only shows nodes with edges in the current mode (not all 6236).
- **Async init**: `initSemanticEngine()` fetches Supabase → IndexedDB cache → computation fallback.

## Engine Design
- **Root extraction**: lookup table first, heuristic prefix/suffix stripping fallback.
- **POS classification**: pattern-based heuristic (mudari' prefix detection, particle/pronoun sets).
- **Similarity scoring**: weighted Jaccard — root (0.5) + concept (0.3) + verb pattern (0.2).
- **Contrast detection**: 17 predefined opposing root pairs across categories.
- **Action modeling**: classifies actor type + tense + target using context-window heuristic.
- **Precompute pipeline**: runs all engines, caches to IndexedDB. Slim cache (rootIndex rebuilt fresh).

## Graph & Visualization
- **SemanticGraph**: D3 Canvas with SpatialGrid for O(1) hit testing.
- **Cluster-based coloring**: nodes colored by primary cluster per mode.
- **Edge coloring by linkType**: gold (root), blue (concept), red (contrast), green (action).
- **5 semantic modes**: Root, Concept, Action, Contrast, Similarity — toggled via top bar.
- **VerseDetail panel**: slide-in right panel showing Arabic text, translation, concepts, actions.

## Known Issues
- CSS `@import` warning (non-blocking) — font import should precede other statements.
- First load requires Supabase fetch + semantic computation (can take several seconds).

## Legacy Code
- `graphStore.ts`, `ForceGraph.tsx`, `ReadingMode.tsx`, `AdminPanel.tsx` — still exist but unused.
- Static data files (`quranVerses.ts`, `rootLookup.ts`, `conceptTags.ts`, `quranData.ts`) still exist for seed script but no longer imported by the app.

## Indonesian Translation Seeding
- Column `text_translation_id TEXT` added to `ayamakna_verses`.
- Source: `api.alquran.cloud/v1/quran/id.indonesian` (Kemenag edition, all 6236 verses in one request).
- Seeded via `scripts/seed-id-translation.mjs` — fetches all, batch updates 30 concurrent `.update().eq('id',...)` calls.
- **Upsert pattern fails** when row already exists and partial columns violate NOT NULL constraints. Use `.update().eq()` instead.
- Temp UPDATE policy needed for seed (anon key has SELECT-only by default). Add, seed, drop.
- Temp INSERT policy is NOT needed when using `.update()` (only needed for `.upsert()`).
- `VerseDetail.tsx` shows Indonesian section `{verse.textTranslationId && (...)}` between English and Concepts.

## Latin/Keyword Search via searchTokens
- Added `searchTokens?: string[]` to `GraphNode` — array of lowercased tokens from: translation words, Indonesian words, concept names (EN+ID), root keywords (EN+transliteration+ID).
- `ROOT_KEYWORDS: Record<string, string>` exported from `semanticStore.ts` — ~60 Arabic roots mapped to space-separated English/transliteration/Indonesian strings.
- `CONCEPT_INDONESIAN: Record<string, string>` — 29 concept IDs mapped to Indonesian keyword strings.
- `isHighlighted()` in `SemanticGraph.tsx` checks `node.searchTokens?.some(t => t.includes(q))`.
- This enables queries like "patience", "sabar", "knowledge", "ilmu", "taqwa" to highlight matching nodes.

## Root Analytics Engine
- `computeRootAnalytics(verses, rootIndex)` in `rootEngine.ts` runs in a single precompute pass.
- **Degree centrality**: co-occurrence adjacency (roots sharing a verse are adjacent). O(sum_verse_roots²).
- **Betweenness heuristic**: bell-curve approximation based on normalized frequency × degree. True betweenness (O(V³)) is infeasible for 6236 nodes.
- **Composite importance**: 0.45×degree + 0.35×betweenness + 0.2×frequencyRank.
- **Density by verse**: `heatScore = 0.6×normalizedRootCount + 0.4×normalizedFrequencyWeight` per verse.
- **Context per root**: single-pass accumulation — derived forms, noun/verb counts, Meccan/Medinan counts.
- `MEDINAN_SURAHS` hardcoded Set (26 surah numbers) in `rootEngine.ts`.
- `DB_VERSION` bumped 4→5 to force cache recomputation after adding rootAnalytics.
- Slim cache: `verseIdsByRoot` excluded from IndexedDB save (redundant, rebuilt from rootIndex). rootIndex also not cached.

## Root Mode Panel (Index.tsx)
- Fixed left-side panel (w-60), appears only in root mode (AnimatePresence).
- **Centrality insights**: 3 clickable buttons — mostConnectedRoot (yellow), bridgeRoot (blue), mostFrequentRoot (green) — each click sets `selectedRoot` state.
- **Root filter**: text input + `ROOT_KEYWORDS` lookup → filtered list of top 20 matching roots with verse counts + clear (X) button.
- **Context toggle**: shows derived forms, POS distribution bar (noun=blue/verb=green), Meccan/Medinan distribution bar (amber/purple).
- `highlightedVerseIds: Set<string> | null` memo — `getVersesByRoot(selectedRoot)` → passed to `SemanticGraph` for edge/node fading.
- Stats bar shows `(N filtered)` when root is selected.

## SemanticGraph Root Mode Visual Enhancements
- **Heatmap**: `useHeat = mode === 'root' && !rootFilterActive && node.heatScore != null` — switches between heat color and cluster color.
- `getHeatColor(heat)`: `hsla(${200 - heat*157}, ${45+heat*35}%, ${35+heat*25}%, 1)` — teal (cool, low density) → gold (warm, high density).
- **Centrality sizing**: `node.centralityScore * 20` added to base radius in root mode.
- **Root filter fading**: edges and nodes not in `highlightedVerseIds` rendered at 15% opacity.
- Tooltip shows `Density: X%` in root mode.

## Bug Fix: Zero Links with Loaded Verses/Roots/Concepts
- **Symptom**: App showed 6236 verses, ~1300 roots, and 29 concepts, but `links = 0` and all graph modes rendered no nodes.
- **Root cause**: IndexedDB cache payload could be accepted even when `verseLinks` was stale/empty. Root index was rebuilt from current data, so stats looked partially correct while graph edges stayed empty.
- **Fix**: Added `isCacheUsable()` guard in `semanticStore.ts` to reject malformed/stale cache for large corpus conditions (non-trivial root index + no root/semantic links), then clear cache and recompute.
- **Hard invalidation**: Bumped semantic cache `DB_VERSION` from 3 -> 4 in `precompute.ts`.
- **Defensive loading**: `loadCache()` now validates payload shape (`computedAt` type and array fields) before accepting cache entries.

## Action Intelligence Engine Upgrade
- **ActorType expanded** from 6 to 10: added `prophet`, `hypocrite`, `shaytan`, `mankind`. Priority-ordered classification in `classifyActor()`.
- **ActionEdge enriched** with 5 new fields: `verbText`, `englishMeaning` (from existing root translations), `rootFrequency` (from rootIndex), `semanticCluster`, `polarity`.
- **Deterministic dictionaries** in `actionDictionaries.ts`: `ACTION_CLUSTER_MAP` (~130 roots → 10 semantic clusters), `ACTION_POLARITY_MAP` (~50 roots → positive/negative/neutral).
- **Semantic clusters**: Belief & Faith, Knowledge, Worship, Speech, Conflict, Movement, Emotional States, Punishment & Reward, Social Interaction, Deception & Corruption.
- **Behavioral Summary Panel**: `computeActionSummary()` computes dominant actor, most frequent root, dominant cluster, tense distribution, polarity breakdown — displayed as a compact panel above actions.
- **Clustered action view**: actions grouped by semantic cluster in collapsible sections, sorted by count descending.
- **Enriched action rows**: polarity dot (green/red/gray) + actor badge (10 distinct colors) + Arabic verb + English translation + target + tense + root frequency. Expandable to show full verse context with highlighted verb.
- **Flow Mode**: toggle to mini inline SVG graph showing Actor → Verb → Target as directed nodes/edges.
- **DB_VERSION bumped 6 → 7** to invalidate cache for new ActionEdge shape.
- **rootTranslations threaded** through `runPrecompute()` → `buildActionIndex()` so enrichment happens at precompute time, not render time.
- **Future-ready**: `ConceptActionComparison` interface defined for cross-concept action pattern comparison.
- **Duplicate key fix**: `نذر` appeared in both `worship` and `speech` clusters; resolved by using `انذر` for the speech variant.

## Root Mode Intelligence Improvements

- **ROOT_TRANSLATIONS** exported from `semanticStore.ts` — ~64 Arabic roots → single English conceptual meaning (distinct from `ROOT_KEYWORDS` which contains multi-keyword search strings).
- **`getVerseRootsWithData(verseId)`** — returns `VerseRootInsight[]` for a verse using only cached `rootIndex` and `rootAnalytics`. No runtime computation. Sorted by `tokenFrequency` desc.
- **Root Intelligence section** in `VerseDetail.tsx` — between Terjemahan and Concepts. Shows per-root badges: `{Translation} {tokenFrequency}×`. Rare roots (verseFrequency < 40) get orange color + dot indicator. Hover tooltip shows Arabic root, verse count, centrality score.
- **Root Filter removed** from Root Mode Panel (`Index.tsx`). `rootSearch` state, `filteredRoots` memo, `topRoots` memo, and `ROOT_KEYWORDS` import all removed from Index.tsx. `selectedRoot` state is still used for centrality insight click → graph fading.
- **Root translation in graph tooltip** (`SemanticGraph.tsx`) — in root mode, shows `ROOT_TRANSLATIONS[hovered.cluster]` alongside the Arabic root. `ROOT_TRANSLATIONS` imported directly from store.
- **Root translation in centrality panel** — centrality insight buttons (most connected, bridge, most frequent) now show Arabic root + English translation side-by-side.
- **Color scale for root rarity**: `verseFrequency >= 500` → muted; `>= 150` → light gold; `>= 40` → gold; `< 40` → orange (rare, visually prominent).
- **VerseDetail `verseRoots` prop** is always passed from Index.tsx (not mode-gated), since root analysis provides linguistic insight regardless of active mode.

## Action Edges Persisted to Supabase
- New table `ayamakna_action_edges` stores precomputed action intelligence (~15-25K rows).
- Columns: `id` (PK), `verse_id` (FK), `actor_type`, `action_root`, `target_type`, `tense`, `verb_text`, `english_meaning`, `root_frequency`, `semantic_cluster`, `polarity`.
- RLS: public SELECT-only (same pattern as other tables).
- Seed script: `scripts/seed-action-edges.mjs` — mirrors client-side tokenizer + action engine logic.
- `dataLoader.ts` fetches action edges alongside other data in parallel.
- `runPrecompute()` accepts optional `preloadedActionEdges` param; skips `buildActionIndex()` when provided.
- `DB_VERSION` bumped 7 → 8 to invalidate stale IndexedDB cache.
- **Result**: eliminates ~2-3s client-side action computation on first load.
