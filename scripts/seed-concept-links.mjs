/**
 * seed-concept-links.mjs
 * Computes and seeds ayamakna_concept_verse_links.
 *
 * Algorithm:
 *   For each pair of verses sharing ≥1 concept:
 *     similarity_score = Concept Jaccard = |shared_concepts| / |union_concepts|
 *     primary_concept_id = concept with highest average weight across the pair
 *     domain_id = domain of the primary concept
 *
 * Filters:
 *   MIN_SIMILARITY = 0.10 (minimum Jaccard to store)
 *   MAX_LINKS_PER_VERSE = 25 (top edges per verse by score)
 *
 * Requires temp INSERT + DELETE policies on ayamakna_concept_verse_links:
 *   CREATE POLICY "Temp INSERT" ON ayamakna_concept_verse_links FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "Temp DELETE" ON ayamakna_concept_verse_links FOR DELETE USING (true);
 * Drop after seeding.
 *
 * Usage: node scripts/seed-concept-links.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pkwvovoiljwjjgbythsp.supabase.co';
const SUPABASE_ANON_KEY =
  '[REDACTED_SUPABASE_ANON_KEY]';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;
const MIN_SIMILARITY = 0.10;
const MAX_LINKS_PER_VERSE = 25;

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

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`Insert ${table}: ${error.message}`);
    process.stdout.write(`  inserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log();
}

async function main() {
  console.log('Loading verse-concept data...');
  const rawVerseConcepts = await fetchAll('ayamakna_verse_concepts', 'verse_id,concept_id,weight');
  const rawConcepts = await fetchAll('ayamakna_concepts', 'id,domain_id,domain_order');

  // Build concept → domain_id lookup
  const conceptDomainMap = new Map(rawConcepts.map((c) => [c.id, c.domain_id]));

  // Build verse → [{conceptId, weight}] map
  const verseConceptMap = new Map();
  for (const vc of rawVerseConcepts) {
    if (!verseConceptMap.has(vc.verse_id)) verseConceptMap.set(vc.verse_id, []);
    verseConceptMap.get(vc.verse_id).push({ conceptId: vc.concept_id, weight: vc.weight });
  }

  // Build concept → [verseId] inverted index
  const conceptVerseIndex = new Map();
  for (const vc of rawVerseConcepts) {
    if (!conceptVerseIndex.has(vc.concept_id)) conceptVerseIndex.set(vc.concept_id, []);
    conceptVerseIndex.get(vc.concept_id).push(vc.verse_id);
  }

  console.log(`Verses with concepts: ${verseConceptMap.size}`);
  console.log('Computing concept verse pairs...');

  // Generate candidate pairs via inverted index (O(C × V_c²))
  const candidatePairs = new Map(); // "vA|vB" → Set of shared conceptIds
  let conceptsProcessed = 0;
  for (const [conceptId, verseIds] of conceptVerseIndex) {
    conceptsProcessed++;
    if (conceptsProcessed % 5 === 0) {
      process.stdout.write(`  concepts: ${conceptsProcessed}/${conceptVerseIndex.size}\r`);
    }
    // Skip concepts that appear in too many verses (noise reduction)
    if (verseIds.length > 600) continue;
    for (let i = 0; i < verseIds.length; i++) {
      for (let j = i + 1; j < verseIds.length; j++) {
        const a = verseIds[i], b = verseIds[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!candidatePairs.has(key)) candidatePairs.set(key, new Set());
        candidatePairs.get(key).add(conceptId);
      }
    }
  }
  console.log(`\nCandidate pairs: ${candidatePairs.size}`);

  // Score all pairs
  console.log('Scoring pairs...');
  const scored = [];
  let pairsProcessed = 0;
  for (const [key, sharedSet] of candidatePairs) {
    pairsProcessed++;
    if (pairsProcessed % 50000 === 0) {
      process.stdout.write(`  pairs: ${pairsProcessed}/${candidatePairs.size}\r`);
    }

    const [vA, vB] = key.split('|');
    const conceptsA = verseConceptMap.get(vA) ?? [];
    const conceptsB = verseConceptMap.get(vB) ?? [];

    if (conceptsA.length === 0 || conceptsB.length === 0) continue;

    const setA = new Set(conceptsA.map((c) => c.conceptId));
    const setB = new Set(conceptsB.map((c) => c.conceptId));
    const union = new Set([...setA, ...setB]);
    const similarity = sharedSet.size / union.size;

    if (similarity < MIN_SIMILARITY) continue;

    // Find primary concept: highest avg weight across the pair
    let primaryConceptId = null;
    let bestAvgWeight = -1;
    for (const cid of sharedSet) {
      const wA = conceptsA.find((c) => c.conceptId === cid)?.weight ?? 0;
      const wB = conceptsB.find((c) => c.conceptId === cid)?.weight ?? 0;
      const avg = (wA + wB) / 2;
      if (avg > bestAvgWeight) { bestAvgWeight = avg; primaryConceptId = cid; }
    }

    scored.push({
      verseA: vA,
      verseB: vB,
      sharedCount: sharedSet.size,
      primaryConceptId,
      domainId: primaryConceptId ? (conceptDomainMap.get(primaryConceptId) ?? null) : null,
      similarity,
    });
  }
  console.log(`\nPairs above threshold: ${scored.length}`);

  // Apply per-node cap (top MAX_LINKS_PER_VERSE per verse, union survival rule)
  console.log('Applying per-node cap...');
  const byNode = new Map();
  for (const s of scored) {
    for (const v of [s.verseA, s.verseB]) {
      if (!byNode.has(v)) byNode.set(v, []);
      byNode.get(v).push(s);
    }
  }
  for (const list of byNode.values()) list.sort((a, b) => b.similarity - a.similarity);

  const surviving = new Set();
  for (const [, list] of byNode) {
    for (const s of list.slice(0, MAX_LINKS_PER_VERSE)) surviving.add(s);
  }
  console.log(`After cap: ${surviving.size} links`);

  // Clear existing data
  console.log('Clearing existing concept verse links...');
  const { error: delError } = await supabase.from('ayamakna_concept_verse_links').delete().neq('id', 0);
  if (delError) throw new Error(`Delete: ${delError.message}`);

  // Build insert rows
  const rows = [...surviving].map((s) => ({
    verse_a_id: s.verseA,
    verse_b_id: s.verseB,
    shared_concepts_count: s.sharedCount,
    primary_concept_id: s.primaryConceptId,
    domain_id: s.domainId,
    similarity_score: parseFloat(s.similarity.toFixed(6)),
  }));

  console.log(`Inserting ${rows.length} concept verse links...`);
  await batchInsert('ayamakna_concept_verse_links', rows);

  console.log(`Done! Seeded ${rows.length} concept verse links.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
