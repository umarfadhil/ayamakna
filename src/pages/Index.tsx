import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Compass, BookOpen, Trash2 } from 'lucide-react';
import ForceGraph from '@/components/graph/ForceGraph';
import ParticleBackground from '@/components/graph/ParticleBackground';
import AdminPanel from '@/components/admin/AdminPanel';
import ReadingMode from '@/components/reader/ReadingMode';
import { GraphData, TopicNode } from '@/types/graph';
import { loadGraphData, addTopic, deleteTopic } from '@/store/graphStore';

const Index = () => {
  const [data, setData] = useState<GraphData>(() => loadGraphData());
  const [searchQuery, setSearchQuery] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TopicNode | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);
  const [mode, setMode] = useState<'explorer' | 'reading'>('explorer');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleNodeClick = useCallback((node: TopicNode) => {
    if (node.depth === 0) return;
    setSelectedNode(prev => prev?.id === node.id ? null : node);
    if (mode === 'reading') {
      setReadingOpen(true);
    }
  }, [mode]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setReadingOpen(false);
    setAdminOpen(false);
  }, []);

  const handleAddTopic = useCallback((topic: Parameters<typeof addTopic>[1] extends GraphData ? never : any) => {
    setData(prev => addTopic(prev, topic));
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNode || selectedNode.depth === 0) return;
    setData(prev => deleteTopic(prev, selectedNode.id));
    setSelectedNode(null);
    setReadingOpen(false);
  }, [selectedNode]);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      <ParticleBackground />

      <AnimatePresence>
        {loaded && (
          <>
            {/* Force Graph */}
            <ForceGraph
              data={data}
              searchQuery={searchQuery}
              onNodeClick={handleNodeClick}
              onBackgroundClick={handleBackgroundClick}
              selectedNodeId={selectedNode?.id || null}
            />

            {/* Top Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="fixed top-0 left-0 right-0 p-4 flex items-center gap-3"
              style={{ zIndex: 30 }}
            >
              {/* Logo */}
              <div className="flex items-center gap-3 mr-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center gold-glow">
                  <span className="text-primary font-arabic text-sm font-bold">ق</span>
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground leading-none">AyaMakna</h1>
                  <p className="text-[10px] text-muted-foreground">Knowledge Graph Explorer</p>
                </div>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search topics, verses, keywords..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full glass-panel pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>

              {/* Mode Toggle */}
              <div className="glass-panel flex p-1 gap-1">
                <button
                  onClick={() => setMode('explorer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'explorer' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Explorer
                </button>
                <button
                  onClick={() => setMode('reading')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'reading' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Reading
                </button>
              </div>

              {/* Add Button */}
              <button
                onClick={() => setAdminOpen(true)}
                className="glass-panel p-2.5 rounded-xl hover:bg-primary/10 transition-all group"
              >
                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </motion.div>

            {/* Bottom Info Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="fixed bottom-4 left-4 right-4 flex items-center justify-between"
              style={{ zIndex: 30 }}
            >
              <div className="glass-panel px-4 py-2 text-xs text-muted-foreground">
                <span className="text-primary font-semibold">{data.nodes.length - 1}</span> topics ·{' '}
                <span className="text-primary font-semibold">{data.links.length}</span> connections
              </div>

              {selectedNode && selectedNode.depth > 0 && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="glass-panel px-4 py-2 flex items-center gap-3"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{selectedNode.label}</div>
                    {selectedNode.verse && (
                      <div className="text-xs text-muted-foreground font-mono">
                        QS {selectedNode.verse.surahName}:{selectedNode.verse.ayah}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setReadingOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    title="Read details"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors"
                    title="Delete topic"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </motion.div>
              )}

              <div className="glass-panel px-4 py-2 text-xs text-muted-foreground">
                Scroll to zoom · Drag to pan · Click to select · Dbl-click to center
              </div>
            </motion.div>

            {/* Admin Panel */}
            <AdminPanel
              isOpen={adminOpen}
              onClose={() => setAdminOpen(false)}
              onAddTopic={handleAddTopic}
              data={data}
            />

            {/* Reading Mode */}
            <ReadingMode
              isOpen={readingOpen}
              onClose={() => setReadingOpen(false)}
              node={selectedNode}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
