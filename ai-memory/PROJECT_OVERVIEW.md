# Project Overview

AyaMakna is a **Qur'anic Semantic Intelligence System** — a React/TypeScript application that reveals hidden meaning in the Qur'an through computational semantic analysis.

## Core Purpose
Uncover deep Qur'anic patterns via:
- **Root repetition** — tracking shared trilateral roots across verses, with centrality analytics (degree, betweenness, frequency ranking)
- **Concept clustering** — grouping verses by semantic themes
- **Action Intelligence Engine** — modeling behavioral patterns: who does what to whom (10 actor types), semantic clustering (10 categories), polarity tagging, tense distribution, with behavioral summary and flow visualization
- **Contrast mapping** — detecting opposing pairs (iman↔kufr, nur↔zulumat, etc.)
- **Semantic similarity** — composite scoring across all dimensions
- **Latin/keyword search** — search by English/Indonesian keywords (e.g. "patience", "sabar") across all modes
- **Root density heatmap** — color nodes by linguistic richness (teal → gold gradient)
- **Root context analytics** — derived forms, POS distribution, Meccan/Medinan distribution per root

## Architecture (3 Layers)

**Layer A — Linguistic Engine** (`src/engine/linguistic/`)
Morphological parsing, root extraction (lookup + heuristic), POS tagging, verse tokenization.

**Layer B — Semantic Engine** (`src/engine/semantic/`)
Root clustering (inverted index), concept tagging, sparse similarity scoring, contrast pairing, action mapping, precompute pipeline with IndexedDB caching.

**Layer C — Visualization Engine** (`src/engine/visualization/` + `src/components/graph/SemanticGraph.tsx`)
D3 Canvas-based force graph with spatial indexing, mode-driven edge filtering, cluster-based coloring. Only shows connected nodes per mode.

## Data Pipeline
Data stored in **Supabase** (project: `pkwvovoiljwjjgbythsp`):
- `ayamakna_surahs` (114) → `ayamakna_verses` (6236, incl. `text_translation_id` Indonesian Kemenag) → `ayamakna_root_lookups` (11682) → `ayamakna_concepts` (29) → `ayamakna_verse_concepts` (9092) → `ayamakna_action_edges` (~15-25K precomputed action edges)

App flow: Supabase fetch → `semanticStore` async init → tokenization → engines → IndexedDB cache → graph data.

Auto-generated via `scripts/generate-corpus.mjs` from `api.alquran.cloud` + `mustafa0x/quran-morphology`.
Seeded via `scripts/seed-supabase.mjs`. Indonesian translations seeded via `scripts/seed-id-translation.mjs` (source: `api.alquran.cloud/v1/quran/id.indonesian`).

## UX Modes
5 toggleable semantic modes: **Root**, **Concept**, **Action**, **Contrast**, **Similarity**.
Each mode filters visible edges and clusters nodes by the active semantic dimension.
Loading screen shown during async data fetch + computation.

**Root Mode extras**: left-side panel with centrality insights (most connected, bridge, most frequent) — each shows Arabic root + English conceptual translation. Context toggle (forms, POS distribution, Meccan/Medinan distribution). Heatmap coloring when no filter active; selecting a root from centrality insights fades non-matching nodes/edges. **Root Intelligence section** in VerseDetail: per-verse root badges with English translation + corpus frequency, sorted by frequency desc, rare roots highlighted in orange.

**Action Mode extras**: Behavioral Intelligence Engine. 10 actor types (Allah, Believer, Disbeliever, Prophet, Hypocrite, Shaytan, Angel, Mankind, Human, Nature) with distinct badge colors. Each action shows Arabic verb + English translation + root frequency + polarity (positive/negative/neutral). Actions grouped by 10 semantic clusters (Belief & Faith, Knowledge, Worship, Speech, Conflict, Movement, Emotional States, Punishment & Reward, Social Interaction, Deception & Corruption) in collapsible sections. Behavioral Summary Panel shows dominant actor, top verb, category, polarity, and tense distribution bar. Flow Mode toggles to mini SVG graph showing Actor → Verb → Target relationships. Expandable action rows reveal full verse context with highlighted verb.

**Search**: Latin/Indonesian keywords search through `searchTokens` on each node (translation words + concept names EN/ID + root keywords EN/transliteration/ID via `ROOT_KEYWORDS` + `CONCEPT_INDONESIAN` maps in `semanticStore.ts`).

## Tech Stack
- React 18 + TypeScript + Vite
- D3.js (Canvas-based force graph with spatial indexing)
- Tailwind CSS + Radix UI (ShadCN)
- **Supabase** for data storage (PostgreSQL + REST API)
- `@supabase/supabase-js` client
- IndexedDB for semantic cache (24h TTL), async initialization
- Cache sanity guard: stale/invalid cache payloads are cleared and recomputed automatically
- Precomputed semantic links, scale-optimized for 6236 verses
