/**
 * seed-contrast-verse-links.mjs
 * Computes and seeds ayamakna_contrast_verse_links.
 *
 * Algorithm:
 *   For each of the 17 contrast pairs in CONTRAST_DICTIONARY:
 *     - Find all verses containing rootA (from ayamakna_verse_tokens)
 *     - Find all verses containing rootB
 *     - Cross-pair them (capped at MAX_LINKS_PER_PAIR)
 *     - Apply per-verse cap with union survival rule
 *
 * verse_a_id = verse containing rootA (A-side pole)
 * verse_b_id = verse containing rootB (B-side pole)
 *
 * Requires temp INSERT + DELETE policies on ayamakna_contrast_verse_links:
 *   CREATE POLICY "Temp INSERT" ON ayamakna_contrast_verse_links FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "Temp DELETE" ON ayamakna_contrast_verse_links FOR DELETE USING (true);
 * Drop after seeding.
 *
 * Usage: node scripts/seed-contrast-verse-links.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pkwvovoiljwjjgbythsp.supabase.co';
const SUPABASE_ANON_KEY =
  '[REDACTED_SUPABASE_ANON_KEY]';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;
const MAX_LINKS_PER_PAIR = 300;   // max links per contrast pair
const MAX_VERSE_SET = 70;         // max verses to sample from each side
const MAX_LINKS_PER_VERSE = 15;   // per-verse edge cap (union survival rule)
const CONTRAST_STRENGTH = 0.8;   // fixed strength for all contrast links

// Root aliases: CONTRAST_DICTIONARY uses canonical roots, but the token DB
// stores some roots differently. Map the dictionary form → DB root.
//   ءمن → أمن  (hamza on its own vs hamza on alef)
//   ءخر → أخر  (same reason)
//   نار → نور  (the DB morphological analyser assigns نار/fire tokens to root
//               نور/light; both lemmas live under the نور root entry)
const ROOT_ALIASES = {
  'ءمن': 'أمن',
  'ءخر': 'أخر',
  'نار': 'نور',
};

// All 18 contrast pairs (mirrors contrastEngine.ts CONTRAST_DICTIONARY)
const CONTRAST_DICTIONARY = [
  { rootA: 'ءمن', rootB: 'كفر', labelA: 'iman', labelB: 'kufr', category: 'faith' },
  { rootA: 'هدي', rootB: 'ضلل', labelA: 'huda', labelB: 'dalal', category: 'guidance' },
  { rootA: 'نور', rootB: 'ظلم', labelA: 'nur', labelB: 'zulumat', category: 'light' },
  { rootA: 'جنن', rootB: 'نار', labelA: 'jannah', labelB: 'jahannam', category: 'afterlife' },
  { rootA: 'دنو', rootB: 'ءخر', labelA: 'dunya', labelB: 'akhirah', category: 'worldview' },
  { rootA: 'خير', rootB: 'شرر', labelA: 'khayr', labelB: 'sharr', category: 'morality' },
  { rootA: 'صلح', rootB: 'فسد', labelA: 'islah', labelB: 'fasad', category: 'morality' },
  { rootA: 'حقق', rootB: 'بطل', labelA: 'haqq', labelB: 'batil', category: 'truth' },
  { rootA: 'صدق', rootB: 'كذب', labelA: 'sidq', labelB: 'kadhib', category: 'truth' },
  { rootA: 'حيي', rootB: 'موت', labelA: 'hayat', labelB: 'mawt', category: 'existence' },
  { rootA: 'ثوب', rootB: 'عذب', labelA: 'thawab', labelB: 'adhab', category: 'recompense' },
  { rootA: 'رحم', rootB: 'غضب', labelA: 'rahmah', labelB: 'ghadab', category: 'divine_attribute' },
  { rootA: 'علم', rootB: 'جهل', labelA: 'ilm', labelB: 'jahl', category: 'knowledge' },
  { rootA: 'صبر', rootB: 'عجل', labelA: 'sabr', labelB: 'ajal', category: 'character' },
  { rootA: 'شكر', rootB: 'كفر', labelA: 'shukr', labelB: 'kufr_nimah', category: 'gratitude' },
  { rootA: 'طوع', rootB: 'عصي', labelA: 'taah', labelB: 'masiyah', category: 'obedience' },
  { rootA: 'ذكر', rootB: 'نسي', labelA: 'dhikr', labelB: 'nisyan', category: 'remembrance' },
  { rootA: 'رجل', rootB: 'مرأ', labelA: 'rajul', labelB: 'mara', category: 'gender' },
];

async function fetchAll(table, columns) {
  const all = [];
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) { done = true; }
    else {
      all.push(...data);
      if (data.length < PAGE_SIZE) done = true;
      from += PAGE_SIZE;
    }
  }
  return all;
}

async function insertBatch(rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('ayamakna_contrast_verse_links')
      .upsert(batch, { onConflict: 'verse_a_id,verse_b_id,pair_id', ignoreDuplicates: true });
    if (error) throw new Error(`Insert failed: ${error.message}`);
    console.log(`  Upserted rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)}`);
  }
}

async function main() {
  console.log('Loading verse tokens...');
  const tokens = await fetchAll('ayamakna_verse_tokens', 'verse_id,root,pos');
  console.log(`Loaded ${tokens.length} tokens`);

  // Build root → Set<verseId> index (skip particles and null roots)
  const rootVerseIndex = new Map();
  for (const t of tokens) {
    if (!t.root || t.pos === 'particle') continue;
    if (!rootVerseIndex.has(t.root)) rootVerseIndex.set(t.root, new Set());
    rootVerseIndex.get(t.root).add(t.verse_id);
  }
  console.log(`Built index for ${rootVerseIndex.size} roots`);

  // Clear existing data
  console.log('Clearing existing contrast verse links...');
  const { error: delError } = await supabase
    .from('ayamakna_contrast_verse_links')
    .delete()
    .neq('id', -1);
  if (delError) throw new Error(`Delete failed: ${delError.message}`);

  // Compute links for each contrast pair
  const allLinks = [];
  for (const pair of CONTRAST_DICTIONARY) {
    const pairId = `${pair.rootA}:${pair.rootB}`;
    const rootA = ROOT_ALIASES[pair.rootA] ?? pair.rootA;
    const rootB = ROOT_ALIASES[pair.rootB] ?? pair.rootB;
    const versesA = [...(rootVerseIndex.get(rootA) ?? [])].slice(0, MAX_VERSE_SET);
    const versesB = [...(rootVerseIndex.get(rootB) ?? [])].slice(0, MAX_VERSE_SET);

    if (versesA.length === 0 || versesB.length === 0) {
      console.log(`  [SKIP] ${pairId} — missing verses (A:${versesA.length}, B:${versesB.length})`);
      continue;
    }

    const setA = new Set(versesA);
    const setB = new Set(versesB);

    const pairLinks = [];
    outer: for (const vA of versesA) {
      for (const vB of versesB) {
        if (vA === vB || setA.has(vB) || setB.has(vA)) continue; // skip same-verse or reversed
        pairLinks.push({ verseA: vA, verseB: vB });
        if (pairLinks.length >= MAX_LINKS_PER_PAIR) break outer;
      }
    }

    // Apply per-verse cap with union survival rule
    const edgesByNode = new Map();
    for (const link of pairLinks) {
      for (const id of [link.verseA, link.verseB]) {
        if (!edgesByNode.has(id)) edgesByNode.set(id, []);
        edgesByNode.get(id).push(link); // push original reference for correct Set deduplication
      }
    }
    const surviving = new Set();
    for (const [, list] of edgesByNode) {
      for (const e of list.slice(0, MAX_LINKS_PER_VERSE)) surviving.add(e);
    }

    const rows = [...surviving].map(({ verseA, verseB }) => ({
      verse_a_id: verseA,
      verse_b_id: verseB,
      pair_id: pairId,
      category: pair.category,
      contrast_strength: CONTRAST_STRENGTH,
    }));

    console.log(`  ${pairId} [${pair.category}]: ${versesA.length} A-side × ${versesB.length} B-side → ${rows.length} links`);
    allLinks.push(...rows);
  }

  console.log(`\nTotal links to insert: ${allLinks.length}`);
  console.log('Inserting...');
  await insertBatch(allLinks);
  console.log('\nDone! Contrast verse links seeded successfully.');
}

main().catch((err) => { console.error(err); process.exit(1); });
