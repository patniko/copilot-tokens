import { useState, useRef, useCallback } from 'react';
import type { Milestone } from '../lib/milestones';
import { checkMilestones } from '../lib/milestones';
import type { DashboardStats } from '../components/TokenDashboard';

const EMPTY_STATS: DashboardStats = {
  inputTokens: 0,
  outputTokens: 0,
  filesChanged: 0,
  linesAdded: 0,
  linesRemoved: 0,
  messagesCount: 0,
  toolCalls: 0,
};

export function useMilestones() {
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const previousStatsRef = useRef<DashboardStats>(EMPTY_STATS);
  const queueRef = useRef<Milestone[]>([]);

  const showNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      setActiveMilestone(queueRef.current.shift()!);
    } else {
      setActiveMilestone(null);
    }
  }, []);

  const dismissMilestone = useCallback(() => {
    showNext();
  }, [showNext]);

  const checkStats = useCallback(
    (currentStats: DashboardStats) => {
      const triggered = checkMilestones(currentStats, previousStatsRef.current);
      previousStatsRef.current = currentStats;

      if (triggered.length === 0) return;

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
