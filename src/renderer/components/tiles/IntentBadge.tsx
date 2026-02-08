import { AnimatePresence, motion } from 'motion/react';

interface IntentBadgeProps {
  intent: string | null;
}

export default function IntentBadge({ intent }: IntentBadgeProps) {
  return (
    <AnimatePresence mode="wait">
      {intent && (
        <motion.div
          key={intent}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full self-start"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(59,130,246,0.12))',
            border: '1px solid rgba(168,85,247,0.25)',
          }}
        >
          <motion.span
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-sm"
          >
            🧠
          </motion.span>
          <span className="text-xs font-medium" style={{ color: 'var(--accent-purple)' }}>
            {intent}
          </span>
          <motion.span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--accent-purple)' }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
