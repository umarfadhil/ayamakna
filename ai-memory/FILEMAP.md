# Filemap

## Engine Layer (Core Logic)

### Layer A — Linguistic Engine
1. `src/engine/linguistic/types.ts` — Surah, Verse (incl. `textTranslationId?: string`), Word, POS, TokenizedVerse
2. `src/engine/linguistic/rootExtractor.ts` â€” Arabic root extraction, diacritics stripping, prefix/suffix removal, tokenization
3. `src/engine/linguistic/index.ts` â€” Barrel export

### Layer B — Semantic Engine
4. `src/engine/semantic/types.ts` — Concept, VerseConcept, VerseLink, RootIndex, ActionEdge (enriched: verbText, englishMeaning, rootFrequency, semanticCluster, polarity), ActionSummary, ConceptActionComparison, ContrastPair, ContrastLink, SimilarityResult, SemanticCache, SemanticMode, ActorType (10 types), RootAnalytics, RootCentrality, RootContext, RootDensityScore
4a. `src/engine/semantic/actionDictionaries.ts` — SemanticCluster (10 categories), ActionPolarity, ACTION_CLUSTER_MAP (~130 roots), ACTION_POLARITY_MAP (~50 roots), SEMANTIC_CLUSTER_LABELS, POLARITY_LABELS, expanded actor indicator sets (PROPHET_INDICATORS, HYPOCRITE_INDICATORS, SHAYTAN_INDICATORS, MANKIND_INDICATORS)
5. `src/engine/semantic/rootEngine.ts` — Root frequency index (inverted), root→verse mapping, root-density scoring, auto-link by shared roots (O(R×V_r²)), `computeRootAnalytics()` (degree centrality, betweenness heuristic, frequency ranking, density heatmap, context per root)
6. `src/engine/semantic/contrastEngine.ts` — Contrast dictionary (17 pairs), detect contrast links via root→verse index, capped at 200/pair
7. `src/engine/semantic/actionEngine.ts` — Actor classification (10 types with priority ordering), tense detection, target classification, enriched action edge extraction (verbText, englishMeaning, rootFrequency, semanticCluster, polarity), computeActionSummary(), auto-link capped at 5000
8. `src/engine/semantic/similarityEngine.ts` — Sparse candidate-pair similarity (root+concept+verb), threshold 0.3, max 15000 results
9. `src/engine/semantic/precompute.ts` — Full pipeline orchestrator, IndexedDB async cache (24h TTL, DB_VERSION=7), cache payload shape guards, integrates rootAnalytics, threads rootTranslations to buildActionIndex
10. `src/engine/semantic/index.ts` — Barrel export

### Layer C — Visualization Engine
11. `src/engine/visualization/types.ts` — GraphNode (incl. `searchTokens?`, `heatScore?`, `centralityScore?`), GraphEdge, GraphConfig, LINK_COLORS, defaults
12. `src/engine/visualization/index.ts` — Barrel export
13. `src/engine/index.ts` — Top-level barrel

## Supabase Integration
14. `src/lib/supabase.ts` — Supabase client singleton (project: pkwvovoiljwjjgbythsp)
15. `src/lib/dataLoader.ts` — Async data fetcher: loads surahs, verses (incl. text_translation_id), root lookups, concepts, verse-concepts from Supabase with paginated fetching

## Data Layer (Legacy — used by seed script only)
16. `src/data/quranVerses.ts` — 6236 verses (114 surahs), Arabic + English translations (2.7MB)
17. `src/data/rootLookup.ts` — 11,682 word→root mappings from Quranic Arabic Corpus (364KB)
18. `src/data/conceptTags.ts` — 29 concepts, 9092 VerseConcept associations, buildConceptMap() (516KB)
19. `src/data/quranData.ts` — 114 surah metadata (name, nameAr, totalAyah)

## Scripts
20. `scripts/generate-corpus.mjs` — Node.js script: fetches Quran text + morphology + generates TS data files
21. `scripts/seed-supabase.mjs` — Seeds all data from TS files into Supabase tables
22. `scripts/seed-id-translation.mjs` — Seeds Indonesian (Kemenag) translations from alqurancloud into `ayamakna_verses.text_translation_id` (run once; requires temp UPDATE policy)

## Store Layer
23. `src/store/semanticStore.ts` — Orchestrator: Supabase fetch → async init → tokenize → cache validation/recompute fallback → `buildGraphData(mode)`, connected-nodes-only graph; exports `ROOT_KEYWORDS`, `ROOT_TRANSLATIONS`, `CONCEPT_INDONESIAN`, `getTopRoots()`, `getVersesByRoot()`, `getRootContext()`, `getRootCentrality()`, `getRootAnalyticsSummary()`, `getVerseRootsWithData()`, `VerseRootInsight`, `getVerseActionSummary()`, `getActionsByCluster()`
24. `src/store/graphStore.ts` — [Legacy] old topic-based graph logic

## Application Layer
25. `src/main.tsx` — Entry point
26. `src/App.tsx` — Router + providers
27. `src/pages/Index.tsx` — Main page: async engine init + loading screen + SemanticGraph + 5-mode toggle + search (Latin/Indonesian) + VerseDetail panel + Root Mode Panel (centrality insights with root translations, context toggle — no root filter)

## UI Components
28. `src/components/graph/SemanticGraph.tsx` — D3 Canvas graph with spatial indexing; heatmap coloring in root mode, centrality-based node sizing, root-filter fading, Latin keyword search via `searchTokens`
29. `src/components/graph/ForceGraph.tsx` — [Legacy] old D3 topic graph
30. `src/components/graph/ParticleBackground.tsx` — Ambient particle animation
31. `src/components/reader/VerseDetail.tsx` — Slide-in panel: Arabic text, English + Indonesian translation, Root Intelligence (per-root badges with translation + frequency), concepts, Action Intelligence (behavioral summary panel, semantic cluster grouping, enriched action rows with polarity/English/frequency, expandable verse context, list/flow mode toggle with mini SVG graph)
32. `src/components/reader/ReadingMode.tsx` — [Legacy] old topic detail modal
33. `src/components/admin/AdminPanel.tsx` — [Legacy] topic creation
34. `src/components/ui/` — ShadCN/Radix component library

## Config
35. `vite.config.ts` — Vite (port 8080, @ alias)
36. `tailwind.config.ts` — Dark theme, gold palette
37. `tsconfig.json` — TypeScript config
