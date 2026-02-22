// =============================================================================
// Semantic Similarity Engine — Layer B (Semantic Engine)
// =============================================================================
// Optimized for 6000+ verses using sparse candidate-pair approach.
// Only compares verse pairs that share at least one root (via root index).
// =============================================================================

import type { Word, TokenizedVerse } from '../linguistic/types';
import type {
  SimilarityWeights,
  SimilarityResult,
  VerseLink,
  VerseConcept,
  ActionEdge,
  RootIndex,
} from './types';
import { rootOverlapScore } from './rootEngine';

export const DEFAULT_WEIGHTS: SimilarityWeights = {
  rootOverlap: 0.5,
  conceptOverlap: 0.3,
  verbPatternOverlap: 0.2,
};

export const DEFAULT_THRESHOLD = 0.3;

export function conceptOverlapScore(
  conceptsA: VerseConcept[],
  conceptsB: VerseConcept[]
): number {
  const setA = new Set(conceptsA.map((c) => c.conceptId));
  const setB = new Set(conceptsB.map((c) => c.conceptId));
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const id of setA) {
    if (setB.has(id)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export function verbPatternOverlapScore(
  actionsA: ActionEdge[],
  actionsB: ActionEdge[]
): number {
  const patternsA = new Set(actionsA.map((a) => `${a.actorType}:${a.actionRoot}`));
  const patternsB = new Set(actionsB.map((a) => `${a.actorType}:${a.actionRoot}`));
  if (patternsA.size === 0 && patternsB.size === 0) return 0;

  let intersection = 0;
  for (const p of patternsA) {
    if (patternsB.has(p)) intersection++;
  }
  const union = new Set([...patternsA, ...patternsB]).size;
  return union > 0 ? intersection / union : 0;
}

export function computeSimilarity(
  wordsA: Word[],
  wordsB: Word[],
  conceptsA: VerseConcept[],
  conceptsB: VerseConcept[],
  actionsA: ActionEdge[],
  actionsB: ActionEdge[],
  weights: SimilarityWeights = DEFAULT_WEIGHTS
): SimilarityResult & { verseA: string; verseB: string } {
  const rootScore = rootOverlapScore(wordsA, wordsB);
  const conceptScore = conceptOverlapScore(conceptsA, conceptsB);
  const verbScore = verbPatternOverlapScore(actionsA, actionsB);

  const totalScore =
    rootScore * weights.rootOverlap +
    conceptScore * weights.conceptOverlap +
    verbScore * weights.verbPatternOverlap;

  return {
    verseA: wordsA[0]?.verseId ?? '',
    verseB: wordsB[0]?.verseId ?? '',
    score: Math.min(1, totalScore),
    breakdown: { rootScore, conceptScore, verbScore },
  };
}

/**
 * SPARSE precompute: only compare verse pairs that share at least one root.
 * Uses the root index as a candidate generator.
 *
 * Complexity: O(R * V_r²) instead of O(n²), where most roots have small V_r.
 *
 * @param maxResults - cap total similarity links to prevent memory blowup
 */
export function precomputeSimilarity(
  verses: TokenizedVerse[],
  conceptMap: Map<string, VerseConcept[]>,
  actionMap: Map<string, ActionEdge[]>,
  rootIndex: RootIndex,
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
  threshold: number = DEFAULT_THRESHOLD,
  maxResults: number = 15000
): SimilarityResult[] {
  // Build verse lookup for fast access
  const verseMap = new Map<string, TokenizedVerse>();
  for (const v of verses) verseMap.set(v.verse.id, v);

  // Generate candidate pairs from root index
  const candidatePairs = new Set<string>();
  for (const entry of Object.values(rootIndex)) {
    // Skip extremely common roots (noise)
    if (entry.verseIds.length > 300 || entry.verseIds.length < 2) continue;

    for (let i = 0; i < entry.verseIds.length; i++) {
      for (let j = i + 1; j < entry.verseIds.length; j++) {
        const a = entry.verseIds[i];
        const b = entry.verseIds[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        candidatePairs.add(key);
      }
    }
  }

  // Score candidate pairs
  const results: SimilarityResult[] = [];

  for (const key of candidatePairs) {
    if (results.length >= maxResults) break;

    const [idA, idB] = key.split('|');
    const vA = verseMap.get(idA);
    const vB = verseMap.get(idB);
    if (!vA || !vB) continue;

    const result = computeSimilarity(
      vA.words,
      vB.words,
      conceptMap.get(idA) ?? [],
      conceptMap.get(idB) ?? [],
      actionMap.get(idA) ?? [],
      actionMap.get(idB) ?? [],
      weights
    );

    result.verseA = idA;
    result.verseB = idB;

    if (result.score >= threshold) {
      results.push(result);
    }
  }

  // Sort by score descending, keep top results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

export function similarityToVerseLinks(results: SimilarityResult[]): VerseLink[] {
  return results.map((r) => ({
    verseA: r.verseA,
    verseB: r.verseB,
    similarityScore: r.score,
    linkType: 'concept' as const,
  }));
}
