import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Search as SearchIcon, ChevronDown } from 'lucide-react';
import { SURAH_LIST } from '@/data/quranData';
import { TopicNode, GraphData } from '@/types/graph';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTopic: (topic: {
    label: string;
    labelId: string;
    labelEn: string;
    verse?: { surah: number; ayah: number; surahName: string; surahNameAr: string };
    explanation?: string;
    explanationId?: string;
    explanationEn?: string;
    parentId: string;
    depth: number;
  }) => void;
  data: GraphData;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, onAddTopic, data }) => {
  const [labelId, setLabelId] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [surahNum, setSurahNum] = useState<number | null>(null);
  const [ayahNum, setAyahNum] = useState<number | null>(null);
  const [explanationId, setExplanationId] = useState('');
  const [explanationEn, setExplanationEn] = useState('');
  const [parentId, setParentId] = useState('center');
  const [surahSearch, setSurahSearch] = useState('');
  const [showSurahDropdown, setShowSurahDropdown] = useState(false);

  const selectedSurah = useMemo(() => 
    SURAH_LIST.find(s => s.number === surahNum), [surahNum]
  );

  const filteredSurahs = useMemo(() => {
    if (!surahSearch) return SURAH_LIST;
    const q = surahSearch.toLowerCase();
    return SURAH_LIST.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.nameAr.includes(q) ||
      s.number.toString().includes(q)
    );
  }, [surahSearch]);

  const parentOptions = useMemo(() => 
    data.nodes.filter(n => n.depth < 3), [data.nodes]
  );

  const parentNode = useMemo(() =>
    data.nodes.find(n => n.id === parentId), [data.nodes, parentId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelId.trim() && !labelEn.trim()) return;

    const label = labelEn.trim() || labelId.trim();
    const verse = surahNum && ayahNum && selectedSurah
      ? { surah: surahNum, ayah: ayahNum, surahName: selectedSurah.name, surahNameAr: selectedSurah.nameAr }
      : undefined;

    onAddTopic({
      label,
      labelId: labelId.trim() || label,
      labelEn: labelEn.trim() || label,
      verse,
      explanation: explanationEn.trim() || undefined,
      explanationId: explanationId.trim() || undefined,
      explanationEn: explanationEn.trim() || undefined,
      parentId,
      depth: (parentNode?.depth ?? 0) + 1,
    });

    // Reset
    setLabelId('');
    setLabelEn('');
    setSurahNum(null);
    setAyahNum(null);
    setExplanationId('');
    setExplanationEn('');
    setParentId('center');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-full max-w-md glass-panel-strong overflow-y-auto"
          style={{ zIndex: 50 }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-primary gold-text-glow">
                Add Topic
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Topic names */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Topic Name</label>
                <input
                  type="text"
                  placeholder="Indonesian (e.g., Ketakwaan)"
                  value={labelId}
                  onChange={e => setLabelId(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
                <input
                  type="text"
                  placeholder="English (e.g., God-consciousness)"
                  value={labelEn}
                  onChange={e => setLabelEn(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>

              {/* Surah selector */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verse Reference</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSurahDropdown(!showSurahDropdown)}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  >
                    <span className={selectedSurah ? 'text-foreground' : 'text-muted-foreground/50'}>
                      {selectedSurah
                        ? `${selectedSurah.number}. ${selectedSurah.name} (${selectedSurah.nameAr})`
                        : 'Select Surah...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>

                  <AnimatePresence>
                    {showSurahDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 right-0 mt-1 glass-panel-strong max-h-60 overflow-y-auto"
                        style={{ zIndex: 60 }}
                      >
                        <div className="p-2 sticky top-0 bg-card/90 backdrop-blur-xl">
                          <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Search surah..."
                              value={surahSearch}
                              onChange={e => setSurahSearch(e.target.value)}
                              className="w-full bg-secondary/50 border border-border rounded-md pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                              autoFocus
                            />
                          </div>
                        </div>
                        {filteredSurahs.map(s => (
                          <button
                            key={s.number}
                            type="button"
                            onClick={() => {
                              setSurahNum(s.number);
                              setShowSurahDropdown(false);
                              setSurahSearch('');
                            }}
                            className="w-full px-3 py-2 text-xs text-left hover:bg-secondary/60 transition-colors flex items-center gap-2"
                          >
                            <span className="text-primary/70 font-mono w-8">{s.number}</span>
                            <span className="text-foreground">{s.name}</span>
                            <span className="text-muted-foreground font-arabic ml-auto">{s.nameAr}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {selectedSurah && (
                  <input
                    type="number"
                    placeholder={`Ayah (1-${selectedSurah.totalAyah})`}
                    min={1}
                    max={selectedSurah.totalAyah}
                    value={ayahNum || ''}
                    onChange={e => setAyahNum(parseInt(e.target.value) || null)}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  />
                )}
              </div>

              {/* Parent selector */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parent Topic</label>
                <select
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                >
                  {parentOptions.map(n => (
                    <option key={n.id} value={n.id}>
                      {'—'.repeat(n.depth)} {n.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Explanation */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Explanation (Optional)</label>
                <textarea
                  placeholder="Indonesian explanation..."
                  value={explanationId}
                  onChange={e => setExplanationId(e.target.value)}
                  rows={2}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                />
                <textarea
                  placeholder="English explanation..."
                  value={explanationEn}
                  onChange={e => setExplanationEn(e.target.value)}
                  rows={2}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:bg-primary/90 transition-all gold-glow"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add to Knowledge Graph
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdminPanel;
