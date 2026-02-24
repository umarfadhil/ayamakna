// =============================================================================
// Layer C — Visualization Engine Types
// =============================================================================

import type { LinkType, SemanticMode } from '../semantic/types';

export interface GraphNode {
  id: string; // verseId
  label: string;
  labelAr?: string;
  surahId: number;
  ayahNumber: number;
  weight: number; // 0-1, drives glow intensity
  cluster?: string; // root or concept cluster ID

  // Enhanced search & root mode features
  searchTokens?: string[];       // lowercased: translation words, concept names, root keywords, Indonesian
  heatScore?: number;            // 0-1 root density score (legacy, kept for compat)
  centralityScore?: number;      // 0-1 composite importance (legacy)
  sharedRootsCount?: number;     // sum of sharedRootsCount across all root edges touching this node
  rootVerseFrequency?: number;   // verse frequency of dominant root (for frequency-based coloring in root mode)
  semanticCluster?: string;      // concept-based cluster ID (for radial layout in root mode)

  // D3 simulation positions
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  linkType: LinkType;
  strength: number; // 0-1
  sharedRootsCount?: number; // number of shared semantic roots (root links only, for edge thickness)
  hopCount?: number;         // 1=direct root share, 2=multi-hop via concept neighbor
}

export interface GraphRenderData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphConfig {
  mode: SemanticMode;
  maxNodes: number;
  edgeThreshold: number; // min similarity score to show edge
  enableAnimation: boolean;
  useWebGL: boolean;
}

export const LINK_COLORS: Record<LinkType, string> = {
  root: '#c4a35a',      // gold
  concept: '#5a9ec4',   // blue
  contrast: '#c45a5a',  // red
  action: '#5ac47a',    // green
};

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  mode: 'root',
  maxNodes: 1000,
  edgeThreshold: 0.3,
  enableAnimation: true,
  useWebGL: false,
};
