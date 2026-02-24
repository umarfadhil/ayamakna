// =============================================================================
// Service A — Linguistic Core (Deterministic, Authoritative)
// =============================================================================
// Returns ONLY roots physically present in the verse.
//
// Hard constraints:
//   ✓ ONLY reads from verse_tokens data (ayamakna_verse_tokens table)
//   ✗ MUST NOT join concept tables, graph tables, semantic clusters, or embeddings
//   ✗ MUST NOT infer anything
//
// Layer 1 answers: "What is in the verse?"
// =============================================================================

// --- Types ---

export interface VerseToken {
  id: string;
  verseId: string;
  surface: string;   // original Arabic surface form (with diacritics)
  lemma: string;     // diacritics-stripped form
  root: string | null; // null for particles/pronouns/prepositions
  pos: string | null;  // part of speech: 'noun' | 'verb' | 'particle' | null
  position: number;  // zero-indexed word position within verse
}

export interface LinguisticRoots {
  /** Deduplicated Arabic roots, ordered by first appearance in verse. */
  roots: string[];
}

// --- Internal state (populated by setVerseTokens, called from semanticStore) ---

let _tokensByVerse: Map<string, VerseToken[]> = new Map();

/**
 * Populate the in-memory store from pre-loaded ayamakna_verse_tokens data.
 * Called once during app initialisation; data originates from Supabase.
 * Service A reads ONLY from this store — no concept/graph access.
 */
export function setVerseTokens(tokens: VerseToken[]): void {
  _tokensByVerse = new Map();
  for (const t of tokens) {
    const existing = _tokensByVerse.get(t.verseId);
    if (existing) {
      existing.push(t);
    } else {
      _tokensByVerse.set(t.verseId, [t]);
    }
  }
  // Sort each verse's tokens by position (ascending)
  for (const [, toks] of _tokensByVerse) {
    toks.sort((a, b) => a.position - b.position);
  }
}

/**
 * Returns the count of verses with at least one token loaded.
 * Used for health checks.
 */
export function getLoadedVerseCount(): number {
  return _tokensByVerse.size;
}

// --- Public API (Service A contract) ---

/**
 * GET /api/verse/:id/linguistic
 *
 * Returns all roots physically present in the verse, deduplicated,
 * ordered by first appearance.
 *
 * Input:  verse_id (e.g. "2:255")
 * Source: ayamakna_verse_tokens ONLY
 * Output: { roots: string[] }
 */
export function getVerseLinguisticRoots(verseId: string): LinguisticRoots {
  const tokens = _tokensByVerse.get(verseId) ?? [];
  const seen = new Set<string>();
  const roots: string[] = [];

  for (const t of tokens) {
    if (t.root && !seen.has(t.root)) {
      // DEFENSIVE: reject any non-Arabic value — indicates data contamination
      if (!ARABIC_ROOT_RE.test(t.root)) {
        console.error(`[LinguisticService] Contamination detected: "${t.root}" in verse ${verseId} is not a valid Arabic root. Skipping.`);
        continue;
      }
      seen.add(t.root);
      roots.push(t.root);
    }
  }

  return { roots };
}

/**
 * Returns all word tokens for a verse, sorted by position.
 * Used by validation and UI display only.
 */
export function getVerseTokensOrdered(verseId: string): VerseToken[] {
  return _tokensByVerse.get(verseId) ?? [];
}

// --- Validation ---

/**
 * Arabic root regex. Valid roots contain ONLY Arabic Unicode characters (U+0600–U+06FF),
 * length 3–4 consonants (trilateral or quadrilateral). Any root failing this check
 * is a sign of data contamination and must be rejected by Service A.
 */
const ARABIC_ROOT_RE = /^[\u0600-\u06FF]{3,4}$/;

/**
 * Returns true if the string is a valid Arabic root (3–4 Arabic consonants).
 * Used defensively in Service A and by callers for validation.
 */
export function isArabicRoot(root: string): boolean {
  return ARABIC_ROOT_RE.test(root);
}

/**
 * Validates that a given root is actually present in the verse.
 * CRITICAL: Used by Service B to reject domains whose from_root is not in the verse.
 */
export function isRootInVerse(verseId: string, root: string): boolean {
  const { roots } = getVerseLinguisticRoots(verseId);
  return roots.includes(root);
}
