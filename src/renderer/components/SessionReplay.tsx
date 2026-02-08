import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { SessionEvent, SessionEventLog } from '../../main/stats-service';

interface SessionReplayProps {
  sessionTimestamp: number | null;
  onClose: () => void;
}

const EVENT_EMOJI: Record<string, string> = {
  'tool.start': '🔧',
  'tool.complete': '✅',
  'tool.error': '❌',
  'milestone.triggered': '🎉',
  'tokens.crossed': '🪙',
  'session.idle': '💤',
  'level:up': '🆙',
};

const EVENT_LABEL: Record<string, string> = {
  'tool.start': 'Tool Started',
  'tool.complete': 'Tool Complete',
  'tool.error': 'Tool Error',
  'milestone.triggered': 'Milestone!',
  'tokens.crossed': 'Token Milestone',
  'session.idle': 'Idle',
  'level:up': 'Level Up!',
};

function formatMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionReplay({ sessionTimestamp, onClose }: SessionReplayProps) {
  const [log, setLog] = useState<SessionEventLog | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // 4x default
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionTimestamp === null) { setLog(null); return; }
    window.statsAPI?.getSessionEventLog(sessionTimestamp).then((l) => {
      setLog(l ?? null);
      setCursor(0);
      setPlaying(false);
    });
  }, [sessionTimestamp]);

  const stop = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const stepForward = useCallback(() => {
    setCursor((c) => {
      if (!log || c >= log.events.length - 1) { stop(); return c; }
      return c + 1;
    });
  }, [log, stop]);

  // Playback loop
  useEffect(() => {
    if (!playing || !log || cursor >= log.events.length - 1) return;
    const nextEvent = log.events[cursor + 1];
    const currentEvent = log.events[cursor];
    const delay = Math.max(50, (nextEvent.timestamp - currentEvent.timestamp) / speed);
    timerRef.current = setTimeout(() => {
      setCursor((c) => {
        if (c >= log.events.length - 1) { stop(); return c; }
        return c + 1;
      });
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, cursor, log, speed, stop]);

  if (sessionTimestamp === null) return null;

  const events = log?.events ?? [];
  const totalDuration = events.length > 0 ? events[events.length - 1].timestamp : 0;
  const currentEvent = events[cursor];
  const progress = totalDuration > 0 ? (currentEvent?.timestamp ?? 0) / totalDuration : 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-[560px] max-h-[80vh] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl overflow-hidden flex flex-col"
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)]">
            <h2 className="text-sm font-bold tracking-widest text-[var(--accent-gold)] led-text">
              ▶ SESSION REPLAY
            </h2>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>
                {sessionTimestamp && new Date(sessionTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <button onClick={onClose} className="text-lg hover:text-[var(--text-primary)] cursor-pointer">✕</button>
            </div>
          </div>

          {!log ? (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
              No replay data found for this session.
            </div>
          ) : (
            <>
              {/* Timeline bar */}
              <div className="px-5 pt-4 pb-2">
                <div className="relative w-full h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    const targetTs = pct * totalDuration;
                    const idx = events.findIndex((ev) => ev.timestamp >= targetTs);
                    setCursor(Math.max(0, idx));
                  }}
                >
                  <div
                    className="absolute h-full bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-gold)] rounded-full transition-all duration-100"
                    style={{ width: `${progress * 100}%` }}
                  />
                  {/* Event markers */}
                  {events.filter((e) => e.type === 'milestone.triggered' || e.type === 'tokens.crossed').map((ev, i) => (
                    <div
                      key={i}
                      className="absolute top-0 w-1.5 h-full bg-[var(--accent-gold)]"
                      style={{ left: `${totalDuration > 0 ? (ev.timestamp / totalDuration) * 100 : 0}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-1">
                  <span>{formatMs(currentEvent?.timestamp ?? 0)}</span>
                  <span>{formatMs(totalDuration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3 px-5 py-2">
                <button
                  onClick={() => { setCursor(0); stop(); }}
                  className="text-lg cursor-pointer hover:text-[var(--accent-gold)]"
                  title="Restart"
                >⏮</button>
                <button
                  onClick={() => playing ? stop() : setPlaying(true)}
                  className="text-2xl cursor-pointer hover:text-[var(--accent-gold)]"
                >
                  {playing ? '⏸' : '▶️'}
                </button>
                <button onClick={stepForward} className="text-lg cursor-pointer hover:text-[var(--accent-gold)]" title="Step">⏭</button>
                <div className="ml-4 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span>Speed:</span>
                  {[1, 2, 4, 8, 16].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${speed === s ? 'bg-[var(--accent-purple)] text-white' : 'hover:text-[var(--text-primary)]'}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Current event highlight */}
              {currentEvent && (
                <div className="mx-5 mb-2 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center gap-3">
                  <span className="text-2xl">{EVENT_EMOJI[currentEvent.type] ?? '📋'}</span>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      {EVENT_LABEL[currentEvent.type] ?? currentEvent.type}
                    </div>
                    {currentEvent.data && (
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        {currentEvent.data.tool != null && <span>{'Tool: ' + String(currentEvent.data.tool) + ' '}</span>}
                        {currentEvent.data.label != null && <span>{String(currentEvent.data.label) + ' '}</span>}
                        {currentEvent.data.threshold != null && <span>{'@ ' + String(currentEvent.data.threshold) + ' '}</span>}
                      </div>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-[var(--text-secondary)] font-mono">
                    {formatMs(currentEvent.timestamp)}
                  </span>
                </div>
              )}

              {/* Event list */}
              <div className="flex-1 overflow-y-auto px-5 pb-4 max-h-[300px]">
                <div className="flex flex-col gap-0.5">
                  {events.map((ev, i) => (
                    <button
                      key={i}
                      onClick={() => { setCursor(i); stop(); }}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-left text-[11px] cursor-pointer transition-colors ${
                        i === cursor
                          ? 'bg-[var(--accent-purple)]/20 text-[var(--text-primary)]'
                          : i < cursor
                          ? 'text-[var(--text-secondary)] opacity-60'
                          : 'text-[var(--text-secondary)]'
                      } hover:bg-[var(--bg-primary)]`}
                    >
                      <span className="w-10 text-right font-mono text-[10px]">{formatMs(ev.timestamp)}</span>
                      <span>{EVENT_EMOJI[ev.type] ?? '📋'}</span>
                      <span className="truncate">{EVENT_LABEL[ev.type] ?? ev.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
