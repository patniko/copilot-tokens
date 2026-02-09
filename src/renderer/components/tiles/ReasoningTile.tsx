import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { renderInline } from '../../lib/render-inline';

interface ReasoningTileProps {
  content: string;
  isStreaming: boolean;
  reasoningId: string;
}

export default function ReasoningTile({ content, isStreaming, reasoningId }: ReasoningTileProps) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLPreElement>(null);

  // Auto-scroll when streaming and expanded
  useEffect(() => {
    if (isStreaming && expanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming, expanded]);

  const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-purple)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full cursor-pointer"
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        {isStreaming && (
          <span style={{ animation: 'pulse-brain 1.5s ease-in-out infinite' }}>🧠</span>
        )}
        {!isStreaming && <span>🧠</span>}
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--accent-purple)' }}
        >
          {isStreaming ? 'Thinking…' : 'Thought process'}
        </span>
        <span
          className="ml-auto text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Collapsed preview */}
      {!expanded && content && (
        <div
          className="text-xs font-mono mt-2 truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {renderInline(preview)}
        </div>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.pre
            ref={contentRef}
            key={reasoningId}
            className="text-xs font-mono rounded-lg p-3 mt-2 overflow-auto whitespace-pre-wrap break-words"
            style={{
              backgroundColor: 'rgba(0,0,0,0.25)',
              color: 'var(--text-secondary)',
              maxHeight: '300px',
            }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {content}
            {isStreaming && (
              <span style={{ color: 'var(--accent-purple)', animation: 'pulse-brain 1.5s ease-in-out infinite' }}>
                {' ▍'}
              </span>
            )}
          </motion.pre>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse-brain {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
