import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { TopicNode, TopicLink, GraphData, D3Node, D3Link } from '@/types/graph';

interface ForceGraphProps {
  data: GraphData;
  searchQuery: string;
  onNodeClick: (node: TopicNode) => void;
  selectedNodeId: string | null;
}

const ForceGraph: React.FC<ForceGraphProps> = ({ data, searchQuery, onNodeClick, selectedNodeId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodesRef = useRef<D3Node[]>([]);
  const linksRef = useRef<D3Link[]>([]);
  const transformRef = useRef(d3.zoomIdentity);
  const hoveredRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<D3Node | null>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  const getNodeRadius = useCallback((node: D3Node) => {
    if (node.depth === 0) return 40;
    if (node.depth === 1) return 18;
    if (node.depth === 2) return 12;
    return 8;
  }, []);

  const isHighlighted = useCallback((node: D3Node) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      node.label.toLowerCase().includes(q) ||
      node.labelId.toLowerCase().includes(q) ||
      node.labelEn.toLowerCase().includes(q) ||
      node.tags.some(t => t.includes(q))
    );
  }, [searchQuery]);

  // Init simulation
  useEffect(() => {
    const nodes: D3Node[] = data.nodes.map(n => ({ ...n }));
    const links: D3Link[] = data.links.map(l => ({ ...l }));

    // Pin center node
    const center = nodes.find(n => n.id === 'center');
    if (center) {
      center.fx = 0;
      center.fy = 0;
    }

    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id(d => d.id)
        .distance(d => {
          if (d.type === 'parent-child') return 120;
          return 180;
        })
        .strength(d => d.strength * 0.5)
      )
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(500))
      .force('center', d3.forceCenter(0, 0).strength(0.05))
      .force('collision', d3.forceCollide<D3Node>().radius(d => getNodeRadius(d) + 10))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simRef.current = sim;

    return () => {
      sim.stop();
    };
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
      ctx.scale(dpr, dpr);
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
      const links = linksRef.current;
      const time = timeRef.current;

      // Draw links
      for (const link of links) {
        const source = link.source as D3Node;
        const target = link.target as D3Node;
        if (!source.x || !source.y || !target.x || !target.y) continue;

        const srcHl = isHighlighted(source);
        const tgtHl = isHighlighted(target);
        const dimmed = searchQuery && (!srcHl || !tgtHl);

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        
        const alpha = dimmed ? 0.05 : (link.type === 'parent-child' ? 0.3 : 0.15);
        if (link.type === 'same-verse') {
          ctx.strokeStyle = `hsla(43, 72%, 52%, ${alpha})`;
        } else if (link.type === 'shared-tag') {
          ctx.strokeStyle = `hsla(43, 40%, 40%, ${alpha})`;
        } else {
          ctx.strokeStyle = `hsla(40, 20%, 50%, ${alpha})`;
        }
        ctx.lineWidth = link.type === 'parent-child' ? 1.5 : 1;
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;

        const r = getNodeRadius(node);
        const hl = isHighlighted(node);
        const dimmed = searchQuery ? !hl : false;
        const isHov = hoveredRef.current === node.id;
        const isSel = selectedNodeId === node.id;
        const isCenter = node.depth === 0;

        const pulse = Math.sin(time * 2 + (isCenter ? 0 : parseInt(node.id, 36) % 10)) * 0.15 + 1;
        const drawR = r * (isHov ? 1.2 : 1) * (isCenter ? pulse : 1);

        // Glow
        if (!dimmed) {
          const glowR = drawR * (isCenter ? 3 : 2);
          const grad = ctx.createRadialGradient(node.x, node.y, drawR * 0.5, node.x, node.y, glowR);
          if (isCenter) {
            grad.addColorStop(0, `hsla(43, 72%, 52%, ${0.3 * pulse})`);
            grad.addColorStop(1, 'hsla(43, 72%, 52%, 0)');
          } else {
            grad.addColorStop(0, `hsla(43, 60%, 45%, ${isHov ? 0.25 : 0.1})`);
            grad.addColorStop(1, 'hsla(43, 60%, 45%, 0)');
          }
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);
        if (isCenter) {
          const ng = ctx.createRadialGradient(node.x - drawR * 0.3, node.y - drawR * 0.3, 0, node.x, node.y, drawR);
          ng.addColorStop(0, 'hsla(43, 80%, 60%, 1)');
          ng.addColorStop(1, 'hsla(43, 72%, 40%, 1)');
          ctx.fillStyle = ng;
        } else {
          ctx.fillStyle = dimmed
            ? 'hsla(240, 15%, 15%, 0.5)'
            : isSel
              ? 'hsla(43, 72%, 52%, 0.9)'
              : isHov
                ? 'hsla(43, 60%, 45%, 0.8)'
                : `hsla(240, 15%, ${12 + node.depth * 3}%, 0.9)`;
        }
        ctx.fill();

        // Border
        ctx.strokeStyle = dimmed
          ? 'hsla(240, 10%, 20%, 0.3)'
          : isCenter
            ? 'hsla(43, 80%, 65%, 0.8)'
            : isSel
              ? 'hsla(43, 72%, 52%, 1)'
              : isHov
                ? 'hsla(43, 60%, 50%, 0.6)'
                : 'hsla(43, 40%, 35%, 0.3)';
        ctx.lineWidth = isCenter ? 2 : 1;
        ctx.stroke();

        // Label
        if (!dimmed && (isCenter || isHov || isSel || node.depth <= 1)) {
          ctx.fillStyle = isCenter
            ? 'hsla(240, 20%, 4%, 1)'
            : isSel
              ? 'hsla(240, 20%, 4%, 1)'
              : 'hsla(40, 20%, 90%, 0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (isCenter) {
            ctx.font = 'bold 14px "Amiri", serif';
            ctx.fillText('Al-Qur\'an', node.x, node.y - 4);
            ctx.font = '9px "Amiri", serif';
            ctx.fillText('القرآن', node.x, node.y + 10);
          } else {
            const fontSize = isHov || isSel ? 11 : 9;
            ctx.font = `500 ${fontSize}px "Space Grotesk", sans-serif`;
            ctx.fillText(node.label, node.x, node.y + drawR + 14);
          }
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
  }, [data, searchQuery, selectedNodeId, getNodeRadius, isHighlighted]);

  // Zoom & pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
      });

    d3.select(canvas).call(zoom);

    // Initial zoom
    const initialTransform = d3.zoomIdentity.scale(1);
    d3.select(canvas).call(zoom.transform, initialTransform);

    return () => {
      d3.select(canvas).on('.zoom', null);
    };
  }, []);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getNodeAt = (mx: number, my: number): D3Node | null => {
      const t = transformRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = (mx - t.x - w / 2) / t.k;
      const y = (my - t.y - h / 2) / t.k;

      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const node = nodesRef.current[i];
        if (node.x == null || node.y == null) continue;
        const r = getNodeRadius(node) * 1.5;
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy < r * r) return node;
      }
      return null;
    };

    const onMove = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      hoveredRef.current = node?.id || null;
      canvas.style.cursor = node ? 'pointer' : 'grab';
      setHovered(node || null);
    };

    const onClick = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node) onNodeClick(node);
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [getNodeRadius, onNodeClick]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0"
        style={{ zIndex: 1, cursor: 'grab' }}
      />
      {/* Tooltip */}
      {hovered && hovered.depth > 0 && (
        <div
          className="fixed glass-panel px-3 py-2 pointer-events-none text-sm max-w-xs"
          style={{
            zIndex: 20,
            left: '50%',
            bottom: 80,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold text-primary">{hovered.label}</div>
          <div className="text-muted-foreground text-xs">
            {hovered.labelId} / {hovered.labelEn}
          </div>
          {hovered.verse && (
            <div className="text-xs text-primary/70 mt-1 font-mono">
              QS {hovered.verse.surahName} : {hovered.verse.ayah}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default React.memo(ForceGraph);
