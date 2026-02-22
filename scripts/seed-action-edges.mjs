#!/usr/bin/env node
// =============================================================================
// Seed Action Edges into Supabase
// Usage: node scripts/seed-action-edges.mjs
// Requires: temporary INSERT policy on ayamakna_action_edges
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pkwvovoiljwjjgbythsp.supabase.co';
const SUPABASE_ANON_KEY = '[REDACTED_SUPABASE_ANON_KEY]';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Diacritics stripping (mirrors src/engine/linguistic/rootExtractor.ts) ---
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;
function stripDiacritics(text) {
  return text.replace(DIACRITICS, '');
}

// --- POS classification (mirrors semanticStore.ts tokenizer) ---
const PARTICLES = new Set(['في', 'من', 'الى', 'على', 'عن', 'مع', 'بين', 'ان', 'انما', 'الا', 'لا', 'ما', 'هل', 'قد', 'لن', 'لم', 'اذ', 'اذا', 'كل', 'بعد', 'قبل', 'عند', 'حيث', 'اي', 'كيف', 'متى', 'اين']);
const CONJUNCTIONS = new Set(['و', 'ف', 'ثم', 'او', 'لكن', 'بل', 'حتى', 'ام']);
const PRONOUNS = new Set(['هو', 'هي', 'هم', 'هن', 'انت', 'انتم', 'نحن', 'انا', 'الذي', 'الذين', 'التي', 'ذلك', 'هذا', 'اياك', 'هذه', 'تلك', 'اولئك', 'ما', 'من']);

function classifyPOS(word, root) {
  if (PARTICLES.has(word)) return 'particle';
  if (CONJUNCTIONS.has(word)) return 'conjunction';
  if (PRONOUNS.has(word)) return 'pronoun';
  if (/^[يتان]/.test(word) && root && word.length >= 4) return 'verb';
  if (word.endsWith('وا') && root) return 'verb';
  if (/^(ا[سعقف]|ف[ا])/.test(word) && root && word.length >= 4) return 'verb';
  if (word === 'الله' || word === 'لله') return 'proper_noun';
  return 'noun';
}

// --- Actor classification (mirrors actionEngine.ts) ---
const DIVINE_INDICATORS = new Set(['الله', 'رب', 'رحمن', 'نحن']);
const BELIEVER_INDICATORS = new Set(['امن', 'صلح', 'تقي', 'صبر', 'شكر', 'توب']);
const DISBELIEVER_INDICATORS = new Set(['كفر', 'ظلم', 'فسق', 'نفق', 'شرك', 'كذب']);
const ANGEL_INDICATORS = new Set(['ملك', 'جبريل', 'ملائكة']);
const PROPHET_INDICATORS = new Set(['موسى', 'عيسى', 'ابراهيم', 'نوح', 'محمد', 'داود', 'سليمان', 'يوسف', 'يعقوب', 'اسماعيل', 'اسحاق', 'لوط', 'هود', 'صالح', 'شعيب', 'يونس', 'ايوب', 'ذكريا', 'يحيى', 'الياس', 'اليسع', 'ذو', 'ادم', 'هارون', 'رسول', 'نبي', 'رسل']);
const HYPOCRITE_INDICATORS = new Set(['نفق', 'منافق', 'منافقون', 'منافقين']);
const SHAYTAN_INDICATORS = new Set(['شيطان', 'ابليس', 'شيط', 'شطن']);
const MANKIND_INDICATORS = new Set(['ناس', 'انس', 'بشر', 'انسان', 'قوم', 'عالم', 'خلق']);

function classifyActor(verb, verseWords) {
  const verbIndex = verseWords.findIndex(w => w.id === verb.id);
  const contextWindow = verseWords.slice(Math.max(0, verbIndex - 3), verbIndex);
  for (const w of contextWindow) {
    const text = w.text; const root = w.root;
    if (DIVINE_INDICATORS.has(text) || DIVINE_INDICATORS.has(root)) return 'divine';
    if (PROPHET_INDICATORS.has(text) || PROPHET_INDICATORS.has(root)) return 'prophet';
    if (SHAYTAN_INDICATORS.has(text) || SHAYTAN_INDICATORS.has(root)) return 'shaytan';
    if (ANGEL_INDICATORS.has(text) || ANGEL_INDICATORS.has(root)) return 'angel';
    if (HYPOCRITE_INDICATORS.has(text) || HYPOCRITE_INDICATORS.has(root)) return 'hypocrite';
    if (BELIEVER_INDICATORS.has(root)) return 'believer';
    if (DISBELIEVER_INDICATORS.has(root)) return 'disbeliever';
    if (MANKIND_INDICATORS.has(text) || MANKIND_INDICATORS.has(root)) return 'mankind';
  }
  if (DIVINE_INDICATORS.has(verb.root)) return 'divine';
  return 'human';
}

function classifyTense(verb) {
  const text = verb.text;
  if (/^[يتأن]/.test(text)) return 'present';
  if (/^[اإ]/.test(text) && text.length <= 5) return 'imperative';
  return 'past';
}

function classifyTarget(verb, verseWords) {
  const verbIndex = verseWords.findIndex(w => w.id === verb.id);
  const afterWords = verseWords.slice(verbIndex + 1, verbIndex + 3);
  for (const w of afterWords) {
    if (w.pos === 'noun' || w.pos === 'proper_noun') {
      const text = w.text; const root = w.root;
      if (DIVINE_INDICATORS.has(text) || DIVINE_INDICATORS.has(root)) return 'divine';
      if (PROPHET_INDICATORS.has(text) || PROPHET_INDICATORS.has(root)) return 'prophet';
      if (SHAYTAN_INDICATORS.has(text) || SHAYTAN_INDICATORS.has(root)) return 'shaytan';
      if (ANGEL_INDICATORS.has(text) || ANGEL_INDICATORS.has(root)) return 'angel';
      if (HYPOCRITE_INDICATORS.has(text) || HYPOCRITE_INDICATORS.has(root)) return 'hypocrite';
      if (BELIEVER_INDICATORS.has(root)) return 'believer';
      if (DISBELIEVER_INDICATORS.has(root)) return 'disbeliever';
      if (MANKIND_INDICATORS.has(text) || MANKIND_INDICATORS.has(root)) return 'mankind';
      return w.root || w.text;
    }
  }
  return undefined;
}

// --- Semantic cluster + polarity dictionaries (mirrors actionDictionaries.ts) ---
const ACTION_CLUSTER_MAP = {
  'امن': 'belief_faith', 'كفر': 'belief_faith', 'شرك': 'belief_faith', 'يقن': 'belief_faith', 'صدق': 'belief_faith', 'كذب': 'belief_faith', 'شهد': 'belief_faith', 'ءمن': 'belief_faith',
  'علم': 'knowledge', 'فهم': 'knowledge', 'عقل': 'knowledge', 'فكر': 'knowledge', 'ذكر': 'knowledge', 'نسي': 'knowledge', 'قرأ': 'knowledge', 'كتب': 'knowledge', 'بين': 'knowledge', 'هدي': 'knowledge', 'درس': 'knowledge', 'حفظ': 'knowledge', 'تلو': 'knowledge', 'وعي': 'knowledge', 'بصر': 'knowledge',
  'عبد': 'worship', 'صلو': 'worship', 'سجد': 'worship', 'ركع': 'worship', 'صوم': 'worship', 'زكو': 'worship', 'حجج': 'worship', 'سبح': 'worship', 'حمد': 'worship', 'شكر': 'worship', 'دعو': 'worship', 'توب': 'worship', 'نذر': 'worship', 'طهر': 'worship', 'قنت': 'worship', 'ذكر': 'worship',
  'قول': 'speech', 'نطق': 'speech', 'كلم': 'speech', 'نبأ': 'speech', 'بشر': 'speech', 'انذر': 'speech', 'وعظ': 'speech', 'حدث': 'speech', 'سأل': 'speech', 'جوب': 'speech', 'شرح': 'speech', 'فسر': 'speech', 'بلغ': 'speech',
  'قتل': 'conflict', 'جهد': 'conflict', 'حرب': 'conflict', 'قتل': 'conflict', 'ضرب': 'conflict', 'نصر': 'conflict', 'غلب': 'conflict', 'فتح': 'conflict', 'هزم': 'conflict', 'دفع': 'conflict', 'رمي': 'conflict', 'عدو': 'conflict', 'صبر': 'conflict',
  'مشي': 'movement', 'سير': 'movement', 'هجر': 'movement', 'خرج': 'movement', 'دخل': 'movement', 'رجع': 'movement', 'جاء': 'movement', 'ذهب': 'movement', 'نزل': 'movement', 'صعد': 'movement', 'بعث': 'movement', 'رسل': 'movement', 'سفر': 'movement',
  'خوف': 'emotional', 'رجو': 'emotional', 'حزن': 'emotional', 'فرح': 'emotional', 'حبب': 'emotional', 'بغض': 'emotional', 'غضب': 'emotional', 'رضي': 'emotional', 'طمع': 'emotional', 'يئس': 'emotional', 'كره': 'emotional', 'ودد': 'emotional',
  'عذب': 'punishment_reward', 'جزي': 'punishment_reward', 'عقب': 'punishment_reward', 'ثوب': 'punishment_reward', 'حسب': 'punishment_reward', 'وزن': 'punishment_reward', 'غفر': 'punishment_reward', 'رحم': 'punishment_reward', 'لعن': 'punishment_reward', 'نعم': 'punishment_reward',
  'عهد': 'social', 'وعد': 'social', 'بيع': 'social', 'نكح': 'social', 'طلق': 'social', 'ولد': 'social', 'ورث': 'social', 'عدل': 'social', 'حكم': 'social', 'شور': 'social', 'ءمر': 'social', 'نهي': 'social', 'وصي': 'social',
  'خدع': 'deception', 'مكر': 'deception', 'كيد': 'deception', 'فسد': 'deception', 'ظلم': 'deception', 'بغي': 'deception', 'طغي': 'deception', 'سرف': 'deception', 'فسق': 'deception', 'نفق': 'deception',
};

const ACTION_POLARITY_MAP = {
  'امن': 'positive', 'صدق': 'positive', 'عبد': 'positive', 'صلو': 'positive', 'سجد': 'positive',
  'شكر': 'positive', 'توب': 'positive', 'هدي': 'positive', 'نصر': 'positive', 'غفر': 'positive',
  'رحم': 'positive', 'حمد': 'positive', 'سبح': 'positive', 'رضي': 'positive', 'صبر': 'positive',
  'علم': 'positive', 'فهم': 'positive', 'عقل': 'positive', 'تقو': 'positive', 'عدل': 'positive',
  'صلح': 'positive', 'بشر': 'positive', 'فلح': 'positive', 'حفظ': 'positive',
  'كفر': 'negative', 'ظلم': 'negative', 'فسق': 'negative', 'كذب': 'negative', 'شرك': 'negative',
  'فسد': 'negative', 'بغي': 'negative', 'طغي': 'negative', 'قتل': 'negative', 'عذب': 'negative',
  'لعن': 'negative', 'خدع': 'negative', 'مكر': 'negative', 'سرف': 'negative', 'ضلل': 'negative',
  'كره': 'negative', 'غضب': 'negative', 'نفق': 'negative',
};

// --- Paginated fetch helper ---
async function fetchAll(table, columns) {
  const PAGE_SIZE = 1000;
  const all = [];
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) { done = true; } else {
      all.push(...data);
      if (data.length < PAGE_SIZE) done = true;
      from += PAGE_SIZE;
    }
  }
  return all;
}

// --- Main ---
async function main() {
  console.log('=== Seed Action Edges ===\n');

  // 1. Fetch data from Supabase
  console.log('[1/4] Fetching data from Supabase...');
  const [rawVerses, rawRoots, rawRootTrans] = await Promise.all([
    fetchAll('ayamakna_verses', 'id,surah_id,ayah_number,text_arabic'),
    fetchAll('ayamakna_root_lookups', 'word,root'),
    fetchAll('ayamakna_root_translations', 'root,translation'),
  ]);
  console.log(`  ${rawVerses.length} verses, ${rawRoots.length} root lookups, ${rawRootTrans.length} root translations`);

  // 2. Build lookup maps
  console.log('[2/4] Building lookup maps...');
  const rootLookup = new Map();
  for (const r of rawRoots) rootLookup.set(r.word.replace(DIACRITICS, ''), r.root);

  const rootTranslations = new Map();
  for (const r of rawRootTrans) rootTranslations.set(r.root, r.translation);

  // Build root index (frequency counts)
  const rootIndex = {};

  // 3. Tokenize + extract actions
  console.log('[3/4] Tokenizing and extracting action edges...');
  const allEdges = [];

  for (const v of rawVerses) {
    const rawWords = v.text_arabic.trim().split(/\s+/).filter(Boolean);
    const words = rawWords.map((text, i) => {
      const clean = stripDiacritics(text);
      const root = rootLookup.get(clean) ?? '';
      return {
        id: `${v.id}:${i}`,
        verseId: v.id,
        text,
        root,
        pos: classifyPOS(clean, root),
        lemma: clean,
      };
    });

    // Build root index entries
    for (const w of words) {
      if (!w.root) continue;
      if (!rootIndex[w.root]) rootIndex[w.root] = { root: w.root, count: 0, verseIds: [] };
      rootIndex[w.root].count++;
      if (!rootIndex[w.root].verseIds.includes(v.id)) rootIndex[w.root].verseIds.push(v.id);
    }

    // Extract verbs
    const verbs = words.filter(w => w.pos === 'verb');
    for (const verb of verbs) {
      const root = verb.root || verb.text;
      allEdges.push({
        id: `action:${v.id}:${verb.id}`,
        verse_id: v.id,
        actor_type: classifyActor(verb, words),
        action_root: root,
        target_type: classifyTarget(verb, words) ?? null,
        tense: classifyTense(verb),
        verb_text: verb.text,
        english_meaning: rootTranslations.get(root) ?? null,
        root_frequency: null, // filled after root index is complete
        semantic_cluster: ACTION_CLUSTER_MAP[root] ?? null,
        polarity: ACTION_POLARITY_MAP[root] ?? 'neutral',
      });
    }
  }

  // Fill root_frequency
  for (const edge of allEdges) {
    edge.root_frequency = rootIndex[edge.action_root]?.count ?? 0;
  }

  console.log(`  Extracted ${allEdges.length} action edges from ${rawVerses.length} verses`);

  // 4. Insert into Supabase in batches
  console.log(`[4/4] Inserting ${allEdges.length} action edges...`);
  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < allEdges.length; i += BATCH_SIZE) {
    const batch = allEdges.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('ayamakna_action_edges').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`  Error at batch ${i}-${i + batch.length}:`, error.message);
      continue;
    }
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${allEdges.length}`);
  }
  console.log(`\n  Done: ${inserted} rows inserted.`);
  console.log('\n=== Seed complete! ===');
}

main().catch(console.error);
