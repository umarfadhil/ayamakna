import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitBranch, Layers, Swords, Scale, Info, RotateCcw } from 'lucide-react';
import type { SemanticMode } from '@/engine/semantic/types';
import type { RootFocusLevel, ConceptFocusLevel, ActionFocusLevel, ContrastFocusLevel } from '@/store/semanticStore';

const MODE_ICONS: Record<SemanticMode, React.FC<{ className?: string }>> = {
  root: GitBranch,
  concept: Layers,
  action: Swords,
  contrast: Scale,
  similarity: Scale,
};

const MODE_COLORS: Record<SemanticMode, string> = {
  root: 'text-yellow-400',
  concept: 'text-blue-400',
  action: 'text-green-400',
  contrast: 'text-red-400',
  similarity: 'text-purple-400',
};

const FOCUS_COLOR: Record<SemanticMode, { active: string }> = {
  root: { active: 'bg-primary/20 text-primary border border-primary/30' },
  concept: { active: 'bg-blue-400/20 text-blue-300 border border-blue-400/30' },
  action: { active: 'bg-green-400/20 text-green-300 border border-green-400/30' },
  contrast: { active: 'bg-red-400/20 text-red-300 border border-red-400/30' },
  similarity: { active: 'bg-purple-400/20 text-purple-300 border border-purple-400/30' },
};

type FocusLevel = RootFocusLevel | ConceptFocusLevel | ActionFocusLevel | ContrastFocusLevel;

interface MobileControlsFabProps {
  semanticMode: SemanticMode;
  onModeChange: (mode: SemanticMode) => void;
  showIsolated: boolean;
  onToggleIsolated: () => void;
  focusLevel: FocusLevel;
  onFocusLevelChange: (level: FocusLevel) => void;
  onAboutOpen: () => void;
  onResetView: () => void;
  visitorCount?: number | null;
}

const MODES: Array<{ mode: SemanticMode; label: string }> = [
  { mode: 'root', label: 'Root' },
  { mode: 'concept', label: 'Concept' },
  { mode: 'action', label: 'Action' },
  { mode: 'contrast', label: 'Contrast' },
];

const FOCUS_LEVELS: FocusLevel[] = ['broad', 'focused', 'deep'];

const MobileControlsFab: React.FC<MobileControlsFabProps> = ({
  semanticMode,
  onModeChange,
  showIsolated,
  onToggleIsolated,
  focusLevel,
  onFocusLevelChange,
  onAboutOpen,
  onResetView,
  visitorCount,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 md:hidden flex flex-col items-end" style={{ zIndex: 40 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            transition={{ duration: 0.2 }}
            className="glass-panel p-3 rounded-2xl mb-3 flex flex-col gap-3 min-w-[180px]"
          >
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { onAboutOpen(); setOpen(false); }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <Info className="w-4 h-4 text-primary" />
                About AyaMakna
              </button>
              <button
                onClick={() => { onResetView(); setOpen(false); }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-primary" />
                Default View
              </button>
            </div>

            {/* Mode selector */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Mode</span>
              <div className="flex gap-1">
                {MODES.map(({ mode, label }) => {
                  const Icon = MODE_ICONS[mode];
                  const isActive = semanticMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => onModeChange(mode)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-all ${
                        isActive
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? MODE_COLORS[mode] : ''}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Isolated toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Isolated</span>
              <button
                onClick={onToggleIsolated}
                className={`relative inline-flex w-10 h-5 items-center rounded-full transition-colors ${
                  showIsolated ? 'bg-primary/40' : 'bg-secondary'
                }`}
              >
                <span
                  className={`inline-block w-4 h-4 rounded-full bg-foreground transition-transform ${
                    showIsolated ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>

            {/* Focus level */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Depth</span>
              <div className="flex gap-1">
                {FOCUS_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => onFocusLevelChange(level)}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium capitalize transition-all ${
                      focusLevel === level
                        ? FOCUS_COLOR[semanticMode].active
                        : 'text-muted-foreground hover:bg-secondary/50'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full glass-panel border border-border flex items-center justify-center shadow-lg transition-transform active:scale-95"
      >
        {open ? (
          <X className="w-5 h-5 text-foreground" />
        ) : (
          <div className="flex flex-col items-center leading-none">
            <Info className="w-4 h-4 text-foreground" />
            <span className="mt-0.5 text-[10px] font-semibold text-foreground/80">
              {visitorCount != null ? visitorCount.toLocaleString() : '—'}
            </span>
          </div>
        )}
      </button>
    </div>
  );
};

export default MobileControlsFab;
