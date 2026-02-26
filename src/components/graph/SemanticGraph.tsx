import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphRenderData } from '@/engine/visualization/types';
import type { LinkType, SemanticMode } from '@/engine/semantic/types';
import { LINK_COLORS } from '@/engine/visualization/types';
import { getRootTranslation } from '@/store/semanticStore';
import { ACTION_FAMILY_LABELS } from '@/engine/semantic/actionDictionaries';
import type { ActionFamily } from '@/engine/semantic/actionDictionaries';
import { CONTRAST_PAIR_ORDER, CONTRAST_DICTIONARY } from '@/engine/semantic/contrastEngine';

interface D3Node extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Edge {
  source: D3Node | string;
  target: D3Node | string;
  linkType: LinkType;
  strength: number;
  sharedRootsCount?: number;
  hopCount?: number;
  sharedConceptsCount?: number;
  sharedActionsCount?: number;
  sameDomain?: boolean;
}

interface SemanticGraphProps {
  data: GraphRenderData;
  searchQuery: string;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
  selectedNodeId: string | null;
  mode: SemanticMode;
  highlightedVerseIds?: Set<string> | null; // when set (root filter active), only these nodes are prominent
  isolatedNodes?: GraphNode[]; // verses with no edges in current mode
}

// --- Spatial Index for fast hit testing ---
class SpatialGrid {
  private cellSize: number;
  private grid = new Map<string, D3Node[]>();

  constructor(cellSize: number = 80) {
    this.cellSize = cellSize;
  }

  clear() { this.grid.clear(); }

  insert(node: D3Node) {
    if (node.x == null || node.y == null) return;
    const key = this.key(node.x, node.y);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key)!.push(node);
  }

  query(x: number, y: number, radius: number): D3Node[] {
    const results: D3Node[] = [];
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const nodes = this.grid.get(`${cx}:${cy}`);
        if (nodes) results.push(...nodes);
      }
    }
    return results;
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
  }
}

// --- Cluster Colors ---
const CLUSTER_COLORS: Record<string, string> = {
  divine: 'hsla(43, 80%, 55%, 1)',
  human: 'hsla(210, 50%, 55%, 1)',
  believer: 'hsla(140, 55%, 45%, 1)',
  disbeliever: 'hsla(0, 55%, 50%, 1)',
  angel: 'hsla(270, 50%, 60%, 1)',
  prophet: 'hsla(50, 75%, 55%, 1)',
  hypocrite: 'hsla(30, 55%, 40%, 1)',
  shaytan: 'hsla(350, 65%, 40%, 1)',
  mankind: 'hsla(190, 45%, 50%, 1)',
  contrast: 'hsla(340, 60%, 55%, 1)',
  neutral: 'hsla(240, 15%, 25%, 1)',
  tawhid: 'hsla(43, 80%, 55%, 1)',
  taqwa: 'hsla(150, 55%, 45%, 1)',
  sabr: 'hsla(200, 50%, 50%, 1)',
  tawakkul: 'hsla(170, 50%, 50%, 1)',
  dhikr: 'hsla(280, 45%, 55%, 1)',
  salah: 'hsla(120, 50%, 45%, 1)',
  ilm: 'hsla(220, 55%, 55%, 1)',
  rahmah: 'hsla(30, 65%, 55%, 1)',
  hidayah: 'hsla(100, 50%, 50%, 1)',
  ihsan: 'hsla(50, 65%, 50%, 1)',
  iman: 'hsla(90, 55%, 45%, 1)',
  kufr: 'hsla(0, 60%, 45%, 1)',
  nur_zulm: 'hsla(55, 70%, 55%, 1)',
  hayat_mawt: 'hsla(300, 40%, 50%, 1)',
  qadr: 'hsla(260, 50%, 55%, 1)',
  akhlaq: 'hsla(160, 50%, 50%, 1)',
  maghfirah: 'hsla(35, 60%, 55%, 1)',
  amr_nahi: 'hsla(180, 50%, 45%, 1)',
  similarity: 'hsla(210, 45%, 50%, 1)',
  unknown: 'hsla(240, 15%, 25%, 1)',
};

function getClusterColor(cluster?: string): string {
  return CLUSTER_COLORS[cluster ?? 'unknown'] ?? CLUSTER_COLORS.unknown;
}

/**
 * Root mode: frequency-based node color aligned with VerseDetail badge logic.
 * grey = high-frequency (common roots), gold/amber = medium, brown = rare.
 */
function getRootFrequencyColor(verseFreq?: number): string {
  if (verseFreq == null) return CLUSTER_COLORS.unknown;
  if (verseFreq >= 500) return 'hsla(240, 10%, 50%, 1)';  // grey — very common root
  if (verseFreq >= 150) return 'hsla(43, 55%, 62%, 1)';   // light gold
  if (verseFreq >= 40)  return 'hsla(35, 70%, 50%, 1)';   // gold/amber
  return 'hsla(22, 65%, 42%, 1)';                          // brown/orange — rare root
}

/**
 * Concept mode: domain-based node color.
 * Same domain shares the hue family; domainOrder drives lightness gradient
 * so different concepts within a domain are visually distinguishable.
 * domainOrder=1 → darkest (most central), higher order → progressively lighter.
 */
function getDomainConceptColor(colorHue?: number, domainOrder?: number): string {
  if (colorHue == null) return CLUSTER_COLORS.unknown;
  const order = domainOrder ?? 1;
  const lightness = Math.min(35 + (order - 1) * 8, 67); // 35% → 67%
  const saturation = Math.max(75 - (order - 1) * 8, 42); // 75% → 42%
  return `hsla(${colorHue}, ${saturation}%, ${lightness}%, 1)`;
}

/**
 * Action mode: action-family-based node color.
 * All nodes in the same family share the same hue; sharedActionsCount drives
 * saturation/lightness gradations within the family (more behaviorally central = more vivid).
 */
function getActionFamilyNodeColor(actionFamilyHue?: number, sharedActionsCount?: number): string {
  if (actionFamilyHue == null) return CLUSTER_COLORS.unknown;
  const activity = Math.min((sharedActionsCount ?? 0) / 25, 1); // 0→1
  const saturation = Math.round(50 + activity * 28); // 50% → 78%
  const lightness = Math.round(42 - activity * 10);  // 42% → 32%
  return `hsla(${actionFamilyHue}, ${saturation}%, ${lightness}%, 1)`;
}

/**
 * Contrast mode: pair-side-based node color.
 * hue comes from CONTRAST_PAIR_HUES (hueA or hueB per side).
 * contrastRootFreq drives saturation/lightness — higher corpus frequency → more vivid.
 */
function getContrastNodeColor(hue?: number, rootFreq?: number): string {
  if (hue == null) return CLUSTER_COLORS.neutral;
  const freq = rootFreq ?? 0;
  const activity = Math.min(freq / 300, 1); // 0→1
  const saturation = Math.round(55 + activity * 25); // 55% → 80%
  const lightness = Math.round(45 - activity * 8);   // 45% → 37%
  return `hsla(${hue}, ${saturation}%, ${lightness}%, 1)`;
}

const SemanticGraph: React.FC<SemanticGraphProps> = ({
  data,
  searchQuery,
  onNodeClick,
  onBackgroundClick,
  selectedNodeId,
  mode,
  highlightedVerseIds,
  isolatedNodes = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);
  const nodesRef = useRef<D3Node[]>([]);
  const edgesRef = useRef<D3Edge[]>([]);
  const transformRef = useRef(d3.zoomIdentity);
  const hoveredRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<D3Node | null>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const spatialRef = useRef(new SpatialGrid());
  // Search edges: temporary dashed edges connecting matched isolated nodes to nearest matched nodes
  const searchEdgesRef = useRef<Array<{source: D3Node; target: D3Node}>>([]);
  const searchEdgeAlphaRef = useRef(0);       // current rendered opacity (0→0.55, animated)

  const getNodeRadius = useCallback((node: D3Node) => {
    // Root mode: size by total shared roots with visible neighbors
    if (mode === 'root') {
      if (node.sharedRootsCount != null && node.sharedRootsCount > 0) {
        return 4 + Math.min(node.sharedRootsCount / 40, 1) * 20;
      }
      return 4;
    }
    // Concept mode: size by structural importance (total shared concepts across edges)
    if (mode === 'concept') {
      if (node.sharedConceptsCount != null && node.sharedConceptsCount > 0) {
        return 4 + Math.min(node.sharedConceptsCount / 30, 1) * 18;
      }
      return 4;
    }
    // Action mode: behavioral centrality (total shared actions = behavioral reach)
    if (mode === 'action') {
      if (node.sharedActionsCount != null && node.sharedActionsCount > 0) {
        return 4 + Math.min(node.sharedActionsCount / 25, 1) * 18;
      }
      return 4;
    }
    // Contrast mode: structural strength (corpus root frequency × edge density)
    if (mode === 'contrast') {
      const freq = node.contrastRootFreq ?? 0;
      return 4 + Math.min(freq / 300, 1) * 16;
    }
    return 6 + node.weight * 14;
  }, [mode]);

  const isHighlighted = useCallback((node: D3Node) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    // Multi-word AND logic: every word in the query must match at least one token
    // Filter out non-alphanumeric tokens (e.g. "&") so "Worship & Devotion" works correctly
    const words = q.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    return words.every((word) => (
      node.label.toLowerCase().includes(word) ||
      (node.labelAr?.toLowerCase().includes(word) ?? false) ||
      node.id.toLowerCase().includes(word) ||
      (node.searchTokens?.some((t) => t.includes(word)) ?? false)
    ));
  }, [searchQuery]);

  // Deferred search-edge computation: runs off the draw loop so connected highlights appear first.
  // When searchQuery changes, edges are cleared immediately; new edges computed after 80ms.
  // D3Node references auto-update with simulation positions, so no 60-frame drift refresh needed.
  useEffect(() => {
    searchEdgesRef.current = [];
    searchEdgeAlphaRef.current = 0;
    if (!searchQuery || !isolatedNodes.length) return;
    const isoIds = new Set(isolatedNodes.map((n) => n.id));
    const tid = setTimeout(() => {
      const allNodes = nodesRef.current;
      const matchedIso = allNodes.filter((n) => isoIds.has(n.id) && isHighlighted(n) && n.x != null);
      const matchedAll = allNodes.filter((n) => isHighlighted(n) && n.x != null);
      const newEdges: Array<{source: D3Node; target: D3Node}> = [];
      const addedPairs = new Set<string>();
      for (const iso of matchedIso) {
        const sorted = matchedAll
          .filter((n) => n.id !== iso.id)
          .map((n) => ({ n, d: Math.hypot((n.x ?? 0) - (iso.x ?? 0), (n.y ?? 0) - (iso.y ?? 0)) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 5);
        for (const { n } of sorted) {
          const k = iso.id < n.id ? `${iso.id}|${n.id}` : `${n.id}|${iso.id}`;
          if (!addedPairs.has(k)) { addedPairs.add(k); newEdges.push({ source: iso, target: n }); }
        }
      }
      searchEdgesRef.current = newEdges;
    }, 80);
    return () => clearTimeout(tid);
  }, [searchQuery, isolatedNodes, isHighlighted]);

  // Init simulation
  useEffect(() => {
    const connectedIds = new Set(data.nodes.map((n) => n.id));
    const isolatedIdSet = new Set(isolatedNodes.map((n) => n.id));
    const nodes: D3Node[] = [
      ...data.nodes.map((n) => ({ ...n })),
      ...isolatedNodes.filter((n) => !connectedIds.has(n.id)).map((n) => ({ ...n })),
    ];
    const edges: D3Edge[] = data.edges.map((e) => ({ ...e }));

    nodesRef.current = nodes;
    edgesRef.current = edges;

    // --- Radial cluster positions (root mode + concept mode + action mode + contrast mode) ---
    // Groups nodes by semanticCluster and arranges each cluster at an angular position.
    const RADIAL_RADIUS = 320;
    let clusterAngleMap: Map<string, number> | null = null;
    if (mode === 'root' || mode === 'concept' || mode === 'action') {
      const clusters = [...new Set(
        nodes
          .filter((n) => !isolatedIdSet.has(n.id) && n.semanticCluster)
          .map((n) => n.semanticCluster!)
      )];
      clusterAngleMap = new Map(
        clusters.map((c, i) => [c, (i / Math.max(clusters.length, 1)) * 2 * Math.PI])
      );
    }
    // Contrast mode: bipartite radial layout — A-side on left hemisphere, B-side on right.
    // Each pair index maps to the same vertical position on each side, so opposing verses
    // are diametrically across the graph (maximum visual separation).
    if (mode === 'contrast') {
      clusterAngleMap = new Map();
      const N = CONTRAST_PAIR_ORDER.length; // 17
      for (const node of nodes) {
        if (!node.semanticCluster) continue;
        const cluster = node.semanticCluster; // format: "pairId:A" or "pairId:B"
        if (clusterAngleMap.has(cluster)) continue;
        const lastColon = cluster.lastIndexOf(':');
        if (lastColon === -1) continue;
        const side = cluster.slice(lastColon + 1);
        const pairId = cluster.slice(0, lastColon);
        const idx = CONTRAST_PAIR_ORDER.indexOf(pairId);
        if (idx === -1) continue;
        const t = idx / Math.max(N - 1, 1); // 0 → 1
        // A-side: left hemisphere π/2 → 3π/2 (top-left to bottom-left)
        // B-side: -π/2 → π/2 (top-right to bottom-right, i.e. diametrically opposite)
        const angle = side === 'A'
          ? Math.PI / 2 + t * Math.PI
          : -Math.PI / 2 + t * Math.PI;
        clusterAngleMap.set(cluster, angle);
      }
    }

    const sim = d3.forceSimulation<D3Node>(nodes)
      .force(
        'link',
        d3.forceLink<D3Node, D3Edge>(edges)
          .id((d) => d.id)
          // Edge distance = similarity-based: high similarity → shorter spring → closer nodes.
          .distance((d) => {
            if (mode === 'root') {
              const sim = d.strength;
              return sim > 0 ? Math.max(35, 120 * (1 - sim * 0.85)) : 130;
            }
            if (mode === 'concept') {
              // Semantic gravity: strong concept overlap → pulled close
              return Math.max(40, 220 * (1 - d.strength * 0.85));
            }
            if (mode === 'action') {
              // Behavioral gravity: strong action overlap → pulled close
              return Math.max(40, 220 * (1 - d.strength * 0.85));
            }
            if (mode === 'contrast') {
              // Tense opposition: high contrast strength → moderate spring that stretches across poles
              return Math.max(180, 400 * (1 - d.strength * 0.5));
            }
            return 100;
          })
          .strength((d) => {
            if (mode === 'root') return Math.max(0.15, d.strength * 0.55);
            if (mode === 'concept') return Math.max(0.12, d.strength * 0.45);
            if (mode === 'action') return Math.max(0.12, d.strength * 0.45);
            if (mode === 'contrast') return Math.max(0.08, d.strength * 0.30);
            return d.strength * 0.3;
          })
      )
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(400))
      .force('center', d3.forceCenter(0, 0).strength(0.03))
      .force('collision', d3.forceCollide<D3Node>().radius((d) => getNodeRadius(d) + 4))
      .alphaDecay(0.015)
      .velocityDecay(0.4)
      .on('tick', () => {
        const grid = spatialRef.current;
        grid.clear();
        for (const node of nodesRef.current) {
          grid.insert(node);
        }
      });

    // Root + Concept + Action + Contrast mode: add gentle radial cluster force (Hybrid Force-Directed + Radial)
    // Root mode: pulls by concept cluster. Concept mode: by domain. Action: by action family.
    // Contrast mode: bipartite pull — A-side to left hemisphere, B-side to right hemisphere.
    if ((mode === 'root' || mode === 'concept' || mode === 'action' || mode === 'contrast') && clusterAngleMap) {
      const _clusterAngleMap = clusterAngleMap; // closure capture
      // Contrast mode uses stronger radial force to maintain pole separation despite cross-edges
      const radialStrength = mode === 'contrast' ? 0.060 : mode === 'concept' ? 0.045 : mode === 'action' ? 0.040 : 0.035;
      sim.force('radialCluster', function(alpha: number) {
        for (const node of nodesRef.current) {
          if (isolatedIdSet.has(node.id) || !node.semanticCluster) continue;
          const angle = _clusterAngleMap.get(node.semanticCluster);
          if (angle == null) continue;
          const targetX = Math.cos(angle) * RADIAL_RADIUS;
          const targetY = Math.sin(angle) * RADIAL_RADIUS;
          if (node.vx != null) node.vx += (targetX - (node.x ?? 0)) * radialStrength * alpha;
          if (node.vy != null) node.vy += (targetY - (node.y ?? 0)) * radialStrength * alpha;
        }
      });
    }

    simRef.current = sim;

    return () => { sim.stop(); };
  }, [data, isolatedNodes, getNodeRadius, mode]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const isolatedIdSet = new Set(isolatedNodes.map((n) => n.id));

    const draw = () => {
      timeRef.current += 0.016;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      const t = transformRef.current;
      ctx.translate(t.x + w / 2, t.y + h / 2);
      ctx.scale(t.k, t.k);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const time = timeRef.current;

      // --- Search edge alpha (computation is deferred in a separate useEffect) ---
      // Connected node highlights apply immediately via isHighlighted(); isolated search edges
      // fade in ~80ms later once the deferred useEffect populates searchEdgesRef.
      const hasSearchEdges = !!(searchQuery && isolatedNodes.length > 0);
      const seTargetAlpha = hasSearchEdges ? 0.55 : 0;
      searchEdgeAlphaRef.current += (seTargetAlpha - searchEdgeAlphaRef.current) * 0.07;
      if (!hasSearchEdges) searchEdgesRef.current = [];

      // --- Draw edges ---
      for (const edge of edges) {
        const source = edge.source as D3Node;
        const target = edge.target as D3Node;
        if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

        const srcId = source.id;
        const tgtId = target.id;

        // Root filter: dim edges not connecting highlighted verses
        const rootFilterActive = highlightedVerseIds && highlightedVerseIds.size > 0;
        const rootDimmed = rootFilterActive && (!highlightedVerseIds!.has(srcId) || !highlightedVerseIds!.has(tgtId));

        const srcHl = isHighlighted(source);
        const tgtHl = isHighlighted(target);
        const searchDimmed = searchQuery ? (!srcHl || !tgtHl) : false;

        const dimmed = rootDimmed || searchDimmed;
        const isMultiHop = edge.hopCount === 2;

        // Hop=2 multi-hop edges are permanently hidden — too noisy vs. their weak semantic signal
        if (isMultiHop) continue;

        // Multi-hop (hop=2): dashed, muted gold, dim, thin — visually subordinate to direct links
        if (isMultiHop) {
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = 'hsla(43, 30%, 58%, 1)'; // muted gold
          ctx.globalAlpha = dimmed ? 0.02 : 0.10 + edge.strength * 0.16;
          ctx.lineWidth = 0.5 + edge.strength * 0.6;
        } else {
          ctx.setLineDash([]);
          const color = LINK_COLORS[edge.linkType] ?? '#555';
          // Root mode: power curve gives ~42-point perceptual range (0.24 → 0.75).
          // Weak edges fade naturally; strong edges are clearly prominent.
          const alpha = dimmed ? 0.03
            : mode === 'root' ? 0.15 + Math.pow(edge.strength, 0.7) * 0.60
            : mode === 'concept' ? 0.12 + edge.strength * 0.45
            : mode === 'contrast' ? 0.08 + edge.strength * 0.30
            : 0.12 + edge.strength * 0.25;
          // Edge thickness: root → sharedRootsCount; concept → strength (confidence); others → strength
          const lineW = mode === 'root' && edge.sharedRootsCount != null
            ? 0.5 + Math.min(edge.sharedRootsCount, 12) * 0.35
            : mode === 'concept'
            ? 0.5 + edge.strength * 3.0
            : mode === 'action' && edge.sharedActionsCount != null
            ? 0.5 + Math.min(edge.sharedActionsCount, 8) * 0.40
            : 0.5 + edge.strength * 1.5;
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = lineW;
        }

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (isMultiHop) ctx.setLineDash([]);
      }

      // --- Draw search edges (dashed, animated fade-in, cyan tint) ---
      const seAlpha = searchEdgeAlphaRef.current;
      const seEdges = searchEdgesRef.current;
      if (seAlpha > 0.01 && seEdges.length > 0) {
        ctx.setLineDash([5, 6]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'hsla(195, 75%, 65%, 1)';
        // Gentle unified breathing pulse on top of the fade-in
        const sePulse = 0.75 + Math.sin(time * 2) * 0.15;
        for (const se of seEdges) {
          if (se.source.x == null || se.source.y == null || se.target.x == null || se.target.y == null) continue;
          ctx.beginPath();
          ctx.moveTo(se.source.x, se.source.y);
          ctx.lineTo(se.target.x, se.target.y);
          ctx.globalAlpha = seAlpha * sePulse;
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      // Set of node IDs that are endpoints of search edges (used to enhance their rendering below)
      const seNodeIds = seEdges.length > 0
        ? new Set<string>(seEdges.flatMap(e => [e.source.id, e.target.id]))
        : new Set<string>();

      // --- Draw nodes ---
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;

        const isIsolated = isolatedIdSet.has(node.id);
        const hasSearchEdge = seNodeIds.has(node.id);
        // Isolated nodes with a search edge are rendered slightly larger so the edge endpoint is visible
        const r = isIsolated ? (hasSearchEdge ? 4.5 : 3) : getNodeRadius(node);
        const isHov = hoveredRef.current === node.id;
        const isSel = selectedNodeId === node.id;

        // Isolated nodes: render as tiny dim dots (cyan tint + larger when connected via search edge)
        if (isIsolated) {
          const searchFaded = searchQuery ? !isHighlighted(node) : false;
          if (searchFaded && !isHov && !isSel) continue;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isHov || isSel ? 5 : r, 0, Math.PI * 2);
          ctx.fillStyle = isSel
            ? 'hsla(240, 30%, 65%, 0.9)'
            : isHov
            ? 'hsla(240, 25%, 55%, 0.7)'
            : hasSearchEdge
            ? `hsla(195, 55%, 52%, ${0.35 + seAlpha * 0.35})`  // cyan tint, opacity tied to edge fade-in
            : 'hsla(240, 20%, 35%, 0.3)';
          ctx.fill();
          ctx.strokeStyle = isSel
            ? 'hsla(240, 50%, 80%, 0.6)'
            : hasSearchEdge
            ? `hsla(195, 65%, 70%, ${0.3 + seAlpha * 0.4})`
            : 'hsla(240, 15%, 45%, 0.2)';
          ctx.lineWidth = hasSearchEdge ? 0.8 : 0.5;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }

        // Determine if dimmed (root filter takes priority over search)
        const rootFilterActive = highlightedVerseIds && highlightedVerseIds.size > 0;
        const rootFaded = rootFilterActive && !highlightedVerseIds!.has(node.id);
        const searchFaded = searchQuery ? !isHighlighted(node) : false;
        const dimmed = rootFaded || searchFaded;

        const drawR = r * (isHov ? 1.25 : 1);

        // Color: root → frequency; concept → domain hue+order; action → family hue+centrality; contrast → pair side hue
        const clusterColor = mode === 'root'
          ? getRootFrequencyColor(node.rootVerseFrequency)
          : mode === 'concept'
          ? getDomainConceptColor(node.domainColorHue, node.domainOrder)
          : mode === 'action'
          ? getActionFamilyNodeColor(node.actionFamilyHue, node.sharedActionsCount)
          : mode === 'contrast'
          ? getContrastNodeColor(node.contrastHue, node.contrastRootFreq)
          : getClusterColor(node.cluster);

        // Glow
        if (!dimmed) {
          const glowR = drawR * (isSel ? 3 : 2);
          const grad = ctx.createRadialGradient(node.x, node.y, drawR * 0.3, node.x, node.y, glowR);
          if (isSel) {
            const p = Math.sin(time * 3) * 0.1 + 0.3;
            grad.addColorStop(0, clusterColor.replace('1)', `${p})`));
            grad.addColorStop(1, clusterColor.replace('1)', '0)'));
          } else {
            const intensity = 0.05 + (node.centralityScore ?? node.weight) * 0.15;
            grad.addColorStop(0, clusterColor.replace('1)', `${isHov ? intensity * 2 : intensity})`));
            grad.addColorStop(1, clusterColor.replace('1)', '0)'));
          }
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);
        if (dimmed) {
          ctx.fillStyle = 'hsla(240, 15%, 15%, 0.2)';
        } else if (isSel) {
          ctx.fillStyle = clusterColor;
        } else if (isHov) {
          ctx.fillStyle = clusterColor.replace('1)', '0.85)');
        } else {
          const alpha = 0.4 + (node.centralityScore ?? node.weight) * 0.5;
          ctx.fillStyle = clusterColor.replace('1)', `${alpha})`);
        }
        ctx.fill();

        // Border
        ctx.strokeStyle = dimmed
          ? 'hsla(240, 10%, 20%, 0.1)'
          : isSel
            ? 'hsla(0, 0%, 100%, 0.8)'
            : clusterColor.replace('1)', '0.4)');
        ctx.lineWidth = isSel ? 2 : 0.8;
        ctx.stroke();

        // Label
        if (!dimmed && (isHov || isSel || (node.centralityScore ?? node.weight) > 0.5)) {
          if (isSel) {
            const lp = Math.sin(time * 2.5) * 0.2 + 0.8;
            ctx.shadowColor = clusterColor.replace('1)', `${lp})`);
            ctx.shadowBlur = 6;
          }
          ctx.fillStyle = isSel
            ? 'hsla(0, 0%, 100%, 0.95)'
            : 'hsla(40, 20%, 90%, 0.85)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `${isSel ? 'bold ' : ''}${isHov || isSel ? 10 : 8}px "Space Grotesk", sans-serif`;
          ctx.fillText(node.label, node.x, node.y + drawR + 12);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [data, isolatedNodes, searchQuery, selectedNodeId, getNodeRadius, isHighlighted, mode, highlightedVerseIds]);

  // Zoom & pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => { transformRef.current = event.transform; });

    const sel = d3.select(canvas);

    sel.on('wheel.customZoom', (event: WheelEvent) => {
      event.preventDefault();
      const currentT = transformRef.current;
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newK = Math.max(0.15, Math.min(6, currentT.k * scaleFactor));
      const mx = event.clientX - w / 2;
      const my = event.clientY - h / 2;
      const newX = mx - (mx - currentT.x) * (newK / currentT.k);
      const newY = my - (my - currentT.y) * (newK / currentT.k);
      transformRef.current = d3.zoomIdentity.translate(newX, newY).scale(newK);
      sel.call(zoom.transform, transformRef.current);
    }, { passive: false });

    sel.call(zoom).on('wheel.zoom', null);
    sel.call(zoom.transform, d3.zoomIdentity.scale(1));
    zoomRef.current = zoom;

    return () => {
      sel.on('.zoom', null);
      sel.on('wheel.customZoom', null);
    };
  }, []);

  // Hit testing using spatial index
  const getNodeAt = useCallback((mx: number, my: number): D3Node | null => {
    const t = transformRef.current;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (mx - t.x - w / 2) / t.k;
    const y = (my - t.y - h / 2) / t.k;

    const candidates = spatialRef.current.query(x, y, 30);
    let bestNode: D3Node | null = null;
    let bestDist = Infinity;

    for (const node of candidates) {
      if (node.x == null || node.y == null) continue;
      const r = getNodeRadius(node) * 1.5;
      const dx = node.x - x;
      const dy = node.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < r * r && dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }
    return bestNode;
  }, [getNodeRadius]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMove = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      hoveredRef.current = node?.id ?? null;
      canvas.style.cursor = node ? 'pointer' : 'grab';
      setHovered(node ?? null);
    };

    const onClick = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node) onNodeClick(node);
      else onBackgroundClick();
    };

    const onDblClick = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node?.x != null && node?.y != null && zoomRef.current && canvas) {
        // Zoom to 2.5× centered on the node. Formula: t.x = -node.x * targetK, t.y = -node.y * targetK
        // because the canvas renders with origin at canvas center (ctx offset by w/2, h/2).
        const targetK = 2.5;
        const newTransform = d3.zoomIdentity
          .translate(-node.x * targetK, -node.y * targetK)
          .scale(targetK);
        d3.select(canvas)
          .transition()
          .duration(600)
          .ease(d3.easeCubicInOut)
          .call(zoomRef.current.transform, newTransform);
      }
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDblClick);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }, [getNodeAt, onNodeClick, onBackgroundClick]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0"
        style={{ zIndex: 1, cursor: 'grab' }}
      />
      {hovered && (
        <div
          className="fixed glass-panel px-3 py-2 pointer-events-none text-sm max-w-sm"
          style={{ zIndex: 20, left: '50%', bottom: 80, transform: 'translateX(-50%)' }}
        >
          <div className="font-semibold text-primary">{hovered.label}</div>
          {hovered.labelAr && (
            <div className="text-foreground/80 text-xs font-arabic mt-0.5 leading-relaxed" dir="rtl">
              {hovered.labelAr}
            </div>
          )}
          {mode === 'root' && hovered.cluster && hovered.cluster !== 'unknown' ? (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-arabic text-yellow-400/90 text-[11px]">{hovered.cluster}</span>
              {getRootTranslation(hovered.cluster) && (
                <span className="text-muted-foreground text-[10px]">
                  · {getRootTranslation(hovered.cluster)}
                </span>
              )}
            </div>
          ) : (
            hovered.cluster && hovered.cluster !== 'unknown' && (
              <div className="text-muted-foreground text-[10px] mt-1 uppercase tracking-wider">
                {mode === 'action'
                  ? (ACTION_FAMILY_LABELS[hovered.cluster as ActionFamily] ?? hovered.cluster)
                  : hovered.cluster}
              </div>
            )
          )}
          {mode === 'root' && hovered.rootVerseFrequency != null && (
            <div className="text-muted-foreground text-[10px] mt-0.5">
              Root frequency: {hovered.rootVerseFrequency} verses
              {hovered.sharedRootsCount != null && ` · ${hovered.sharedRootsCount} shared roots`}
            </div>
          )}
          {mode === 'root' && hovered.semanticCluster && (
            <div className="text-muted-foreground text-[10px] mt-0.5 uppercase tracking-wider">
              Cluster: {hovered.semanticCluster}
            </div>
          )}
          {mode === 'contrast' && hovered.contrastPairId && (() => {
            const pair = CONTRAST_DICTIONARY.find((p) => `${p.rootA}:${p.rootB}` === hovered.contrastPairId);
            const sideLabel = hovered.contrastSide === 'A'
              ? (pair?.labelA ?? 'A')
              : (pair?.labelB ?? 'B');
            return (
              <div className="mt-1">
                <div className="text-[10px] font-semibold" style={{ color: hovered.contrastHue != null ? `hsla(${hovered.contrastHue}, 75%, 65%, 1)` : undefined }}>
                  {sideLabel} · {pair?.category ?? hovered.contrastPairId}
                </div>
                {hovered.contrastRootFreq != null && (
                  <div className="text-muted-foreground text-[10px]">
                    Root in {hovered.contrastRootFreq} verses
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
};

export default React.memo(SemanticGraph);
