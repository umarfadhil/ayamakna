import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphRenderData } from '@/engine/visualization/types';
import type { LinkType, SemanticMode } from '@/engine/semantic/types';
import { LINK_COLORS } from '@/engine/visualization/types';
import { getRootTranslation } from '@/store/semanticStore';

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
}

interface SemanticGraphProps {
  data: GraphRenderData;
  searchQuery: string;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
  selectedNodeId: string | null;
  mode: SemanticMode;
  highlightedVerseIds?: Set<string> | null; // when set (root filter active), only these nodes are prominent
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

/** Heatmap color: low density = cool teal, high density = warm gold */
function getHeatColor(heat: number): string {
  const h = Math.round(200 - heat * 157); // 200 (teal) → 43 (gold)
  const s = Math.round(45 + heat * 35);
  const l = Math.round(35 + heat * 25);
  return `hsla(${h}, ${s}%, ${l}%, 1)`;
}

const SemanticGraph: React.FC<SemanticGraphProps> = ({
  data,
  searchQuery,
  onNodeClick,
  onBackgroundClick,
  selectedNodeId,
  mode,
  highlightedVerseIds,
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

  const getNodeRadius = useCallback((node: D3Node) => {
    // Root mode: size by centrality importance; other modes: size by link density
    if (mode === 'root' && node.centralityScore != null) {
      return 5 + node.centralityScore * 20;
    }
    return 6 + node.weight * 14;
  }, [mode]);

  const isHighlighted = useCallback((node: D3Node) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      node.label.toLowerCase().includes(q) ||
      (node.labelAr?.includes(searchQuery) ?? false) ||
      node.id.includes(q) ||
      (node.searchTokens?.some((t) => t.includes(q)) ?? false)
    );
  }, [searchQuery]);

  // Init simulation
  useEffect(() => {
    const nodes: D3Node[] = data.nodes.map((n) => ({ ...n }));
    const edges: D3Edge[] = data.edges.map((e) => ({ ...e }));

    nodesRef.current = nodes;
    edgesRef.current = edges;

    const sim = d3.forceSimulation<D3Node>(nodes)
      .force(
        'link',
        d3.forceLink<D3Node, D3Edge>(edges)
          .id((d) => d.id)
          .distance(100)
          .strength((d) => d.strength * 0.3)
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

    simRef.current = sim;

    return () => { sim.stop(); };
  }, [data, getNodeRadius]);

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
        const color = LINK_COLORS[edge.linkType] ?? '#555';
        const alpha = dimmed ? 0.03 : 0.12 + edge.strength * 0.25;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 0.5 + edge.strength * 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // --- Draw nodes ---
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;

        const r = getNodeRadius(node);
        const isHov = hoveredRef.current === node.id;
        const isSel = selectedNodeId === node.id;

        // Determine if dimmed (root filter takes priority over search)
        const rootFilterActive = highlightedVerseIds && highlightedVerseIds.size > 0;
        const rootFaded = rootFilterActive && !highlightedVerseIds!.has(node.id);
        const searchFaded = searchQuery ? !isHighlighted(node) : false;
        const dimmed = rootFaded || searchFaded;

        const drawR = r * (isHov ? 1.25 : 1);

        // Color: root mode + no filter → heatmap; otherwise cluster color
        const useHeat = mode === 'root' && !rootFilterActive && node.heatScore != null;
        const clusterColor = useHeat
          ? getHeatColor(node.heatScore!)
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
  }, [data, searchQuery, selectedNodeId, getNodeRadius, isHighlighted, mode, highlightedVerseIds]);

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
        const currentK = transformRef.current.k;
        const newTransform = d3.zoomIdentity
          .translate(-node.x * currentK, -node.y * currentK)
          .scale(currentK);
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
                {hovered.cluster}
              </div>
            )
          )}
          {mode === 'root' && hovered.heatScore != null && (
            <div className="text-muted-foreground text-[10px] mt-0.5">
              Density: {Math.round(hovered.heatScore * 100)}%
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default React.memo(SemanticGraph);
