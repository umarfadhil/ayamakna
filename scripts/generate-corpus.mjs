#!/usr/bin/env node
// =============================================================================
// Corpus Data Generator for AyaMakna
// =============================================================================
// Fetches full Quran text (Arabic + English) and morphological corpus data,
// then generates TypeScript data files for the semantic engine.
//
// Sources:
//   - Arabic text: api.alquran.cloud (Uthmani script)
//   - English text: api.alquran.cloud (Sahih International)
//   - Morphology: mustafa0x/quran-morphology (GitHub)
//
// Run: node scripts/generate-corpus.mjs
// =============================================================================

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');

// --- Fetch Helpers ---

async function fetchJSON(url) {
  console.log(`  Fetching ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchText(url) {
  console.log(`  Fetching ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// --- Step 1: Fetch Quran Text ---

async function fetchQuranText() {
  console.log('\n[1/4] Fetching Quran text...');

  const [arData, enData] = await Promise.all([
    fetchJSON('https://api.alquran.cloud/v1/quran/quran-uthmani'),
    fetchJSON('https://api.alquran.cloud/v1/quran/en.sahih'),
  ]);

  const arSurahs = arData.data.surahs;
  const enSurahs = enData.data.surahs;

  const verses = [];
  for (let s = 0; s < arSurahs.length; s++) {
    const arSurah = arSurahs[s];
    const enSurah = enSurahs[s];
    for (let a = 0; a < arSurah.ayahs.length; a++) {
      const arAyah = arSurah.ayahs[a];
      const enAyah = enSurah.ayahs[a];
      verses.push({
        id: `${arSurah.number}:${arAyah.numberInSurah}`,
        surahId: arSurah.number,
        ayahNumber: arAyah.numberInSurah,
        textArabic: arAyah.text,
        textTranslation: enAyah.text,
      });
    }
  }

  console.log(`  Got ${verses.length} verses from ${arSurahs.length} surahs`);
  return verses;
}

// --- Step 2: Fetch & Parse Morphological Corpus ---

async function fetchMorphology() {
  console.log('\n[2/4] Fetching morphological corpus...');

  const text = await fetchText(
    'https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt'
  );

  // Parse: each line is "chapter:verse:word:segment\tform\ttag\tfeatures"
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  console.log(`  Parsing ${lines.length} morphological segments...`);

  // Group by word (chapter:verse:word) and extract root per word
  // We want: { "1:1:1": { root: "سمو", pos: "N", ... }, ... }
  const wordRoots = new Map(); // "surahId:ayah:wordIndex" -> { root, pos, form }
  const rootLookup = new Map(); // "cleanedWord" -> "root"

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 4) continue;

    const [location, form, tag, features] = parts;
    const [ch, vs, wd, seg] = location.split(':').map(Number);
    const wordKey = `${ch}:${vs}:${wd}`;

    // Extract ROOT from features
    const rootMatch = features.match(/ROOT:([^\|]+)/);
    const root = rootMatch ? rootMatch[1] : '';

    // Extract LEM from features
    const lemMatch = features.match(/LEM:([^\|]+)/);
    const lem = lemMatch ? lemMatch[1] : '';

    // Only store root from stem segments (not prefixes/suffixes)
    // Stem segments typically have ROOT
    if (root && !wordRoots.has(wordKey)) {
      wordRoots.set(wordKey, { root, pos: tag, form, lem });
    }
    // If we already have this word but found a root in a different segment
    if (root && wordRoots.has(wordKey) && !wordRoots.get(wordKey).root) {
      wordRoots.get(wordKey).root = root;
    }

    // Build root lookup: stripped form -> root
    if (root && form.length > 1) {
      rootLookup.set(form, root);
    }
  }

  console.log(`  Extracted roots for ${wordRoots.size} words`);
  console.log(`  Built root lookup with ${rootLookup.size} entries`);
  return { wordRoots, rootLookup };
}

// --- Step 3: Generate Root Lookup File ---

function generateRootLookup(rootLookup) {
  console.log('\n[3/4] Generating root lookup...');

  // Group roots by root value for organized output
  const byRoot = new Map();
  for (const [word, root] of rootLookup) {
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(word);
  }

  // Sort by frequency (most common roots first)
  const sorted = [...byRoot.entries()].sort((a, b) => b[1].length - a[1].length);

  let entries = '';
  for (const [root, words] of sorted) {
    // Only include roots with at least 1 word form
    for (const word of words) {
      entries += `  '${word}': '${root}',\n`;
    }
  }

  const content = `// =============================================================================
// Arabic Word → Root Lookup Table (Auto-generated from Quranic Arabic Corpus)
// =============================================================================
// Source: https://github.com/mustafa0x/quran-morphology
// Total entries: ${rootLookup.size}
// =============================================================================

export const ROOT_LOOKUP: Record<string, string> = {
${entries}};

export function createRootLookupMap(): Map<string, string> {
  return new Map(Object.entries(ROOT_LOOKUP));
}
`;

  console.log(`  Generated ${rootLookup.size} root lookup entries`);
  return content;
}

// --- Step 4: Generate Concept Tags ---

// Root → concept mapping for algorithmic tagging
const ROOT_TO_CONCEPT = {
  // Tawhid (oneness)
  'ءله': 'tawhid', 'وحد': 'tawhid', 'ربب': 'tawhid', 'سبح': 'tawhid',
  // Taqwa
  'وقي': 'taqwa', 'تقي': 'taqwa',
  // Sabr
  'صبر': 'sabr',
  // Tawakkul
  'وكل': 'tawakkul',
  // Dhikr
  'ذكر': 'dhikr',
  // Salah
  'صلو': 'salah', 'سجد': 'salah', 'ركع': 'salah',
  // Ilm (knowledge)
  'علم': 'ilm', 'فقه': 'ilm', 'عقل': 'ilm', 'فكر': 'ilm', 'بصر': 'ilm',
  // Rahmah (mercy)
  'رحم': 'rahmah', 'رءف': 'rahmah',
  // Hidayah (guidance)
  'هدي': 'hidayah',
  // Ihsan (excellence)
  'حسن': 'ihsan',
  // Iman (faith)
  'ءمن': 'iman', 'امن': 'iman',
  // Kufr
  'كفر': 'kufr', 'شرك': 'kufr', 'نفق': 'kufr_nifaq',
  // Nur/Zulumat
  'نور': 'nur_zulm', 'ظلم': 'nur_zulm',
  // Life/Death
  'حيي': 'hayat_mawt', 'موت': 'hayat_mawt', 'بعث': 'hayat_mawt',
  // Qadr (divine power)
  'قدر': 'qadr', 'خلق': 'qadr', 'كون': 'qadr',
  // Akhlaq (character)
  'خلق': 'akhlaq', 'برر': 'akhlaq',
  // Maghfirah (forgiveness)
  'غفر': 'maghfirah', 'توب': 'maghfirah', 'عفو': 'maghfirah',
  // Amr/Nahi
  'عرف': 'amr_nahi', 'نكر': 'amr_nahi', 'نهي': 'amr_nahi', 'ءمر': 'amr_nahi',
  // Tawbah (repentance)
  'توب': 'tawbah',
  // Rizq (provision)
  'رزق': 'rizq', 'نفق': 'rizq',
  // Adl (justice)
  'عدل': 'adl', 'قسط': 'adl', 'حكم': 'adl',
  // Shukr (gratitude)
  'شكر': 'shukr',
  // Dua (supplication)
  'دعو': 'dua',
  // Jihad (striving)
  'جهد': 'jihad',
  // Jannah/Nar
  'جنن': 'jannah_nar', 'نار': 'jannah_nar', 'جحم': 'jannah_nar',
  // Qiyamah (Day of Judgment)
  'قوم': 'qiyamah', 'حسب': 'qiyamah', 'وزن': 'qiyamah',
  // Quran/Revelation
  'قرء': 'quran', 'نزل': 'quran', 'كتب': 'quran', 'وحي': 'quran',
  // Khawf/Raja (fear & hope)
  'خوف': 'khawf_raja', 'رجو': 'khawf_raja', 'خشي': 'khawf_raja',
};

// Extended concept definitions
const CONCEPT_DEFINITIONS = [
  { id: 'tawhid', name: 'Tawhid', nameAr: 'التوحيد', description: 'Oneness of God — monotheistic unity' },
  { id: 'taqwa', name: 'Taqwa', nameAr: 'التقوى', description: 'God-consciousness and spiritual awareness' },
  { id: 'sabr', name: 'Sabr', nameAr: 'الصبر', description: 'Patience and perseverance through trials' },
  { id: 'tawakkul', name: 'Tawakkul', nameAr: 'التوكل', description: 'Reliance and trust in Allah' },
  { id: 'dhikr', name: 'Dhikr', nameAr: 'الذكر', description: 'Remembrance of Allah' },
  { id: 'salah', name: 'Salah', nameAr: 'الصلاة', description: 'Prayer and worship' },
  { id: 'ilm', name: 'Ilm', nameAr: 'العلم', description: 'Knowledge and understanding' },
  { id: 'rahmah', name: 'Rahmah', nameAr: 'الرحمة', description: 'Mercy and compassion' },
  { id: 'hidayah', name: 'Hidayah', nameAr: 'الهداية', description: 'Divine guidance' },
  { id: 'ihsan', name: 'Ihsan', nameAr: 'الإحسان', description: 'Excellence and doing good' },
  { id: 'iman', name: 'Iman', nameAr: 'الإيمان', description: 'Faith and belief' },
  { id: 'kufr', name: 'Kufr', nameAr: 'الكفر', description: 'Disbelief and denial' },
  { id: 'kufr_nifaq', name: 'Nifaq', nameAr: 'النفاق', description: 'Hypocrisy' },
  { id: 'nur_zulm', name: 'Light & Darkness', nameAr: 'النور والظلمات', description: 'Contrast between light and darkness' },
  { id: 'hayat_mawt', name: 'Life & Death', nameAr: 'الحياة والموت', description: 'Cycle of life, death, and resurrection' },
  { id: 'qadr', name: 'Qadr', nameAr: 'القدر', description: 'Divine power, creation, and decree' },
  { id: 'akhlaq', name: 'Akhlaq', nameAr: 'الأخلاق', description: 'Character and moral conduct' },
  { id: 'maghfirah', name: 'Maghfirah', nameAr: 'المغفرة', description: 'Forgiveness and pardon' },
  { id: 'amr_nahi', name: 'Amr & Nahi', nameAr: 'الأمر والنهي', description: 'Enjoining good and forbidding evil' },
  { id: 'tawbah', name: 'Tawbah', nameAr: 'التوبة', description: 'Repentance and returning to God' },
  { id: 'rizq', name: 'Rizq', nameAr: 'الرزق', description: 'Provision and sustenance' },
  { id: 'adl', name: 'Adl', nameAr: 'العدل', description: 'Justice and equity' },
  { id: 'shukr', name: 'Shukr', nameAr: 'الشكر', description: 'Gratitude and thankfulness' },
  { id: 'dua', name: "Du'a", nameAr: 'الدعاء', description: 'Supplication and calling upon God' },
  { id: 'jihad', name: 'Jihad', nameAr: 'الجهاد', description: 'Striving in the way of God' },
  { id: 'jannah_nar', name: 'Jannah & Nar', nameAr: 'الجنة والنار', description: 'Paradise and Hellfire' },
  { id: 'qiyamah', name: 'Qiyamah', nameAr: 'القيامة', description: 'Day of Judgment and accountability' },
  { id: 'quran', name: 'Quran', nameAr: 'القرآن', description: 'The Quran, revelation, and scripture' },
  { id: 'khawf_raja', name: 'Khawf & Raja', nameAr: 'الخوف والرجاء', description: 'Fear of God and hope in His mercy' },
];

function generateConceptTags(wordRoots, verses) {
  console.log('\n[4/4] Generating concept tags...');

  // For each verse, find which concepts its roots map to
  const verseConcepts = [];
  let tagged = 0;

  for (const verse of verses) {
    // Collect all roots in this verse
    const verseRoots = new Set();
    // Find all words for this verse in the morphology data
    for (const [key, data] of wordRoots) {
      const [ch, vs] = key.split(':').map(Number);
      if (ch === verse.surahId && vs === verse.ayahNumber && data.root) {
        verseRoots.add(data.root);
      }
    }

    // Map roots to concepts
    const conceptWeights = new Map();
    for (const root of verseRoots) {
      const conceptId = ROOT_TO_CONCEPT[root];
      if (conceptId) {
        const current = conceptWeights.get(conceptId) || 0;
        conceptWeights.set(conceptId, Math.min(1, current + 0.4));
      }
    }

    // Add verse-concept mappings
    for (const [conceptId, weight] of conceptWeights) {
      verseConcepts.push({
        verseId: verse.id,
        conceptId,
        weight: Math.round(weight * 100) / 100,
      });
    }

    if (conceptWeights.size > 0) tagged++;
  }

  console.log(`  Tagged ${tagged}/${verses.length} verses with concepts`);
  console.log(`  Generated ${verseConcepts.length} verse-concept associations`);

  // Generate the TS file
  const conceptsStr = CONCEPT_DEFINITIONS.map(c =>
    `  { id: '${c.id}', name: '${c.name}', nameAr: '${c.nameAr}', description: '${c.description}' }`
  ).join(',\n');

  const vcStr = verseConcepts.map(vc =>
    `  { verseId: '${vc.verseId}', conceptId: '${vc.conceptId}', weight: ${vc.weight} }`
  ).join(',\n');

  return `// =============================================================================
// Concept Tags & Verse-Concept Mappings (Auto-generated)
// =============================================================================
// ${CONCEPT_DEFINITIONS.length} concepts, ${verseConcepts.length} verse-concept associations
// Tagged ${tagged}/${verses.length} verses
// =============================================================================

import type { Concept, VerseConcept } from '@/engine/semantic/types';

export const CONCEPTS: Concept[] = [
${conceptsStr},
];

export const VERSE_CONCEPTS: VerseConcept[] = [
${vcStr},
];

export function buildConceptMap(): Map<string, VerseConcept[]> {
  const map = new Map<string, VerseConcept[]>();
  for (const vc of VERSE_CONCEPTS) {
    if (!map.has(vc.verseId)) map.set(vc.verseId, []);
    map.get(vc.verseId)!.push(vc);
  }
  return map;
}
`;
}

// --- Generate Verses File ---

function generateVersesFile(verses) {
  // Group verses by surah for organized output
  let content = `// =============================================================================
// Qur'anic Verse Dataset (Auto-generated from alquran.cloud API)
// =============================================================================
// ${verses.length} verses across 114 surahs
// Arabic: Uthmani script | English: Sahih International
// =============================================================================

import type { Verse } from '@/engine/linguistic/types';

export const QURAN_VERSES: Verse[] = [\n`;

  let currentSurah = 0;
  for (const v of verses) {
    if (v.surahId !== currentSurah) {
      currentSurah = v.surahId;
      content += `  // --- Surah ${currentSurah} ---\n`;
    }
    // Escape single quotes in text
    const ar = v.textArabic.replace(/'/g, "\\'");
    const en = v.textTranslation.replace(/'/g, "\\'");
    content += `  { id: '${v.id}', surahId: ${v.surahId}, ayahNumber: ${v.ayahNumber}, textArabic: '${ar}', textTranslation: '${en}' },\n`;
  }

  content += `];\n`;
  return content;
}

// --- Main ---

async function main() {
  console.log('=== AyaMakna Corpus Generator ===\n');

  try {
    // Step 1: Fetch Quran text
    const verses = await fetchQuranText();

    // Step 2: Fetch morphological data
    const { wordRoots, rootLookup } = await fetchMorphology();

    // Step 3: Generate root lookup file
    const rootLookupContent = generateRootLookup(rootLookup);
    writeFileSync(join(DATA_DIR, 'rootLookup.ts'), rootLookupContent, 'utf-8');
    console.log('  Written: src/data/rootLookup.ts');

    // Step 4: Generate concept tags
    const conceptContent = generateConceptTags(wordRoots, verses);
    writeFileSync(join(DATA_DIR, 'conceptTags.ts'), conceptContent, 'utf-8');
    console.log('  Written: src/data/conceptTags.ts');

    // Step 5: Generate verses file
    const versesContent = generateVersesFile(verses);
    writeFileSync(join(DATA_DIR, 'quranVerses.ts'), versesContent, 'utf-8');
    console.log('  Written: src/data/quranVerses.ts');

    console.log('\n=== Generation complete! ===');
    console.log(`  Verses: ${verses.length}`);
    console.log(`  Root entries: ${rootLookup.size}`);
    console.log(`  Word roots: ${wordRoots.size}`);

  } catch (err) {
    console.error('\nFATAL:', err.message);
    process.exit(1);
  }
}

main();
