import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MILESTONES, getAllMilestones, type Milestone, type Badge } from '../lib/milestones';
import { getLevelTier, MAX_LEVEL } from '../lib/level-system';
import type { Achievement, LevelProgressData } from '../../main/stats-service';

interface TrophyCaseProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function TrophyCase({ isOpen, onClose }: TrophyCaseProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const unlockedIds = new Set(achievements.map((a) => a.milestoneId));

  useEffect(() => {
    if (!isOpen) return;
    window.statsAPI?.getAchievements().then(setAchievements);
    window.statsAPI?.getLevelProgress().then((lp) => setCurrentLevel(lp.level));
  }, [isOpen]);

  const allMilestones = getAllMilestones();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed top-0 right-0 z-50 h-full w-[400px] border-l border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-bold tracking-widest text-[var(--accent-gold)] led-text">
                🏅 TROPHY CASE
              </h2>
              <button
                onClick={onClose}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* Stats bar */}
              <div className="flex gap-3">
                <div className="glass-card flex-1 p-3 text-center">
                  <div className="text-2xl font-bold text-[var(--accent-gold)]">{achievements.length}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Unlocked</div>
                </div>
                <div className="glass-card flex-1 p-3 text-center">
                  <div className="text-2xl font-bold text-[var(--text-secondary)]">{allMilestones.length - achievements.length}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Remaining</div>
                </div>
                <div className="glass-card flex-1 p-3 text-center">
                  <div className="text-2xl font-bold text-[var(--accent-purple)]">
                    {allMilestones.length > 0 ? Math.round((achievements.length / allMilestones.length) * 100) : 0}%
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Complete</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-gold)]"
                  initial={{ width: 0 }}
                  animate={{ width: allMilestones.length > 0 ? `${(achievements.length / allMilestones.length) * 100}%` : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              {/* Tier progression */}
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Tier Progression
                </h3>
                <div className="flex flex-col gap-1.5">
                  {([
                    { name: 'Novice',    emoji: '🌱', minLevel: 1,  maxLevel: 14 },
                    { name: 'Adept',     emoji: '⭐', minLevel: 15, maxLevel: 29 },
                    { name: 'Skilled',   emoji: '🔥', minLevel: 30, maxLevel: 44 },
                    { name: 'Veteran',   emoji: '⚔️', minLevel: 45, maxLevel: 59 },
                    { name: 'Expert',    emoji: '💎', minLevel: 60, maxLevel: 74 },
                    { name: 'Master',    emoji: '👑', minLevel: 75, maxLevel: 89 },
                    { name: 'Legendary', emoji: '🌟', minLevel: 90, maxLevel: 100 },
                  ] as const).map((tier) => {
                    const reached = currentLevel >= tier.minLevel;
                    const current = currentLevel >= tier.minLevel && currentLevel <= tier.maxLevel;
                    return (
                      <div
                        key={tier.name}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          current
                            ? 'bg-[var(--accent-purple)]/15 border border-[var(--accent-purple)]/30'
                            : reached
                            ? 'bg-[var(--bg-primary)]'
                            : 'bg-[var(--bg-primary)] opacity-40'
                        }`}
                      >
                        <span className={`text-xl ${reached ? '' : 'grayscale blur-[1px]'}`}>{tier.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold ${current ? 'text-[var(--accent-gold)]' : reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            {tier.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            Levels {tier.minLevel}–{tier.maxLevel}
                          </div>
                        </div>
                        {current && (
                          <span className="text-[10px] font-bold text-[var(--accent-purple)] uppercase tracking-wider">
                            Current
                          </span>
                        )}
                        {reached && !current && (
                          <span className="text-[10px] text-[var(--accent-gold)]">✓</span>
                        )}
                        {!reached && (
                          <span className="text-[10px] text-[var(--text-secondary)]">🔒</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Badge grid */}
              <div className="grid grid-cols-3 gap-3">
                {allMilestones.map((m) => {
                  const unlocked = unlockedIds.has(m.id);
                  const achievement = achievements.find((a) => a.milestoneId === m.id);
                  const isBadge = 'description' in m;
                  const count = achievement?.count || 0;
                  return (
                    <motion.div
                      key={m.id}
                      className={`glass-card p-3 flex flex-col items-center gap-1.5 text-center transition-colors relative ${
                        unlocked ? '' : 'opacity-40 grayscale'
                      }`}
                      whileHover={unlocked ? { scale: 1.05 } : {}}
                      title={unlocked && achievement ? `Unlocked ${formatDate(achievement.unlockedAt)}${count > 1 ? ` · ×${count}` : ''}` : isBadge ? (m as Badge).description : 'Locked'}
                    >
                      {unlocked && count > 1 && (
                        <span className="absolute top-1 right-1.5 text-[9px] font-bold text-[var(--accent-gold)] tabular-nums">
                          ×{count}
                        </span>
                      )}
                      <span className={`text-2xl ${unlocked ? '' : 'blur-[2px]'}`}>
                        {unlocked ? m.emoji : '🔒'}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-primary)] leading-tight">
                        {m.label}
                      </span>
                      {unlocked && achievement && (
                        <span className="text-[8px] text-[var(--accent-gold)]">
                          {new Date(achievement.unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {!unlocked && (
                        <span className="text-[8px] text-[var(--text-secondary)]">
                          {isBadge ? (m as Badge).description :
                           'metric' in m && m.metric === 'totalTokens' ? `${((m as Milestone).threshold / 1000).toFixed(0)}K tokens` :
                           'metric' in m && m.metric === 'filesChanged' ? `${(m as Milestone).threshold} files` :
                           `${(m as Milestone).threshold} lines`}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Recently unlocked */}
              {achievements.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                    Recently Unlocked
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {[...achievements]
                      .sort((a, b) => b.unlockedAt - a.unlockedAt)
                      .slice(0, 5)
                      .map((a) => (
                        <div key={a.milestoneId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-primary)]">
                          <span className="text-lg">{a.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[var(--text-primary)] truncate">{a.label}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">{formatDate(a.unlockedAt)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {achievements.length === 0 && (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  <p className="text-3xl mb-2">🏅</p>
                  <p className="text-sm">No achievements yet!</p>
                  <p className="text-xs mt-1">Start chatting to unlock badges.</p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
