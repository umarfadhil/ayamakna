#!/usr/bin/env node
// =============================================================================
// Seed Linguistic Data into Supabase
// Populates:
//   1. ayamakna_verse_tokens  — word-level tokens per verse (Service A ground truth)
//   2. ayamakna_root_concepts — root→concept associations (Service B lookup)
//
// Prerequisites:
//   Add temporary INSERT policies for both tables before running:
//     CREATE POLICY "Temp insert verse_tokens" ON ayamakna_verse_tokens FOR INSERT WITH CHECK (true);
//     CREATE POLICY "Temp insert root_concepts" ON ayamakna_root_concepts FOR INSERT WITH CHECK (true);
//   Drop them after seeding.
//
// Usage: node scripts/seed-linguistic-data.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pkwvovoiljwjjgbythsp.supabase.co';
const SUPABASE_ANON_KEY = '[REDACTED_SUPABASE_ANON_KEY]';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Diacritics stripping (mirrors rootExtractor.ts) ---
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;
function stripDiacritics(text) {
  return text.replace(DIACRITICS, '');
}

// --- Arabic particle set (function words that get NULL root) ---
// Covers: prepositions, conjunctions, pronouns, demonstratives,
// relative pronouns, negation, conditional, modal, vocative, response particles.
const PARTICLE_SET = new Set([
  // Prepositions
  'في', 'من', 'إلى', 'على', 'عن', 'مع', 'ب', 'ل', 'ك', 'حتى', 'منذ', 'خلال',
  // Conjunctions
  'و', 'ف', 'ثم', 'أو', 'أم', 'لكن', 'بل', 'لا', 'ولا',
  // Pronouns (personal)
  'هو', 'هي', 'هم', 'هن', 'هما', 'أنت', 'أنتم', 'أنتن', 'أنتما', 'أنا', 'نحن',
  // Object/possessive pronouns (attached form as standalone lemma)
  'ه', 'ها', 'هم', 'هن', 'ك', 'كم', 'كن', 'نا', 'ي',
  // Demonstratives
  'هذا', 'هذه', 'ذلك', 'تلك', 'هؤلاء', 'أولئك', 'هذان', 'هاتان', 'ذانك', 'تانك',
  // Relative pronouns
  'الذي', 'التي', 'الذين', 'اللواتي', 'اللاتي', 'اللذان', 'اللتان',
  // Interrogatives (used as particles)
  'ما', 'ماذا', 'من', 'أين', 'متى', 'كيف', 'لماذا', 'هل', 'أ',
  // Negation
  'لم', 'لن', 'لا', 'ليس', 'لات', 'ما', 'لما',
  // Conditional & response
  'إن', 'إذا', 'لو', 'لولا', 'لوما', 'أما', 'إما', 'نعم', 'بلى', 'لا', 'كلا',
  // Modal / future
  'سوف', 'س', 'قد',
  // Vocative
  'يا', 'أيها', 'أيتها',
  // Other function words
  'إنما', 'إن', 'أن', 'كأن', 'لأن', 'كي', 'لكي', 'حتى', 'قبل', 'بعد',
  'عند', 'لدى', 'لدن', 'تجاه', 'إزاء', 'حول', 'فوق', 'تحت', 'أمام', 'وراء',
  'بين', 'وسط', 'خلف', 'دون', 'غير', 'سوى', 'إلا', 'حاشا', 'خلا', 'عدا',
  // Common Quranic particles (diacritics-stripped)
  'الا', 'انما', 'ان', 'لكن', 'بلى', 'كلا', 'فلما', 'لما',
]);

/**
 * Classify the POS of a token.
 * Returns one of: 'noun' | 'verb' | 'particle'
 * We use three signals:
 *   1. If lemma (diacritics-stripped) is in the PARTICLE_SET → 'particle'
 *   2. If no root found (null) → 'particle' (most unrecognised tokens are function words)
 *   3. Otherwise → 'noun' (default for lexical words; we don't distinguish verb/adj here
 *      without a morphological analyser, but 'noun' is sufficient for root-nullification logic)
 */
function classifyPOS(lemma, root) {
  if (PARTICLE_SET.has(lemma)) return 'particle';
  if (!root) return 'particle';
  return 'noun'; // covers nouns, verbs, adjectives — all lexical
}

// --- Paginated fetch helper ---
async function fetchAll(table, columns) {
  const PAGE_SIZE = 1000;
  const all = [];
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) {
      done = true;
    } else {
      all.push(...data);
      if (data.length < PAGE_SIZE) done = true;
      from += PAGE_SIZE;
    }
  }
  return all;
}

// --- Batch upsert helper ---
async function batchInsert(table, rows, batchSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`Insert failed for ${table}: ${error.message}`);
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length} rows`);
  }
  console.log(); // newline
}

async function main() {
  console.log('=== Seeding Linguistic Data ===\n');

  // --- 1. Fetch source data ---
  console.log('Fetching source data from Supabase...');
  const [rawVerses, rawRoots, rawVerseConcepts] = await Promise.all([
    fetchAll('ayamakna_verses', 'id,text_arabic'),
    fetchAll('ayamakna_root_lookups', 'word,root'),
    fetchAll('ayamakna_verse_concepts', 'verse_id,concept_id,weight'),
  ]);
  console.log(`  Verses: ${rawVerses.length}, Root lookups: ${rawRoots.length}, Verse-concepts: ${rawVerseConcepts.length}`);

  // --- 2. Build root lookup map (diacritics-stripped keys) ---
  const rootLookup = new Map();
  for (const r of rawRoots) {
    rootLookup.set(stripDiacritics(r.word), r.root);
  }

  // --- 3. Tokenize all verses → ayamakna_verse_tokens ---
  console.log('\nTokenizing verses...');
  const tokenRows = [];
  // Map: verse_id → Map<root, count> for later use in root_concepts
  const verseRootMap = new Map(); // verse_id → Set<root>

  for (const verse of rawVerses) {
    const words = verse.text_arabic.trim().split(/\s+/).filter(Boolean);
    const verseRoots = new Set();

    for (let i = 0; i < words.length; i++) {
      const surface = words[i];
      const lemma = stripDiacritics(surface);
      const rawRoot = rootLookup.get(lemma) || null;
      const pos = classifyPOS(lemma, rawRoot);
      // Only lexical words (noun/verb/adjective) carry a root; particles get NULL
      const root = pos === 'particle' ? null : rawRoot;

      tokenRows.push({
        id: `${verse.id}:${i}`,
        verse_id: verse.id,
        surface,
        lemma,
        root,
        pos,
        position: i,
      });

      if (root) verseRoots.add(root);
    }

    verseRootMap.set(verse.id, verseRoots);
  }
  console.log(`  Total tokens: ${tokenRows.length}`);

  // Clear existing tokens before re-seeding
  console.log('Clearing existing verse_tokens...');
  const { error: deleteErr } = await supabase.from('ayamakna_verse_tokens').delete().neq('id', '__never__');
  if (deleteErr) console.warn('  Warning: could not clear verse_tokens:', deleteErr.message);

  console.log('Inserting verse_tokens...');
  await batchInsert('ayamakna_verse_tokens', tokenRows, 1000);

  // --- 4. Derive root_concepts ---
  // For each (root, concept_id) pair: collect weight of each co-occurring verse, then average.
  console.log('\nDeriving root→concept associations...');

  // Map: `${root}|${conceptId}` → { totalWeight, count }
  const rcAccum = new Map();

  for (const vc of rawVerseConcepts) {
    const roots = verseRootMap.get(vc.verse_id);
    if (!roots) continue;

    for (const root of roots) {
      const key = `${root}|${vc.concept_id}`;
      const existing = rcAccum.get(key);
      if (existing) {
        existing.totalWeight += vc.weight;
        existing.count++;
      } else {
        rcAccum.set(key, { root, conceptId: vc.concept_id, totalWeight: vc.weight, count: 1 });
      }
    }
  }

  const rootConceptRows = [];
  for (const { root, conceptId, totalWeight, count } of rcAccum.values()) {
    rootConceptRows.push({
      root,
      concept_id: conceptId,
      weight: totalWeight / count, // average weight
      verse_count: count,
    });
  }
  console.log(`  Total root-concept pairs: ${rootConceptRows.length}`);

  // Clear existing root_concepts before re-seeding
  console.log('Clearing existing root_concepts...');
  const { error: rcDeleteErr } = await supabase.from('ayamakna_root_concepts').delete().neq('root', '__never__');
  if (rcDeleteErr) console.warn('  Warning: could not clear root_concepts:', rcDeleteErr.message);

  console.log('Inserting root_concepts...');
  await batchInsert('ayamakna_root_concepts', rootConceptRows, 500);

  // --- 5. Summary ---
  console.log('\n=== Seed Complete ===');
  const [{ count: tkCount }] = (await supabase.from('ayamakna_verse_tokens').select('*', { count: 'exact', head: true })).data ?? [{ count: 0 }];
  const [{ count: rcCount }] = (await supabase.from('ayamakna_root_concepts').select('*', { count: 'exact', head: true })).data ?? [{ count: 0 }];
  console.log(`  ayamakna_verse_tokens:  ${tokenRows.length} rows`);
  console.log(`  ayamakna_root_concepts: ${rootConceptRows.length} rows`);
  console.log('\nDone! Remember to drop the temp INSERT policies.');
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
