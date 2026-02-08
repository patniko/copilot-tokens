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
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-xs italic px-3 py-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          🧠 {intent}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
