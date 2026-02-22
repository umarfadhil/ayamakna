#!/usr/bin/env node
// =============================================================================
// Seed Indonesian (Kemenag) translations into ayamakna_verses.text_translation_id
// Usage: node scripts/seed-id-translation.mjs
// Source: api.alquran.cloud/v1/quran/id.indonesian
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pkwvovoiljwjjgbythsp.supabase.co';
const SUPABASE_ANON_KEY = '[REDACTED_SUPABASE_ANON_KEY]';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchIndonesianTranslations() {
  console.log('Fetching Indonesian translations from alqurancloud...');
  const res = await fetch('https://api.alquran.cloud/v1/quran/id.indonesian');
  if (!res.ok) throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  const json = await res.json();

  if (json.code !== 200 || !json.data?.surahs) {
    throw new Error('Unexpected API response shape');
  }

  const verses = [];
  for (const surah of json.data.surahs) {
    for (const ayah of surah.ayahs) {
      verses.push({
        id: `${surah.number}:${ayah.numberInSurah}`,
        text_translation_id: ayah.text,
      });
    }
  }
  console.log(`Fetched ${verses.length} Indonesian verses`);
  return verses;
}

// Update one verse using REST PATCH
async function updateOne(verse) {
  const { error } = await supabase
    .from('ayamakna_verses')
    .update({ text_translation_id: verse.text_translation_id })
    .eq('id', verse.id);
  if (error) throw new Error(`Update failed for ${verse.id}: ${error.message}`);
}

async function main() {
  const verses = await fetchIndonesianTranslations();

  const CONCURRENCY = 30; // parallel requests per batch
  let done = 0;
  let failed = 0;

  for (let i = 0; i < verses.length; i += CONCURRENCY) {
    const batch = verses.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(updateOne));

    for (const r of results) {
      if (r.status === 'fulfilled') done++;
      else { failed++; console.error(r.reason?.message ?? r.reason); }
    }

    process.stdout.write(`\rUpdated ${done}/${verses.length} (${failed} failed)...`);
  }

  console.log(`\nDone! ${done} updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
