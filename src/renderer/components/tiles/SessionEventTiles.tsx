import { useState } from 'react';
import { motion } from 'motion/react';

/* ------------------------------------------------------------------ */
/*  1. ErrorBanner                                                     */
/* ------------------------------------------------------------------ */

interface ErrorBannerProps {
  errorType: string;
  message: string;
  statusCode?: number;
}

export function ErrorBanner({ errorType, message, statusCode }: ErrorBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 120;

  return (
    <div
      className="glass-card w-full px-3 py-2 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-red)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs shrink-0">⚠️</span>
        <span className="text-xs font-medium truncate" style={{ color: 'var(--accent-red)' }}>
          {errorType}
        </span>
        {statusCode != null && (
          <span
            className="text-xs font-mono px-1.5 rounded shrink-0"
            style={{ backgroundColor: 'rgba(255,80,80,0.15)', color: 'var(--accent-red)' }}
          >
            {statusCode}
          </span>
        )}
        {!isLong && (
          <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            — {message}
          </span>
        )}
      </div>
      {isLong && (
        <>
          <div
            className="text-xs mt-1"
            style={{ color: 'var(--text-secondary)', whiteSpace: expanded ? 'pre-wrap' : undefined }}
          >
            {expanded ? message : `${message.slice(0, 120)}…`}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs mt-1 cursor-pointer"
            style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', padding: 0 }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. ModelChangeBanner                                               */
/* ------------------------------------------------------------------ */

interface ModelChangeBannerProps {
  previousModel?: string;
  newModel: string;
}

export function ModelChangeBanner({ previousModel, newModel }: ModelChangeBannerProps) {
  return (
    <div
      className="glass-card w-full px-3 py-2 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-purple)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs shrink-0">🔄</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Model changed:{' '}
          {previousModel && (
            <>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{previousModel}</span>
              {' → '}
            </>
          )}
          <span className="font-mono font-medium" style={{ color: 'var(--accent-purple)' }}>{newModel}</span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. TruncationWarning                                               */
/* ------------------------------------------------------------------ */

interface TruncationWarningProps {
  tokensRemoved: number;
  messagesRemoved: number;
}

export function TruncationWarning({ tokensRemoved, messagesRemoved }: TruncationWarningProps) {
  return (
    <div
      className="glass-card w-full px-3 py-2 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-gold)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs shrink-0">✂️</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Context truncated —{' '}
          <span style={{ color: 'var(--accent-gold)' }}>{tokensRemoved.toLocaleString()}</span> tokens,{' '}
          <span style={{ color: 'var(--accent-gold)' }}>{messagesRemoved}</span> messages removed
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. CompactionBanner                                                */
/* ------------------------------------------------------------------ */

interface CompactionBannerProps {
  phase: 'start' | 'complete';
  preTokens?: number;
  postTokens?: number;
  summary?: string;
}

export function CompactionBanner({ phase, preTokens, postTokens, summary }: CompactionBannerProps) {
  const [showSummary, setShowSummary] = useState(false);
  const saved = preTokens != null && postTokens != null ? preTokens - postTokens : null;

  return (
    <div
      className="glass-card w-full px-3 py-2 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-blue)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs shrink-0">📦</span>
        {phase === 'start' ? (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Compacting context…
            <span style={{ animation: 'pulse-dot 1.5s ease-in-out infinite', marginLeft: 4 }}>●</span>
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Compaction complete
            {saved != null && (
              <> — <span style={{ color: 'var(--accent-blue)' }}>{saved.toLocaleString()}</span> tokens saved</>
            )}
          </span>
        )}
      </div>
      {phase === 'complete' && summary && (
        <>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="text-xs mt-1 cursor-pointer"
            style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', padding: 0 }}
          >
            {showSummary ? 'Hide summary' : 'Show summary'}
          </button>
          {showSummary && (
            <div
              className="text-xs mt-1 rounded px-2 py-1"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {summary}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. ShutdownReport                                                  */
/* ------------------------------------------------------------------ */

interface ShutdownReportProps {
  totalRequests: number;
  totalApiDurationMs: number;
  linesAdded: number;
  linesRemoved: number;
  filesModified: string[];
  modelMetrics: Record<string, {
    requests: { count: number; cost: number };
    usage: { inputTokens: number; outputTokens: number };
  }>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${(s / 60).toFixed(1)}m`;
}

export function ShutdownReport({
  totalRequests,
  totalApiDurationMs,
  linesAdded,
  linesRemoved,
  filesModified,
  modelMetrics,
}: ShutdownReportProps) {
  const [expanded, setExpanded] = useState(false);
  const models = Object.entries(modelMetrics);

  return (
    <motion.div
      className="glass-card w-full px-3 py-3 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-gold)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs shrink-0">📊</span>
        <span className="text-xs font-medium" style={{ color: 'var(--accent-gold)' }}>
          Session Report
        </span>
      </div>

      {/* Stats grid */}
      <div
        className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div>
          <span style={{ color: 'var(--text-primary)' }}>{totalRequests}</span> requests
        </div>
        <div>
          <span style={{ color: 'var(--accent-green)' }}>+{linesAdded}</span>{' '}
          <span style={{ color: 'var(--accent-red)' }}>−{linesRemoved}</span>
        </div>
        <div>{formatDuration(totalApiDurationMs)}</div>
        <div>
          {filesModified.length} file{filesModified.length !== 1 ? 's' : ''} modified
        </div>
      </div>

      {/* Model breakdown */}
      {models.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs mt-2 cursor-pointer"
            style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', padding: 0 }}
          >
            {expanded ? 'Hide model breakdown' : `Model breakdown (${models.length})`}
          </button>
          {expanded && (
            <div className="mt-1 space-y-1">
              {models.map(([model, m]) => (
                <div
                  key={model}
                  className="text-xs font-mono rounded px-2 py-1"
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)' }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{model}</span>
                  {' — '}
                  {m.requests.count} req, ${m.requests.cost.toFixed(4)},{' '}
                  {(m.usage.inputTokens + m.usage.outputTokens).toLocaleString()} tok
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. TurnIndicator                                                   */
/* ------------------------------------------------------------------ */

interface TurnIndicatorProps {
  phase: 'start' | 'end';
  turnId: string;
}

export function TurnIndicator({ phase, turnId }: TurnIndicatorProps) {
  const label = phase === 'start' ? `turn ${turnId}` : `end ${turnId}`;

  return (
    <div className="flex items-center gap-2 w-full py-0.5" style={{ opacity: 0.35 }}>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
      <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  7. SkillBanner                                                     */
/* ------------------------------------------------------------------ */

interface SkillBannerProps {
  name: string;
  allowedTools?: string[];
}

export function SkillBanner({ name, allowedTools }: SkillBannerProps) {
  return (
    <div
      className="glass-card w-full px-3 py-2 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-purple)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs shrink-0">🎯</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Skill:{' '}
          <span className="font-medium" style={{ color: 'var(--accent-purple)' }}>{name}</span>
          {allowedTools && allowedTools.length > 0 && (
            <span style={{ color: 'var(--text-secondary)' }}>
              {' '}· {allowedTools.length} tool{allowedTools.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  8. HookBanner                                                      */
/* ------------------------------------------------------------------ */

interface HookBannerProps {
  hookType: string;
  phase: 'start' | 'end';
  success?: boolean;
}

export function HookBanner({ hookType, phase, success }: HookBannerProps) {
  const statusIcon =
    phase === 'start'
      ? '●'
      : success === false
        ? '✗'
        : '✓';
  const statusColor =
    phase === 'start'
      ? 'var(--text-secondary)'
      : success === false
        ? 'var(--accent-red)'
        : 'var(--accent-green)';

  return (
    <div className="flex items-center gap-2 w-full px-3 py-1" style={{ opacity: 0.6 }}>
      <span className="text-xs" style={{ color: statusColor }}>{statusIcon}</span>
      <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
        hook:{hookType}
      </span>
      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        {phase === 'start' ? 'running' : success === false ? 'failed' : 'done'}
      </span>
    </div>
  );
}
