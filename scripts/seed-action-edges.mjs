#!/usr/bin/env node
// =============================================================================
// Seed Action Edges into Supabase (v2 — uses ayamakna_verse_tokens as source)
// Usage: node scripts/seed-action-edges.mjs
// Requires: temporary DELETE + INSERT policy on ayamakna_action_edges
//
// Key change from v1: Uses ayamakna_verse_tokens (morphologically-analyzed tokens)
// instead of raw verse text with weak POS heuristics.
// Only seeds tokens whose root exists in ACTION_FAMILY_MAP — guarantees every
// edge has a valid semantic_cluster and corresponds to a recognized verb root.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './_supabaseEnv.mjs';

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseEnv();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Diacritics stripping ---
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;
function stripDiacritics(text) {
  return text ? text.replace(DIACRITICS, '') : '';
}

// =============================================================================
// ACTION_FAMILY_MAP — mirrors src/engine/semantic/actionDictionaries.ts
// Only roots in this map will be seeded as action edges.
// Update this when actionDictionaries.ts is updated.
// =============================================================================
const ACTION_FAMILY_MAP = {
  // WORSHIP & DEVOTION
  'عبد': 'worship_devotion', 'صلو': 'worship_devotion', 'سجد': 'worship_devotion',
  'صوم': 'worship_devotion', 'زكو': 'worship_devotion', 'حجج': 'worship_devotion',
  'سبح': 'worship_devotion', 'حمد': 'worship_devotion', 'ذكر': 'worship_devotion',
  'شكر': 'worship_devotion', 'قنت': 'worship_devotion', 'ركع': 'worship_devotion',
  'طوف': 'worship_devotion', 'نذر': 'worship_devotion', 'طهر': 'worship_devotion',
  'خشع': 'worship_devotion', 'صلح': 'worship_devotion',
  'امن': 'worship_devotion', 'أمن': 'worship_devotion', 'طوع': 'worship_devotion',

  // MORAL CONDUCT
  'صبر': 'moral_conduct', 'عدل': 'moral_conduct', 'صدق': 'moral_conduct',
  'وفي': 'moral_conduct', 'عفو': 'moral_conduct', 'نصح': 'moral_conduct',
  'نفق': 'moral_conduct', 'برر': 'moral_conduct', 'عهد': 'moral_conduct',
  'وصي': 'moral_conduct', 'امر': 'moral_conduct', 'نهي': 'moral_conduct',
  'احسن': 'moral_conduct', 'عون': 'moral_conduct', 'رحم': 'moral_conduct',
  'عمل': 'moral_conduct', 'فعل': 'moral_conduct', 'نفع': 'moral_conduct',
  'قوم': 'moral_conduct', 'تبع': 'moral_conduct',

  // DIVINE COMMAND
  'وحي': 'divine_command', 'اذن': 'divine_command', 'حرم': 'divine_command',
  'فرض': 'divine_command', 'شرع': 'divine_command', 'كلم': 'divine_command',
  'نزل': 'divine_command', 'كتب': 'divine_command', 'قضي': 'divine_command',
  'حكم': 'divine_command', 'امل': 'divine_command', 'اوحي': 'divine_command',
  'يسر': 'divine_command', 'فصل': 'divine_command', 'ولي': 'divine_command',

  // DIVINE CREATION
  'خلق': 'divine_creation', 'جعل': 'divine_creation', 'صور': 'divine_creation',
  'نفخ': 'divine_creation', 'حيي': 'divine_creation', 'موت': 'divine_creation',
  'بعث': 'divine_creation', 'رزق': 'divine_creation', 'مطر': 'divine_creation',
  'نبت': 'divine_creation', 'دبر': 'divine_creation', 'انشأ': 'divine_creation',
  'فطر': 'divine_creation', 'قدر': 'divine_creation',
  'كون': 'divine_creation', 'سوي': 'divine_creation', 'غني': 'divine_creation',
  'ملك': 'divine_creation',

  // KNOWLEDGE & REFLECTION
  'علم': 'knowledge_reflection', 'عقل': 'knowledge_reflection', 'فقه': 'knowledge_reflection',
  'فكر': 'knowledge_reflection', 'تدبر': 'knowledge_reflection', 'نظر': 'knowledge_reflection',
  'بصر': 'knowledge_reflection', 'سمع': 'knowledge_reflection', 'قرء': 'knowledge_reflection',
  'درس': 'knowledge_reflection', 'حفظ': 'knowledge_reflection', 'شهد': 'knowledge_reflection',
  'يقن': 'knowledge_reflection', 'خبر': 'knowledge_reflection', 'تفكر': 'knowledge_reflection',

  // REJECTION & DENIAL
  'كفر': 'rejection_denial', 'شرك': 'rejection_denial', 'كذب': 'rejection_denial',
  'جحد': 'rejection_denial', 'بغي': 'rejection_denial', 'طغي': 'rejection_denial',
  'حاد': 'rejection_denial', 'ريب': 'rejection_denial', 'زيغ': 'rejection_denial',
  'ضل': 'rejection_denial', 'ارتد': 'rejection_denial', 'انكر': 'rejection_denial',
  'استكبر': 'rejection_denial', 'هزأ': 'rejection_denial',

  // PROCLAMATION & WARNING
  'قول': 'proclamation_warning', 'دعو': 'proclamation_warning', 'بلغ': 'proclamation_warning',
  'انذر': 'proclamation_warning', 'بشر': 'proclamation_warning', 'نبء': 'proclamation_warning',
  'وعظ': 'proclamation_warning', 'حدث': 'proclamation_warning', 'نطق': 'proclamation_warning',
  'تلو': 'proclamation_warning', 'قصص': 'proclamation_warning', 'خطب': 'proclamation_warning',
  'جدل': 'proclamation_warning', 'سءل': 'proclamation_warning', 'ندي': 'proclamation_warning',

  // SOCIAL & FAMILY AFFAIRS
  'نكح': 'social_transaction', 'طلق': 'social_transaction', 'بيع': 'social_transaction',
  'ورث': 'social_transaction', 'هجر': 'social_transaction', 'سير': 'social_transaction',
  'دخل': 'social_transaction', 'خرج': 'social_transaction', 'شور': 'social_transaction',
  'عاشر': 'social_transaction', 'رضع': 'social_transaction', 'مشي': 'social_transaction',
  'قدم': 'social_transaction', 'سفر': 'social_transaction', 'جري': 'social_transaction',
  'بدل': 'social_transaction', 'لقي': 'social_transaction', 'أكل': 'social_transaction',
  'أتي': 'social_transaction', 'قبل': 'social_transaction',

  // SPIRITUAL & EMOTIONAL STATES
  'خوف': 'spiritual_states', 'رجو': 'spiritual_states', 'حبب': 'spiritual_states',
  'حزن': 'spiritual_states', 'فرح': 'spiritual_states', 'بكي': 'spiritual_states',
  'غضب': 'spiritual_states', 'كره': 'spiritual_states', 'طمع': 'spiritual_states',
  'رضي': 'spiritual_states', 'خشي': 'spiritual_states', 'حسد': 'spiritual_states',
  'وجل': 'spiritual_states', 'اطمأن': 'spiritual_states',

  // CONFLICT & RESISTANCE
  'قتل': 'conflict_resistance', 'جهد': 'conflict_resistance', 'نصر': 'conflict_resistance',
  'غلب': 'conflict_resistance', 'فتح': 'conflict_resistance', 'ضرب': 'conflict_resistance',
  'رمي': 'conflict_resistance', 'هزم': 'conflict_resistance', 'عدو': 'conflict_resistance',
  'عصي': 'conflict_resistance', 'دافع': 'conflict_resistance', 'حرب': 'conflict_resistance',

  // DIVINE RETRIBUTION
  'عذب': 'divine_retribution', 'هلك': 'divine_retribution', 'لعن': 'divine_retribution',
  'ضلل': 'divine_retribution', 'طبع': 'divine_retribution', 'جزي': 'divine_retribution',
  'حسب': 'divine_retribution', 'اخذ': 'divine_retribution', 'أخذ': 'divine_retribution',
  'خذل': 'divine_retribution', 'ختم': 'divine_retribution', 'سخط': 'divine_retribution',
  'انتقم': 'divine_retribution',

  // SEEKING & SUPPLICATION
  'توب': 'seeking_supplication', 'غفر': 'seeking_supplication', 'رجع': 'seeking_supplication',
  'عوذ': 'seeking_supplication', 'هدي': 'seeking_supplication', 'رشد': 'seeking_supplication',
  'فزع': 'seeking_supplication', 'رغب': 'seeking_supplication', 'تضرع': 'seeking_supplication',
  'ناجي': 'seeking_supplication', 'استغاث': 'seeking_supplication',
  'رود': 'seeking_supplication', 'قلب': 'seeking_supplication',
};

// All recognized verb roots (Set for fast lookup)
const VERB_ROOT_SET = new Set(Object.keys(ACTION_FAMILY_MAP));

// --- Actor classification (mirrors actionEngine.ts) ---
const DIVINE_INDICATORS = new Set(['الله', 'رب', 'رحمن', 'نحن']);
const BELIEVER_INDICATORS = new Set(['امن', 'صلح', 'تقي', 'صبر', 'شكر', 'توب']);
const DISBELIEVER_INDICATORS = new Set(['كفر', 'ظلم', 'فسق', 'نفق', 'شرك', 'كذب']);
const ANGEL_INDICATORS = new Set(['ملك', 'جبريل', 'ملائكة']);
const PROPHET_INDICATORS = new Set(['موسى', 'عيسى', 'ابراهيم', 'نوح', 'محمد', 'داود', 'سليمان', 'يوسف', 'يعقوب', 'اسماعيل', 'اسحاق', 'لوط', 'هود', 'صالح', 'شعيب', 'يونس', 'ايوب', 'ذكريا', 'يحيى', 'الياس', 'اليسع', 'ادم', 'هارون', 'رسول', 'نبي', 'رسل']);
const HYPOCRITE_INDICATORS = new Set(['نفق', 'منافق', 'منافقون', 'منافقين']);
const SHAYTAN_INDICATORS = new Set(['شيطان', 'ابليس', 'شيط', 'شطن']);
const MANKIND_INDICATORS = new Set(['ناس', 'انس', 'بشر', 'انسان', 'قوم', 'عالم', 'خلق']);

function classifyActor(tokenIndex, allTokensForVerse) {
  // Look at up to 3 tokens before this one
  const start = Math.max(0, tokenIndex - 3);
  const context = allTokensForVerse.slice(start, tokenIndex);
  for (const w of context) {
    const text = stripDiacritics(w.surface);
    const root = w.root || '';
    if (DIVINE_INDICATORS.has(text) || DIVINE_INDICATORS.has(root)) return 'divine';
    if (PROPHET_INDICATORS.has(text) || PROPHET_INDICATORS.has(root)) return 'prophet';
    if (SHAYTAN_INDICATORS.has(text) || SHAYTAN_INDICATORS.has(root)) return 'shaytan';
    if (ANGEL_INDICATORS.has(text) || ANGEL_INDICATORS.has(root)) return 'angel';
    if (HYPOCRITE_INDICATORS.has(text) || HYPOCRITE_INDICATORS.has(root)) return 'hypocrite';
    if (BELIEVER_INDICATORS.has(root)) return 'believer';
    if (DISBELIEVER_INDICATORS.has(root)) return 'disbeliever';
    if (MANKIND_INDICATORS.has(text) || MANKIND_INDICATORS.has(root)) return 'mankind';
  }
  if (DIVINE_INDICATORS.has(allTokensForVerse[tokenIndex]?.root || '')) return 'divine';
  return 'human';
}

function classifyTense(surface) {
  const s = stripDiacritics(surface);
  if (/^[يتأن]/.test(s)) return 'present';
  if (/^[اإ]/.test(s) && s.length <= 5) return 'imperative';
  return 'past';
}

function classifyTarget(tokenIndex, allTokensForVerse) {
  const after = allTokensForVerse.slice(tokenIndex + 1, tokenIndex + 3);
  for (const w of after) {
    if (w.pos === 'noun') {
      const text = stripDiacritics(w.surface);
      const root = w.root || '';
      if (DIVINE_INDICATORS.has(text) || DIVINE_INDICATORS.has(root)) return 'divine';
      if (PROPHET_INDICATORS.has(text) || PROPHET_INDICATORS.has(root)) return 'prophet';
      if (MANKIND_INDICATORS.has(text) || MANKIND_INDICATORS.has(root)) return 'mankind';
      return root || text;
    }
  }
  return null;
}

// --- Polarity map ---
const ACTION_POLARITY_MAP = {
  'امن': 'positive', 'أمن': 'positive', 'صدق': 'positive', 'عبد': 'positive',
  'صلو': 'positive', 'سجد': 'positive', 'شكر': 'positive', 'توب': 'positive',
  'هدي': 'positive', 'نصر': 'positive', 'غفر': 'positive', 'رحم': 'positive',
  'حمد': 'positive', 'سبح': 'positive', 'رضي': 'positive', 'صبر': 'positive',
  'علم': 'positive', 'فهم': 'positive', 'عقل': 'positive', 'عدل': 'positive',
  'صلح': 'positive', 'فلح': 'positive', 'حفظ': 'positive', 'عمل': 'positive',
  'نفع': 'positive', 'طوع': 'positive',
  'كفر': 'negative', 'ظلم': 'negative', 'فسق': 'negative', 'كذب': 'negative',
  'شرك': 'negative', 'فسد': 'negative', 'بغي': 'negative', 'طغي': 'negative',
  'قتل': 'negative', 'عذب': 'negative', 'لعن': 'negative', 'هزأ': 'negative',
  'مكر': 'negative', 'ضلل': 'negative', 'كره': 'negative', 'غضب': 'negative',
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
  console.log('=== Seed Action Edges v2 (verse_tokens source) ===\n');

  // 1. Fetch data from Supabase
  console.log('[1/5] Fetching data from Supabase...');
  const [rawTokens, rawRootTrans] = await Promise.all([
    fetchAll('ayamakna_verse_tokens', 'id,verse_id,surface,lemma,root,pos,position'),
    fetchAll('ayamakna_root_translations', 'root,translation'),
  ]);
  console.log(`  ${rawTokens.length} verse tokens, ${rawRootTrans.length} root translations`);

  // 2. Build lookup maps
  console.log('[2/5] Building lookup maps...');
  const rootTranslations = new Map();
  for (const r of rawRootTrans) rootTranslations.set(r.root, r.translation);

  // Group tokens by verse_id (sorted by position)
  const tokensByVerse = new Map();
  for (const t of rawTokens) {
    if (!tokensByVerse.has(t.verse_id)) tokensByVerse.set(t.verse_id, []);
    tokensByVerse.get(t.verse_id).push(t);
  }
  for (const tokens of tokensByVerse.values()) {
    tokens.sort((a, b) => a.position - b.position);
  }

  // Build root frequency index
  console.log('[3/5] Building root frequency index...');
  const rootFreqMap = new Map();
  for (const t of rawTokens) {
    if (!t.root) continue;
    rootFreqMap.set(t.root, (rootFreqMap.get(t.root) ?? 0) + 1);
  }

  // 4. Extract action edges from tokens
  console.log('[4/5] Extracting action edges from verb tokens...');
  const allEdges = [];
  let processedVerses = 0;

  for (const [verseId, tokens] of tokensByVerse) {
    processedVerses++;
    if (processedVerses % 1000 === 0) process.stdout.write(`\r  Processing verse ${processedVerses}/${tokensByVerse.size}`);

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      // Only include tokens whose root is a recognized action verb root
      if (!t.root || !VERB_ROOT_SET.has(t.root)) continue;
      // Skip particles (function words)
      if (t.pos === 'particle') continue;

      const family = ACTION_FAMILY_MAP[t.root];
      allEdges.push({
        id: `action:${verseId}:${t.id}`,
        verse_id: verseId,
        actor_type: classifyActor(i, tokens),
        action_root: t.root,
        target_type: classifyTarget(i, tokens),
        tense: classifyTense(t.surface),
        verb_text: t.surface,
        english_meaning: rootTranslations.get(t.root) ?? null,
        root_frequency: rootFreqMap.get(t.root) ?? 0,
        semantic_cluster: family,  // always non-null (guaranteed by VERB_ROOT_SET filter)
        polarity: ACTION_POLARITY_MAP[t.root] ?? 'neutral',
      });
    }
  }
  console.log(`\n  Extracted ${allEdges.length} action edges from ${processedVerses} verses`);

  // 5. Clear existing rows and insert new ones
  console.log('[5/5] Clearing old rows and inserting...');
  const { error: deleteError } = await supabase.from('ayamakna_action_edges').delete().neq('id', '___never___');
  if (deleteError) {
    console.error('  Delete failed:', deleteError.message);
    console.error('  Make sure temp DELETE policy is active on ayamakna_action_edges');
    process.exit(1);
  }
  console.log('  Old rows cleared.');

  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < allEdges.length; i += BATCH_SIZE) {
    const batch = allEdges.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('ayamakna_action_edges').insert(batch);
    if (error) {
      console.error(`  Error at batch ${i}: ${error.message}`);
      continue;
    }
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${allEdges.length}`);
  }
  console.log(`\n  Done: ${inserted} rows inserted.`);
  console.log('\n=== Re-seed ayamakna_action_verse_links next: node scripts/seed-action-verse-links.mjs ===');
}

main().catch(console.error);
