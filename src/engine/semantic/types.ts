// =============================================================================
// Layer B — Semantic Engine Types
// =============================================================================

export interface ConceptDomain {
  id: string;
  name: string;
  nameId?: string;
  description: string;
  colorHue: number;   // HSL hue 0-360
  displayOrder: number;
}

export interface Concept {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
  domainId?: string;     // FK → ConceptDomain.id
  domainOrder?: number;  // 1-based rank within domain (drives intra-domain color lightness)
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
  sharedRootsCount?: number;    // number of semantically-mapped shared roots (root links only)
  semanticCluster?: string;     // primary concept cluster for the link (root links only)
  hopCount?: number;            // 1=direct root share, 2=via concept neighbor (multi-layer projection)
  sharedConceptsCount?: number; // number of shared concepts (concept links only)
  domainId?: string;            // domain of the primary shared concept (concept links only)
  sharedActionsCount?: number;  // number of shared action roots (action links only)
  pairId?: string;              // contrast pair ID "rootA:rootB" (contrast links only)
  contrastCategory?: string;    // contrast category e.g. "light", "faith" (contrast links only)
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

import type { ActionFamily, ActionPolarity, ActorOntology } from './actionDictionaries';

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
  semanticCluster?: ActionFamily;  // Action family (was SemanticCluster)
  canonicalAction?: string;     // Normalized English verb form (e.g. "Pray", "Create")
  polarity: ActionPolarity;
}

export interface ActionSummary {
  dominantActor: ActorType;
  dominantActorOntology: ActorOntology;  // top-level ontology group
  dominantActorCount: number;
  mostFrequentRoot: string;
  mostFrequentRootMeaning: string;
  mostFrequentRootCount: number;
  dominantCluster?: ActionFamily;  // Action family (was SemanticCluster)
  dominantClusterCount: number;
  tenseDistribution: Record<Tense, number>;
  temporalMode: string;  // 'Past dominant' | 'Present dominant' | 'Command dominant' | 'Eschatological' | 'Mixed'
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
