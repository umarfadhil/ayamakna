# AyaMakna — Qur'anic Semantic Intelligence System

AyaMakna is a web application that reveals hidden structural and thematic patterns in the Qur'an through computational semantic analysis. All 6,236 verses across 114 surahs are loaded, processed, and visualized as an interactive force graph. Each view mode exposes a different layer of meaning.

---

## What is AyaMakna?

The Qur'an contains 6,236 verses written in classical Arabic. AyaMakna applies linguistic and semantic computing to surface connections that are invisible to casual reading: shared trilateral roots across hundreds of verses, recurring behavioral archetypes, thematic oppositions, conceptual clustering, and composite semantic similarity.

The application runs entirely in the browser. On first load it fetches morphological data from Supabase, runs semantic precomputation, and caches results in IndexedDB (24h TTL). Subsequent loads are near-instant.

---

## Disclaimer
*This project is a computational exploration of the Qur'anic text using root analysis, semantic clustering, and graph-based modeling.*

**It is intended as**:
 - A research and educational tool
 - A structural and linguistic visualization system
 - A semantic analysis experiment
**It is not**:
 - A tafsir (exegetical interpretation)
 - A theological authority
 - A replacement for classical scholarship
 - A definitive explanation of meaning
> ***All semantic groupings, behavioral classifications, contrast pairings, and centrality measures are derived through algorithmic and linguistic modeling. They reflect structural patterns in the corpus and may not fully capture traditional interpretive nuance.***

This project does not claim doctrinal authority and does not promote any specific theological position. Users are encouraged to consult qualified scholars and classical sources for religious guidance and interpretation.
Sources
Arabic: quran.com
Translation (EN): Saheeh International
Translation (ID): King Fahad Quran Complex

---

## Five Semantic Modes

Switch between modes using the top bar. Each mode draws different edges, clusters nodes differently, and exposes a different lens on the text.

---

### 1. Root Mode

**What it shows:** Verses that share a semantically meaningful Arabic trilateral root.

**How connections are calculated:**
- Every Arabic word is traced to its trilateral root via a morphological lookup table (11,682 entries from Quranic Arabic Corpus) with a heuristic prefix/suffix fallback.
- Two verses connect if they share at least one root **and** that root maps to a semantic concept cluster (`ayamakna_root_concepts`). Purely grammatical or particle roots are excluded.
- Connections are precomputed and stored in `ayamakna_root_verse_links`. Similarity score uses **True Semantic Jaccard**: `shared_semantic_roots / union_of_semantic_roots_only` (denominator excludes particles and unmapped roots).
- A second layer of **indirect (hop=2) connections** links verses via concept adjacency: `Verse A → Root A → Concept A ↔ Concept B → Root B → Verse B`. These are shown as dashed edges and can be toggled with the "Bridges" button.

**Graph morphology:**

| Element | Encoding |
|---|---|
| Node size | Sum of `sharedRootsCount` across all root edges touching that node. Formula: `r = 4 + min(sharedRoots / 40, 1) × 20` |
| Node color | Corpus verse-frequency of the verse's dominant root: grey (≥500 verses, very common root), light gold (≥150), gold/amber (≥40), brown/orange (<40, rare root) |
| Edge thickness | `0.5 + min(sharedRootsCount, 12) × 0.35` — thicker = more shared roots |
| Edge opacity | Power-curve: `0.15 + strength^0.7 × 0.60` — strong connections clearly dominate weak ones |
| hop=1 edges | Solid gold — direct shared root |
| hop=2 edges | Dashed, muted gold — indirect concept bridge |
| Edge spring | `distance = max(35, 200 × (1 − strength × 0.85))` — high similarity pulls nodes closer |
| Layout | Hybrid Force-Directed + Radial. Nodes are pulled toward their semantic concept cluster's angular position on a ring (radius=320). |

**Focus levels:** Broad / Focused / Deep control the minimum Semantic Jaccard threshold (0.28 / 0.48 / 0.55). Higher = fewer but tighter connections.

**VerseDetail — Root Intelligence section:**
- Shows every trilateral root physically present in the verse (from morphological token data — deterministic).
- Each root badge shows: Arabic root + English translation + corpus frequency count (e.g., "رحم — Mercy 339×").
- Rare roots (frequency < 40 verses) are highlighted in orange with a dot indicator.
- Hover a badge to see Arabic root, total verse count, and centrality score.

**How to interpret:**
- Large nodes = verses that share many roots with many neighbors (structurally central).
- Brown/orange nodes = verses containing rare roots — linguistically distinctive passages.
- Tight clusters = verses that share a coherent semantic vocabulary.
- The radial layout groups clusters by underlying concept domain — similar angular position = related thematic territory.
- Search for any root keyword (e.g., "mercy", "rahma", "rahmat", "sabar", "patience") to highlight matching verses. The animated placeholder cycles through 20 Quranic concept words every ~10 seconds as an auto-highlight demo.

---

### 2. Concept Mode

**What it shows:** Verses that share Islamic thematic concepts, organized into a two-level Domain → Concept hierarchy.

**How connections are calculated:**
- 29 concepts are grouped into 9 semantic domains (e.g., Faith & Spiritual Consciousness, Eschatology & Judgment, Worship & Devotion).
- Each verse is tagged with concepts via root-to-concept associations (`ayamakna_root_concepts`, 9,686 rows).
- Two verses connect if their concept sets overlap. Similarity is **pure Concept Jaccard**: `shared_concepts / union_concepts`.
- Connections are precomputed in `ayamakna_concept_verse_links`.

**9 Concept Domains:**

| Domain | Hue | Concepts |
|---|---|---|
| Divine Essence & Attributes | Gold (45°) | Tawhid, Qadr, Rahmah, Hidayah |
| Revelation & Sacred Knowledge | Cyan (195°) | Quran, Ilm |
| Faith & Spiritual Consciousness | Violet (270°) | Iman, Taqwa, Khawf/Raja, Nur/Zulm, Tawakkul |
| Worship & Devotion | Green (140°) | Salah, Dhikr, Dua, Shukr |
| Virtue & Moral Excellence | Teal (165°) | Akhlaq, Ihsan, Adl, Sabr |
| Repentance & Divine Forgiveness | Orange (30°) | Tawbah, Maghfirah |
| Disbelief & Spiritual Opposition | Red (0°) | Kufr, Kufr/Nifaq |
| Eschatology & Judgment | Deep Blue (220°) | Qiyamah, Jannah/Nar, Hayat/Mawt |
| Social Ethics & Communal Order | Yellow-Green (85°) | Amr/Nahi, Jihad, Rizq |

**Graph morphology:**

| Element | Encoding |
|---|---|
| Node color | `hsla(domain_hue, saturation, lightness, 0.9)`. Lightness = `35% + (concept_rank − 1) × 8%`. Darker within a hue = higher-ranked/more central concept. Saturation scales with concept verse count (hub concepts are more vivid). |
| Node size | `4 + min(sharedConceptsCount / 30, 1) × 18` — structural importance in concept co-occurrence graph |
| Edge thickness | `0.5 + min(similarity_score, 1) × 3` — confidence/strength |
| Edge spring | `max(40, 220 × (1 − similarity_score × 0.85))` — semantic gravity |
| Edge color | Blue (#5a9ec4) — intra-domain edges slightly brighter |
| Layout | Radial by domain — nodes pulled toward their domain's angular position on ring |

**Focus levels:** Broad / Focused / Deep set minimum Concept Jaccard (0.15 / 0.30 / 0.48).

**How to interpret:**
- Node color identifies which domain a verse belongs to (its highest-weight concept).
- Nodes of the same hue cluster together — visually separating Faith verses (violet) from Eschatology (deep blue) from Divine (gold).
- Darker shade within a color family = that verse's dominant concept is more thematically central within its domain.
- Cross-domain edges (connecting different colors) = verses that bridge two thematic worlds.
- Search for domain or concept names (e.g., "Divine Essence", "Taqwa", "Eschatology") to highlight matching verses.

---

### 3. Action Mode

**What it shows:** Verses that share recurring behavioral patterns — who does what to whom — organized into 12 Action Families.

**How connections are calculated:**
- Every Arabic verb token in the corpus is classified into an Action Family using a deterministic dictionary of ~155 root→family mappings (`ACTION_FAMILY_MAP` in `actionDictionaries.ts`).
- Particle roots and non-verb roots are excluded.
- Two verses connect if their action root sets overlap. Similarity is **Action Jaccard**: `shared_action_roots / union_action_roots`.
- Connections are precomputed in `ayamakna_action_verse_links`.
  
**12 Action Families:**

| Family | Hue | Description |
|---|---|---|
| Worship & Devotion | Green (140°) | Prayer, submission, gratitude, faith acts |
| Moral Conduct | Teal (165°) | Righteous deeds, justice, patience, ethics |
| Divine Command & Revelation | Gold (45°) | God's commands, revealed instructions |
| Divine Creation & Providence | Yellow (60°) | God's creative acts, sustenance, sovereignty |
| Knowledge & Reflection | Cyan (195°) | Learning, pondering, observation, wisdom |
| Rejection & Denial | Red (0°) | Disbelief, mockery, rejection of truth |
| Proclamation & Warning | Orange (30°) | Calling, warning, prophetic address |
| Social Transaction | Yellow-Green (85°) | Trade, exchange, social obligations |
| Spiritual States | Violet (270°) | Fear, hope, love, inner transformation |
| Conflict & Resistance | Crimson (15°) | Fighting, opposition, struggle |
| Divine Retribution | Deep Red (350°) | Punishment, seizing, divine consequence |
| Seeking & Supplication | Deep Blue (220°) | Prayer requests, seeking, turning to God |

**Graph morphology:**

| Element | Encoding |
|---|---|
| Node color | `hsla(family_hue, 50 + activity×28%, 42 − activity×10%, 1)` where activity = `sharedActionsCount / 25`. Same family = same hue. Higher activity = more vivid and slightly darker. |
| Node size | `4 + min(sharedActionsCount / 25, 1) × 18` — behavioral centrality |
| Edge thickness | `0.5 + min(sharedActionsCount, 8) × 0.40` |
| Edge spring | `max(40, 220 × (1 − strength × 0.85))` — behavioral gravity |
| Edge color | Green (#4CAF50) |
| Layout | Radial by action family — nodes pulled toward family's angular position |

**Focus levels:** Broad / Focused / Deep set minimum Action Jaccard (0.12 / 0.25 / 0.40).

**VerseDetail — Action Intelligence section:**
- **Behavioral Summary**: dominant action family, most frequent verb (Arabic + English), tense distribution, polarity breakdown.
- **Action rows**: actor badge (color-coded by type) + Arabic verb surface form + English meaning + root frequency + polarity dot (green=positive, red=negative, grey=neutral) + action family colored dot.
- Expandable rows show full verse context with the verb highlighted in the Arabic text.
- **Flow Mode**: toggle to a mini SVG graph showing Actor → Verb → Target as directed nodes.

**How to interpret:**
- Nodes of the same color share a dominant action pattern — e.g., all green nodes are about worship acts, all red nodes involve rejection or disbelief.
- More vivid/saturated nodes are more behaviorally central (they share action patterns with many neighbors).
- Edge thickness shows how many action roots are shared — thick edges = multiple overlapping behavioral verbs.
- The radial layout clusters verses by their primary action family.
- Search "Worship & Devotion", "Social Transaction", or any action concept to highlight matching behavioral clusters.

---

### 4. Contrast Mode

**What it shows:** Verses positioned on opposite sides of 17 fundamental Qur'anic conceptual oppositions (iman↔kufr, nur↔zulumat, jannah↔nar, etc.).

**How connections are calculated:**
- 17 predefined contrast pairs are defined in `CONTRAST_DICTIONARY` with opposing Arabic root pairs.
- A verse is placed on side A if it contains a root from the A-side of a pair; side B for the B-side root.
- Two verses connect if one is on side A and the other on side B of the same contrast pair.
- Cross-pair connections are not drawn — only intra-pair opposition links.
- Precomputed in `ayamakna_contrast_verse_links` (4,155 links across 16 pairs; all links have a fixed strength of 0.8).

**17 Contrast Pairs include:** nur↔zulumat (light/darkness), iman↔kufr (faith/disbelief), jannah↔nar (paradise/fire), rahma↔adab (mercy/punishment), sabr↔jazaa (patience/punishment), haqq↔batil (truth/falsehood), and more.

**Graph morphology:**

| Element | Encoding |
|---|---|
| Node color | `hsla(pair_hue, 55 + activity×25%, 45 − activity×8%, 1)`. Each contrast pair has a unique hue for each side (A-side and B-side get different but related hues). Higher root frequency = more vivid. |
| Node size | `4 + min(rootFreq / 300, 1) × 16` — scaled by corpus frequency of the verse's primary contrast root |
| Edge spring | `max(180, 400 × (1 − strength × 0.5))` — deliberately long spring to maintain visual separation between poles |
| Edge alpha | `0.08 + strength × 0.30` |
| Layout | **Bipartite radial** — A-side (positive/light pole) occupies the left hemisphere; B-side (negative/dark pole) occupies the right hemisphere. Each pair gets a distinct vertical position. Radial strength = 0.060 (stronger than other modes to maintain pole separation). |

**Focus levels:** Broad / Focused / Deep set per-verse edge caps (15 / 8 / 3 edges per verse). Since all links have fixed strength, focus level here controls density rather than a threshold.

**VerseDetail — Contrast Intelligence section:**
- Groups contrast links by pair — one card per pair.
- Each card shows: pair header with colored A↔B labels, which side this verse is on, **frequency asymmetry bars** (corpus verse-count per root on each side, dominance gap, ratio), and up to 3 partner verse excerpts with opponent-side indicator.

**How to interpret:**
- The left hemisphere contains verses of affirmation (light, faith, paradise, mercy).
- The right hemisphere contains verses of negation or warning (darkness, disbelief, fire, punishment).
- Nodes positioned at the same vertical height are on opposite sides of the same contrast pair.
- Cross-hemisphere edges are the contrast links — they connect theologically opposed passages.
- Larger nodes on either side = verses whose root appears more frequently in the corpus (more central to that pole).
- Color identifies which contrast pair a verse belongs to — each of the 17 pairs has a unique hue on each side.

---

### 5. Similarity Mode (Under Development)

**What it shows:** Verses with high composite semantic similarity across all dimensions.

**How connections are calculated:**
- Similarity is a **weighted Jaccard composite**:
  - Root overlap: 50% weight
  - Concept overlap: 30% weight
  - Verb pattern overlap: 20% weight
- Only verse pairs scoring ≥ 0.3 composite similarity are linked. Capped at 15,000 results.
- Computed client-side via a sparse candidate-pair approach using the root inverted index to pre-screen candidates.

**Graph morphology:**

| Element | Encoding |
|---|---|
| Node color | Cluster-based (primary concept cluster of the verse) |
| Node size | Centrality-based (betweenness approximation) |
| Edge thickness | Proportional to similarity score |
| Edge color | Teal (#4FC3F7) |

**How to interpret:**
- Verses that cluster tightly share strong semantic vocabulary across roots, themes, and verb patterns simultaneously.
- Unlike Root Mode (single linguistic layer) or Concept Mode (thematic layer), Similarity Mode aggregates all three layers — the most holistic view.
- Verses appearing in tight similarity clusters with verses from different surahs indicate thematic unity across the Qur'an's structure.

---

## Cross-Mode Features

### Search

All five modes support keyword search through the search bar at the top.

- **Root/Similarity mode**: matches root translations (English), root keywords (EN/transliteration/Indonesian), verse English translation, verse Indonesian translation.
- **Concept mode**: matches domain names, concept names (EN/ID). Does NOT search verse translation text — only thematic labels.
- **Action mode**: matches action family names (EN/ID), canonical action names, family IDs.
- **Contrast mode**: matches Arabic transliteration labels (e.g. "nur", "kufr", "iman"), category names, English keyword expansions.

Multi-word AND search is supported: "Right Path" highlights only verses matching both "right" and "path".

The search bar placeholder animates through example keywords (~10s per word). When no search is active, the current placeholder word auto-highlights matching nodes in the graph.

### Isolated Verses Toggle

The Eye icon in the top bar toggles display of verses that have no connections in the current mode. Isolated verses appear as tiny dim dotted circles. When search is active and isolated verses are shown, dashed cyan edges are drawn from matched isolated nodes to their nearest matched neighbors (up to 5 edges, fade-in animation).

### Coverage Display

The bottom-left status bar shows `X% coverage` — the percentage of the 6,236 verses that are connected in the current mode. Color-coded: green (≥70%), yellow (≥40%), red (<40%).

### Verse Detail Panel

Clicking any node opens the Verse Detail panel on the right with sections in this order:

1. **Arabic text** — Uthmani script
2. **English translation** — Sahih International
3. **Indonesian translation** — Kemenag edition
4. **Root Intelligence** — all trilateral roots physically in the verse, with English translation, corpus frequency, and rarity highlighting
5. **Concepts Intelligence** — concept badges for this verse with domain context
6. **Action Intelligence** — behavioral summary + enriched action rows + flow mode SVG
7. **Contrast Intelligence** — contrast pair cards with frequency asymmetry visualization
8. **Similarity Intelligence** — top-5 most similar verses with score breakdown (root/concept/verb)

---

## Data Architecture

```
Supabase (pkwvovoiljwjjgbythsp)
├── ayamakna_surahs           (114 rows)
├── ayamakna_verses           (6,236 rows) — Arabic + English + Indonesian
├── ayamakna_verse_tokens     (82,456 rows) — word-level morphological data
├── ayamakna_root_lookups     (11,682 rows) — root dictionary
├── ayamakna_root_translations (1,657 rows) — root → English meaning
├── ayamakna_concepts         (29 rows) — with domain_id + domain_order
├── ayamakna_concept_domains  (9 rows) — domain taxonomy with HSL hues
├── ayamakna_verse_concepts   (9,092 rows) — verse ↔ concept associations
├── ayamakna_root_concepts    (9,686 rows) — root ↔ concept associations + weight
├── ayamakna_concept_graph_edges (322 rows) — concept co-occurrence adjacency
├── ayamakna_action_edges     (~2,852 rows) — precomputed verb/actor/family per verse-token
├── ayamakna_root_verse_links — precomputed semantic root connections (hop=1 + hop=2)
├── ayamakna_concept_verse_links — precomputed concept Jaccard connections
├── ayamakna_action_verse_links — precomputed action Jaccard connections
└── ayamakna_contrast_verse_links (4,155 rows) — precomputed contrast oppositions
```

All data is fetched once at startup and cached in IndexedDB (24-hour TTL). All semantic links are precomputed — no heavy computation runs in the browser on subsequent loads.

---

## Tech Stack

- **React 18** + TypeScript + Vite
- **D3.js** — Canvas-based force-directed graph with SpatialGrid hit testing
- **Tailwind CSS** + Radix UI (ShadCN)
- **Supabase** — PostgreSQL data store (REST API)
- **IndexedDB** — local semantic cache (24h TTL)

---

## Local Development

```sh
# Clone and install
git clone <YOUR_GIT_URL>
cd ayamakna
npm install

# Start dev server
npm run dev
```

Requires Node.js. The app connects to Supabase on startup — no local database setup needed.
