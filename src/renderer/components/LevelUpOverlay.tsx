import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getLevelTier } from '../lib/level-system';

interface LevelUpOverlayProps {
  level: number | null;
  onComplete: () => void;
}

export default function LevelUpOverlay({ level, onComplete }: LevelUpOverlayProps) {
  useEffect(() => {
    if (level === null) return;
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [level, onComplete]);

  if (level === null) return null;
  const tier = getLevelTier(level);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onComplete}
      >
        <motion.div
          className="flex flex-col items-center gap-4 p-8"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        >
          <motion.div
            className="text-7xl"
            animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {tier.emoji}
          </motion.div>

          <motion.h1
            className="text-4xl font-black tracking-widest text-[var(--accent-gold)] led-text"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            LEVEL {level}!
          </motion.h1>

          <motion.p
            className="text-lg text-[var(--accent-purple)] uppercase tracking-wider font-bold"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {tier.name}
          </motion.p>

          <motion.p
            className="text-xs text-[var(--text-secondary)] mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Click anywhere to continue
          </motion.p>

          {/* Decorative particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-xl pointer-events-none"
              initial={{
                x: 0,
                y: 0,
                opacity: 1,
                scale: 1,
              }}
              animate={{
                x: Math.cos((i / 12) * Math.PI * 2) * 200,
                y: Math.sin((i / 12) * Math.PI * 2) * 200,
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
            >
              {['⭐', '✨', '🎉', '🪙', '💎', '🔥'][i % 6]}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
