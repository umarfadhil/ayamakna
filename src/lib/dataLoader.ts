// =============================================================================
// Data Loader — Fetches AyaMakna data from Supabase
// =============================================================================

import { supabase } from './supabase';
import type { Verse } from '@/engine/linguistic/types';
import type { Concept, VerseConcept } from '@/engine/semantic/types';

export interface SurahInfo {
  number: number;
  name: string;
  nameAr: string;
  totalAyah: number;
}

export interface LoadedData {
  verses: Verse[];
  surahs: SurahInfo[];
  rootLookup: Map<string, string>;
  rootTranslations: Map<string, string>;
  concepts: Concept[];
  verseConcepts: VerseConcept[];
}

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) {
      done = true;
    } else {
      all.push(...(data as T[]));
      if (data.length < PAGE_SIZE) done = true;
      from += PAGE_SIZE;
    }
  }

  return all;
}

export async function loadDataFromSupabase(): Promise<LoadedData> {
  console.time('supabase:load');

  const [rawVerses, rawSurahs, rawRoots, rawRootTrans, rawConcepts, rawVC] = await Promise.all([
    fetchAll<{ id: string; surah_id: number; ayah_number: number; text_arabic: string; text_translation: string; text_translation_id: string | null }>(
      'ayamakna_verses', 'id,surah_id,ayah_number,text_arabic,text_translation,text_translation_id'
    ),
    fetchAll<{ number: number; name: string; name_ar: string; total_ayah: number }>(
      'ayamakna_surahs', 'number,name,name_ar,total_ayah'
    ),
    fetchAll<{ word: string; root: string }>(
      'ayamakna_root_lookups', 'word,root'
    ),
    fetchAll<{ root: string; translation: string }>(
      'ayamakna_root_translations', 'root,translation'
    ),
    fetchAll<{ id: string; name: string; name_ar: string | null; description: string }>(
      'ayamakna_concepts', 'id,name,name_ar,description'
    ),
    fetchAll<{ verse_id: string; concept_id: string; weight: number }>(
      'ayamakna_verse_concepts', 'verse_id,concept_id,weight'
    ),
  ]);

  // Map Supabase column names → app types
  const verses: Verse[] = rawVerses.map((v) => ({
    id: v.id,
    surahId: v.surah_id,
    ayahNumber: v.ayah_number,
    textArabic: v.text_arabic,
    textTranslation: v.text_translation,
    textTranslationId: v.text_translation_id ?? undefined,
  }));

  const surahs: SurahInfo[] = rawSurahs.map((s) => ({
    number: s.number,
    name: s.name,
    nameAr: s.name_ar,
    totalAyah: s.total_ayah,
  }));

  // Build root lookup map with diacritics stripped from keys
  const rootLookup = new Map<string, string>();
  for (const r of rawRoots) {
    rootLookup.set(r.word.replace(DIACRITICS, ''), r.root);
  }

  // Build root translation map (Arabic root → English conceptual meaning)
  const rootTranslations = new Map<string, string>();
  for (const r of rawRootTrans) {
    rootTranslations.set(r.root, r.translation);
  }

  const concepts: Concept[] = rawConcepts.map((c) => ({
    id: c.id,
    name: c.name,
    nameAr: c.name_ar ?? undefined,
    description: c.description,
  }));

  const verseConcepts: VerseConcept[] = rawVC.map((vc) => ({
    verseId: vc.verse_id,
    conceptId: vc.concept_id,
    weight: vc.weight,
  }));

  console.timeEnd('supabase:load');
  console.log(`Loaded: ${verses.length} verses, ${surahs.length} surahs, ${rootLookup.size} roots, ${rootTranslations.size} root translations, ${concepts.length} concepts, ${verseConcepts.length} verse-concepts`);

  return { verses, surahs, rootLookup, rootTranslations, concepts, verseConcepts };
}
