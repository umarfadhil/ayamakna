import { describe, it, expect, beforeEach } from 'vitest';
import {
  setVerseTokens,
  getVerseLinguisticRoots,
  isArabicRoot,
} from '@/services/linguistic/linguisticService';
import type { VerseToken } from '@/services/linguistic/linguisticService';

// ---------------------------------------------------------------------------
// Unit tests — Service A: Linguistic Core
// Verifies architectural rule: only Arabic roots physically in the verse pass.
// ---------------------------------------------------------------------------

describe('isArabicRoot', () => {
  it('accepts valid 3-letter Arabic roots', () => {
    expect(isArabicRoot('صبر')).toBe(true);
    expect(isArabicRoot('علم')).toBe(true);
    expect(isArabicRoot('رحم')).toBe(true);
  });

  it('accepts valid 4-letter Arabic roots', () => {
    expect(isArabicRoot('دحرج')).toBe(true); // quadrilateral root
    expect(isArabicRoot('زلزل')).toBe(true); // quadrilateral root
    expect(isArabicRoot('وسوس')).toBe(true); // quadrilateral root
  });

  it('rejects roots with wrong length (< 3 or > 4)', () => {
    expect(isArabicRoot('ص')).toBe(false);    // 1 char
    expect(isArabicRoot('صر')).toBe(false);   // 2 chars
    expect(isArabicRoot('صبرتم')).toBe(false); // 5 chars
  });

  it('rejects English words', () => {
    expect(isArabicRoot('Blessing')).toBe(false);
    expect(isArabicRoot('Mercy')).toBe(false);
    expect(isArabicRoot('faith')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isArabicRoot('')).toBe(false);
  });

  it('rejects mixed scripts', () => {
    expect(isArabicRoot('ص1ر')).toBe(false);
    expect(isArabicRoot('صbر')).toBe(false);
  });
});

describe('getVerseLinguisticRoots', () => {
  const VERSE_ID = '2:255';

  beforeEach(() => {
    const tokens: VerseToken[] = [
      { id: 't1', verseId: VERSE_ID, surface: 'اللَّهُ', lemma: 'الله', root: 'اله', position: 0 },
      { id: 't2', verseId: VERSE_ID, surface: 'لَا', lemma: 'لا', root: null, position: 1 },
      { id: 't3', verseId: VERSE_ID, surface: 'إِلَٰهَ', lemma: 'إله', root: 'اله', position: 2 }, // duplicate root
      { id: 't4', verseId: VERSE_ID, surface: 'إِلَّا', lemma: 'الا', root: null, position: 3 },
      { id: 't5', verseId: VERSE_ID, surface: 'هُوَ', lemma: 'هو', root: 'هوي', position: 4 },
      { id: 't6', verseId: VERSE_ID, surface: 'الْحَيُّ', lemma: 'حي', root: 'حيي', position: 5 },
      // Contaminated token — English word as root (should be rejected)
      { id: 't7', verseId: VERSE_ID, surface: 'القيوم', lemma: 'قيوم', root: 'Blessing', position: 6 },
    ];
    setVerseTokens(tokens);
  });

  it('returns only deduplicated Arabic roots', () => {
    const { roots } = getVerseLinguisticRoots(VERSE_ID);

    // 'اله' appears twice → deduplicated to one
    // null roots → excluded
    // 'Blessing' → rejected by Arabic filter
    expect(roots).toEqual(['اله', 'هوي', 'حيي']);
  });

  it('does not contain any English words', () => {
    const { roots } = getVerseLinguisticRoots(VERSE_ID);
    roots.forEach((root) => {
      expect(/^[\u0600-\u06FF]{3,4}$/.test(root)).toBe(true);
    });
  });

  it('does not contain "Blessing" or any concept name', () => {
    const { roots } = getVerseLinguisticRoots(VERSE_ID);
    expect(roots).not.toContain('Blessing');
    expect(roots).not.toContain('Mercy');
    expect(roots).not.toContain('Faith');
  });

  it('returns empty array for unknown verse', () => {
    const { roots } = getVerseLinguisticRoots('99:99');
    expect(roots).toEqual([]);
  });
});
