import { useRef, useCallback, useEffect } from 'react';
import { partyBus, PartyEvents } from '../lib/party-bus';
import type { SessionEvent } from '../../main/stats-service';

/**
 * Records party-bus events during a session for later replay.
 * Call `save()` before session ends to persist the log.
 */
export function useSessionRecorder() {
  const eventsRef = useRef<SessionEvent[]>([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    eventsRef.current = [];
    startRef.current = Date.now();

    const tracked = [
      PartyEvents.TOOL_START,
      PartyEvents.TOOL_COMPLETE,
      PartyEvents.TOOL_ERROR,
      PartyEvents.MILESTONE_TRIGGERED,
      PartyEvents.SESSION_IDLE,
      PartyEvents.LEVEL_UP,
    ] as const;

    const handlers = tracked.map((eventType) => {
      const handler = (data?: unknown) => {
        eventsRef.current.push({
          type: eventType,
          timestamp: Date.now() - startRef.current,
          data: data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined,
        });
      };
      partyBus.on(eventType, handler);
      return { eventType, handler };
    });

    return () => {
      handlers.forEach(({ eventType, handler }) => partyBus.off(eventType, handler));
    };
  }, []);

  const save = useCallback(async () => {
    if (eventsRef.current.length === 0) return;
    await window.statsAPI?.saveSessionEvents(startRef.current, eventsRef.current);
  }, []);

  const reset = useCallback(() => {
    eventsRef.current = [];
    startRef.current = Date.now();
  }, []);

  return { save, reset, getEventCount: () => eventsRef.current.length };
}
