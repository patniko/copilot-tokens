import { useEffect, useRef, useState, useCallback } from 'react';
import OdometerCounter from './OdometerCounter';
import ContextProgressBar from './ContextProgressBar';
import { partyBus, PartyEvents } from '../lib/party-bus';

export interface DashboardStats {
  inputTokens: number;
  outputTokens: number;
  realOutputTokens: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  messagesCount: number;
  toolCalls: number;
}

interface QuotaInfo {
  quotaId: string;
  usedRequests: number;
  entitlementRequests: number;
  remainingPercentage: number;
  overage: number;
  resetDate?: string;
  isUnlimited: boolean;
}

interface UsageDetails {
  totalCost: number;
  totalDuration: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  quota: QuotaInfo | null;
}

interface TokenDashboardProps {
  inputTokenCount?: number;
  contextWindow?: number;
  onStatsUpdate?: (stats: DashboardStats) => void;
  panelIds?: string[];
}

const initialStats: DashboardStats = {
  inputTokens: 0,
  outputTokens: 0,
  realOutputTokens: 0,
  filesChanged: 0,
  linesAdded: 0,
  linesRemoved: 0,
  messagesCount: 0,
  toolCalls: 0,
};

export default function TokenDashboard({ inputTokenCount, contextWindow, onStatsUpdate, panelIds }: TokenDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [gitStats, setGitStats] = useState<{ filesChanged: number; linesAdded: number; linesRemoved: number } | null>(null);
  const [contextUsage, setContextUsage] = useState<{ currentTokens: number; tokenLimit: number } | null>(null);
  const [usageDetails, setUsageDetails] = useState<UsageDetails>({ totalCost: 0, totalDuration: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quota: null });
  const statsRef = useRef(stats);

  // Keep ref in sync for event callbacks
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // Report stats upstream (merge token stats + git stats)
  const prevTotalRef = useRef(0);
  useEffect(() => {
    // Wait for initial git stats poll before reporting, so milestones get a correct baseline
    if (!gitStats) return;
    const merged = { ...stats, filesChanged: gitStats.filesChanged, linesAdded: gitStats.linesAdded, linesRemoved: gitStats.linesRemoved };
    onStatsUpdate?.(merged);
    // Emit Party Bus events when crossing token thresholds
    const total = stats.inputTokens + stats.outputTokens;
    const prev = prevTotalRef.current;
    for (const t of [1000, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]) {
      if (prev < t && total >= t) partyBus.emit(PartyEvents.TOKENS_CROSSED(t), total);
    }
    prevTotalRef.current = total;
  }, [stats, gitStats, onStatsUpdate]);

  // Sync inputTokenCount prop
  useEffect(() => {
    if (inputTokenCount != null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStats((prev) => ({ ...prev, inputTokens: inputTokenCount }));
    }
  }, [inputTokenCount]);

  // Poll real git stats every 3 seconds
  useEffect(() => {
    const poll = async () => {
      if (!window.cwdAPI) return;
      const cwd = await window.cwdAPI.get();
      if (!cwd) return;
      const gs = await window.cwdAPI.gitStats(cwd);
      setGitStats({ filesChanged: gs.filesChanged, linesAdded: gs.linesAdded, linesRemoved: gs.linesRemoved });
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleEvent = useCallback((event: unknown) => {
    const ev = event as Record<string, unknown> | null;
    if (!ev || typeof ev !== 'object') return;
    const type = ev.type as string | undefined;
    if (!type) return;

    if (type === 'session.usage_info') {
      setContextUsage({
        currentTokens: (ev.currentTokens ?? 0) as number,
        tokenLimit: (ev.tokenLimit ?? 0) as number,
      });
      return;
    }

    setStats((prev) => {
      const next = { ...prev };

      if (type === 'assistant.message_delta') {
        const delta = (ev.delta ?? ev.content ?? '') as string;
        // Rough estimate until real usage event arrives
        next.outputTokens += Math.max(1, Math.ceil(delta.length / 4));
      }

      if (type === 'session.idle') {
        next.messagesCount += 1;
      }

      if (type === 'assistant.usage') {
        const input = (ev.inputTokens ?? 0) as number;
        const output = (ev.outputTokens ?? 0) as number;
        // Input tokens = current context size (use latest, not cumulative)
        if (input > 0) next.inputTokens = input;
        // Output tokens = accumulate real counts, replace the delta estimate
        if (output > 0) {
          // Subtract the delta-based estimate we added during streaming, add the real count
          next.outputTokens = prev.realOutputTokens + output;
          next.realOutputTokens = prev.realOutputTokens + output;
        }
        // Rich usage details
        const cost = (ev.cost ?? 0) as number;
        const duration = (ev.duration ?? 0) as number;
        const cacheRead = (ev.cacheReadTokens ?? 0) as number;
        const cacheWrite = (ev.cacheWriteTokens ?? 0) as number;
        const snapshots = ev.quotaSnapshots as Record<string, { isUnlimitedEntitlement: boolean; entitlementRequests: number; usedRequests: number; remainingPercentage: number; overage: number; resetDate?: string }> | undefined;
        setUsageDetails(prev => {
          const updated = {
            totalCost: prev.totalCost + cost,
            totalDuration: prev.totalDuration + duration,
            cacheReadTokens: prev.cacheReadTokens + cacheRead,
            cacheWriteTokens: prev.cacheWriteTokens + cacheWrite,
            quota: prev.quota,
          };
          // Use the latest quota snapshot (take the first one available)
          if (snapshots) {
            const firstKey = Object.keys(snapshots)[0];
            if (firstKey) {
              const s = snapshots[firstKey];
              updated.quota = {
                quotaId: firstKey,
                usedRequests: s.usedRequests,
                entitlementRequests: s.entitlementRequests,
                remainingPercentage: s.remainingPercentage,
                overage: s.overage,
                resetDate: s.resetDate,
                isUnlimited: s.isUnlimitedEntitlement,
              };
            }
          }
          return updated;
        });
      }

      if (type === 'tool.start') {
        next.toolCalls += 1;
      }

      // Trigger a git stats refresh after tool completions
      if (type === 'tool.complete' || type === 'session.idle') {
        if (window.cwdAPI) {
          window.cwdAPI.get().then((cwd) => {
            if (cwd) {
              window.cwdAPI.gitStats(cwd).then((gs) => {
                setGitStats({ filesChanged: gs.filesChanged, linesAdded: gs.linesAdded, linesRemoved: gs.linesRemoved });
              });
            }
          });
        }
      }

      return next;
    });
  }, []);

  // Subscribe to copilot events (all panels)
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const ids = panelIds && panelIds.length > 0 ? panelIds : ['main'];
    const unsubs = ids.map(id => window.copilotAPI.onEvent(handleEvent, id));
    return () => unsubs.forEach(u => u());
  }, [handleEvent, panelIds?.join(',')]);

  const totalTokens = stats.inputTokens + stats.outputTokens;

  return (
    <div className="flex flex-col gap-2">
      {/* Token Counters */}
      <Section title="Tokens">
        <OdometerCounter label="INPUT" value={stats.inputTokens} size="sm" />
        <OdometerCounter label="OUTPUT" value={stats.outputTokens} size="sm" />
        <OdometerCounter label="TOTAL" value={totalTokens} size="sm" color="var(--accent-gold)" />
      </Section>

      {/* Context Usage */}
      <Section title="Context Window">
        <ContextProgressBar
          usedTokens={contextUsage?.currentTokens ?? stats.inputTokens}
          maxTokens={contextUsage?.tokenLimit ?? contextWindow}
        />
      </Section>

      {/* Usage Details (cost, cache, duration) */}
      {(usageDetails.totalCost > 0 || usageDetails.cacheReadTokens > 0) && (
        <Section title="Usage">
          <div className="flex gap-4 items-end flex-wrap">
            {usageDetails.totalCost > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">Cost</span>
                <span className="text-xs font-mono text-[var(--accent-gold)]">{(usageDetails.totalCost).toFixed(4)}</span>
              </div>
            )}
            {usageDetails.totalDuration > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">API Time</span>
                <span className="text-xs font-mono text-[var(--text-primary)]">{(usageDetails.totalDuration / 1000).toFixed(1)}s</span>
              </div>
            )}
            {usageDetails.cacheReadTokens > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">Cache ↓</span>
                <span className="text-xs font-mono text-[var(--accent-green)]">{usageDetails.cacheReadTokens.toLocaleString()}</span>
              </div>
            )}
            {usageDetails.cacheWriteTokens > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">Cache ↑</span>
                <span className="text-xs font-mono text-[var(--accent-purple)]">{usageDetails.cacheWriteTokens.toLocaleString()}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Quota */}
      {usageDetails.quota && !usageDetails.quota.isUnlimited && (
        <Section title="Quota">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-[var(--text-secondary)]">{usageDetails.quota.usedRequests} / {usageDetails.quota.entitlementRequests} requests</span>
              <span className={usageDetails.quota.remainingPercentage < 0.2 ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'}>
                {Math.round(usageDetails.quota.remainingPercentage * 100)}% left
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (1 - usageDetails.quota.remainingPercentage) * 100)}%`,
                  backgroundColor: usageDetails.quota.remainingPercentage < 0.2 ? 'var(--accent-red)' : usageDetails.quota.remainingPercentage < 0.5 ? 'var(--accent-gold)' : 'var(--accent-green)',
                }}
              />
            </div>
            {usageDetails.quota.overage > 0 && (
              <span className="text-[9px] text-[var(--accent-red)]">⚠ {usageDetails.quota.overage} overage requests</span>
            )}
            {usageDetails.quota.resetDate && (
              <span className="text-[9px] text-[var(--text-secondary)]">Resets {new Date(usageDetails.quota.resetDate).toLocaleDateString()}</span>
            )}
          </div>
        </Section>
      )}

      {/* File Stats */}
      <Section title="Changes">
        <div className="flex gap-4 items-end">
          <OdometerCounter label="FILES" value={gitStats?.filesChanged ?? 0} size="sm" />
          <OdometerCounter label="+" value={gitStats?.linesAdded ?? 0} size="sm" color="var(--accent-green)" />
          <OdometerCounter label="−" value={gitStats?.linesRemoved ?? 0} size="sm" color="var(--accent-red)" />
        </div>
      </Section>

      {/* Session Info */}
      <Section title="Session">
        <div className="flex gap-4 items-end">
          <OdometerCounter label="MESSAGES" value={stats.messagesCount} size="sm" />
          <OdometerCounter label="TOOLS" value={stats.toolCalls} size="sm" />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card px-3 py-2 flex flex-col gap-1.5">
      <h3 className="text-[9px] uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}
