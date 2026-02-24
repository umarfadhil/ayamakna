/**
 * seed-root-links.mjs
 * Computes and seeds ayamakna_root_verse_links (multi-layer projection).
 *
 * Two phases:
 *
 * Phase 1 — Direct root links (hop_count=1):
 *   Verses connect when they share ≥1 semantically-mapped root.
 *   similarity_score = Semantic Jaccard (shared_semantic_roots / union_of_semantic_roots_only).
 *   semantic_cluster = dominant concept_id (most-shared concept cluster).
 *
 * Phase 2 — Multi-hop links (hop_count=2):
 *   Verse A → Root A → Concept A ↔ Related Concept B → Root B → Verse B
 *   Verses connect when a root in A maps to a concept adjacent (in concept_graph_edges) to a concept
 *   mapped by a root in B. Skips pairs already connected by Phase 1.
 *   similarity_score = path_score = maxWeight(A→C_A) × edge_strength × maxWeight(B→C_B).
 *   semantic_cluster = concept on the higher-weight side of the path.
 *
 * Requires temp INSERT + DELETE policies on ayamakna_root_verse_links:
 *   CREATE POLICY "Temp INSERT" ON ayamakna_root_verse_links FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "Temp DELETE" ON ayamakna_root_verse_links FOR DELETE USING (true);
 * Drop after seeding.
 *
 * Usage: node scripts/seed-root-links.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pkwvovoiljwjjgbythsp.supabase.co';
const SUPABASE_ANON_KEY =
  '[REDACTED_SUPABASE_ANON_KEY]';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 1000;

async function fetchAll(table, columns) {
  const all = [];
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    if (!data || data.length === 0) { done = true; } else {
      all.push(...data);
      if (data.length < PAGE_SIZE) done = true;
      from += PAGE_SIZE;
    }
  }
  return all;
}

// --- Configuration ---
// Phase 1
const MAX_VERSE_FREQ = 500;       // skip roots appearing in >500 verses (too common/noisy)
const MIN_SHARED_ROOTS = 1;       // min semantically-mapped shared roots to create a direct link

// Phase 2
const MIN_EDGE_STRENGTH = 0.3;    // min concept graph edge strength to follow
const MIN_PATH_SCORE = 0.12;      // min path_score = weightA × edgeStrength × weightB
const MAX_VERSES_PER_CONCEPT = 200; // only consider top-N verses per concept (by root weight)

// Shared
const MAX_LINKS_PER_VERSE = 20;   // max total edges (hop=1 + hop=2) per verse
const BATCH_SIZE = 500;           // insert batch size

async function main() {
  console.time('total');

  // ─── Load data ───────────────────────────────────────────────────────────────

  console.log('Loading verse tokens...');
  const tokens = await fetchAll('ayamakna_verse_tokens', 'verse_id,root');
  console.log(`  ${tokens.length} tokens`);

  // verseRootSets: verseId → Set<root> (all roots including non-semantic)
  const verseRootSets = new Map();
  // rootIndex: root → Set<verseId>
  const rootIndex = new Map();

  for (const t of tokens) {
    if (!t.root) continue;
    if (!verseRootSets.has(t.verse_id)) verseRootSets.set(t.verse_id, new Set());
    verseRootSets.get(t.verse_id).add(t.root);
    if (!rootIndex.has(t.root)) rootIndex.set(t.root, new Set());
    rootIndex.get(t.root).add(t.verse_id);
  }
  console.log(`  ${verseRootSets.size} verses with roots, ${rootIndex.size} unique roots`);

  console.log('Loading root concepts...');
  const rawRootConcepts = await fetchAll('ayamakna_root_concepts', 'root,concept_id,weight');
  console.log(`  ${rawRootConcepts.length} root-concept entries`);

  // rootConceptBest: root → { conceptId, weight } (highest-weight concept for each root)
  const rootConceptBest = new Map();
  for (const rc of rawRootConcepts) {
    const existing = rootConceptBest.get(rc.root);
    if (!existing || rc.weight > existing.weight) {
      rootConceptBest.set(rc.root, { conceptId: rc.concept_id, weight: rc.weight });
    }
  }
  const rootConceptMap = new Map([...rootConceptBest.entries()].map(([root, v]) => [root, v.conceptId]));
  console.log(`  ${rootConceptMap.size} roots with semantic mapping`);

  console.log('Loading concept graph edges...');
  const rawConceptEdges = await fetchAll('ayamakna_concept_graph_edges', 'concept_a,concept_b,strength');
  console.log(`  ${rawConceptEdges.length} concept graph edges`);

  // ─── Build semantic verse root sets (for Phase 1 Semantic Jaccard denominator) ──

  const semanticVerseRootSets = new Map(); // verseId → Set<semantically-mapped root>
  for (const [verseId, roots] of verseRootSets) {
    const semRoots = new Set([...roots].filter((r) => rootConceptMap.has(r)));
    if (semRoots.size > 0) semanticVerseRootSets.set(verseId, semRoots);
  }

  // ─── Phase 1: Direct root links (hop_count = 1) ──────────────────────────────

  console.log('\nPhase 1: Computing direct root links...');

  // pairData: pairKey → { count, clusterCounts: Map<conceptId, count> }
  const pairData = new Map();

  let processedRoots = 0;
  for (const [root, verseIdSet] of rootIndex) {
    const verseIds = [...verseIdSet];
    if (verseIds.length > MAX_VERSE_FREQ || verseIds.length < 2) continue;
    const cluster = rootConceptMap.get(root);
    if (!cluster) continue; // only semantically-mapped roots

    for (let i = 0; i < verseIds.length; i++) {
      for (let j = i + 1; j < verseIds.length; j++) {
        const a = verseIds[i], b = verseIds[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const existing = pairData.get(key);
        if (existing) {
          existing.count++;
          existing.clusterCounts.set(cluster, (existing.clusterCounts.get(cluster) ?? 0) + 1);
        } else {
          pairData.set(key, { count: 1, clusterCounts: new Map([[cluster, 1]]) });
        }
      }
    }
    processedRoots++;
  }
  console.log(`  Processed ${processedRoots} semantic roots, ${pairData.size} candidate pairs`);

  // Build Phase 1 links + track direct pair set
  const directPairSet = new Set();
  const links = [];
  const verseLinkCounts = new Map();

  const sorted = [...pairData.entries()]
    .filter(([, d]) => d.count >= MIN_SHARED_ROOTS)
    .sort((a, b) => b[1].count - a[1].count);

  for (const [key, data] of sorted) {
    const [idA, idB] = key.split('|');
    const countA = verseLinkCounts.get(idA) ?? 0;
    const countB = verseLinkCounts.get(idB) ?? 0;
    if (countA >= MAX_LINKS_PER_VERSE || countB >= MAX_LINKS_PER_VERSE) continue;

    const semA = semanticVerseRootSets.get(idA) ?? new Set();
    const semB = semanticVerseRootSets.get(idB) ?? new Set();
    const semUnion = new Set([...semA, ...semB]).size;
    const score = semUnion > 0 ? data.count / semUnion : 0;

    let dominantCluster = '';
    let maxCnt = 0;
    for (const [c, cnt] of data.clusterCounts) {
      if (cnt > maxCnt) { dominantCluster = c; maxCnt = cnt; }
    }

    links.push({
      verse_a_id: idA,
      verse_b_id: idB,
      shared_roots_count: data.count,
      semantic_cluster: dominantCluster,
      similarity_score: score,
      hop_count: 1,
    });

    directPairSet.add(key);
    verseLinkCounts.set(idA, countA + 1);
    verseLinkCounts.set(idB, countB + 1);
  }

  console.log(`  ${links.length} direct links (hop=1)`);

  // ─── Phase 2: Multi-hop links (hop_count = 2) ─────────────────────────────────
  // Path: Verse A → Root A → Concept A ↔ Concept B → Root B → Verse B
  // score = maxWeight(A→C_A) × edgeStrength(C_A↔C_B) × maxWeight(B→C_B)

  console.log('\nPhase 2: Computing multi-hop links via concept graph...');

  // Build undirected concept adjacency: conceptId → [{neighbor, strength}]
  const conceptEdgeMap = new Map();
  for (const edge of rawConceptEdges) {
    if (!conceptEdgeMap.has(edge.concept_a)) conceptEdgeMap.set(edge.concept_a, []);
    conceptEdgeMap.get(edge.concept_a).push({ neighbor: edge.concept_b, strength: edge.strength });
    if (!conceptEdgeMap.has(edge.concept_b)) conceptEdgeMap.set(edge.concept_b, []);
    conceptEdgeMap.get(edge.concept_b).push({ neighbor: edge.concept_a, strength: edge.strength });
  }

  // Build: conceptId → [{verseId, maxRootWeight}] sorted desc, capped at MAX_VERSES_PER_CONCEPT
  // For each verse, the maxRootWeight is the highest root_concept weight among roots mapping to this concept
  const conceptVersesMap = new Map(); // conceptId → [{verseId, weight}]
  const verseConceptWeights = new Map(); // verseId → Map<conceptId, maxWeight>

  for (const [root, { conceptId, weight }] of rootConceptBest) {
    const verseIds = rootIndex.get(root);
    if (!verseIds) continue;
    for (const verseId of verseIds) {
      // verseConceptWeights
      if (!verseConceptWeights.has(verseId)) verseConceptWeights.set(verseId, new Map());
      const prev = verseConceptWeights.get(verseId).get(conceptId) ?? 0;
      if (weight > prev) verseConceptWeights.get(verseId).set(conceptId, weight);
    }
  }

  for (const [verseId, conceptMap] of verseConceptWeights) {
    for (const [conceptId, weight] of conceptMap) {
      if (!conceptVersesMap.has(conceptId)) conceptVersesMap.set(conceptId, []);
      conceptVersesMap.get(conceptId).push({ verseId, weight });
    }
  }

  // Sort each concept's verse list by weight desc and cap
  for (const [cId, arr] of conceptVersesMap) {
    arr.sort((a, b) => b.weight - a.weight);
    conceptVersesMap.set(cId, arr.slice(0, MAX_VERSES_PER_CONCEPT));
  }

  // For each concept edge, compute verse pairs via multi-hop path
  // multiHopCandidates: pairKey → { score, dominantCluster }
  const multiHopCandidates = new Map();
  let edgesProcessed = 0;

  for (const edge of rawConceptEdges) {
    if (edge.strength < MIN_EDGE_STRENGTH) continue;
    const { concept_a: cA, concept_b: cB, strength } = edge;

    const versesA = conceptVersesMap.get(cA) ?? [];
    const versesB = conceptVersesMap.get(cB) ?? [];
    if (versesA.length === 0 || versesB.length === 0) continue;

    for (const { verseId: vA, weight: wA } of versesA) {
      for (const { verseId: vB, weight: wB } of versesB) {
        if (vA === vB) continue;
        const key = vA < vB ? `${vA}|${vB}` : `${vB}|${vA}`;
        if (directPairSet.has(key)) continue; // already a direct link

        const pathScore = wA * strength * wB;
        if (pathScore < MIN_PATH_SCORE) continue;

        const existing = multiHopCandidates.get(key);
        if (!existing || pathScore > existing.score) {
          // Dominant cluster = concept on higher-weight side
          const dominantCluster = wA >= wB ? cA : cB;
          multiHopCandidates.set(key, { score: pathScore, dominantCluster });
        }
      }
    }
    edgesProcessed++;
  }

  console.log(`  Processed ${edgesProcessed} concept edges (strength≥${MIN_EDGE_STRENGTH}), ${multiHopCandidates.size} multi-hop candidates`);

  // Sort multi-hop candidates by score desc, apply per-verse cap
  const multiHopSorted = [...multiHopCandidates.entries()].sort((a, b) => b[1].score - a[1].score);
  let multiHopAdded = 0;

  for (const [key, { score, dominantCluster }] of multiHopSorted) {
    const [idA, idB] = key.split('|');
    const countA = verseLinkCounts.get(idA) ?? 0;
    const countB = verseLinkCounts.get(idB) ?? 0;
    if (countA >= MAX_LINKS_PER_VERSE || countB >= MAX_LINKS_PER_VERSE) continue;

    links.push({
      verse_a_id: idA,
      verse_b_id: idB,
      shared_roots_count: 0, // no direct shared roots; connection is via concept graph
      semantic_cluster: dominantCluster,
      similarity_score: score,
      hop_count: 2,
    });

    verseLinkCounts.set(idA, countA + 1);
    verseLinkCounts.set(idB, countB + 1);
    multiHopAdded++;
  }

  console.log(`  ${multiHopAdded} multi-hop links added (hop=2)`);
  console.log(`\nTotal links: ${links.length} (${links.filter(l => l.hop_count === 1).length} direct + ${links.filter(l => l.hop_count === 2).length} multi-hop)`);

  // ─── Seed to Supabase ─────────────────────────────────────────────────────────

  console.log('\nClearing existing root verse links...');
  const { error: delError } = await supabase.from('ayamakna_root_verse_links').delete().gte('id', 0);
  if (delError) {
    console.warn('Delete failed (may need DELETE policy):', delError.message);
  }

  console.log('Inserting root verse links...');
  let inserted = 0;
  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('ayamakna_root_verse_links').insert(batch);
    if (error) {
      console.error(`Batch ${i}–${i + BATCH_SIZE} failed:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    if (inserted % 5000 === 0 || inserted === links.length) {
      console.log(`  Inserted ${inserted}/${links.length}`);
    }
  }

  console.log(`\nDone! ${inserted} root verse links seeded.`);
  console.timeEnd('total');
}

main().catch((err) => { console.error(err); process.exit(1); });
