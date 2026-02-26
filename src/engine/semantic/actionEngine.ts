// =============================================================================
// Verb Dynamics (Action) Engine — Layer B (Semantic Engine)
// =============================================================================
// Models verb-action dynamics in Qur'anic verses.
// Classifies actor types, tenses, action targets, semantic clusters, and polarity.
// =============================================================================

import type { Word, TokenizedVerse } from '../linguistic/types';
import type { ActionEdge, ActorType, Tense, VerseLink, ActionSummary, RootIndex } from './types';
import type { ActionFamily, ActionPolarity, ActorOntology } from './actionDictionaries';
import {
  ACTION_FAMILY_MAP,
  CANONICAL_ACTION_MAP,
  ACTION_POLARITY_MAP,
  ACTOR_ONTOLOGY_MAP,
  PROPHET_INDICATORS,
  HYPOCRITE_INDICATORS,
  SHAYTAN_INDICATORS,
  MANKIND_INDICATORS,
} from './actionDictionaries';

// --- Actor Classification ---

/** Roots/lemmas commonly associated with divine actors. */
const DIVINE_INDICATORS = new Set([
  'الله', 'رب', 'رحمن', 'نحن', // "We" in divine speech
]);

/** Roots commonly associated with believers. */
const BELIEVER_INDICATORS = new Set([
  'امن', 'صلح', 'تقي', 'صبر', 'شكر', 'توب',
]);

/** Roots commonly associated with disbelievers. */
const DISBELIEVER_INDICATORS = new Set([
  'كفر', 'ظلم', 'فسق', 'نفق', 'شرك', 'كذب',
]);

/** Roots associated with angels. */
const ANGEL_INDICATORS = new Set([
  'ملك', 'جبريل', 'ملائكة',
]);

/**
 * Classify the actor type of a verb based on context words in the verse.
 * Uses a proximity-based heuristic: checks words before the verb.
 * Priority order: divine > prophet > shaytan > angel > hypocrite > believer > disbeliever > mankind > human
 */
export function classifyActor(
  verb: Word,
  verseWords: Word[]
): ActorType {
  const verbIndex = verseWords.findIndex((w) => w.id === verb.id);

  // Check nearby words (up to 3 words before the verb) for actor indicators
  const contextWindow = verseWords.slice(Math.max(0, verbIndex - 3), verbIndex);

  for (const w of contextWindow) {
    const text = w.text;
    const root = w.root;

    if (DIVINE_INDICATORS.has(text) || DIVINE_INDICATORS.has(root)) return 'divine';
    if (PROPHET_INDICATORS.has(text) || PROPHET_INDICATORS.has(root)) return 'prophet';
    if (SHAYTAN_INDICATORS.has(text) || SHAYTAN_INDICATORS.has(root)) return 'shaytan';
    if (ANGEL_INDICATORS.has(text) || ANGEL_INDICATORS.has(root)) return 'angel';
    if (HYPOCRITE_INDICATORS.has(text) || HYPOCRITE_INDICATORS.has(root)) return 'hypocrite';
    if (BELIEVER_INDICATORS.has(root)) return 'believer';
    if (DISBELIEVER_INDICATORS.has(root)) return 'disbeliever';
    if (MANKIND_INDICATORS.has(text) || MANKIND_INDICATORS.has(root)) return 'mankind';
  }

  // Default: check the verb root itself for self-identifying patterns
  if (DIVINE_INDICATORS.has(verb.root)) return 'divine';

  return 'human'; // default fallback
}

/**
 * Classify the tense of a verb.
 * Arabic verb forms have distinct patterns:
 * - Past (ماضي): base form, e.g., فَعَلَ
 * - Present (مضارع): prefixed with ي/ت/أ/ن
 * - Imperative (أمر): distinct conjugation
 */
export function classifyTense(verb: Word): Tense {
  const text = verb.text;

  // Present tense markers (mudari' prefixes)
  if (/^[يتأن]/.test(text)) return 'present';

  // Imperative patterns (often start with alif)
  if (/^[اإ]/.test(text) && text.length <= 5) return 'imperative';

  // Future marker (sa- / sawfa)
  // This is handled at the verse level, not word level

  // Default to past tense
  return 'past';
}

/**
 * Attempt to identify the target/object of a verb.
 * Looks at words immediately after the verb.
 */
export function classifyTarget(
  verb: Word,
  verseWords: Word[]
): ActorType | string | undefined {
  const verbIndex = verseWords.findIndex((w) => w.id === verb.id);
  const afterWords = verseWords.slice(verbIndex + 1, verbIndex + 3);

  for (const w of afterWords) {
    if (w.pos === 'noun' || w.pos === 'proper_noun') {
      const text = w.text;
      const root = w.root;
      if (DIVINE_INDICATORS.has(text) || DIVINE_INDICATORS.has(root)) return 'divine';
      if (PROPHET_INDICATORS.has(text) || PROPHET_INDICATORS.has(root)) return 'prophet';
      if (SHAYTAN_INDICATORS.has(text) || SHAYTAN_INDICATORS.has(root)) return 'shaytan';
      if (ANGEL_INDICATORS.has(text) || ANGEL_INDICATORS.has(root)) return 'angel';
      if (HYPOCRITE_INDICATORS.has(text) || HYPOCRITE_INDICATORS.has(root)) return 'hypocrite';
      if (BELIEVER_INDICATORS.has(root)) return 'believer';
      if (DISBELIEVER_INDICATORS.has(root)) return 'disbeliever';
      if (MANKIND_INDICATORS.has(text) || MANKIND_INDICATORS.has(root)) return 'mankind';
      return w.root || w.text; // return the root/text as a generic target
    }
  }

  return undefined;
}

/**
 * Extract all action edges from a tokenized verse.
 * Populates enriched fields using root translations and root index.
 */
export function extractActions(
  verse: TokenizedVerse,
  rootTranslations: Map<string, string>,
  rootIndex: RootIndex
): ActionEdge[] {
  const edges: ActionEdge[] = [];
  const verbs = verse.words.filter((w) => w.pos === 'verb');

  for (const verb of verbs) {
    const root = verb.root || verb.text;
    edges.push({
      id: `action:${verse.verse.id}:${verb.id}`,
      actorType: classifyActor(verb, verse.words),
      actionRoot: root,
      targetType: classifyTarget(verb, verse.words),
      tense: classifyTense(verb),
      verseId: verse.verse.id,
      verbText: verb.text,
      englishMeaning: rootTranslations.get(root) ?? '',
      rootFrequency: rootIndex[root]?.count ?? 0,
      semanticCluster: ACTION_FAMILY_MAP[root],
      canonicalAction: CANONICAL_ACTION_MAP[root],
      polarity: ACTION_POLARITY_MAP[root] ?? 'neutral',
    });
  }

  return edges;
}

/**
 * Extract all action edges from multiple verses.
 */
export function buildActionIndex(
  verses: TokenizedVerse[],
  rootTranslations: Map<string, string>,
  rootIndex: RootIndex
): ActionEdge[] {
  return verses.flatMap((v) => extractActions(v, rootTranslations, rootIndex));
}

/**
 * Auto-link verses that share similar action patterns.
 * Two verses are linked if they have verbs with the same root
 * performed by the same actor type.
 */
export function autoLinkByAction(
  verses: TokenizedVerse[],
  actionEdges: ActionEdge[]
): VerseLink[] {
  const links: VerseLink[] = [];
  const seen = new Set<string>();

  // Group actions by (actorType, actionRoot) pattern
  const patternMap = new Map<string, string[]>();

  for (const edge of actionEdges) {
    const pattern = `${edge.actorType}:${edge.actionRoot}`;
    if (!patternMap.has(pattern)) {
      patternMap.set(pattern, []);
    }
    const verseList = patternMap.get(pattern)!;
    if (!verseList.includes(edge.verseId)) {
      verseList.push(edge.verseId);
    }
  }

  // Link verses sharing the same action pattern (capped)
  const MAX_ACTION_LINKS = 5000;
  for (const [_, verseIds] of patternMap) {
    if (verseIds.length < 2 || verseIds.length > 200) continue; // skip very common patterns

    for (let i = 0; i < verseIds.length && links.length < MAX_ACTION_LINKS; i++) {
      for (let j = i + 1; j < verseIds.length && links.length < MAX_ACTION_LINKS; j++) {
        const key = `${verseIds[i]}:${verseIds[j]}`;
        if (seen.has(key)) continue;
        seen.add(key);

        links.push({
          verseA: verseIds[i],
          verseB: verseIds[j],
          similarityScore: 0.6,
          linkType: 'action',
        });
      }
    }
  }

  return links;
}

/**
 * Compute behavioral summary for a set of action edges.
 * Works at any aggregation level (verse, concept, or global).
 */
export function computeActionSummary(actions: ActionEdge[]): ActionSummary | null {
  if (actions.length === 0) return null;

  const actorCounts = new Map<ActorType, number>();
  const rootCounts = new Map<string, number>();
  const clusterCounts = new Map<ActionFamily, number>();
  const tenseDistribution: Record<Tense, number> = { past: 0, present: 0, future: 0, imperative: 0 };
  const polarityCounts = { positive: 0, negative: 0, neutral: 0 };

  for (const a of actions) {
    actorCounts.set(a.actorType, (actorCounts.get(a.actorType) ?? 0) + 1);
    rootCounts.set(a.actionRoot, (rootCounts.get(a.actionRoot) ?? 0) + 1);
    const cluster = a.semanticCluster ?? ACTION_FAMILY_MAP[a.actionRoot];
    if (cluster) {
      clusterCounts.set(cluster, (clusterCounts.get(cluster) ?? 0) + 1);
    }
    tenseDistribution[a.tense]++;
    polarityCounts[a.polarity]++;
  }

  // Find dominants
  let dominantActor: ActorType = 'human';
  let dominantActorCount = 0;
  for (const [actor, count] of actorCounts) {
    if (count > dominantActorCount) { dominantActor = actor; dominantActorCount = count; }
  }

  let mostFrequentRoot = '';
  let mostFrequentRootCount = 0;
  for (const [root, count] of rootCounts) {
    if (count > mostFrequentRootCount) { mostFrequentRoot = root; mostFrequentRootCount = count; }
  }

  // Get English meaning for the most frequent root
  const mostFrequentRootMeaning = actions.find((a) => a.actionRoot === mostFrequentRoot)?.englishMeaning ?? '';

  let dominantCluster: ActionFamily | undefined;
  let dominantClusterCount = 0;
  for (const [cluster, count] of clusterCounts) {
    if (count > dominantClusterCount) { dominantCluster = cluster; dominantClusterCount = count; }
  }

  const dominantPolarity: ActionPolarity =
    polarityCounts.positive >= polarityCounts.negative && polarityCounts.positive >= polarityCounts.neutral
      ? 'positive'
      : polarityCounts.negative >= polarityCounts.neutral
        ? 'negative'
        : 'neutral';

  // Derive top-level actor ontology from dominant actor type
  const dominantActorOntology: ActorOntology = ACTOR_ONTOLOGY_MAP[dominantActor] ?? 'human';

  // Derive temporal mode from tense distribution
  const totalTense = tenseDistribution.past + tenseDistribution.present
    + tenseDistribution.future + tenseDistribution.imperative;
  let temporalMode = 'Mixed';
  if (totalTense > 0) {
    const imperativePct = tenseDistribution.imperative / totalTense;
    const futurePct = tenseDistribution.future / totalTense;
    if (imperativePct > 0.30) temporalMode = 'Command dominant';
    else if (futurePct > 0.15) temporalMode = 'Eschatological';
    else if (tenseDistribution.present > tenseDistribution.past) temporalMode = 'Present dominant';
    else if (tenseDistribution.past > tenseDistribution.present) temporalMode = 'Past dominant';
  }

  return {
    dominantActor,
    dominantActorOntology,
    dominantActorCount,
    mostFrequentRoot,
    mostFrequentRootMeaning,
    mostFrequentRootCount,
    dominantCluster,
    dominantClusterCount,
    tenseDistribution,
    temporalMode,
    polaritySummary: polarityCounts,
    dominantPolarity,
    totalActions: actions.length,
  };
}

/**
 * Get action pattern summary for a verse.
 * Useful for UI display.
 */
export function getActionSummary(
  verseId: string,
  actionEdges: ActionEdge[]
): Array<{ actor: ActorType; action: string; target?: string; tense: Tense }> {
  return actionEdges
    .filter((e) => e.verseId === verseId)
    .map((e) => ({
      actor: e.actorType,
      action: e.actionRoot,
      target: typeof e.targetType === 'string' ? e.targetType : e.targetType,
      tense: e.tense,
    }));
}
