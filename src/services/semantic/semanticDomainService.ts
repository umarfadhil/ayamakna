// =============================================================================
// Service B — Semantic AI Layer (Explainable, Traceable, Optional)
// =============================================================================
// Generates explainable semantic domains derived ONLY from roots
// returned by Service A.
//
// Allowed processing:
//   1. root → concept mapping       (ayamakna_root_concepts)
//   2. concept → graph neighbors    (ayamakna_concept_graph_edges, depth=1 ONLY)
//   3. embedding similarity         (not implemented — marked as future-ready)
//
// Forbidden:
//   ✗ Direct verse-to-concept joins
//   ✗ Surah-level aggregation
//   ✗ Global corpus ranking without root origin
//   ✗ Any domain without a complete trace
//   ✗ Graph traversal depth > 1
//
// Layer 2 answers: "What can be inferred from those roots?"
// =============================================================================

// --- Types ---

export interface RootConceptEntry {
  root: string;
  conceptId: string;
  /** Aggregated root→concept association strength [0,1] */
  weight: number;
  /** Number of verses where this root co-occurs with the concept */
  verseCount: number;
}

export interface ConceptGraphEdge {
  conceptA: string;
  conceptB: string;
  /** Normalised co-occurrence strength [0,1] */
  strength: number;
  sharedVerseCount: number;
}

export interface DomainTrace {
  /** Arabic root in the verse that triggered this inference */
  from_root: string;
  /** Concept directly associated with from_root */
  via_concept: string;
  /** Strength of the root→concept association */
  relation_strength: number;
}

/**
 * A semantic domain inferred from a verse's roots via 1-hop concept expansion.
 * EVERY domain MUST have a complete trace. No trace = rejected.
 */
export interface SemanticDomain {
  /** Human-readable concept/domain name */
  domain: string;
  /** Overall inference confidence = relation_strength × neighbor_strength */
  confidence: number;
  trace: DomainTrace;
}

// --- Internal state ---

/** root → list of (concept, weight) pairs */
let _rootConceptsMap: Map<string, RootConceptEntry[]> = new Map();
/** conceptId → list of (neighborConceptId, strength) pairs */
let _conceptNeighbors: Map<string, Array<{ conceptId: string; strength: number }>> = new Map();
/** conceptId → human-readable name */
let _conceptNames: Map<string, string> = new Map();

// --- Initialisation ---

/**
 * Load root→concept associations from ayamakna_root_concepts.
 * Called once during app init by semanticStore.
 */
export function setRootConcepts(entries: RootConceptEntry[]): void {
  _rootConceptsMap = new Map();
  for (const e of entries) {
    const existing = _rootConceptsMap.get(e.root);
    if (existing) {
      existing.push(e);
    } else {
      _rootConceptsMap.set(e.root, [e]);
    }
  }
}

/**
 * Load concept co-occurrence graph from ayamakna_concept_graph_edges.
 * Edges are undirected: both directions are stored.
 * Called once during app init by semanticStore.
 */
export function setConceptGraphEdges(edges: ConceptGraphEdge[]): void {
  _conceptNeighbors = new Map();
  for (const e of edges) {
    // Direction A → B
    const neighborsA = _conceptNeighbors.get(e.conceptA) ?? [];
    neighborsA.push({ conceptId: e.conceptB, strength: e.strength });
    _conceptNeighbors.set(e.conceptA, neighborsA);

    // Direction B → A
    const neighborsB = _conceptNeighbors.get(e.conceptB) ?? [];
    neighborsB.push({ conceptId: e.conceptA, strength: e.strength });
    _conceptNeighbors.set(e.conceptB, neighborsB);
  }
}

/**
 * Register concept names for human-readable domain labels.
 */
export function setConceptNames(concepts: Array<{ id: string; name: string }>): void {
  _conceptNames = new Map(concepts.map((c) => [c.id, c.name]));
}

export function isServiceReady(): boolean {
  return _rootConceptsMap.size > 0 && _conceptNeighbors.size > 0;
}

// --- Validation helpers ---

/**
 * Validates a trace object is complete and its from_root is in the
 * provided linguistic root list.
 *
 * VALIDATION RULES:
 *   1. from_root must be in linguisticRoots
 *   2. via_concept must be non-empty
 *   3. relation_strength must be > 0
 */
function isTraceValid(trace: DomainTrace, linguisticRoots: ReadonlySet<string>): boolean {
  if (!linguisticRoots.has(trace.from_root)) return false;  // Rule 1
  if (!trace.via_concept) return false;                      // Rule 2
  if (!(trace.relation_strength > 0)) return false;          // Rule 3
  return true;
}

// --- Public API (Service B contract) ---

/**
 * Returns semantic domains inferred from the verse's linguistic roots.
 *
 * Chain: root (Service A) → direct concept (root_concepts) → neighbor concept (graph, depth=1)
 * Each returned domain has a COMPLETE, VALIDATED trace.
 *
 * If a domain's trace is incomplete or its from_root is not in linguisticRoots → REJECTED.
 * If graph depth > 1 would be required → NOT REACHED (depth is inherently 1 here).
 *
 * Returns top-N domains sorted by confidence descending.
 *
 * @param linguisticRoots — roots from Service A (ground truth)
 * @param limit — max domains to return (default 5)
 */
export function getVerseSemanticDomains(
  linguisticRoots: string[],
  limit: number = 5
): SemanticDomain[] {
  if (!isServiceReady() || linguisticRoots.length === 0) return [];

  const rootSet = new Set(linguisticRoots);

  // domain name → best SemanticDomain (keep highest confidence per unique domain)
  const domainsMap = new Map<string, SemanticDomain>();

  for (const root of linguisticRoots) {
    // HARD CHECK: root must come from Service A's list
    if (!rootSet.has(root)) continue;

    const directConcepts = _rootConceptsMap.get(root) ?? [];

    for (const rc of directConcepts) {
      // Depth-1 expansion: look at concept's neighbors in the graph
      const neighbors = _conceptNeighbors.get(rc.conceptId) ?? [];

      for (const neighbor of neighbors) {
        const domainName = _conceptNames.get(neighbor.conceptId) ?? neighbor.conceptId;
        const confidence = rc.weight * neighbor.strength;

        const trace: DomainTrace = {
          from_root: root,
          via_concept: rc.conceptId,
          relation_strength: rc.weight,
        };

        // VALIDATION: reject if trace incomplete or root not in verse
        if (!isTraceValid(trace, rootSet)) continue;
        // VALIDATION: reject domains with negligible confidence
        if (confidence < 0.001) continue;

        const existing = domainsMap.get(domainName);
        if (!existing || confidence > existing.confidence) {
          domainsMap.set(domainName, { domain: domainName, confidence, trace });
        }
      }
    }
  }

  return [...domainsMap.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Unit-test-style validation: checks that all domains in the result set
 * have valid traces with from_root present in the provided root list.
 * Returns list of violations (empty = all valid).
 */
export function validateDomains(
  domains: SemanticDomain[],
  linguisticRoots: string[]
): string[] {
  const rootSet = new Set(linguisticRoots);
  const violations: string[] = [];

  for (const d of domains) {
    if (!d.trace) {
      violations.push(`Domain "${d.domain}": missing trace`);
      continue;
    }
    if (!rootSet.has(d.trace.from_root)) {
      violations.push(`Domain "${d.domain}": from_root "${d.trace.from_root}" not in verse roots`);
    }
    if (!d.trace.via_concept) {
      violations.push(`Domain "${d.domain}": trace.via_concept is empty`);
    }
    if (!(d.trace.relation_strength > 0)) {
      violations.push(`Domain "${d.domain}": trace.relation_strength must be > 0`);
    }
  }

  return violations;
}
