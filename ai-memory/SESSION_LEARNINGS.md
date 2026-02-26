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

## UI Improvements Round 2: Isolated Search Fix, Contrast/Similarity Intelligence, Actor Highlight

### 1. Isolated Verse Full Search Tokens
- `getVerseSearchTokens(verseId)` exported from `semanticStore.ts` — public wrapper around `buildSearchTokens()` using `_tokenizedVerseMap`.
- `isolatedNodes` in `Index.tsx` now uses `getVerseSearchTokens(v.id)` for full rich tokens (root keywords, concept names, Indonesian) instead of translation-only split.

### 2. VerseDetail: Concepts renamed + Contrast/Similarity Intelligence sections added
- "Concepts" renamed to **"Concepts Intelligence"**.
- **Contrast Intelligence** section: up to 5 contrast links, each shows `labelA ↔ labelB`, category, partner verse ref + excerpt. Uses `CONTRAST_DICTIONARY` from `contrastEngine.ts` to resolve pair metadata. Store export: `getVerseContrastLinks(verseId)`.
- **Similarity Intelligence** section: top-5 similar verses, shows score + excerpt + root/concept/verb breakdown. Store export: `getVerseSimilarityLinks(verseId, limit)`.
- `VerseDetail.tsx` imports `getVerseById`, `getSurahList` from store and `CONTRAST_DICTIONARY` from contrastEngine.
- `contrastLinks` and `similarityLinks` props passed from `Index.tsx`.

### 3. Action Intelligence: Actor + Verb Search Highlighting
- `ActionRow` accepts `searchQuery?: string`. Actor badge gets `ring-2 ring-white/40 scale-110` when query matches actor label/type. Verb text turns `text-yellow-300` when query matches English meaning or root.
- `ClusterSection` and flat list both forward `searchQuery` to `ActionRow`.

## UI Improvements: Isolated Verses, Search Highlighting, Coverage Analytics

### 1. Isolated Verse Toggle
- New `showIsolated` toggle button (Eye/EyeOff icon) in top bar next to Mode Toggle.
- `getAllVerses()` and `getConnectedVerseIds(mode)` exported from `semanticStore.ts`.
- `isolatedNodes` memo in `Index.tsx`: filters all verses not in mode's connected set → builds minimal `GraphNode[]` with `weight=0, cluster='unknown'`.
- `SemanticGraph.tsx` accepts `isolatedNodes?: GraphNode[]` prop — merged into D3 simulation (deduped by id).
- Isolated nodes rendered as tiny (r=3) dim dotted circles (`hsla(240,20%,35%,0.3)`, dashed border). They expand on hover/select. Full connected nodes are unaffected.
- Clicking an isolated node opens `VerseDetail` normally (uses same `onNodeClick`).

### 2. Search Highlights Root Badges & Concept Badges in VerseDetail
- `VerseDetail` now accepts optional `searchQuery?: string` prop — passed from `Index.tsx`.
- `RootBadge` checks if `searchQuery` matches `insight.translation` or `insight.root` — highlighted with `ring-2 ring-yellow-400/70 bg-yellow-400/15 scale-105`.
- Concept badges similarly highlighted if `searchQuery` matches `concept.name` or `concept.id` — `ring-2 ring-blue-400/70`.
- Highlights are passive (no filtering, just visual ring on matching badges).

### 3. Coverage Analytics in Bottom Bar
- `coverage` memo in `Index.tsx`: `{ connected: graphData.nodes.length, total: stats.verses, pct: Math.round(...) }`.
- Displayed in bottom-left stats bar as `X% coverage` — color-coded: green (≥70%), yellow (≥40%), red (<40%).
- Tooltip: "{connected} of {total} verses connected in {mode} mode".

## Mode-Specific Search & VerseDetail Re-order

### Mode-Aware Search Tokens
- `getVerseSearchTokensForMode(verseId, mode)` exported from `semanticStore.ts` — returns mode-specific search tokens:
  - **root/similarity**: root keywords (English/transliteration/Indonesian via `ROOT_KEYWORDS`) + root translations + translation words
  - **concept**: concept names (EN/ID via `CONCEPT_INDONESIAN`) + translation words
  - **action**: actor type keys + actor labels + English verb meanings + semantic cluster names + target types + translation words
  - **contrast**: contrast pair `labelA`/`labelB`/`category` (e.g. "nur", "kufr", "iman", "faith") from `CONTRAST_DICTIONARY` for pairs the verse participates in + translation words
- `buildGraphData(mode)` now calls `getVerseSearchTokensForMode` instead of generic `buildSearchTokens` — connected nodes get mode-specific tokens.
- `isolatedNodes` in `Index.tsx` also use `getVerseSearchTokensForMode(v.id, semanticMode)`.
- `SemanticGraph.isHighlighted()` is unchanged — still checks `node.searchTokens` — mode specificity is achieved via the tokens themselves.
- `CONTRAST_DICTIONARY` imported at top of `semanticStore.ts` (from `contrastEngine.ts`) for contrast token building.
- Badge highlighting in `VerseDetail.tsx` (RootBadge, concept badge, ActionRow) is unchanged — remains independent of graph search.

### VerseDetail Section Order
- **New order**: Arabic → EN Translation → ID Translation → Root Intelligence → Concepts Intelligence → **Action Intelligence** → Contrast Intelligence → Similarity Intelligence
- Action Intelligence moved up from bottom to between Concepts and Contrast.

## Root Intelligence Two-Layer Refactor

### Architecture
Root Intelligence split into strict two-layer architecture:
- **Service A (Linguistic Core)**: `src/services/linguistic/linguisticService.ts` — reads ONLY from `ayamakna_verse_tokens`. Returns roots physically in verse. Deterministic. No concept/graph access.
- **Service B (Semantic AI Layer)**: `src/services/semantic/semanticDomainService.ts` — takes root list from Service A. Expands via root→concept→graph neighbor (depth=1). Every domain has a mandatory trace `{from_root, via_concept, relation_strength}`. Domains without valid trace are REJECTED.

### New Supabase Tables (all with public SELECT-only RLS)
- `ayamakna_verse_tokens` (82,456 rows): id, verse_id, surface, lemma, root, position
- `ayamakna_root_concepts` (9,686 rows): root, concept_id, weight, verse_count (derived from verse-concept co-occurrence)
- `ayamakna_concept_graph_edges` (322 rows): concept_a, concept_b, strength, shared_verse_count (concept co-occurrence adjacency, min 2 shared verses)

### Data Seeding
- `scripts/seed-linguistic-data.mjs` — seeds `ayamakna_verse_tokens` + `ayamakna_root_concepts` (requires temp INSERT + DELETE policies; drop after)
- `ayamakna_concept_graph_edges` seeded via SQL `execute_sql` (derived entirely from existing `ayamakna_verse_concepts`)

### SemanticDomain Return Structure
```json
{ "domain": "Faith", "confidence": 0.63, "trace": { "from_root": "ربب", "via_concept": "tawhid", "relation_strength": 0.42 } }
```

### Validation Rules (enforced in Service B)
1. `trace.from_root` MUST be in Service A root list → reject if not
2. `trace.via_concept` must be non-empty → reject
3. `trace.relation_strength` must be > 0 → reject
4. Graph depth > 1 → never reached (inherently enforced)
- `validateDomains()` exported for unit tests; violations logged in dev mode

### UI Changes (VerseDetail.tsx)
- "Root Intelligence" renamed + split into:
  - **Linguistic Roots**: shows root badges, label "Roots physically present in this verse."
  - **Semantic Expansion**: shows AI-inferred domains with violet badge "AI Inference" + expandable trace panel + confidence bar
- `SemanticDomainCard` component: click to show/hide trace, shows from_root (Arabic), via_concept, relation_strength

### Data Flow
1. `dataLoader.ts` fetches all 3 new tables alongside existing data
2. `semanticStore.ts` calls `setVerseTokens()`, `setRootConcepts()`, `setConceptGraphEdges()`, `setConceptNames()` during `initSemanticEngine()`
3. `getVerseLinguisticRootsFromStore(verseId)` → Service A → returns `string[]`
4. `getVerseSemanticDomains(verseId)` → Service B → validates + returns `SemanticDomain[]`
5. `Index.tsx` computes `selectedSemanticDomains` memo → passed to `VerseDetail`

### Principle
Layer 1 answers: "What is in the verse?" (deterministic)
Layer 2 answers: "What can be inferred from those roots?" (explainable AI)
These must never be merged.

## ayamakna_verse_tokens POS Enhancement

- **New column**: `pos TEXT` added to `ayamakna_verse_tokens` via Supabase migration (`ALTER TABLE ayamakna_verse_tokens ADD COLUMN IF NOT EXISTS pos TEXT`).
- **POS values**: `'noun'` (covers verbs/adjectives too — all lexical), `'particle'` (function words with NULL root).
- **Particle set** defined in `seed-linguistic-data.mjs` as `PARTICLE_SET` (Set of ~80 diacritics-stripped Arabic function words): prepositions (في, من, إلى, ب, ل, ك…), conjunctions (و, ف, ثم, أو…), pronouns (هو, هي, هم, أنا, نحن…), demonstratives (هذا, ذلك, هؤلاء…), relative pronouns (الذي, التي…), negation (لم, لن, لا, ما…), conditionals (إن, إذا, لو…), modals (سوف, قد), vocatives (يا), question particles (هل, أ).
- **`classifyPOS(lemma, root)`**: if lemma in PARTICLE_SET → `'particle'`; if root is null → `'particle'`; else → `'noun'`.
- **Root nullification rule**: `root = pos === 'particle' ? null : rawRoot` — guarantees particles carry no root.
- **`VerseToken` interface** updated: added `pos: string | null` field in `src/services/linguistic/linguisticService.ts`.
- **`dataLoader.ts`** updated: fetches `pos` column (`'id,verse_id,surface,lemma,root,pos,position'`) and maps it through.
- Re-seed needed: run `node scripts/seed-linguistic-data.mjs` with temp INSERT+DELETE policies to apply pos data to all 82,456 token rows.

## Root Intelligence UI Merge + Root Translation Enrichment

### UI Merge (VerseDetail.tsx)
- Two separate sections ("Linguistic Roots" and "Semantic Expansion") merged back into a single **"Root Intelligence"** section.
- Root badges (Service A) are the only root display — `SemanticDomainCard` and AI-inferred domains sub-section were fully removed.
- `semanticDomains` prop, `SemanticDomain` type import, `Sparkles` icon, and `getVerseSemanticDomains` import in `Index.tsx` all removed.

### ayamakna_root_translations Enrichment
- UPSERT pattern: `INSERT INTO ayamakna_root_translations ... ON CONFLICT (root) DO UPDATE SET translation = EXCLUDED.translation`.
- Added/updated ~120 curated Quranic root translations. Total: **1,657 rows** (was 1,651 before).
- Duplicate root guard: `ON CONFLICT DO UPDATE` fails with "command cannot affect row a second time" if same root appears twice in VALUES — ensure VALUES list is deduplicated before running.
- Temp UPDATE + INSERT policies needed for anon key; drop after seeding.

## Root Mode Search Improvements

### Animated Typing Placeholder (Index.tsx)
- `useTypingPlaceholder(words, typingMs, deletingMs, pauseMs)` hook cycles through `ROOT_PLACEHOLDER_WORDS` (20 Quranic concept words: Forgiveness, Mercy, Knowledge, …).
- Phases: `typing` (80ms/char) → `paused` (1600ms) → `deleting` (45ms/char) → next word.
- Only active in root mode; other modes show `'Search verses…'`.
- Returns `'Try "Forgiveness"'` format; falls back to `'Search root translations…'` during blank gap.

### Root Mode Search Scope (semanticStore.ts `getVerseSearchTokensForMode`)
- Root mode tokens: **root translations + root keywords + verse EN + verse ID translations** (all combined).
- Root source is **Service A** (`getVerseLinguisticRoots`) — same as VerseDetail badges, ensuring no search hits on roots that aren't displayed.
- Replaced old `_tokenizedVerseMap` root source in root mode (was inconsistent with badges).

### Multi-Word AND Search (SemanticGraph.tsx `isHighlighted`)
- Query is split on spaces: `"Right Path"` → `["right", "path"]`.
- AND logic: a node is highlighted only if **every** word matches at least one search token.
- Handles single-word queries identically to before (one-element array).
- Arabic label matching uses `.toLowerCase()` for consistency.

## Action Edges Persisted to Supabase
- New table `ayamakna_action_edges` stores precomputed action intelligence (~15-25K rows).
- Columns: `id` (PK), `verse_id` (FK), `actor_type`, `action_root`, `target_type`, `tense`, `verb_text`, `english_meaning`, `root_frequency`, `semantic_cluster`, `polarity`.
- RLS: public SELECT-only (same pattern as other tables).
- Seed script: `scripts/seed-action-edges.mjs` — mirrors client-side tokenizer + action engine logic.
- `dataLoader.ts` fetches action edges alongside other data in parallel.
- `runPrecompute()` accepts optional `preloadedActionEdges` param; skips `buildActionIndex()` when provided.
- `DB_VERSION` bumped 7 → 8 to invalidate stale IndexedDB cache.
- **Result**: eliminates ~2-3s client-side action computation on first load.

## Root Mode Intelligence Overhaul (Graph Morphology + Semantic Cluster Links)

### Connection Rule Change
- **Old**: Two verses connect if they share ≥3 roots (Jaccard threshold).
- **New**: Two verses connect if they share ≥1 root **AND** that root maps to a semantic concept cluster (`ayamakna_root_concepts`). Only semantically-meaningful roots create edges.
- `autoLinkByRoot()` now accepts `rootConceptMap: Map<string, string>` (root → primary conceptId). Roots without a concept mapping are skipped.
- `VerseLink` interface gains `sharedRootsCount?: number` and `semanticCluster?: string`.

### semantic_cluster + similarity_score Overhaul (seed-root-links.mjs)
- **`semantic_cluster`**: stays as **concept_id** (most-frequent concept cluster among shared roots) — root translation was tried but caused messy "hairball" layout since it breaks the radial clustering grouping. Concept_id groups nodes correctly for the radial force.
  - Note: `VerseLink.semanticCluster` (link-level) is stored in cache but **not rendered** in app UI — it's not transferred to `GraphEdge` in `getEdgesForMode()`. The node's `semanticCluster` for radial layout comes from `_rootConceptMap.get(maxRoot)` independently.
- **`similarity_score` change**: was "modified Jaccard" (`shared_semantic_roots / union_of_ALL_roots`) → now **true Semantic Jaccard** (`shared_semantic_roots / union_of_semantic_roots_only`).
  - Denominator is now the union of semantically-mapped roots from both verses (not all roots, not particles). Gives purer measure of shared semantic vocabulary.
  - Main idea: "what fraction of their combined *meaningful* root vocabulary do these two verses share?"
- Re-seeding required: `node scripts/seed-root-links.mjs` (temp INSERT + DELETE policies needed).

### Search + Isolated Verse Lag Fix (SemanticGraph.tsx)
- **Root cause**: search edge computation ran inside `draw()` on every keystroke (because `searchQuery` is in draw effect deps → full effect re-run per keystroke). Also did O(n² log n) nearest-neighbor sort on frame 1 of new query.
- **Fix**: moved search edge computation to a **dedicated `useEffect`** watching `[searchQuery, isolatedNodes, isHighlighted]` with `setTimeout(fn, 80)` delay.
  - Connected node highlights apply immediately via `isHighlighted()` in draw (fast, O(n) per frame).
  - Isolated search edges computed 80ms later → fade-in animation starts once populated.
  - D3Node references in `searchEdgesRef` auto-update with simulation positions (no 60-frame recompute needed).
- **Removed**: `frameCountRef`, `searchEdgeComputedRef` — no longer needed since computation is out of the draw loop.
- **Draw loop change**: computation block replaced with a 3-line alpha lerp + clear on no-query.

### Graph Morphology (Root Mode)
- **Node size** = sum of `sharedRootsCount` across all root edges touching the node. Formula: `r = 4 + min(sharedRoots/40, 1) * 20`.
- **Node color** = frequency-based (aligns with VerseDetail badge): grey (≥500 verses), light gold (≥150), gold/amber (≥40), brown/orange (<40). Uses `node.rootVerseFrequency` (dominant root's corpus verse count).
- **Edge thickness** = `0.5 + min(sharedRootsCount, 12) * 0.35` in root mode.
- **Edge distance** = similarity-based spring: `distance = max(35, 200 * (1 - strength * 0.85))`. High similarity → closer nodes.
- **Edge strength** = `max(0.08, strength * 0.55)` in root mode.
- **Layout** = Hybrid Force-Directed + Radial. A custom `radialCluster` D3 force pulls nodes toward their semantic concept cluster's angular position on a ring (radius=320, strength=0.035·alpha). Only active in root mode.

### New Supabase Table
- `ayamakna_root_verse_links`: precomputed semantic root links.
- Columns: `id` SERIAL PK, `verse_a_id`, `verse_b_id`, `shared_roots_count`, `semantic_cluster`, `similarity_score`.
- Indexed on both verse columns. RLS: public SELECT-only.
- Seed: `node scripts/seed-root-links.mjs` (requires temp INSERT + DELETE policies; drops after seeding).
- `dataLoader.ts` loads this table and passes to `runPrecompute()` as `preloadedRootLinks`.
- When provided, skips client-side `autoLinkByRoot()` entirely.
- `DB_VERSION` bumped 8 → 9 to invalidate stale IndexedDB cache.

### Auto-Highlight from Placeholder
- `useTypingPlaceholder` now returns `{ display, currentWord }`.
- `pauseMs` increased 1600 → 9000ms (full cycle ~10s per word).
- `currentWord` is populated only during the pause phase (word fully typed).
- `effectiveSearchQuery` in `Index.tsx`: uses `currentWord.toLowerCase()` when no user search is active in root mode, auto-highlighting matching nodes.

### GraphNode / GraphEdge New Fields
- `GraphNode`: `sharedRootsCount?`, `rootVerseFrequency?`, `semanticCluster?`
- `GraphEdge`: `sharedRootsCount?`
- `semanticCluster` on node = concept ID of the verse's dominant root → used for radial positioning.

## Multi-Layer Root Projection (hop=1 + hop=2)

### Architecture
Root mode connections use **two-hop multi-layer projection**:
- **hop=1 (direct)**: verses share ≥1 semantically-mapped root. Solid gold edge.
- **hop=2 (indirect)**: `Verse A → Root A → Concept A ↔ Concept B → Root B → Verse B`. Dashed, muted-gold, dim edge. Pairs already connected by hop=1 are skipped.

### DB Change
`hop_count INTEGER NOT NULL DEFAULT 1` added to `ayamakna_root_verse_links` (migration applied).

### Similarity Scores
- hop=1: Semantic Jaccard (`shared_semantic_roots / union_of_semantic_roots`)
- hop=2: path_score = `maxWeight(A→C_A) × edgeStrength(C_A↔C_B) × maxWeight(B→C_B)`

### seed-root-links.mjs Phase 2 Algorithm
1. Load `ayamakna_concept_graph_edges` (322 rows)
2. Build `conceptVersesMap`: concept → top-200 verses by maxRootWeight
3. For each concept edge (`strength ≥ 0.3`): compute all verse pairs, `pathScore = wA × edgeStrength × wB`
4. Skip if `pathScore < 0.12` or pair in `directPairSet`
5. Sort candidates by score desc; apply combined `MAX_LINKS_PER_VERSE = 20` cap
6. `shared_roots_count = 0` for hop=2; `semantic_cluster` = concept on higher-weight side

### Visual Differentiation (SemanticGraph.tsx)
- hop=2: `setLineDash([4, 5])`, color `hsla(43, 30%, 58%, 1)`, alpha `0.10 + strength×0.16`, thin
- hop=1: unchanged (solid gold, existing formula)

### Data Flow
`hop_count` (DB) → `dataLoader.ts` `hopCount` → `VerseLink.hopCount` → `getEdgesForMode()` → `GraphEdge.hopCount` → draw loop

### Configs
`MIN_EDGE_STRENGTH=0.3`, `MIN_PATH_SCORE=0.12`, `MAX_VERSES_PER_CONCEPT=200`. Expected: 10–30K multi-hop links.

### Re-seeding
`node scripts/seed-root-links.mjs` (temp INSERT + DELETE policies needed on `ayamakna_root_verse_links`)

## Root Mode Graph Noise Reduction

### Root Mode Focus Level (Coverage Control)
- `RootFocusLevel` type exported from `semanticStore.ts`: `'broad' | 'focused' | 'deep'`
- `_rootFocusLevel` module variable (default `'focused'`), controlled via `setRootFocusLevel(level)`
- Thresholds: `broad=0.28`, `focused=0.48`, `deep=0.55` (Semantic Jaccard min on `similarityScore`)
- Filter applied **before** the per-node cap in `getEdgesForMode('root')` — drops whole nodes when all their edges fall below threshold
- UI: compact 3-button group in top bar (root mode only, styled like Mode Toggle)
- `rootFocusLevel` added to `graphData` useMemo deps in `Index.tsx` to trigger recompute on change

### Problem (initial noise sources)
Root mode graph was visually noisy and hard to interpret due to three compounding issues:
1. **Flat hop=1 opacity** — `Math.max(0.28, 0.12 + strength×0.25)` gave only 9-point perceptual range (0.28–0.37); weak and strong edges looked identical.
2. **Prominent hop=2 edges** — dashed multi-hop bridges (0.10–0.26 opacity) competed visually with direct connections.
3. **No visualization-side edge cap** — seed cap of 20 edges/node still allowed hairball clusters.

### Solution (visualization/store only, no re-seeding)
- **Per-node edge cap** in `getEdgesForMode('root')` (`semanticStore.ts`): top 7 hop=1 + top 3 hop=2 per node using **union survival rule** (edge survives if in top-N for either endpoint). Prevents hairballs at the data layer.
- **Power-curve opacity** for hop=1 (`SemanticGraph.tsx`): `0.15 + strength^0.7 × 0.60` → 42-point perceptual range (0.24–0.75). Strong edges clearly dominate.
- **Hop=2 toggle** (`Index.tsx` + `SemanticGraph.tsx`): hidden by default (`showHop2=false`). "Bridges" toggle button appears only in root mode. Hop=2 stays in D3 sim for layout — toggling visibility doesn't cause node jumps.
- **D3Edge interface** extended with `hopCount?` and `sharedRootsCount?` (TypeScript prerequisite).

### Union Survival Rule
If edge A→B is in A's top-7 but not B's top-7, it still survives. This ensures every node retains its own strongest connections — intersection would sever real structure for high-degree hub nodes.

## Concept Intelligence Overhaul (Designed — Not Yet Implemented)

### Problem with Current Concept Mode
- `similarityToVerseLinks()` in `similarityEngine.ts` assigns `linkType: 'concept'` to general similarity links (50% root + 30% concept + 20% verb). Concept mode = composite similarity, NOT true concept-based clustering.
- No two-level structure (Verse → Concept → Domain).
- Node coloring uses raw concept ID — no visual domain hierarchy.
- No focus level control (only root mode has broad/focused/deep).

### Domain Taxonomy (9 Domains — 29 concepts total)

| Domain ID | Name | Hue | Concepts | Verse Coverage |
|---|---|---|---|---|
| `divine-attributes` | Divine Essence & Attributes | 45° (gold) | tawhid, qadr, rahmah, hidayah | ~2839 |
| `revelation-knowledge` | Revelation & Sacred Knowledge | 195° (cyan) | quran, ilm | ~1471 |
| `faith-consciousness` | Faith & Spiritual Consciousness | 270° (violet) | iman, taqwa, khawf_raja, nur_zulm, tawakkul | ~969 |
| `worship-devotion` | Worship & Devotion | 140° (green) | salah, dhikr, dua, shukr | ~684 |
| `virtue-ethics` | Virtue & Moral Excellence | 165° (teal) | akhlaq, ihsan, adl, sabr | ~742 |
| `repentance-forgiveness` | Repentance & Divine Forgiveness | 30° (orange) | tawbah, maghfirah | ~292 |
| `disbelief-opposition` | Disbelief & Spiritual Opposition | 0° (red) | kufr, kufr_nifaq | ~592+ |
| `eschatology-judgment` | Eschatology & Judgment | 220° (deep blue) | qiyamah, jannah_nar, hayat_mawt | ~1220 |
| `social-ethics` | Social Ethics & Communal Order | 85° (yellow-green) | amr_nahi, jihad, rizq | ~344 |

**Domain ordering within each domain (for intra-domain shade assignment):**
- Divine: tawhid(1), qadr(2), rahmah(3), hidayah(4)
- Revelation: quran(1), ilm(2)
- Faith: iman(1), taqwa(2), nur_zulm(3), khawf_raja(4), tawakkul(5)
- Worship: salah(1), dhikr(2), dua(3), shukr(4)
- Virtue: akhlaq(1), ihsan(2), adl(3), sabr(4)
- Repentance: maghfirah(1), tawbah(2)
- Disbelief: kufr(1), kufr_nifaq(2)
- Eschatology: qiyamah(1), hayat_mawt(2), jannah_nar(3)
- Social: amr_nahi(1), rizq(2), jihad(3)

### Data Quality Notes
- `iman` and `kufr_nifaq` have 0 verse-concept associations in `ayamakna_verse_concepts` (data gap).
- `qadr` is by far the most verse-tagged concept (1280 verses) — acts as cross-domain hub.

### New Supabase Tables Required

1. **`ayamakna_concept_domains`**:
   - `id TEXT PK` (e.g. 'divine-attributes')
   - `name TEXT` (English)
   - `name_id TEXT` (Indonesian)
   - `description TEXT`
   - `color_hue INTEGER` (0-360 HSL hue)
   - `display_order INTEGER`

2. **`ayamakna_concepts` column additions**:
   - `domain_id TEXT` FK → ayamakna_concept_domains(id)
   - `domain_order INTEGER` (position within domain, 1-based, for shade assignment)

3. **`ayamakna_concept_verse_links`** (precomputed concept-mode connections):
   - `id SERIAL PK`
   - `verse_a_id TEXT`, `verse_b_id TEXT`
   - `shared_concepts_count INTEGER`
   - `primary_concept_id TEXT` (highest-weight shared concept)
   - `domain_id TEXT` (domain of primary shared concept)
   - `similarity_score FLOAT` (concept Jaccard: shared_concepts / union_concepts)
   - Indexed on both verse columns. RLS: public SELECT-only.
   - Seed: `scripts/seed-concept-links.mjs`

### Graph Morphology (Concept Mode)

- **Node Color**: `hsla(domain_hue, saturation, lightness, 0.9)` where:
  - `saturation`: 60% for hub concepts (high verse_count), 45% for rare concepts
  - `lightness`: 35% + (domain_order-1) × 8% → darker = higher-ranked concept within domain
  - e.g., tawhid (domain_order=1, hue=45°) → `hsla(45, 70%, 35%, 0.9)` (rich gold)
  - e.g., hidayah (domain_order=4, hue=45°) → `hsla(45, 50%, 59%, 0.9)` (light gold)
- **Node Size**: 4 + min(sharedConceptsCount / 30, 1) × 18 (structural importance = degree in concept graph)
- **Edge Thickness**: 0.5 + min(similarity_score, 1) × 3 (confidence/strength)
- **Edge Distance (spring)**: `max(40, 220 × (1 − similarity_score × 0.85))` (semantic gravity)
- **Edge Color**: existing blue (#5a9ec4), with intra-domain edges slightly brighter than cross-domain
- **Layout**: Hybrid Force + Radial — nodes pulled toward domain's angular position (same radial cluster force pattern as root mode, RADIAL_RADIUS=320, keyed by `domain_id`)

### Focus Levels (Concept Mode)
- `broad`: similarity_score ≥ 0.15 (shows most connections)
- `focused`: similarity_score ≥ 0.30 (default)
- `deep`: similarity_score ≥ 0.48 (tightest semantic clusters only)
- Module variable `_conceptFocusLevel` in `semanticStore.ts`, exported as `ConceptFocusLevel`
- UI: same 3-button group in top bar as root mode, visible only in concept mode

### Store Changes
- `_conceptDomainMap: Map<string, ConceptDomain>` (conceptId → domain data)
- `getDomainForConcept(conceptId)` → `ConceptDomain | undefined`
- `getNodeDomainId(verseId)` → domain_id of verse's highest-weight concept
- `getConceptFocusLevel()` / `setConceptFocusLevel(level)`
- `getPrimaryCluster` concept mode: returns `domain_id` (for radial layout, replacing raw conceptId)
- `getEdgesForMode` concept mode: uses `_conceptFocusLevel` threshold against preloaded concept verse links

### Seeding Plan
- `scripts/seed-concept-links.mjs`: load `ayamakna_verse_concepts`, compute pure concept Jaccard pairs, cap MAX_LINKS_PER_VERSE=25, MIN_SIMILARITY=0.10, skip if similarity < 0.10. Store in `ayamakna_concept_verse_links`. Requires temp INSERT + DELETE policies.
- Expected row count: 80K-150K links (4491 verse-covered verses, moderate density)
- `DB_VERSION` bump: 9 → 10 after loading concept_verse_links

### Left Panel (Concept Mode)
- Mirror of root mode panel: domain insights section
- **Domain summary**: 9 domain buttons, click selects domain → highlights all verses in that domain's concepts
- **Concept selector within domain**: shows top concepts by verse count with expand/collapse
- `selectedDomain` state → `highlightedVerseIds` memo → passed to SemanticGraph for fading

### VerseDetail Changes
- "Concepts Intelligence" section: show concept badges WITH domain chip (e.g., `[Faith ●] Taqwa`)
- Domain chip: colored dot matching domain hue, domain short label
- Clicking domain chip → sets active domain filter (future feature)

### Clustering Quality Targets
- Expected Silhouette score: ~0.35-0.45 (limited by qadr's cross-domain reach)
- Expected Modularity: ~0.30-0.45
- qadr/tawhid/ilm form a tight triangle — expected strong intra-domain cohesion for Divine cluster

## Concept Mode Search & Auto-Highlight

### Search Scope (Concept Mode Only)
- `getVerseSearchTokensForMode(verseId, 'concept')` in `semanticStore.ts` now returns ONLY domain + concept keywords — NO translation words.
- Tokens: `concept.name`, `concept.id`, `CONCEPT_INDONESIAN[id]`, `domain.name`, `domain.id`, individual domain name words (e.g., "divine", "essence").
- This ensures searching "Divine Essence" highlights only verses in that domain, not any verse with those words in its translation.

### Auto-Highlight Placeholder (Concept Mode)
- `CONCEPT_PLACEHOLDER_WORDS` in `Index.tsx`: 20 domain/concept names (e.g., "Divine Essence", "Taqwa", "Eschatology").
- Second `useTypingPlaceholder` instance (`conceptTypingPlaceholder`, `conceptPlaceholderWord`) runs in parallel with root placeholder.
- `effectiveSearchQuery` in `Index.tsx` now handles concept mode: uses `conceptPlaceholderWord.toLowerCase()` when no user search is active in concept mode and no node is selected.
- Search bar `placeholder` shows `conceptTypingPlaceholder` in concept mode (animated cycling).
- Cadence: same as root mode — ~10s per word (pauseMs=9000).

### VerseDetail Concept Badge Highlighting
- `isConceptMatch` in `VerseDetail.tsx` now also checks `domain?.name.toLowerCase().includes(q)` and `domain?.id.toLowerCase().includes(q)`.
- `domain` variable moved above `isConceptMatch` so it's available for the check.
- Badges for concepts in a matching domain are highlighted even if the concept name itself doesn't match the query.

## Search Edges for Isolated Nodes

### Feature
When `searchQuery` is active AND `showIsolated` toggle is ON (`isolatedNodes.length > 0`):
- Each matched isolated node gets up to 5 dashed "search edges" drawn to its nearest matched nodes (connected or isolated).
- Edges are purely visual — NOT added to the D3 simulation, so they don't affect layout.
- Animation: edges fade in from 0 → 0.55 opacity via lerp (7%/frame ≈ 600ms). Gentle breathing pulse (`±0.15`) once faded.
- When query changes: draw effect re-runs → `searchEdgeAlphaRef` reset to 0 → fresh fade-in.
- Matched isolated nodes that are search-edge endpoints render with cyan tint + slightly larger radius (4.5 instead of 3), opacity tied to the same fade-in.

### Implementation (SemanticGraph.tsx)
- 4 new refs: `searchEdgesRef`, `searchEdgeAlphaRef`, `frameCountRef`, `searchEdgeComputedRef`.
- `isolatedIdSet` moved outside `draw()` to be shared between search-edge computation and node rendering (was previously recomputed inside `draw()` on every frame).
- All 4 refs reset at the start of the draw effect so animation starts fresh on each re-run.
- Computation runs on frame 1 (query change triggers `searchEdgeComputedRef !== searchQuery`) and every 60 frames (position drift update). Uses `isHighlighted()` + positional distance (Math.hypot) to find K=5 nearest matched nodes per matched isolated node. Deduplicates pairs with a `Set<string>`.
- Draw order: regular edges → search edges (dashed cyan) → nodes.
- `seNodeIds` Set (built each frame from current search edges) gates the enhanced isolated node styling.

## Action Intelligence Overhaul — 12 Action Families

### Conceptual Shift
- **Old**: Action = verb detection (10 vague semantic clusters like "Belief & Faith", "Knowledge").
- **New**: Action = Agent → Action → Object → Context. Answers "What are the recurring behavioral patterns?"
- Distinction from Concept: Concept = "what is it about?" (thematic); Action = "what is being done?" (procedural).
- Two verses may share concept "Guidance" but differ in action: "seek guidance" vs "grant guidance".

### 12 Action Families (actionDictionaries.ts)
| Family ID | Name | Hue |
|---|---|---|
| `worship_devotion` | Worship & Devotion | 140° |
| `moral_conduct` | Moral Conduct | 165° |
| `divine_command` | Divine Command & Revelation | 45° |
| `divine_creation` | Divine Creation & Providence | 60° |
| `knowledge_reflection` | Knowledge & Reflection | 195° |
| `rejection_denial` | Rejection & Denial | 0° |
| `proclamation_warning` | Proclamation & Warning | 30° |
| `social_transaction` | Social Transaction | 85° |
| `spiritual_states` | Spiritual States | 270° |
| `conflict_resistance` | Conflict & Resistance | 15° |
| `divine_retribution` | Divine Retribution | 350° |
| `seeking_supplication` | Seeking & Supplication | 220° |

- `ACTION_FAMILY_HUES`: HSL hue per family (pre-resolved for draw loop).
- `ACTION_PLACEHOLDER_WORDS`: 20 words for animated search bar in action mode.
- Legacy aliases exported: `SemanticCluster = ActionFamily`, `ACTION_CLUSTER_MAP = ACTION_FAMILY_MAP`, `SEMANTIC_CLUSTER_LABELS = ACTION_FAMILY_LABELS`.
- **Duplicate key fix**: 'صبر' kept only in moral_conduct; 'غضب' replaced with 'سخط' in divine_retribution; 'دعو' kept only in proclamation_warning.

### Supabase Tables
- `ayamakna_action_families`: 12 rows (id, name, name_id, color_hue, display_order). Static reference.
- `ayamakna_action_verse_links`: precomputed action-mode verse connections.
  - Columns: `id SERIAL PK`, `verse_a_id`, `verse_b_id`, `shared_actions_count INTEGER`, `primary_action_family TEXT`, `similarity_score FLOAT`.
  - Indexed on both verse columns. RLS: public SELECT-only.
  - Seed: `node scripts/seed-action-verse-links.mjs` (requires temp INSERT + DELETE policies; drop after).

### Seed Script (seed-action-verse-links.mjs)
- Loads `ayamakna_action_edges` (verse_id, action_root, semantic_cluster).
- Builds verse → Set<action_root> map (deduplicated per verse).
- Inverted index: action_root → [verseId]. Skips roots in >500 verses (noise).
- Action Jaccard = shared_action_roots / union_action_roots. MIN_SIMILARITY=0.10.
- Primary_action_family = most frequent family among shared roots (via inline ACTION_FAMILY_MAP).
- Per-node cap: top 25 edges per verse, union survival rule.
- `DB_VERSION` bumped 10 → 11 to invalidate IndexedDB cache.

### Graph Morphology (Action Mode)
- **Node color**: `getActionFamilyColor(actionFamilyHue, sharedActionsCount)` → `hsla(hue, 45+activity×30%, 40−activity×8%, 1)` where activity = min(sharedActionsCount/25, 1).
- **Node size**: `4 + min(sharedActionsCount/25, 1) × 18` (behavioral centrality).
- **Edge thickness**: `0.5 + min(sharedActionsCount, 8) × 0.40`.
- **Edge distance (spring)**: `max(40, 220 × (1 − strength × 0.85))` (behavioral gravity).
- **Edge strength**: `max(0.12, strength × 0.45)`.
- **Layout**: Radial by action family. `semanticCluster = actionFamilyId` on nodes; `radialStrength = 0.040`.

### Focus Levels (Action Mode)
- `ActionFocusLevel`: `'broad' | 'focused' | 'deep'`
- Thresholds: `broad=0.12`, `focused=0.25`, `deep=0.40` (similarity_score min).
- `_actionFocusLevel` in `semanticStore.ts`, exported via `setActionFocusLevel()` / `getActionFocusLevel()`.
- UI: 3-button group in top bar (green styling, appears only in action mode).

### Search Scope (Action Mode)
- `getVerseSearchTokensForMode(verseId, 'action')` returns ONLY: canonical action names, action family IDs, `ACTION_FAMILY_LABELS` (EN), `ACTION_FAMILY_INDONESIAN` (ID). NO translation words.
- Auto-highlight: `ACTION_PLACEHOLDER_WORDS` cycling through action family keywords (~10s per word via useTypingPlaceholder, pauseMs=9000).

### GraphNode / GraphEdge New Fields
- `GraphNode`: `sharedActionsCount?`, `actionFamilyId?`, `actionFamilyHue?`
- `GraphEdge`: `sharedActionsCount?`

### VerseDetail Action Family Badge
- `ACTION_FAMILY_HUES` imported in `VerseDetail.tsx`.
- Each `ActionRow` shows a small colored dot (2×2, `hsl(hue, 55%, 52%)`) in the right-side meta area alongside tense + frequency.
- Expanded section shows a colored badge (dot + family label) with inline HSL border/background/text styles.

## Actor Ontology + Behavioral Summary Redesign

### ActorOntology (actionDictionaries.ts)
- `ActorOntology` type: `'divine' | 'angelic' | 'human' | 'jinn_shaytan' | 'collective' | 'natural'`
- `ACTOR_ONTOLOGY_MAP`: maps existing `ActorType` → `ActorOntology` (no DB change; derived mapping).
- `ACTOR_ONTOLOGY_HUES`: divine=45°, angelic=195°, human=140°, jinn_shaytan=0°, collective=85°, natural=220°.
- `ACTOR_ONTOLOGY_LABELS`: display names per ontology group.
- `ACTOR_ROLE_LABELS`: granular role display names (e.g., "Prophet / Messenger", "Believer (Mu'min)").

### ActionSummary New Fields (types.ts)
- `dominantActorOntology: ActorOntology` — top-level ontology group of dominant actor.
- `temporalMode: string` — derived from tenseDistribution: `'Command dominant'` (imperative>30%), `'Eschatological'` (future>15%), `'Present dominant'`, `'Past dominant'`, `'Mixed'`.

### Store New Exports (semanticStore.ts)
- `getActionRootVerseCount(root)` → number of unique verses containing an action root.
- `getActionRootVerseIds(root)` → `Set<string>` for graph highlight.
- `getActionFamilyVerseCount(family)` → unique verse count for a family.
- `actorOntology` + `actorOntologyHue` fields added to `GraphNode` in action mode `buildGraphData()`.

### VerseDetail.tsx — Action Intelligence Redesign (v2)
- **Removed**: `ActionFamilyGroup` (collapsible bordered sections), `ACTOR_LABELS`, `ACTOR_COLORS`, `TENSE_LABELS`, `familyGroups` memo, actor ontology imports.
- **`ActionBehavioralSummary` simplified**: now shows ONLY: "Category" (dominant action family, title-cased label) + "Actions" list (Arabic verbText + English canonical, deduplicated, max 10). Removed: Actor Ontology, Dominant Role, Behavioral Polarity, Temporal Mode, purpose sentence.
- `ActionBehavioralSummary` accepts `actions: ActionEdge[]` + optional `onActionFilter` props.
- Action rows in summary show inline "N verses ↗" hover button if `onActionFilter` is provided.

### SemanticGraph.tsx — Node Color (v2)
- **Old**: `getActorOntologyColor(actorOntologyHue)` — colored by who is acting.
- **New**: `getActionFamilyNodeColor(actionFamilyHue, sharedActionsCount)` — colored by action family. Same family = same hue. `sharedActionsCount` drives saturation/lightness gradations within family (more central = more vivid). Formula: `hsla(hue, 50+activity×28%, 42-activity×10%, 1)` where activity = sharedActionsCount/25.
- Radial clustering by action family unchanged (semanticCluster = actionFamilyId, radialStrength=0.040).

### Index.tsx
- `getActionRootVerseIds` imported from store.
- `highlightedVerseIds: Set<string> | null` state added (was previously only memo for root mode panel).
- `handleActionFilter(actionRoot)` callback: calls `getActionRootVerseIds` → sets `highlightedVerseIds` → dims non-matching nodes in graph.
- `highlightedVerseIds` passed to `SemanticGraph`; `onActionFilter` passed to `VerseDetail`.

## Action Intelligence — Verb Purity + Category Coverage Fixes

### Problem
- `ayamakna_action_edges` was seeded with a weak POS heuristic (`/^[يتان]/` + length≥4) that:
  1. **False positives**: noun roots starting with يتان (e.g., شيأ=thing, يوم=day, نفس=soul, نطف=drop) were seeded as actions
  2. **False negatives**: past tense verbs (starting with consonants) were missed entirely
- 1889/2852 rows had NULL `semantic_cluster` (old `ACTION_CLUSTER_MAP` didn't cover them)
- The `LEGACY_CLUSTER_MAP` fix (previous session) handles 963 rows with old cluster IDs
- 1889 NULL rows fall back to `ACTION_FAMILY_MAP[action_root]`; noun roots not in the map → undefined → grey/no category

### Root Cause of Unmapped Roots (DB query result — top NULL-cluster roots)
- **True nouns (false positives)**: شيأ(144), يوم(19), نفس(15), نطف(11), ترب(16) — should NOT be in action edges
- **Real verb roots missing from ACTION_FAMILY_MAP**: كون(62), قوم(57), رود(47), أمن(41), أتي(35), فعل(22), نفع(21), تبع(20), بدل(17), ولي(17), غني(16), عمل(16), سوي(16), يسر(15), ندي(15), لقي(15), قبل(14), طوع(14), هزأ(12), أكل(12), ملك(11), فصل(11), قلب(10), رود(47), أخذ(23 — hamza variant of اخذ), أمن(41 — hamza variant of امن)

### Fix 1: Expand ACTION_FAMILY_MAP (`actionDictionaries.ts`)
Added ~25 new verb roots across all 12 families:
- `worship_devotion`: امن, أمن (hamza variant), طوع
- `moral_conduct`: عمل, فعل, نفع, قوم, تبع
- `divine_command`: يسر, فصل, ولي
- `divine_creation`: كون, سوي, غني, ملك
- `rejection_denial`: هزأ
- `proclamation_warning`: ندي
- `social_transaction`: بدل, لقي, أكل, أتي, قبل
- `divine_retribution`: أخذ (hamza variant of اخذ)
- `seeking_supplication`: رود, قلب

### Fix 2: Client-side filter in `dataLoader.ts`
After mapping action edges, `.filter(a => a.semanticCluster !== undefined)` removes edges whose root is not in ACTION_FAMILY_MAP (noun false positives). Applied after LEGACY_CLUSTER_MAP normalization.

### Fix 3: Isolation of no-category verses in action graph (`semanticStore.ts` `buildGraphData`)
In action mode node building: if `getPrimaryCluster('action', ...) === 'unknown'`, `continue` (skip node). After building all nodes, filter edges to only those where both endpoints are in the final node set (`nodeIdSet`). Verses with no valid-family action roots are naturally isolated.

### Fix 4: Seed Script Overhaul (`seed-action-edges.mjs` v2)
Changed source from raw `ayamakna_verses.text_arabic` to `ayamakna_verse_tokens`:
- Loads all tokens from `ayamakna_verse_tokens` (morphologically analyzed)
- **Strict filter**: only seeds tokens where `root IN ACTION_FAMILY_MAP` — guarantees every seeded edge has `semantic_cluster != NULL`
- Skips `pos = 'particle'` tokens
- Uses `token.surface` as `verb_text` (actual form in verse)
- Clears all old rows (`DELETE ... neq 'id', '___never___'`) before inserting
- `tense` classification still uses heuristic on surface form
- After running: must re-seed `ayamakna_action_verse_links` with `node scripts/seed-action-verse-links.mjs`

### DB_VERSION bumped 11 → 12
Invalidates IndexedDB cache for the new filter logic.

### Re-seeding (to apply full fix to DB)
1. Add temp DELETE + INSERT policies on `ayamakna_action_edges`
2. `node scripts/seed-action-edges.mjs`
3. Drop temp policies, add temp policies on `ayamakna_action_verse_links`
4. `node scripts/seed-action-verse-links.mjs`
5. Drop temp policies

## Action Mode UI Fixes

### 1. Graph Tooltip Category Label Fix
- **Problem**: Hovering a node in action mode showed raw cluster ID (e.g. `MORAL_CONDUCT`) instead of the human-readable label.
- **Fix**: `SemanticGraph.tsx` tooltip block now resolves `hovered.cluster` through `ACTION_FAMILY_LABELS` when `mode === 'action'`. Import added: `ACTION_FAMILY_LABELS`, `ActionFamily` from `actionDictionaries`.

### 2. Action Placeholder Words Updated
- `ACTION_PLACEHOLDER_WORDS` in `actionDictionaries.ts` now contains all 12 family labels (e.g. "Worship & Devotion", "Social & Family Affairs") + 12 key canonical action names.
- `Index.tsx` now imports `ACTION_PLACEHOLDER_WORDS` from `actionDictionaries` instead of maintaining a duplicate local array.

### 3. Multi-Word Placeholder AND-Logic Fix
- **Problem**: Placeholder words containing `&` (e.g. "Worship & Devotion") caused the AND-search to require `&` to match a token, so no nodes highlighted.
- **Fix**: `isHighlighted()` in `SemanticGraph.tsx` filters split words by `/[\p{L}\p{N}]/u` — only alphanumeric words are required to match. Symbols like `&` are ignored.

### 4. Action Search Scope (already correct — confirmed)
- `getVerseSearchTokensForMode(verseId, 'action')` returns ONLY: canonical action names, family labels (EN + individual words), family IDs, Indonesian family keywords. No translation words.
- This ensures searching "Worship" or "Social & Family Affairs" highlights only matching behavioral verses.

## Contrast Intelligence Overhaul

### Feature Goals (implemented)
1. **Frequency Asymmetry**: show corpus verse-frequency counts per root, dominance gap, ratio, visual bars.
2. **Cluster by contrast topics** (17 predefined pairs, not individual verses).
3. **Precomputed Supabase table**: `ayamakna_contrast_verse_links`.
4. **Graph morphology**: bipartite radial layout (A-side left hemisphere, B-side right), topic-based pair-side colors, frequency-based node sizing.
5. **Broad/Focused/Deep focus levels** (edge cap, not threshold).
6. **Search scope**: ONLY contrast topic labels + English expansions — no translation words.
7. **Auto-highlight placeholder**: 20 contrast keywords cycling via `useTypingPlaceholder`.

### Supabase Table (`ayamakna_contrast_verse_links`)
- Columns: `id SERIAL PK`, `verse_a_id TEXT`, `verse_b_id TEXT`, `pair_id TEXT`, `category TEXT`, `contrast_strength FLOAT DEFAULT 0.8`.
- Unique constraint: `(verse_a_id, verse_b_id, pair_id)`.
- RLS: public SELECT-only.
- Seed: `node scripts/seed-contrast-verse-links.mjs` (requires temp INSERT + DELETE policies).
- Result: **4,155 links** across 16 of 17 pairs. `جنن:نار` skipped — `نار` not in token DB (no root stored for fire noun).
- Root aliases: `ءمن` → `أمن`, `ءخر` → `أخر` (token DB uses alef with hamza above, not bare hamza).
- Bug fix in seed script: `edgesByNode` must push original object references (not new objects) for Set deduplication to work correctly in union survival rule. Also switched to `upsert(ignoreDuplicates=true)` as safety net.

### Seed Script (`scripts/seed-contrast-verse-links.mjs`)
- Loads verse tokens, builds root→verseId index (pos != 'particle').
- For each pair: samples up to MAX_VERSE_SET=70 per side, cross-pairs up to MAX_LINKS_PER_PAIR=300.
- Per-verse cap (MAX_LINKS_PER_VERSE=15) with union survival rule.
- `ROOT_ALIASES` dict maps `CONTRAST_DICTIONARY` root keys → token DB root forms.

### New Exports (`contrastEngine.ts`)
- `CONTRAST_PAIR_ORDER: string[]` — 17 pair IDs in fixed order (index used for bipartite angular position).
- `CONTRAST_PAIR_HUES: Record<string, { hueA, hueB }>` — hue per side per pair (avoids green/black/white).
- `CONTRAST_LABEL_ENGLISH: Record<string, string>` — space-sep English keywords per label (for search tokens).
- `CONTRAST_PLACEHOLDER_WORDS: string[]` — 20 English contrast concept words.

### ContrastFocusLevel (`semanticStore.ts`)
- `CONTRAST_CAPS = { broad: 15, focused: 8, deep: 3 }` — per-verse edge cap (not similarity threshold, since all links have fixed strength=0.8).
- `setContrastFocusLevel()` / `getContrastFocusLevel()` / `ContrastFocusLevel` type exported.
- Module state: `_contrastVerseLinks: VerseLink[]`, `_verseContrastPairsMap: Map<string, Set<string>>`.

### Graph Node Fields (`visualization/types.ts`)
- `contrastSide?: 'A' | 'B'` — pole (A=positive/light, B=negative/dark).
- `contrastHue?: number` — HSL hue from CONTRAST_PAIR_HUES (pre-resolved).
- `contrastPairIdx?: number` — pair index 0-16 in CONTRAST_PAIR_ORDER (for bipartite angle).
- `contrastRootFreq?: number` — corpus verse-frequency of primary contrast root (node sizing).
- `contrastPairId?: string` — primary contrast pair ID (e.g. "نور:ظلم").

### VerseLink Fields (`types.ts`)
- `pairId?: string` — contrast pair ID "rootA:rootB" (contrast links only).
- `contrastCategory?: string` — contrast category e.g. "light", "faith".

### Graph Morphology (`SemanticGraph.tsx`)
- `getContrastNodeColor(hue?, rootFreq?)` — `hsla(hue, 55+activity×25%, 45−activity×8%, 1)`.
- `getNodeRadius` contrast: `4 + min(rootFreq/300, 1) × 16`.
- Edge alpha contrast: `0.08 + strength × 0.30`.
- Edge distance contrast: `max(180, 400 × (1 − strength × 0.5))` — tense opposition spring.
- **Bipartite radial layout**: `semanticCluster = pairId + ':' + side`. ClusterAngleMap:
  - A-side: `π/2 + (pairIdx / (N-1)) × π` (left hemisphere, top to bottom).
  - B-side: `-π/2 + (pairIdx / (N-1)) × π` (right hemisphere, diametrically opposite).
  - radialStrength = 0.060 (stronger than other modes to maintain pole separation despite cross-edges).
- Hover tooltip: shows side label + category + root verse count, colored by `contrastHue`.

### getContrastTopicStats (`semanticStore.ts`)
```ts
getContrastTopicStats(pairId): { freqA, freqB, ratio, dominantSide: 'A'|'B', dominanceGap } | null
```
- Uses `cache.rootIndex[pair.rootA/rootB].verseIds.length` for corpus frequencies.

### getVerseContrastLinks (`semanticStore.ts`)
- Now uses `_contrastVerseLinks` (preloaded Supabase) instead of `cache.contrastLinks`.
- Returns enriched data: `pairId, category, partnerVerseId, score, thisSide: 'A'|'B', topicStats`.
- Capped at 20 links per verse.

### Contrast Intelligence Panel (`VerseDetail.tsx`)
- `ContrastLinkData` interface extended with `category`, `thisSide`, `topicStats`.
- `CONTRAST_PAIR_HUES` imported from contrastEngine.
- Groups links by pairId — one card per pair.
- Each card: pair header (colored labels A↔B), side indicator, **frequency asymmetry bars** (two bars with corpus counts, dominance gap, ratio, dominant side), then up to 3 partner verse excerpts with opponent side indicator dot.
- Ratio display: always shown as dominant:subordinate (e.g., `1.87:1` or `1:2.4`).

### Search Scope (Contrast Mode)
- `getVerseSearchTokensForMode(verseId, 'contrast')` returns ONLY:
  - Transliteration labels from `CONTRAST_DICTIONARY` (e.g. "nur", "zulumat", "iman", "kufr") + category.
  - English keyword expansions from `CONTRAST_LABEL_ENGLISH` (e.g. "light illumination brightness").
  - Uses `_verseContrastPairsMap` (from preloaded links) — NOT cache.contrastLinks.
  - NO translation words (unlike old implementation).

### Index.tsx Changes
- `CONTRAST_PLACEHOLDER_WORDS` imported from contrastEngine.
- `contrastTypingPlaceholder` + `contrastPlaceholderWord` via `useTypingPlaceholder`.
- `contrastFocusLevel` state + `handleContrastFocusLevel` callback.
- `setContrastFocusLevel` imported from store.
- Search bar placeholder shows `contrastTypingPlaceholder` in contrast mode.
- `effectiveSearchQuery` uses `contrastPlaceholderWord` in contrast mode (same pattern as other modes).
- Contrast Focus Level buttons (red styling, contrast mode only): `bg-red-400/20 text-red-300 border-red-400/30`.
- `contrastFocusLevel` added to `graphData` useMemo deps.
