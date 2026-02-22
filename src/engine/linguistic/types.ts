// =============================================================================
// Layer A — Linguistic Engine Types
// =============================================================================

export interface Surah {
  id: number;
  name: string;
  nameAr: string;
  totalAyah: number;
}

export interface Verse {
  id: string; // format: "surahId:ayahNumber" e.g. "2:255"
  surahId: number;
  ayahNumber: number;
  textArabic: string;
  textTranslation: string;
  textTranslationId?: string; // Bahasa Indonesia (Kemenag)
}

export type POS =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'particle'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'adverb'
  | 'interjection'
  | 'proper_noun';

export interface Word {
  id: string; // format: "verseId:wordIndex" e.g. "2:255:3"
  verseId: string;
  text: string;
  root: string;
  pos: POS;
  lemma: string;
}

export interface TokenizedVerse {
  verse: Verse;
  words: Word[];
}
