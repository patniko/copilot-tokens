import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface HooksIndicatorProps {
  panelIds?: string[];
}

const HOOK_FRIENDLY_NAMES: Record<string, string> = {
  onSessionStart: 'Session Start',
  onUserPromptSubmitted: 'Prompt Check',
  onPreToolUse: 'Pre-Tool',
  onPostToolUse: 'Post-Tool',
  onErrorOccurred: 'Error Handler',
  onSessionEnd: 'Session End',
};

export default function HooksIndicator({ panelIds }: HooksIndicatorProps) {
  const [activeHooks, setActiveHooks] = useState<Set<string>>(new Set());
  const [totalInvocations, setTotalInvocations] = useState(0);
  const [flash, setFlash] = useState<{ hookType: string; success: boolean } | null>(null);

  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;

    const handleEvent = (event: unknown) => {
      const ev = event as Record<string, unknown> | null;
      if (!ev || typeof ev !== 'object') return;
      const type = ev.type as string | undefined;
      if (!type) return;

      if (type === 'hook.start') {
        const hookType = ev.hookType as string;
        setActiveHooks(prev => new Set(prev).add(hookType));
        setTotalInvocations(prev => prev + 1);
      } else if (type === 'hook.end') {
        const hookType = ev.hookType as string;
        const success = ev.success as boolean;
        setActiveHooks(prev => {
          const next = new Set(prev);
          next.delete(hookType);
          return next;
        });
        setFlash({ hookType, success });
        setTimeout(() => setFlash(null), 600);
      }
    };

    const ids = panelIds && panelIds.length > 0 ? panelIds : ['main'];
    const unsubs = ids.map(id => window.copilotAPI.onEvent(handleEvent, id));
    return () => unsubs.forEach(u => u());
  }, [panelIds?.join(',')]);

  const activeHook = Array.from(activeHooks)[0] ?? null;
  const friendlyName = activeHook ? (HOOK_FRIENDLY_NAMES[activeHook] ?? activeHook) : null;

  return (
    <div className="glass-card px-3 py-2 flex flex-col gap-1.5">
      <div className="text-[9px] uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-1">
        Hook Pipeline
      </div>
      <div className="flex items-center gap-2 min-h-[20px]">
        <AnimatePresence mode="wait">
          {activeHook ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              className="flex items-center gap-1.5 text-xs"
            >
              <motion.span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-purple)' }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <span style={{ color: 'var(--accent-purple)' }}>
                🪝 {friendlyName}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
            >
              <span>🪝 Hooks</span>
              <span className="text-[9px] opacity-70">{totalInvocations}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {flash && (
            <motion.span
              key={`flash-${flash.hookType}`}
              initial={{ opacity: 1, scale: 1.2 }}
              animate={{ opacity: 0, scale: 0.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="ml-auto text-[9px]"
              style={{ color: flash.success ? 'var(--accent-green)' : 'var(--accent-red)' }}
            >
              {flash.success ? '✓' : '✗'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
