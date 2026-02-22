// =============================================================================
// Root Extraction — Layer A (Linguistic Engine)
// =============================================================================
// Extracts Arabic trilateral/quadrilateral roots from words.
// Uses a lookup-based approach with fallback heuristic stripping.
// =============================================================================

import type { Word } from './types';

// Common Arabic prefixes (particles, conjunctions, prepositions)
const PREFIXES = [
  'وال', 'فال', 'بال', 'كال', 'لل',
  'ال', 'و', 'ف', 'ب', 'ك', 'ل', 'س',
];

// Common Arabic suffixes (pronouns, gender/number markers)
const SUFFIXES = [
  'هم', 'هن', 'كم', 'كن', 'نا', 'ها',
  'ون', 'ين', 'ات', 'ان', 'تم', 'تن',
  'ه', 'ك', 'ي', 'ة', 'ت', 'ا', 'و', 'ن',
];

// Diacritical marks to strip for root analysis
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

/**
 * Strip diacritical marks from Arabic text.
 */
export function stripDiacritics(text: string): string {
  return text.replace(DIACRITICS, '');
}

/**
 * Strip known prefixes from an Arabic word.
 * Returns the stripped form.
 */
export function stripPrefixes(word: string): string {
  let stripped = word;
  for (const prefix of PREFIXES) {
    if (stripped.startsWith(prefix) && stripped.length > prefix.length + 2) {
      stripped = stripped.slice(prefix.length);
      break; // only strip one prefix
    }
  }
  return stripped;
}

/**
 * Strip known suffixes from an Arabic word.
 * Returns the stripped form.
 */
export function stripSuffixes(word: string): string {
  let stripped = word;
  for (const suffix of SUFFIXES) {
    if (stripped.endsWith(suffix) && stripped.length > suffix.length + 2) {
      stripped = stripped.slice(0, -suffix.length);
      break; // only strip one suffix
    }
  }
  return stripped;
}

/**
 * Heuristic root extraction by stripping affixes.
 * This is a fallback when no lookup table entry exists.
 * Returns a best-guess root (the stripped consonantal skeleton).
 */
export function extractRootHeuristic(arabicWord: string): string {
  let word = stripDiacritics(arabicWord);
  word = stripPrefixes(word);
  word = stripSuffixes(word);
  return word;
}

/**
 * Extract root from a Word using the lookup table first,
 * then falling back to heuristic extraction.
 */
export function extractRoot(word: Word, rootLookup?: Map<string, string>): string {
  // If root already assigned (from corpus data), use it
  if (word.root) return word.root;

  const cleaned = stripDiacritics(word.text);

  // Check lookup table
  if (rootLookup?.has(cleaned)) {
    return rootLookup.get(cleaned)!;
  }

  // Fallback to heuristic
  return extractRootHeuristic(word.text);
}

/**
 * Tokenize an Arabic verse into raw word strings.
 * Splits on whitespace and strips diacritics.
 */
export function tokenizeArabic(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map(stripDiacritics);
}
