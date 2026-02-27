#!/usr/bin/env node
// =============================================================================
// Seed AyaMakna data into Supabase
// Usage: node scripts/seed-supabase.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './_supabaseEnv.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src', 'data');

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseEnv();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Parsing helpers ---

function parseSurahs() {
  const raw = fs.readFileSync(path.join(SRC, 'quranData.ts'), 'utf-8');
  const surahs = [];
  const regex = /\{\s*number:\s*(\d+),\s*name:\s*"([^"]+)",\s*nameAr:\s*"([^"]+)",\s*totalAyah:\s*(\d+)\s*\}/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    surahs.push({
      number: parseInt(match[1]),
      name: match[2],
      name_ar: match[3],
      total_ayah: parseInt(match[4]),
    });
  }
  return surahs;
}

function parseConcepts() {
  const raw = fs.readFileSync(path.join(SRC, 'conceptTags.ts'), 'utf-8');
  const concepts = [];
  // Match: { id: 'x', name: 'x', nameAr: 'x', description: 'x' }
  const regex = /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*nameAr:\s*'([^']+)',\s*description:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    concepts.push({
      id: match[1],
      name: match[2],
      name_ar: match[3],
      description: match[4],
    });
  }
  return concepts;
}

function parseQuranVerses() {
  const raw = fs.readFileSync(path.join(SRC, 'quranVerses.ts'), 'utf-8');
  const verses = [];
  const regex = /\{\s*id:\s*'([^']+)',\s*surahId:\s*(\d+),\s*ayahNumber:\s*(\d+),\s*textArabic:\s*'((?:[^'\\]|\\.)*)'\s*,\s*textTranslation:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    verses.push({
      id: match[1],
      surah_id: parseInt(match[2]),
      ayah_number: parseInt(match[3]),
      text_arabic: match[4].replace(/\\'/g, "'"),
      text_translation: match[5].replace(/\\'/g, "'"),
    });
  }
  return verses;
}

function parseRootLookups() {
  const raw = fs.readFileSync(path.join(SRC, 'rootLookup.ts'), 'utf-8');
  const lookups = [];
  const regex = /^\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'\s*,?\s*$/gm;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    lookups.push({
      word: match[1].replace(/\\'/g, "'"),
      root: match[2].replace(/\\'/g, "'"),
    });
  }
  return lookups;
}

function parseVerseConcepts() {
  const raw = fs.readFileSync(path.join(SRC, 'conceptTags.ts'), 'utf-8');
  const vcs = [];
  const regex = /\{\s*verseId:\s*'([^']+)',\s*conceptId:\s*'([^']+)',\s*weight:\s*([\d.]+)\s*\}/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    vcs.push({
      verse_id: match[1],
      concept_id: match[2],
      weight: parseFloat(match[3]),
    });
  }
  return vcs;
}

// --- Batch upsert helper ---

async function batchUpsert(table, rows, conflictCol, batchSize = 500) {
  console.log(`  Inserting ${rows.length} rows into ${table}...`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictCol });
    if (error) {
      console.error(`  Error at batch ${i}-${i + batch.length}:`, error.message);
      continue;
    }
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${rows.length}`);
  }
  console.log(`\n  Done: ${inserted} rows.`);
}

// --- Main ---

async function main() {
  console.log('=== AyaMakna Supabase Seed ===\n');

  // 1. Surahs (must be first — verses FK references surahs)
  console.log('[1/5] Parsing surahs...');
  const surahs = parseSurahs();
  console.log(`  Parsed ${surahs.length} surahs`);
  await batchUpsert('ayamakna_surahs', surahs, 'number');

  // 2. Concepts (must be before verse_concepts — FK references concepts)
  console.log('\n[2/5] Parsing concepts...');
  const concepts = parseConcepts();
  console.log(`  Parsed ${concepts.length} concepts`);
  await batchUpsert('ayamakna_concepts', concepts, 'id');

  // 3. Verses
  console.log('\n[3/5] Parsing verses...');
  const verses = parseQuranVerses();
  console.log(`  Parsed ${verses.length} verses`);
  await batchUpsert('ayamakna_verses', verses, 'id');

  // 4. Root lookups
  console.log('\n[4/5] Parsing root lookups...');
  const roots = parseRootLookups();
  console.log(`  Parsed ${roots.length} root lookups`);
  await batchUpsert('ayamakna_root_lookups', roots, 'word');

  // 5. Verse-concept associations
  console.log('\n[5/5] Parsing verse-concepts...');
  const vcs = parseVerseConcepts();
  console.log(`  Parsed ${vcs.length} verse-concept associations`);
  await batchUpsert('ayamakna_verse_concepts', vcs, 'id');

  console.log('\n=== Seed complete! ===');
}

main().catch(console.error);
