import { useRef, useCallback } from 'react';
import { BADGES, type Badge } from '../lib/milestones';
import { partyBus, PartyEvents } from '../lib/party-bus';

/**
 * Countable badge system for feature-discovery achievements.
 * Call `trigger(badgeId)` when the user performs an action.
 * The overlay fires only on first unlock; count increments every time.
 */
export function useBadges() {
  const firedRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const achievements = await window.statsAPI?.getAchievements();
    if (achievements) {
      for (const a of achievements) {
        firedRef.current.add(a.milestoneId);
      }
    }
  }, []);

  const trigger = useCallback(async (badgeId: string) => {
    await ensureLoaded();
    const badge = BADGES.find(b => b.id === badgeId);
    if (!badge) return;

    const isFirst = !firedRef.current.has(badgeId);
    firedRef.current.add(badgeId);

    // Persist (increments count if already exists)
    window.statsAPI?.addAchievement({
      milestoneId: badge.id,
      label: badge.label,
      emoji: badge.emoji,
      unlockedAt: Date.now(),
      count: 1,
    });

    // Only show overlay on first unlock
    if (isFirst) {
      partyBus.emit(PartyEvents.MILESTONE_TRIGGERED, badge);
    }
  }, [ensureLoaded]);

  return { trigger };
}
