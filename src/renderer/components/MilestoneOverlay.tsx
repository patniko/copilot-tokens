import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import type { Milestone } from '../lib/milestones';
import { useSound } from '../hooks/useSound';

interface MilestoneOverlayProps {
  milestone: Milestone | null;
  onComplete: () => void;
}

const DURATIONS: Record<Milestone['effect'], number> = {
  sparkle: 2000,
  banner: 2000,
  confetti: 3000,
  jackpot: 5000,
  mega: 5000,
};

export default function MilestoneOverlay({ milestone, onComplete }: MilestoneOverlayProps) {
  const { play } = useSound();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!milestone) return;

    play(milestone.sound);
    fireEffect(milestone.effect);

    cleanup();
    timerRef.current = setTimeout(onComplete, DURATIONS[milestone.effect]);
    return cleanup;
  }, [milestone, play, onComplete, cleanup]);

  return (
    <AnimatePresence>
      {milestone && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {/* Border flicker for jackpot/mega — flickers briefly then fades out */}
          {(milestone.effect === 'jackpot' || milestone.effect === 'mega') && (
            <motion.div
              className="absolute inset-0 border-4 rounded-lg"
              initial={{ borderColor: 'rgba(255,215,0,0)', opacity: 0 }}
              animate={{
                borderColor: [
                  'rgba(255,215,0,0.9)', 'rgba(255,60,60,0.8)',
                  'rgba(255,215,0,0.9)', 'rgba(255,60,60,0.8)',
                  'rgba(255,215,0,0.9)', 'rgba(255,60,60,0.8)',
                  'rgba(255,215,0,0.6)',
                ],
                opacity: [0, 1, 1, 1, 1, 1, 0],
              }}
              transition={{ duration: 2.4, ease: 'easeOut' }}
            />
          )}

          {/* Background brightness pulse for jackpot/mega — brief flash */}
          {(milestone.effect === 'jackpot' || milestone.effect === 'mega') && (
            <motion.div
              className="absolute inset-0"
              initial={{ backgroundColor: 'rgba(255,255,255,0)' }}
              animate={{
                backgroundColor: [
                  'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)',
                  'rgba(255,255,255,0)', 'rgba(255,255,255,0.04)',
                  'rgba(255,255,255,0)',
                ],
              }}
              transition={{ duration: 2, ease: 'easeOut' }}
            />
          )}

          {/* Screen shake wrapper for mega */}
          <motion.div
            className="absolute inset-0 flex items-start justify-center"
            animate={
              milestone.effect === 'mega'
                ? { x: [0, -4, 4, -2, 2, 0], y: [0, 2, -2, 1, -1, 0] }
                : {}
            }
            transition={
              milestone.effect === 'mega'
                ? { duration: 0.4, repeat: 6, ease: 'easeInOut' }
                : {}
            }
          >
            {/* Banner */}
            {milestone.effect !== 'sparkle' && (
              <motion.div
                className="mt-24 px-8 py-4 rounded-xl bg-[var(--bg-secondary)] border-2 border-[var(--accent-gold)] shadow-2xl"
                initial={{ y: -120, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -120, opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              >
                <motion.p
                  className="text-3xl font-bold tracking-wider text-[var(--accent-gold)] led-text text-center whitespace-nowrap"
                  animate={
                    milestone.effect === 'jackpot' || milestone.effect === 'mega'
                      ? { rotate: [0, -2, 2, -1, 1, 0] }
                      : {}
                  }
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  {milestone.emoji} {milestone.label}
                </motion.p>
              </motion.div>
            )}

            {/* Sparkle-only: smaller floating text */}
            {milestone.effect === 'sparkle' && (
              <motion.div
                className="mt-32"
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-2xl font-bold text-[var(--accent-gold)] led-text">
                  {milestone.emoji} {milestone.label}
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Mega badge unlock */}
          {milestone.effect === 'mega' && (
            <motion.div
              className="absolute bottom-8 right-8 px-4 py-2 rounded-lg bg-[var(--accent-gold)] text-[var(--bg-primary)] font-bold text-sm shadow-lg"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1, type: 'spring', damping: 15 }}
            >
              🏆 Badge Unlocked: Million Token Club
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}

function fireEffect(effect: Milestone['effect']) {
  switch (effect) {
    case 'sparkle':
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { x: 0.15, y: 0.4 },
        colors: ['#FFD700', '#FFA500', '#FFEC8B'],
        scalar: 0.6,
        ticks: 60,
      });
      break;

    case 'banner':
      // Banner is CSS-only, no confetti
      break;

    case 'confetti':
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 } }), 500);
      break;

    case 'jackpot':
      for (let i = 0; i < 5; i++) {
        setTimeout(
          () =>
            confetti({
              particleCount: 50,
              spread: 80,
              origin: { x: Math.random(), y: Math.random() * 0.5 + 0.2 },
            }),
          i * 600,
        );
      }
      break;

    case 'mega':
      // Jackpot confetti + extra bursts
      for (let i = 0; i < 8; i++) {
        setTimeout(
          () =>
            confetti({
              particleCount: 80,
              spread: 120,
              origin: { x: Math.random(), y: Math.random() * 0.6 + 0.1 },
              colors: ['#FFD700', '#FF4444', '#44FF44', '#4488FF'],
            }),
          i * 500,
        );
      }
      break;
  }
}
