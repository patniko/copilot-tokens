import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { RankedSession, LifetimeStats, SessionStats } from '../../main/stats-service';

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  onReplaySession?: (sessionTimestamp: number) => void;
}

const rankBadge = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, {
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

export default function Leaderboard({ isOpen, onClose, onReplaySession }: LeaderboardProps) {
  const [sessions, setSessions] = useState<RankedSession[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeStats | null>(null);
  const [bests, setBests] = useState<Partial<Record<keyof SessionStats, number>>>({});
  const [commitBests, setCommitBests] = useState<{ linesAdded: number; linesRemoved: number } | null>(null);
  const [replayTimestamps, setReplayTimestamps] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      window.statsAPI.getTopSessions(10),
      window.statsAPI.getLifetimeStats(),
      window.statsAPI.getAllTimeBests(),
      window.statsAPI.getSessionEvents(),
      window.statsAPI.getCommitBests(),
    ]).then(([s, l, b, events, cb]) => {
      setSessions(s as RankedSession[]);
      setLifetime(l);
      setBests(b);
      setReplayTimestamps(new Set(events.map((e: { sessionTimestamp: number }) => e.sessionTimestamp)));
      if (cb.linesAdded > 0 || cb.linesRemoved > 0) setCommitBests(cb);
    });
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
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
                🏆 LEADERBOARD
              </h2>
              <button
                onClick={onClose}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
              {/* Trophy Shelf */}
              {lifetime && (
                <motion.div
                  className="flex gap-3"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                >
                  {[
                    { icon: '🪙', label: 'Lifetime Tokens', value: formatNumber(lifetime.lifetimeTokens) },
                    { icon: '🔥', label: 'Streak', value: `${lifetime.currentStreak}d` },
                    { icon: '🎮', label: 'Sessions', value: formatNumber(lifetime.totalSessions) },
                  ].map((badge) => (
                    <motion.div
                      key={badge.label}
                      className="glass-card flex-1 p-3 flex flex-col items-center gap-1 text-center"
                      variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
                    >
                      <span className="text-2xl">{badge.icon}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{badge.label}</span>
                      <span className="text-sm font-bold text-[var(--accent-gold)]">{badge.value}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Lifetime Stats */}
              {lifetime && (
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                    Lifetime Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: '🪙', label: 'Total Tokens', value: formatNumber(lifetime.lifetimeTokens) },
                      { icon: '🎮', label: 'Total Sessions', value: formatNumber(lifetime.totalSessions) },
                      { icon: '🔥', label: 'Current Streak', value: `${lifetime.currentStreak} days` },
                      { icon: '🏅', label: 'Longest Streak', value: `${lifetime.longestStreak} days` },
                      { icon: '⚡', label: 'Fastest Response', value: formatMs(lifetime.fastestResponse) },
                    ].map((stat) => (
                      <div key={stat.label} className="glass-card p-3 flex items-center gap-2">
                        <span className="text-lg">{stat.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{stat.value}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">{stat.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Top Sessions */}
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Top 10 Sessions
                </h3>

                {sessions.length === 0 ? (
                  <div className="text-center text-[var(--text-secondary)] py-8">
                    🎰 No sessions yet — start playing!
                  </div>
                ) : (
                  <motion.ul
                    className="flex flex-col gap-2"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                  >
                    {sessions.map((s) => (
                      <motion.li
                        key={`${s.rank}-${s.timestamp}`}
                        className="glass-card p-3 flex items-center gap-3"
                        variants={{ hidden: { x: 50, opacity: 0 }, visible: { x: 0, opacity: 1 } }}
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

              {/* All-Time Bests */}
              {Object.keys(bests).length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                    All-Time Bests
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(bests) as [keyof SessionStats, number][]).map(([key, value]) => {
                      const meta = bestLabels[key];
                      if (!meta) return null;
                      return (
                        <div key={key} className="glass-card p-3 flex items-center gap-2">
                          <span className="text-lg">{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[var(--accent-gold)] truncate">
                              {key === 'durationMs' ? formatMs(value) : formatNumber(value)}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)]">{meta.label}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Commit Bests */}
              {commitBests && (
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                    Commit Bests
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="glass-card p-3 flex items-center gap-2">
                      <span className="text-lg">📝</span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--accent-green)] truncate">
                          {formatNumber(commitBests.linesAdded)}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Most Lines Added</div>
                      </div>
                    </div>
                    <div className="glass-card p-3 flex items-center gap-2">
                      <span className="text-lg">🗑️</span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--accent-red)] truncate">
                          {formatNumber(commitBests.linesRemoved)}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Most Lines Removed</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
