// =============================================================================
// Layer B — Semantic Engine Types
// =============================================================================

export interface Concept {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
}

export interface VerseConcept {
  verseId: string;
  conceptId: string;
  weight: number; // 0-1 relevance score
}

export type LinkType = 'root' | 'concept' | 'contrast' | 'action';

export interface VerseLink {
  verseA: string;
  verseB: string;
  similarityScore: number; // 0-1
  linkType: LinkType;
  sharedRootsCount?: number; // number of semantically-mapped shared roots (root links only)
  semanticCluster?: string;  // primary concept cluster for the link (root links only)
  hopCount?: number;         // 1=direct root share, 2=via concept neighbor (multi-layer projection)
}

// --- Root Engine Types ---

export interface RootFrequency {
  root: string;
  count: number;
  verseIds: string[];
}

export interface RootIndex {
  [root: string]: RootFrequency;
}

export interface RootDensity {
  verseId: string;
  uniqueRoots: number;
  totalWords: number;
  density: number; // uniqueRoots / totalWords
}

export interface RootCentrality {
  root: string;
  degreeCentrality: number; // 0-1 normalized by N-1
  betweennessCentrality: number; // 0-1 normalized
  frequencyCount: number; // token frequency across corpus
  verseFrequency: number; // number of verses containing root
  frequencyRank: number; // 1 = most frequent
  neighborCount: number; // unique adjacent roots in co-occurrence graph
  importance: number; // composite score for visualization weighting
}

export interface RootCentralitySummary {
  mostConnectedRoot?: RootCentrality;
  bridgeRoot?: RootCentrality;
  mostFrequentRoot?: RootCentrality;
}

export interface RootDensityScore {
  verseId: string;
  uniqueRootCount: number;
  frequencyWeight: number;
  normalizedRootCount: number;
  normalizedFrequencyWeight: number;
  heatScore: number; // 0-1 combined density score
}

export interface RootFormFrequency {
  form: string;
  count: number;
}

export interface RootPOSDistribution {
  noun: number;
  verb: number;
  other: number;
  total: number;
}

export interface RootRevelationDistribution {
  meccan: number;
  medinan: number;
  unknown: number;
  total: number;
}

export interface RootContext {
  root: string;
  forms: RootFormFrequency[];
  posDistribution: RootPOSDistribution;
  revelationDistribution: RootRevelationDistribution;
}

export interface RootAnalytics {
  centralityByRoot: Record<string, RootCentrality>;
  centralitySummary: RootCentralitySummary;
  frequencyRanking: string[];
  densityByVerse: Record<string, RootDensityScore>;
  contextsByRoot: Record<string, RootContext>;
  verseIdsByRoot: Record<string, string[]>;
}

// --- Action Engine Types ---

import type { SemanticCluster, ActionPolarity } from './actionDictionaries';

export type ActorType =
  | 'divine' | 'human' | 'believer' | 'disbeliever'
  | 'angel' | 'nature'
  | 'prophet' | 'hypocrite' | 'shaytan' | 'mankind';

export type Tense = 'past' | 'present' | 'future' | 'imperative';

export interface ActionEdge {
  id: string;
  actorType: ActorType;
  actionRoot: string;
  targetType?: ActorType | string;
  tense: Tense;
  verseId: string;
  verbText: string;             // Actual Arabic verb word from the verse
  englishMeaning: string;       // English translation from root translations
  rootFrequency: number;        // Corpus-wide frequency of the action root
  semanticCluster?: SemanticCluster;
  polarity: ActionPolarity;
}

export interface ActionSummary {
  dominantActor: ActorType;
  dominantActorCount: number;
  mostFrequentRoot: string;
  mostFrequentRootMeaning: string;
  mostFrequentRootCount: number;
  dominantCluster?: SemanticCluster;
  dominantClusterCount: number;
  tenseDistribution: Record<Tense, number>;
  polaritySummary: { positive: number; negative: number; neutral: number };
  dominantPolarity: ActionPolarity;
  totalActions: number;
}

/** Future-ready: compare action patterns across concepts. */
export interface ConceptActionComparison {
  conceptId: string;
  conceptName: string;
  actionSummary: ActionSummary;
  topActions: ActionEdge[];
  topActors: Array<{ actor: ActorType; count: number }>;
  topClusters: Array<{ cluster: SemanticCluster; count: number }>;
}

// --- Contrast Engine Types ---

export interface ContrastPair {
  rootA: string;
  rootB: string;
  labelA: string; // e.g. "iman"
  labelB: string; // e.g. "kufr"
  category: string; // e.g. "faith", "light", "afterlife"
}

export interface ContrastLink {
  verseA: string;
  verseB: string;
  pairId: string; // reference to ContrastPair
  polarity: 'positive' | 'negative';
}

// --- Similarity Engine Types ---

export interface SimilarityWeights {
  rootOverlap: number;
  conceptOverlap: number;
  verbPatternOverlap: number;
}

export interface SimilarityResult {
  verseA: string;
  verseB: string;
  score: number;
  breakdown: {
    rootScore: number;
    conceptScore: number;
    verbScore: number;
  };
}

// --- Precomputed Cache ---

export interface SemanticCache {
  rootIndex: RootIndex;
  verseLinks: VerseLink[];
  contrastLinks: ContrastLink[];
  actionEdges: ActionEdge[];
  similarityLinks: SimilarityResult[];
  rootAnalytics?: RootAnalytics;
  computedAt: number; // timestamp
}

// --- Mode Types ---

export type SemanticMode = 'root' | 'concept' | 'action' | 'contrast' | 'similarity';
