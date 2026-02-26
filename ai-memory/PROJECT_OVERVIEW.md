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

**Linguistic (Service A):**
- `ayamakna_surahs` (114) → `ayamakna_verses` (6236) → `ayamakna_root_lookups` (11682) → `ayamakna_root_translations` (1651) → **`ayamakna_verse_tokens` (82456)** — word-level ground truth

**Semantic (Service B):**
- `ayamakna_concept_domains` (9) — high-level domain taxonomy with HSL hue per domain
- `ayamakna_concepts` (29, incl. `domain_id` + `domain_order`) → `ayamakna_verse_concepts` (9092) → **`ayamakna_root_concepts` (9686)** — root→concept associations → **`ayamakna_concept_graph_edges` (322)** — concept adjacency
- `ayamakna_concept_verse_links` — precomputed concept-mode verse connections (pure concept Jaccard)

**Action:**
- `ayamakna_action_edges` (2852 precomputed action edges)

**Root Verse Links (precomputed):**
- `ayamakna_root_verse_links` — semantic root-based verse connections (verse_a_id, verse_b_id, shared_roots_count, semantic_cluster, similarity_score). Seeded via `scripts/seed-root-links.mjs`.

App flow: Supabase fetch → `semanticStore` async init → tokenization → engines → IndexedDB cache → graph data.

Auto-generated via `scripts/generate-corpus.mjs` from `api.alquran.cloud` + `mustafa0x/quran-morphology`.
Seeded via `scripts/seed-supabase.mjs`. Indonesian translations seeded via `scripts/seed-id-translation.mjs` (source: `api.alquran.cloud/v1/quran/id.indonesian`).

## UX Modes
5 toggleable semantic modes: **Root**, **Concept**, **Action**, **Contrast**, **Similarity**.
Each mode filters visible edges and clusters nodes by the active semantic dimension.
Loading screen shown during async data fetch + computation.

**Root Mode extras**: left-side panel with centrality insights. Graph morphology: node size = shared-root count with visible neighbors; node color = root frequency (grey=common, gold=medium, brown=rare); edge thickness = shared root count; edge distance = similarity-based spring (similar → closer); hybrid Force-Directed + Radial layout (nodes pulled toward concept-cluster angular positions). Auto-highlight animates through placeholder keywords every ~10s. **Root Intelligence section** in VerseDetail: per-verse root badges with English translation + corpus frequency, sorted by frequency desc, rare roots highlighted in orange.

**Action Mode extras**: Behavioral Intelligence Engine. 10 actor types (Allah, Believer, Disbeliever, Prophet, Hypocrite, Shaytan, Angel, Mankind, Human, Nature) with distinct badge colors. Each action shows Arabic verb + English translation + root frequency + polarity (positive/negative/neutral). Actions grouped by 10 semantic clusters (Belief & Faith, Knowledge, Worship, Speech, Conflict, Movement, Emotional States, Punishment & Reward, Social Interaction, Deception & Corruption) in collapsible sections. Behavioral Summary Panel shows dominant actor, top verb, category, polarity, and tense distribution bar. Flow Mode toggles to mini SVG graph showing Actor → Verb → Target relationships. Expandable action rows reveal full verse context with highlighted verb.

**Concept Mode extras** (redesign in progress — see SESSION_LEARNINGS.md): Two-level structure (Verse → Concept → Domain). 9 domains each with 3–5 concepts. Node color = domain hue + concept-rank lightness within domain. Edge thickness = concept Jaccard strength. Radial layout by domain. Focus levels (broad/focused/deep). Left panel with domain insights.

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
