import { useState, useRef, useCallback } from 'react';
import type { Milestone } from '../lib/milestones';
import { checkMilestones } from '../lib/milestones';
import type { DashboardStats } from '../components/TokenDashboard';
import { partyBus, PartyEvents } from '../lib/party-bus';

export function useMilestones() {
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const previousStatsRef = useRef<DashboardStats | null>(null);
  const queueRef = useRef<Milestone[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  const showNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      setActiveMilestone(queueRef.current.shift()!);
    } else {
      setActiveMilestone(null);
    }
  }, []);

  const dismissMilestone = useCallback(() => {
    partyBus.emit(PartyEvents.MILESTONE_DISMISSED, activeMilestone);
    showNext();
  }, [showNext, activeMilestone]);

  const checkStats = useCallback(
    (currentStats: DashboardStats) => {
      // First call is the baseline — don't trigger milestones for pre-existing stats
      if (previousStatsRef.current === null) {
        previousStatsRef.current = currentStats;
        return;
      }
      const triggered = checkMilestones(currentStats, previousStatsRef.current)
        .filter((m) => !firedRef.current.has(m.id));
      previousStatsRef.current = currentStats;

      if (triggered.length === 0) return;

      for (const m of triggered) {
        firedRef.current.add(m.id);
        partyBus.emit(PartyEvents.MILESTONE_TRIGGERED, m);
        // Persist as achievement
        window.statsAPI?.addAchievement({
          milestoneId: m.id,
          label: m.label,
          emoji: m.emoji,
          unlockedAt: Date.now(),
        });
      }

      if (activeMilestone === null && queueRef.current.length === 0) {
        setActiveMilestone(triggered[0]);
        queueRef.current.push(...triggered.slice(1));
      } else {
        queueRef.current.push(...triggered);
      }
    },
    [activeMilestone],
  );

  return { activeMilestone, checkStats, dismissMilestone };
}
