import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getAllMilestones, type Milestone, type Badge } from '../lib/milestones';
import { LEVEL_CATEGORIES, CATEGORY_LABELS, getThresholds, getCategoryCompletion, getLevelTier, MAX_LEVEL, type LevelProgress, type LevelCategory } from '../lib/level-system';
import type { RankedSession, LifetimeStats, SessionStats, Achievement } from '../../main/stats-service';

type Tab = 'stats' | 'trophies';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplaySession?: (sessionTimestamp: number) => void;
  initialTab?: Tab;
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatNumber = (n: number) => n.toLocaleString();

const formatMs = (ms: number) => {
  if (!isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const formatCompact = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};

const rankBadge = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

const bestLabels: Record<string, { label: string; icon: string }> = {
  inputTokens: { label: 'Most Input Tokens', icon: '📥' },
  outputTokens: { label: 'Most Output Tokens', icon: '📤' },
  messagesCount: { label: 'Most Messages', icon: '💬' },
  filesChanged: { label: 'Most Files', icon: '📁' },
  linesAdded: { label: 'Most Lines Added', icon: '➕' },
  linesRemoved: { label: 'Most Lines Removed', icon: '➖' },
  toolCalls: { label: 'Most Tool Calls', icon: '🔧' },
  durationMs: { label: 'Longest Session', icon: '⏱️' },
};

export default function AchievementsModal({ isOpen, onClose, onReplaySession, initialTab = 'stats' }: AchievementsModalProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  // Stats tab data
  const [sessions, setSessions] = useState<RankedSession[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeStats | null>(null);
  const [bests, setBests] = useState<Partial<Record<keyof SessionStats, number>>>({});
  const [commitBests, setCommitBests] = useState<{ linesAdded: number; linesRemoved: number } | null>(null);
  const [replayTimestamps, setReplayTimestamps] = useState<Set<number>>(new Set());

  // Trophy tab data
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null);

  // Reset tab when opening
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);

  // Load data when opened
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      window.statsAPI.getTopSessions(10),
      window.statsAPI.getLifetimeStats(),
      window.statsAPI.getAllTimeBests(),
      window.statsAPI.getSessionEvents(),
      window.statsAPI.getCommitBests(),
      window.statsAPI.getAchievements(),
      window.statsAPI.getLevelProgress(),
    ]).then(([s, l, b, events, cb, achiev, lp]) => {
      setSessions(s as RankedSession[]);
      setLifetime(l);
      setBests(b);
      setReplayTimestamps(new Set(events.map((e: { sessionTimestamp: number }) => e.sessionTimestamp)));
      if (cb.linesAdded > 0 || cb.linesRemoved > 0) setCommitBests(cb);
      setAchievements(achiev);
      setCurrentLevel(lp.level);
      setLevelProgress(lp as LevelProgress);
    });
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="pointer-events-auto w-full max-w-2xl max-h-[85vh] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                <h2 className="text-lg font-bold tracking-widest text-[var(--accent-gold)] led-text">
                  🏆 ACHIEVEMENTS
                </h2>
                <button
                  onClick={onClose}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--border-color)]">
                {([
                  { id: 'stats' as Tab, label: 'Leaderboard', icon: '🏅' },
                  { id: 'trophies' as Tab, label: 'Trophies', icon: '🏆' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                      tab === t.id
                        ? 'text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)] bg-[var(--bg-primary)]/30'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {tab === 'stats' ? (
                  <StatsTab
                    lifetime={lifetime}
                    sessions={sessions}
                    bests={bests}
                    commitBests={commitBests}
                    replayTimestamps={replayTimestamps}
                    onReplaySession={onReplaySession}
                  />
                ) : (
                  <TrophiesTab
                    achievements={achievements}
                    currentLevel={currentLevel}
                    levelProgress={levelProgress}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Stats / Leaderboard Tab ─── */

function StatsTab({
  lifetime,
  sessions,
  bests,
  commitBests,
  replayTimestamps,
  onReplaySession,
}: {
  lifetime: LifetimeStats | null;
  sessions: RankedSession[];
  bests: Partial<Record<keyof SessionStats, number>>;
  commitBests: { linesAdded: number; linesRemoved: number } | null;
  replayTimestamps: Set<number>;
  onReplaySession?: (ts: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Headline stats */}
      {lifetime && (
        <motion.div
          className="grid grid-cols-4 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {[
            { icon: '🪙', label: 'Lifetime Tokens', value: formatCompact(lifetime.lifetimeTokens) },
            { icon: '🔥', label: 'Streak', value: `${lifetime.currentStreak}d` },
            { icon: '🎮', label: 'Sessions', value: formatNumber(lifetime.totalSessions) },
            { icon: '⚡', label: 'Fastest', value: formatMs(lifetime.fastestResponse) },
          ].map((badge) => (
            <motion.div
              key={badge.label}
              className="glass-card p-3 flex flex-col items-center gap-1 text-center"
              variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
            >
              <span className="text-2xl">{badge.icon}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">{badge.label}</span>
              <span className="text-sm font-bold text-[var(--accent-gold)]">{badge.value}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Lifetime detail + All-Time Bests side by side */}
      <div className="grid grid-cols-2 gap-5">
        {lifetime && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">Lifetime Stats</h3>
            <div className="flex flex-col gap-2">
              {[
                { icon: '🪙', label: 'Total Tokens', value: formatNumber(lifetime.lifetimeTokens) },
                { icon: '🎮', label: 'Total Sessions', value: formatNumber(lifetime.totalSessions) },
                { icon: '🔥', label: 'Current Streak', value: `${lifetime.currentStreak} days` },
                { icon: '🏅', label: 'Longest Streak', value: `${lifetime.longestStreak} days` },
                { icon: '⚡', label: 'Fastest Response', value: formatMs(lifetime.fastestResponse) },
              ].map((stat) => (
                <div key={stat.label} className="glass-card p-2.5 flex items-center gap-2">
                  <span className="text-base">{stat.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{stat.value}</div>
                    <div className="text-[9px] text-[var(--text-secondary)]">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {Object.keys(bests).length > 0 && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">All-Time Bests</h3>
            <div className="flex flex-col gap-2">
              {(Object.entries(bests) as [keyof SessionStats, number][]).map(([key, value]) => {
                const meta = bestLabels[key];
                if (!meta) return null;
                return (
                  <div key={key} className="glass-card p-2.5 flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--accent-gold)] truncate">
                        {key === 'durationMs' ? formatMs(value) : formatNumber(value)}
                      </div>
                      <div className="text-[9px] text-[var(--text-secondary)]">{meta.label}</div>
                    </div>
                  </div>
                );
              })}
              {commitBests && (
                <>
                  <div className="glass-card p-2.5 flex items-center gap-2">
                    <span className="text-base">📝</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--accent-green)] truncate">{formatNumber(commitBests.linesAdded)}</div>
                      <div className="text-[9px] text-[var(--text-secondary)]">Most Lines Added</div>
                    </div>
                  </div>
                  <div className="glass-card p-2.5 flex items-center gap-2">
                    <span className="text-base">🗑️</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--accent-red)] truncate">{formatNumber(commitBests.linesRemoved)}</div>
                      <div className="text-[9px] text-[var(--text-secondary)]">Most Lines Removed</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Top Sessions */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">Top 10 Sessions</h3>
        {sessions.length === 0 ? (
          <div className="text-center text-[var(--text-secondary)] py-8">
            🎰 No sessions yet — start playing!
          </div>
        ) : (
          <motion.ul
            className="flex flex-col gap-2"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          >
            {sessions.map((s) => (
              <motion.li
                key={`${s.rank}-${s.timestamp}`}
                className="glass-card p-3 flex items-center gap-3"
                variants={{ hidden: { x: 30, opacity: 0 }, visible: { x: 0, opacity: 1 } }}
              >
                <span className="text-lg w-8 text-center font-bold shrink-0">
                  {rankBadge(s.rank)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {formatNumber(s.inputTokens + s.outputTokens)} tokens
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] flex gap-2">
                    <span>{formatDate(s.timestamp)}</span>
                    <span>·</span>
                    <span>{s.messagesCount} msgs</span>
                    <span>·</span>
                    <span>{s.filesChanged} files</span>
                  </div>
                </div>
                {onReplaySession && replayTimestamps.has(s.timestamp) && (
                  <button
                    onClick={() => onReplaySession(s.timestamp)}
                    className="shrink-0 px-2 py-1 text-[10px] rounded bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/40 transition-colors cursor-pointer"
                    title="Replay session"
                  >
                    ▶ Replay
                  </button>
                )}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>
    </div>
  );
}

/* ─── Trophies Tab ─── */

function TrophiesTab({
  achievements,
  currentLevel,
  levelProgress,
}: {
  achievements: Achievement[];
  currentLevel: number;
  levelProgress: LevelProgress | null;
}) {
  const unlockedIds = new Set(achievements.map((a) => a.milestoneId));
  const allMilestones = getAllMilestones();

  return (
    <div className="flex flex-col gap-5">
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

      {/* Tier progression + Level progress side by side */}
      <div className="grid grid-cols-2 gap-5">
        <section>
          <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">Tier Progression</h3>
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
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                    current
                      ? 'bg-[var(--accent-purple)]/15 border border-[var(--accent-purple)]/30'
                      : reached
                      ? 'bg-[var(--bg-primary)]'
                      : 'bg-[var(--bg-primary)] opacity-40'
                  }`}
                >
                  <span className={`text-base ${reached ? '' : 'grayscale blur-[1px]'}`}>{tier.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-bold ${current ? 'text-[var(--accent-gold)]' : reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {tier.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-secondary)]">
                      Levels {tier.minLevel}–{tier.maxLevel}
                    </div>
                  </div>
                  {current && <span className="text-[9px] font-bold text-[var(--accent-purple)] uppercase tracking-wider">Current</span>}
                  {reached && !current && <span className="text-[9px] text-[var(--accent-gold)]">✓</span>}
                  {!reached && <span className="text-[9px] text-[var(--text-secondary)]">🔒</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Level category progress */}
        {levelProgress && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Level {levelProgress.level} Progress
            </h3>
            <div className="flex flex-col gap-2">
              {LEVEL_CATEGORIES.map((cat) => {
                const completions = getCategoryCompletion(levelProgress);
                const thresholds = getThresholds(levelProgress.level).thresholds;
                const pct = completions[cat];
                const current = levelProgress.categoryProgress[cat];
                const threshold = thresholds[cat];
                const complete = pct >= 1;
                const meta = CATEGORY_LABELS[cat];
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="w-4 text-center text-xs" title={meta.label}>{meta.emoji}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-[9px] mb-0.5">
                        <span className={complete ? 'text-[var(--accent-gold)] font-bold' : 'text-[var(--text-secondary)]'}>
                          {meta.label}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {formatCompact(current)} / {formatCompact(threshold)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            complete
                              ? 'bg-[var(--accent-gold)]'
                              : 'bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-cyan)]'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, pct * 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                    {complete && <span className="text-[10px]">✅</span>}
                  </div>
                );
              })}
            </div>
            {levelProgress.level < MAX_LEVEL && (
              <div className="text-[9px] text-[var(--text-secondary)] text-center italic mt-2">
                Fill all bars to reach Level {levelProgress.level + 1}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Badge grid */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">Badges</h3>
        <div className="grid grid-cols-4 gap-3">
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
      </section>

      {/* Recently unlocked */}
      {achievements.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">Recently Unlocked</h3>
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
  );
}
