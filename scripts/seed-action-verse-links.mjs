/**
 * seed-action-verse-links.mjs
 * Computes and seeds ayamakna_action_verse_links.
 *
 * Algorithm:
 *   For each pair of verses sharing ≥1 action root:
 *     similarity_score = Action Jaccard = |shared_action_roots| / |union_action_roots|
 *     primary_action_family = dominant action family among shared roots
 *     shared_actions_count = count of shared action roots
 *
 * Filters:
 *   MIN_SIMILARITY = 0.10 (minimum Jaccard to store)
 *   MAX_LINKS_PER_VERSE = 25 (top edges per verse by score)
 *   MAX_ROOT_VERSES = 500 (skip hyper-frequent roots to reduce noise)
 *
 * Requires temp INSERT + DELETE policies on ayamakna_action_verse_links:
 *   CREATE POLICY "Temp INSERT" ON ayamakna_action_verse_links FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "Temp DELETE" ON ayamakna_action_verse_links FOR DELETE USING (true);
 * Drop after seeding.
 *
 * Usage: node scripts/seed-action-verse-links.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './_supabaseEnv.mjs';

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseEnv();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;
const MIN_SIMILARITY = 0.10;
const MAX_LINKS_PER_VERSE = 25;
const MAX_ROOT_VERSES = 500; // skip hyper-frequent roots (noise)

// Inline ACTION_FAMILY_MAP (mirrors actionDictionaries.ts — update if families change)
const ACTION_FAMILY_MAP = {
  // worship_devotion
  'صلو': 'worship_devotion', 'صوم': 'worship_devotion', 'زكو': 'worship_devotion',
  'حج': 'worship_devotion', 'عبد': 'worship_devotion', 'سجد': 'worship_devotion',
  'ركع': 'worship_devotion', 'ذكر': 'worship_devotion', 'تسبح': 'worship_devotion',
  'حمد': 'worship_devotion', 'شكر': 'worship_devotion', 'توب': 'worship_devotion',
  'استغفر': 'worship_devotion', 'خشع': 'worship_devotion', 'تقو': 'worship_devotion',
  // moral_conduct
  'عدل': 'moral_conduct', 'قسط': 'moral_conduct', 'صدق': 'moral_conduct',
  'امن': 'moral_conduct', 'وفي': 'moral_conduct', 'صبر': 'moral_conduct',
  'عفو': 'moral_conduct', 'رحم': 'moral_conduct', 'برر': 'moral_conduct',
  'إحسن': 'moral_conduct', 'حسن': 'moral_conduct', 'حفظ': 'moral_conduct',
  // divine_command
  'أمر': 'divine_command', 'نهي': 'divine_command', 'حكم': 'divine_command',
  'شرع': 'divine_command', 'فرض': 'divine_command', 'أوحي': 'divine_command',
  'أنزل': 'divine_command', 'بعث': 'divine_command', 'أرسل': 'divine_command',
  'هدي': 'divine_command', 'أهدي': 'divine_command',
  // divine_creation
  'خلق': 'divine_creation', 'جعل': 'divine_creation', 'صور': 'divine_creation',
  'رزق': 'divine_creation', 'أحيي': 'divine_creation', 'أمات': 'divine_creation',
  'بسط': 'divine_creation', 'قبض': 'divine_creation', 'فطر': 'divine_creation',
  'أنشأ': 'divine_creation', 'قدر': 'divine_creation',
  // knowledge_reflection
  'علم': 'knowledge_reflection', 'عقل': 'knowledge_reflection', 'فقه': 'knowledge_reflection',
  'تدبر': 'knowledge_reflection', 'تفكر': 'knowledge_reflection', 'نظر': 'knowledge_reflection',
  'سمع': 'knowledge_reflection', 'قرأ': 'knowledge_reflection', 'كتب': 'knowledge_reflection',
  'فهم': 'knowledge_reflection', 'حكم': 'knowledge_reflection', 'بصر': 'knowledge_reflection',
  // rejection_denial
  'كفر': 'rejection_denial', 'كذب': 'rejection_denial', 'أشرك': 'rejection_denial',
  'جحد': 'rejection_denial', 'أنكر': 'rejection_denial', 'استكبر': 'rejection_denial',
  'عصي': 'rejection_denial', 'فسق': 'rejection_denial', 'ضل': 'rejection_denial',
  'أعرض': 'rejection_denial', 'أبي': 'rejection_denial',
  // proclamation_warning
  'دعو': 'proclamation_warning', 'بلغ': 'proclamation_warning', 'أنذر': 'proclamation_warning',
  'بشر': 'proclamation_warning', 'شهد': 'proclamation_warning', 'قول': 'proclamation_warning',
  'نادي': 'proclamation_warning', 'خطب': 'proclamation_warning', 'ذكر': 'proclamation_warning',
  'تلو': 'proclamation_warning', 'أقام': 'proclamation_warning',
  // social_transaction
  'نكح': 'social_transaction', 'طلق': 'social_transaction', 'بيع': 'social_transaction',
  'اشتري': 'social_transaction', 'وارث': 'social_transaction', 'أنفق': 'social_transaction',
  'أعطي': 'social_transaction', 'أخذ': 'social_transaction', 'عقد': 'social_transaction',
  'شارك': 'social_transaction', 'قرض': 'social_transaction', 'أدي': 'social_transaction',
  // spiritual_states
  'خاف': 'spiritual_states', 'رجا': 'spiritual_states', 'حب': 'spiritual_states',
  'توكل': 'spiritual_states', 'يقن': 'spiritual_states', 'غضب': 'spiritual_states',
  'حزن': 'spiritual_states', 'فرح': 'spiritual_states', 'وجل': 'spiritual_states',
  'اطمأن': 'spiritual_states', 'قنط': 'spiritual_states', 'أمل': 'spiritual_states',
  // conflict_resistance
  'جهد': 'conflict_resistance', 'قتل': 'conflict_resistance', 'دفع': 'conflict_resistance',
  'نصر': 'conflict_resistance', 'أعد': 'conflict_resistance', 'حارب': 'conflict_resistance',
  'أسلم': 'conflict_resistance', 'صمد': 'conflict_resistance', 'مقاوم': 'conflict_resistance',
  // divine_retribution
  'عذب': 'divine_retribution', 'لعن': 'divine_retribution', 'غضب': 'divine_retribution',
  'سخط': 'divine_retribution', 'أهلك': 'divine_retribution', 'أخذ': 'divine_retribution',
  'عاقب': 'divine_retribution', 'انتقم': 'divine_retribution', 'جزي': 'divine_retribution',
  'حاسب': 'divine_retribution',
  // seeking_supplication
  'سأل': 'seeking_supplication', 'استعن': 'seeking_supplication', 'طلب': 'seeking_supplication',
  'رغب': 'seeking_supplication', 'تضرع': 'seeking_supplication', 'ابتهل': 'seeking_supplication',
  'نجو': 'seeking_supplication', 'استجار': 'seeking_supplication', 'لجأ': 'seeking_supplication',
};

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
  console.log('Loading action edges from Supabase...');
  const rawEdges = await fetchAll('ayamakna_action_edges', 'verse_id,action_root,semantic_cluster');
  console.log(`Loaded ${rawEdges.length} action edges`);

  // Build verse → Set<action_root> map (deduplicated per verse)
  const verseRootMap = new Map(); // verseId → Set<root>
  for (const e of rawEdges) {
    if (!verseRootMap.has(e.verse_id)) verseRootMap.set(e.verse_id, new Set());
    verseRootMap.get(e.verse_id).add(e.action_root);
  }
  console.log(`Verses with action edges: ${verseRootMap.size}`);

  // Build inverted index: action_root → [verseId] (for efficient pair generation)
  const rootVerseIndex = new Map();
  for (const [verseId, roots] of verseRootMap) {
    for (const root of roots) {
      if (!rootVerseIndex.has(root)) rootVerseIndex.set(root, []);
      rootVerseIndex.get(root).push(verseId);
    }
  }

  // Build verse → Set<action_family> for family lookup
  const verseFamilyMap = new Map(); // verseId → Map<family, count>
  for (const e of rawEdges) {
    const family = ACTION_FAMILY_MAP[e.action_root] ?? e.semantic_cluster ?? null;
    if (!family) continue;
    if (!verseFamilyMap.has(e.verse_id)) verseFamilyMap.set(e.verse_id, new Map());
    const fm = verseFamilyMap.get(e.verse_id);
    fm.set(family, (fm.get(family) ?? 0) + 1);
  }

  console.log('Computing action verse pairs...');

  // Generate candidate pairs via inverted index
  const candidatePairs = new Map(); // "vA|vB" → Set<shared_root>
  let rootsProcessed = 0;
  for (const [root, verseIds] of rootVerseIndex) {
    rootsProcessed++;
    if (rootsProcessed % 100 === 0) {
      process.stdout.write(`  roots: ${rootsProcessed}/${rootVerseIndex.size}\r`);
    }
    // Skip hyper-frequent roots (noise reduction)
    if (verseIds.length > MAX_ROOT_VERSES) continue;
    for (let i = 0; i < verseIds.length; i++) {
      for (let j = i + 1; j < verseIds.length; j++) {
        const a = verseIds[i], b = verseIds[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!candidatePairs.has(key)) candidatePairs.set(key, new Set());
        candidatePairs.get(key).add(root);
      }
    }
  }
  console.log(`\nCandidate pairs: ${candidatePairs.size}`);

  // Score all pairs
  console.log('Scoring pairs...');
  const scored = [];
  let pairsProcessed = 0;
  for (const [key, sharedRoots] of candidatePairs) {
    pairsProcessed++;
    if (pairsProcessed % 50000 === 0) {
      process.stdout.write(`  pairs: ${pairsProcessed}/${candidatePairs.size}\r`);
    }

    const [vA, vB] = key.split('|');
    const rootsA = verseRootMap.get(vA);
    const rootsB = verseRootMap.get(vB);
    if (!rootsA || !rootsB) continue;

    const union = new Set([...rootsA, ...rootsB]);
    const similarity = sharedRoots.size / union.size;

    if (similarity < MIN_SIMILARITY) continue;

    // Find dominant action family among shared roots
    const familyCounts = new Map();
    for (const root of sharedRoots) {
      const family = ACTION_FAMILY_MAP[root];
      if (family) familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    }
    let primaryActionFamily = null;
    let bestCount = 0;
    for (const [fam, cnt] of familyCounts) {
      if (cnt > bestCount) { primaryActionFamily = fam; bestCount = cnt; }
    }

    scored.push({ verseA: vA, verseB: vB, sharedCount: sharedRoots.size, primaryActionFamily, similarity });
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
  console.log('Clearing existing action verse links...');
  const { error: delError } = await supabase.from('ayamakna_action_verse_links').delete().neq('id', 0);
  if (delError) throw new Error(`Delete: ${delError.message}`);

  // Build insert rows
  const rows = [...surviving].map((s) => ({
    verse_a_id: s.verseA,
    verse_b_id: s.verseB,
    shared_actions_count: s.sharedCount,
    primary_action_family: s.primaryActionFamily,
    similarity_score: parseFloat(s.similarity.toFixed(6)),
  }));

  console.log(`Inserting ${rows.length} action verse links...`);
  await batchInsert('ayamakna_action_verse_links', rows);

  console.log(`\nDone! Seeded ${rows.length} action verse links.`);
  console.log('\nRemember to drop temp policies after seeding:');
  console.log('  DROP POLICY "Temp INSERT" ON ayamakna_action_verse_links;');
  console.log('  DROP POLICY "Temp DELETE" ON ayamakna_action_verse_links;');
}

main().catch((err) => { console.error(err); process.exit(1); });
