import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSound } from '../hooks/useSound';

interface PromptBarProps {
  onSend?: (prompt: string) => void;
  onGeneratingChange?: (generating: boolean) => void;
}

const LINE_HEIGHT = 24;
const MAX_LINES = 6;

export default function PromptBar({ onSend, onGeneratingChange }: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { play } = useSound();

  const setGenerating = useCallback(
    (value: boolean) => {
      setIsGenerating(value);
      onGeneratingChange?.(value);
    },
    [onGeneratingChange],
  );

  // Listen for session.idle to stop generating
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const cleanup = window.copilotAPI.onEvent((event: unknown) => {
      if (event && typeof event === 'object' && 'type' in event && (event as { type: string }).type === 'session.idle') {
        setGenerating(false);
      }
    });
    return cleanup;
  }, [setGenerating]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxHeight = LINE_HEIGHT * MAX_LINES;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [prompt]);

  const handleSend = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;
    play('leverPull');
    window.copilotAPI?.sendMessage(trimmed);
    setGenerating(true);
    onSend?.(trimmed);
    setPrompt('');
  }, [prompt, isGenerating, play, setGenerating, onSend]);

  const handleAbort = useCallback(() => {
    window.copilotAPI?.abort();
    setGenerating(false);
  }, [setGenerating]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = prompt.trim().length > 0;

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompt…"
          rows={1}
          className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none rounded-lg border border-[var(--border-color)] px-4 py-3 focus:border-[var(--accent-purple)] focus:shadow-[0_0_8px_var(--accent-purple)] transition-shadow"
          style={{ lineHeight: `${LINE_HEIGHT}px` }}
        />

        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.button
              key="stop"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={handleAbort}
              className="px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg text-sm whitespace-nowrap cursor-pointer"
            >
              ⏹ STOP
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={handleSend}
              disabled={!canSend}
              whileHover={
                canSend
                  ? {
                      boxShadow: [
                        '0 0 4px var(--accent-gold)',
                        '0 0 16px var(--accent-gold)',
                        '0 0 4px var(--accent-gold)',
                      ],
                      transition: { duration: 1.2, repeat: Infinity },
                    }
                  : undefined
              }
              whileTap={canSend ? { y: 4 } : undefined}
              className="px-4 py-2.5 bg-[var(--accent-gold)] text-black font-bold rounded-lg text-sm whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ willChange: 'transform' }}
            >
              🎰 PULL
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
