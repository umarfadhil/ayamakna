// =============================================================================
// Root Engine — Layer B (Semantic Engine)
// =============================================================================
// Optimized for 6000+ verses using inverted-index approach.
// Avoids O(n²) pairwise comparisons by using root→verses index.
// =============================================================================

import type { Word, TokenizedVerse } from '../linguistic/types';
import type {
  RootFrequency,
  RootIndex,
  RootDensity,
  VerseLink,
  RootAnalytics,
  RootCentrality,
  RootContext,
  RootDensityScore,
} from './types';

// Medinan surahs by scholarly consensus (simplified surah-level classification)
const MEDINAN_SURAHS = new Set([2,3,4,5,8,9,22,24,33,47,48,49,55,57,58,59,60,61,62,63,64,65,66,76,98,110]);

/**
 * Build a root frequency index from tokenized verses.
 */
export function buildRootIndex(verses: TokenizedVerse[]): RootIndex {
  const index: RootIndex = {};

  for (const { verse, words } of verses) {
    const seenRoots = new Set<string>();
    for (const word of words) {
      if (!word.root || word.root.length === 0) continue;
      if (!index[word.root]) {
        index[word.root] = { root: word.root, count: 0, verseIds: [] };
      }
      index[word.root].count++;
      if (!seenRoots.has(word.root)) {
        seenRoots.add(word.root);
        index[word.root].verseIds.push(verse.id);
      }
    }
  }

  return index;
}

export function getTopRoots(index: RootIndex, limit: number = 50): RootFrequency[] {
  return Object.values(index)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getVersesByRoot(index: RootIndex, root: string): string[] {
  return index[root]?.verseIds ?? [];
}

export function calculateRootDensity(verses: TokenizedVerse[]): RootDensity[] {
  return verses.map(({ verse, words }) => {
    const uniqueRoots = new Set(words.map((w) => w.root).filter(Boolean));
    return {
      verseId: verse.id,
      uniqueRoots: uniqueRoots.size,
      totalWords: words.length,
      density: words.length > 0 ? uniqueRoots.size / words.length : 0,
    };
  });
}

/**
 * Auto-link verses by shared roots using INVERTED INDEX approach.
 * Instead of O(n²) pairwise comparison, iterates over the root index:
 * for each root appearing in multiple verses, links those verses.
 *
 * Time: O(R * V_r²) where R = unique roots, V_r = verses per root.
 * Much faster than O(n²) when most roots appear in few verses.
 *
 * @param minSharedRoots - minimum shared roots to create a link
 * @param maxLinksPerVerse - cap links per verse to prevent explosion
 */
export function autoLinkByRoot(
  verses: TokenizedVerse[],
  rootIndex: RootIndex,
  minSharedRoots: number = 3,
  maxLinksPerVerse: number = 20
): VerseLink[] {
  // Build per-verse root sets
  const verseRootSets = new Map<string, Set<string>>();
  for (const { verse, words } of verses) {
    const roots = new Set(words.map((w) => w.root).filter(Boolean));
    if (roots.size > 0) verseRootSets.set(verse.id, roots);
  }

  // Count shared roots between verse pairs using inverted index
  // pairKey -> sharedRootCount
  const pairCounts = new Map<string, number>();

  for (const entry of Object.values(rootIndex)) {
    const vIds = entry.verseIds;
    // Skip very common roots (appear in >500 verses) to avoid noise
    if (vIds.length > 500 || vIds.length < 2) continue;

    for (let i = 0; i < vIds.length; i++) {
      for (let j = i + 1; j < vIds.length; j++) {
        const key = vIds[i] < vIds[j] ? `${vIds[i]}|${vIds[j]}` : `${vIds[j]}|${vIds[i]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  // Convert to links, filtering by minSharedRoots
  const links: VerseLink[] = [];
  const verseLinkCounts = new Map<string, number>();

  // Sort by shared count descending to prioritize strongest links
  const sorted = [...pairCounts.entries()]
    .filter(([_, count]) => count >= minSharedRoots)
    .sort((a, b) => b[1] - a[1]);

  for (const [key, sharedCount] of sorted) {
    const [idA, idB] = key.split('|');
    const countA = verseLinkCounts.get(idA) ?? 0;
    const countB = verseLinkCounts.get(idB) ?? 0;

    if (countA >= maxLinksPerVerse || countB >= maxLinksPerVerse) continue;

    const rootsA = verseRootSets.get(idA);
    const rootsB = verseRootSets.get(idB);
    if (!rootsA || !rootsB) continue;

    const union = new Set([...rootsA, ...rootsB]).size;
    const score = union > 0 ? sharedCount / union : 0;

    links.push({ verseA: idA, verseB: idB, similarityScore: score, linkType: 'root' });
    verseLinkCounts.set(idA, countA + 1);
    verseLinkCounts.set(idB, countB + 1);
  }

  return links;
}

/**
 * Compute full root analytics: centrality metrics, density heatmap, and root contexts.
 * Single-pass over verses for context (O(total_words)).
 * Co-occurrence adjacency for degree centrality (O(sum_verse_roots²)).
 */
export function computeRootAnalytics(
  verses: TokenizedVerse[],
  rootIndex: RootIndex
): RootAnalytics {
  const roots = Object.keys(rootIndex);
  const N = roots.length;

  // === 1. Co-occurrence adjacency for degree centrality ===
  const neighborSets = new Map<string, Set<string>>();
  for (const root of roots) neighborSets.set(root, new Set());

  for (const { words } of verses) {
    const verseRoots = [...new Set(words.map((w) => w.root).filter(Boolean))];
    for (let i = 0; i < verseRoots.length; i++) {
      for (let j = i + 1; j < verseRoots.length; j++) {
        const r1 = verseRoots[i], r2 = verseRoots[j];
        neighborSets.get(r1)?.add(r2);
        neighborSets.get(r2)?.add(r1);
      }
    }
  }

  // === 2. Frequency ranking (by token count desc) ===
  const frequencyRanking = [...roots].sort(
    (a, b) => (rootIndex[b].count - rootIndex[a].count)
  );
  const rankMap = new Map<string, number>();
  frequencyRanking.forEach((r, i) => rankMap.set(r, i + 1));

  // === 3. Centrality per root ===
  const centralityByRoot: Record<string, RootCentrality> = {};

  for (const root of roots) {
    const freq = rootIndex[root];
    const neighborCount = neighborSets.get(root)?.size ?? 0;
    const degreeCentrality = N > 1 ? neighborCount / (N - 1) : 0;
    const verseFrequency = freq.verseIds.length;
    const normalizedFreq = verseFrequency / Math.max(verses.length, 1);

    // Betweenness heuristic: bridge roots appear in moderate frequency × high degree
    // Bell-curve peak around normalizedFreq=0.25; penalizes very rare and very ubiquitous roots
    const betweennessCentrality = normalizedFreq > 0 && normalizedFreq < 1
      ? Math.sin(Math.PI * Math.min(normalizedFreq * 2, 1)) * degreeCentrality
      : 0;

    const frequencyRank = rankMap.get(root) ?? N;
    const normalizedRank = 1 - (frequencyRank - 1) / Math.max(N - 1, 1);

    // Composite importance: degree + betweenness + frequency rank
    const importance = Math.min(1, 0.45 * degreeCentrality + 0.35 * betweennessCentrality + 0.2 * normalizedRank);

    centralityByRoot[root] = {
      root,
      degreeCentrality,
      betweennessCentrality,
      frequencyCount: freq.count,
      verseFrequency,
      frequencyRank,
      neighborCount,
      importance,
    };
  }

  // === 4. Centrality summary ===
  let mostConnectedRoot: RootCentrality | undefined;
  let bridgeRoot: RootCentrality | undefined;
  let mostFrequentRoot: RootCentrality | undefined;
  for (const c of Object.values(centralityByRoot)) {
    if (!mostConnectedRoot || c.degreeCentrality > mostConnectedRoot.degreeCentrality) mostConnectedRoot = c;
    if (!bridgeRoot || c.betweennessCentrality > bridgeRoot.betweennessCentrality) bridgeRoot = c;
    if (!mostFrequentRoot || c.verseFrequency > mostFrequentRoot.verseFrequency) mostFrequentRoot = c;
  }

  // === 5. Root density by verse ===
  const densityRaw: Array<{ verseId: string; uniqueRootCount: number; frequencyWeight: number }> = [];
  for (const { verse, words } of verses) {
    const uniqueRoots = new Set(words.map((w) => w.root).filter(Boolean));
    let frequencyWeight = 0;
    for (const root of uniqueRoots) frequencyWeight += rootIndex[root]?.count ?? 0;
    densityRaw.push({ verseId: verse.id, uniqueRootCount: uniqueRoots.size, frequencyWeight });
  }

  const maxRootCount = Math.max(...densityRaw.map((d) => d.uniqueRootCount), 1);
  const maxFreqWeight = Math.max(...densityRaw.map((d) => d.frequencyWeight), 1);

  const densityByVerse: Record<string, RootDensityScore> = {};
  for (const d of densityRaw) {
    const nrc = d.uniqueRootCount / maxRootCount;
    const nfw = d.frequencyWeight / maxFreqWeight;
    densityByVerse[d.verseId] = {
      verseId: d.verseId,
      uniqueRootCount: d.uniqueRootCount,
      frequencyWeight: d.frequencyWeight,
      normalizedRootCount: nrc,
      normalizedFrequencyWeight: nfw,
      heatScore: 0.6 * nrc + 0.4 * nfw,
    };
  }

  // === 6. Root contexts — single pass over all verses ===
  type CtxAccum = { forms: Map<string, number>; noun: number; verb: number; other: number; meccan: number; medinan: number; unknown: number };
  const ctxAccum = new Map<string, CtxAccum>();
  for (const root of roots) {
    ctxAccum.set(root, { forms: new Map(), noun: 0, verb: 0, other: 0, meccan: 0, medinan: 0, unknown: 0 });
  }

  for (const { verse, words } of verses) {
    const revType = MEDINAN_SURAHS.has(verse.surahId) ? 'medinan' : 'meccan';
    const countedRevRoots = new Set<string>();

    for (const word of words) {
      if (!word.root) continue;
      const ctx = ctxAccum.get(word.root);
      if (!ctx) continue;

      ctx.forms.set(word.lemma, (ctx.forms.get(word.lemma) ?? 0) + 1);

      if (word.pos === 'verb') ctx.verb++;
      else if (word.pos === 'noun' || word.pos === 'adjective' || word.pos === 'proper_noun') ctx.noun++;
      else ctx.other++;

      if (!countedRevRoots.has(word.root)) {
        countedRevRoots.add(word.root);
        if (revType === 'medinan') ctx.medinan++;
        else ctx.meccan++;
      }
    }
  }

  const contextsByRoot: Record<string, RootContext> = {};
  for (const root of roots) {
    const ctx = ctxAccum.get(root)!;
    contextsByRoot[root] = {
      root,
      forms: [...ctx.forms.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([form, count]) => ({ form, count })),
      posDistribution: {
        noun: ctx.noun, verb: ctx.verb, other: ctx.other,
        total: ctx.noun + ctx.verb + ctx.other,
      },
      revelationDistribution: {
        meccan: ctx.meccan, medinan: ctx.medinan, unknown: ctx.unknown,
        total: ctx.meccan + ctx.medinan + ctx.unknown,
      },
    };
  }

  // === 7. verseIdsByRoot (alias of rootIndex) ===
  const verseIdsByRoot: Record<string, string[]> = {};
  for (const root of roots) verseIdsByRoot[root] = rootIndex[root].verseIds;

  return {
    centralityByRoot,
    centralitySummary: { mostConnectedRoot, bridgeRoot, mostFrequentRoot },
    frequencyRanking,
    densityByVerse,
    contextsByRoot,
    verseIdsByRoot,
  };
}

export function rootOverlapScore(wordsA: Word[], wordsB: Word[]): number {
  const rootsA = new Set(wordsA.map((w) => w.root).filter(Boolean));
  const rootsB = new Set(wordsB.map((w) => w.root).filter(Boolean));
  if (rootsA.size === 0 && rootsB.size === 0) return 0;

  let intersection = 0;
  for (const root of rootsA) {
    if (rootsB.has(root)) intersection++;
  }
  const union = new Set([...rootsA, ...rootsB]).size;
  return union > 0 ? intersection / union : 0;
}
