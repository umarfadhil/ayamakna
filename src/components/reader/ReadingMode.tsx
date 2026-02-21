import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { TopicNode } from '@/types/graph';

interface ReadingModeProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopicNode | null;
}

const ReadingMode: React.FC<ReadingModeProps> = ({ isOpen, onClose, node }) => {
  if (!node || node.depth === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 40 }}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="glass-panel-strong w-full max-w-lg relative"
          >
            <div className="p-8">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{node.label}</h2>
                  <p className="text-sm text-muted-foreground">
                    {node.labelId} · {node.labelEn}
                  </p>
                </div>
              </div>

              {node.verse && (
                <div className="mb-6 p-4 rounded-lg bg-secondary/40 border border-border/30">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Verse Reference</div>
                  <div className="text-primary font-semibold font-arabic text-lg">
                    {node.verse.surahNameAr}
                  </div>
                  <div className="text-sm text-foreground mt-1">
                    QS {node.verse.surahName} : {node.verse.ayah}
                  </div>
                </div>
              )}

              {(node.explanationId || node.explanationEn) && (
                <div className="space-y-4">
                  {node.explanationId && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">🇮🇩 Penjelasan</div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{node.explanationId}</p>
                    </div>
                  )}
                  {node.explanationEn && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">🇬🇧 Explanation</div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{node.explanationEn}</p>
                    </div>
                  )}
                </div>
              )}

              {node.tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {node.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReadingMode;
