// =============================================================================
// Contrast Pair Engine — Layer B (Semantic Engine)
// =============================================================================
// Optimized for 6000+ verses with capped links per contrast pair.
// =============================================================================

import type { TokenizedVerse } from '../linguistic/types';
import type { ContrastPair, ContrastLink, VerseLink } from './types';

export const CONTRAST_DICTIONARY: ContrastPair[] = [
  { rootA: 'ءمن', rootB: 'كفر', labelA: 'iman', labelB: 'kufr', category: 'faith' },
  { rootA: 'هدي', rootB: 'ضلل', labelA: 'huda', labelB: 'dalal', category: 'guidance' },
  { rootA: 'نور', rootB: 'ظلم', labelA: 'nur', labelB: 'zulumat', category: 'light' },
  { rootA: 'جنن', rootB: 'نار', labelA: 'jannah', labelB: 'jahannam', category: 'afterlife' },
  { rootA: 'دنو', rootB: 'ءخر', labelA: 'dunya', labelB: 'akhirah', category: 'worldview' },
  { rootA: 'خير', rootB: 'شرر', labelA: 'khayr', labelB: 'sharr', category: 'morality' },
  { rootA: 'صلح', rootB: 'فسد', labelA: 'islah', labelB: 'fasad', category: 'morality' },
  { rootA: 'حقق', rootB: 'بطل', labelA: 'haqq', labelB: 'batil', category: 'truth' },
  { rootA: 'صدق', rootB: 'كذب', labelA: 'sidq', labelB: 'kadhib', category: 'truth' },
  { rootA: 'حيي', rootB: 'موت', labelA: 'hayat', labelB: 'mawt', category: 'existence' },
  { rootA: 'ثوب', rootB: 'عذب', labelA: 'thawab', labelB: 'adhab', category: 'recompense' },
  { rootA: 'رحم', rootB: 'غضب', labelA: 'rahmah', labelB: 'ghadab', category: 'divine_attribute' },
  { rootA: 'علم', rootB: 'جهل', labelA: 'ilm', labelB: 'jahl', category: 'knowledge' },
  { rootA: 'صبر', rootB: 'عجل', labelA: 'sabr', labelB: 'ajal', category: 'character' },
  { rootA: 'شكر', rootB: 'كفر', labelA: 'shukr', labelB: 'kufr_nimah', category: 'gratitude' },
  { rootA: 'طوع', rootB: 'عصي', labelA: 'taah', labelB: 'masiyah', category: 'obedience' },
  { rootA: 'ذكر', rootB: 'نسي', labelA: 'dhikr', labelB: 'nisyan', category: 'remembrance' },
];

export function getPairId(pair: ContrastPair): string {
  return `${pair.rootA}:${pair.rootB}`;
}

/**
 * Build a root→verseIds index for fast lookups.
 */
function buildRootVerseIndex(verses: TokenizedVerse[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const { verse, words } of verses) {
    const seen = new Set<string>();
    for (const w of words) {
      if (w.root && !seen.has(w.root)) {
        seen.add(w.root);
        if (!index.has(w.root)) index.set(w.root, []);
        index.get(w.root)!.push(verse.id);
      }
    }
  }
  return index;
}

/**
 * Detect contrast links, capped per pair to prevent explosion.
 * For 6000+ verses, uncapped contrast links can be millions.
 *
 * @param maxLinksPerPair - max links to generate per contrast pair
 */
export function detectContrastLinks(
  verses: TokenizedVerse[],
  dictionary: ContrastPair[] = CONTRAST_DICTIONARY,
  maxLinksPerPair: number = 200
): ContrastLink[] {
  const rootVerseIndex = buildRootVerseIndex(verses);
  const links: ContrastLink[] = [];

  for (const pair of dictionary) {
    const pairId = getPairId(pair);
    const versesWithA = rootVerseIndex.get(pair.rootA) ?? [];
    const versesWithB = rootVerseIndex.get(pair.rootB) ?? [];

    if (versesWithA.length === 0 || versesWithB.length === 0) continue;

    // Sample links if the cross product is too large
    let count = 0;
    const setB = new Set(versesWithB);

    for (const vA of versesWithA) {
      if (count >= maxLinksPerPair) break;
      for (const vB of versesWithB) {
        if (count >= maxLinksPerPair) break;
        if (vA === vB) continue;

        links.push({ verseA: vA, verseB: vB, pairId, polarity: 'positive' });
        count++;
      }
    }
  }

  return links;
}

export function contrastLinksToVerseLinks(contrastLinks: ContrastLink[]): VerseLink[] {
  return contrastLinks.map((cl) => ({
    verseA: cl.verseA,
    verseB: cl.verseB,
    similarityScore: 0.8,
    linkType: 'contrast' as const,
  }));
}

export function detectInternalContrasts(
  verses: TokenizedVerse[],
  dictionary: ContrastPair[] = CONTRAST_DICTIONARY
): Array<{ verseId: string; pair: ContrastPair }> {
  const results: Array<{ verseId: string; pair: ContrastPair }> = [];
  const rootVerseIndex = buildRootVerseIndex(verses);

  for (const pair of dictionary) {
    const setA = new Set(rootVerseIndex.get(pair.rootA) ?? []);
    const versesB = rootVerseIndex.get(pair.rootB) ?? [];
    for (const vId of versesB) {
      if (setA.has(vId)) results.push({ verseId: vId, pair });
    }
  }

  return results;
}
