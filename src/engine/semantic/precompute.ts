// =============================================================================
// Precompute Pipeline — Layer B (Semantic Engine)
// =============================================================================
// Optimized for 6000+ verses. Uses IndexedDB for cache (localStorage too small).
// Caps link counts to prevent memory blowup.
// =============================================================================

import type { TokenizedVerse } from '../linguistic/types';
import type {
  SemanticCache,
  VerseConcept,
  SimilarityWeights,
} from './types';
import { buildRootIndex, autoLinkByRoot, computeRootAnalytics } from './rootEngine';
import { detectContrastLinks, contrastLinksToVerseLinks } from './contrastEngine';
import { buildActionIndex, autoLinkByAction } from './actionEngine';
import {
  precomputeSimilarity,
  similarityToVerseLinks,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLD,
} from './similarityEngine';

const DB_NAME = 'ayamakna-cache';
const DB_VERSION = 7; // bumped: enriched ActionEdge with verbText, englishMeaning, cluster, polarity
const STORE_NAME = 'semantic';
const CACHE_KEY = 'main';

/**
 * Run the full semantic precomputation pipeline.
 * Optimized for large datasets (6000+ verses):
 * - Root linking uses inverted index (not O(n²))
 * - Similarity uses sparse candidate-pair approach
 * - Contrast links capped per pair
 * - Action links capped per pattern
 * - Root analytics: centrality, density heatmap, context
 */
export function runPrecompute(
  verses: TokenizedVerse[],
  conceptMap: Map<string, VerseConcept[]> = new Map(),
  rootTranslations: Map<string, string> = new Map(),
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
  similarityThreshold: number = DEFAULT_THRESHOLD,
  rootLinkMinShared: number = 3
): SemanticCache {
  console.time('precompute:rootIndex');
  const rootIndex = buildRootIndex(verses);
  console.timeEnd('precompute:rootIndex');

  console.time('precompute:rootLinks');
  const rootLinks = autoLinkByRoot(verses, rootIndex, rootLinkMinShared, 15);
  console.timeEnd('precompute:rootLinks');

  console.time('precompute:contrastLinks');
  const contrastLinks = detectContrastLinks(verses);
  const contrastVerseLinks = contrastLinksToVerseLinks(contrastLinks);
  console.timeEnd('precompute:contrastLinks');

  console.time('precompute:actionEdges');
  const actionEdges = buildActionIndex(verses, rootTranslations, rootIndex);
  const actionLinks = autoLinkByAction(verses, actionEdges);
  console.timeEnd('precompute:actionEdges');

  // Build action map
  const actionMap = new Map<string, typeof actionEdges>();
  for (const edge of actionEdges) {
    if (!actionMap.has(edge.verseId)) actionMap.set(edge.verseId, []);
    actionMap.get(edge.verseId)!.push(edge);
  }

  console.time('precompute:similarity');
  const similarityLinks = precomputeSimilarity(
    verses, conceptMap, actionMap, rootIndex,
    weights, similarityThreshold, 10000
  );
  console.timeEnd('precompute:similarity');

  console.time('precompute:rootAnalytics');
  const rootAnalytics = computeRootAnalytics(verses, rootIndex);
  console.timeEnd('precompute:rootAnalytics');

  const allVerseLinks = [
    ...rootLinks,
    ...contrastVerseLinks,
    ...actionLinks,
    ...similarityToVerseLinks(similarityLinks),
  ];

  console.log(`Precompute done: ${allVerseLinks.length} total links (root: ${rootLinks.length}, contrast: ${contrastVerseLinks.length}, action: ${actionLinks.length}, similarity: ${similarityLinks.length})`);

  return {
    rootIndex,
    verseLinks: allVerseLinks,
    contrastLinks,
    actionEdges,
    similarityLinks,
    rootAnalytics,
    computedAt: Date.now(),
  };
}

// --- IndexedDB Cache ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save cache to IndexedDB (handles much larger data than localStorage).
 * Slim version: rootIndex skipped (fast to rebuild); verseIdsByRoot skipped (derived from rootIndex).
 */
export async function saveCache(cache: SemanticCache): Promise<void> {
  try {
    const slimAnalytics = cache.rootAnalytics ? {
      centralityByRoot: cache.rootAnalytics.centralityByRoot,
      centralitySummary: cache.rootAnalytics.centralitySummary,
      frequencyRanking: cache.rootAnalytics.frequencyRanking,
      densityByVerse: cache.rootAnalytics.densityByVerse,
      contextsByRoot: cache.rootAnalytics.contextsByRoot,
      verseIdsByRoot: {}, // not cached — rebuilt from rootIndex at load time
    } : undefined;

    const slim = {
      verseLinks: cache.verseLinks,
      contrastLinks: cache.contrastLinks,
      actionEdges: cache.actionEdges,
      similarityLinks: cache.similarityLinks,
      rootAnalytics: slimAnalytics,
      computedAt: cache.computedAt,
    };
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(slim, CACHE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('Failed to save cache to IndexedDB:', e);
  }
}

/**
 * Load cache from IndexedDB.
 */
export async function loadCache(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<SemanticCache | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
    const result = await new Promise<any>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!result || typeof result.computedAt !== 'number') return null;
    if (Date.now() - result.computedAt > maxAgeMs) return null;

    // rootIndex is not stored — caller must rebuild it
    return {
      rootIndex: {},
      verseLinks: Array.isArray(result.verseLinks) ? result.verseLinks : [],
      contrastLinks: Array.isArray(result.contrastLinks) ? result.contrastLinks : [],
      actionEdges: Array.isArray(result.actionEdges)
        ? result.actionEdges.filter((e: any) => typeof e.verbText === 'string' && typeof e.polarity === 'string')
        : [],
      similarityLinks: Array.isArray(result.similarityLinks) ? result.similarityLinks : [],
      rootAnalytics: result.rootAnalytics ?? undefined,
      computedAt: result.computedAt,
    };
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
