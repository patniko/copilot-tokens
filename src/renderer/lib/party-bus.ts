type Listener = (...args: unknown[]) => void;

const bus = new Map<string, Set<Listener>>();

export const partyBus = {
  on(event: string, fn: Listener): () => void {
    if (!bus.has(event)) bus.set(event, new Set());
    bus.get(event)!.add(fn);
    return () => { bus.get(event)?.delete(fn); };
  },

  off(event: string, fn: Listener): void {
    bus.get(event)?.delete(fn);
  },

  emit(event: string, ...args: unknown[]): void {
    bus.get(event)?.forEach((fn) => fn(...args));
  },

  clear(): void {
    bus.clear();
  },
};

// Well-known event names (not exhaustive — any string is valid)
export const PartyEvents = {
  // Token thresholds
  TOKENS_CROSSED: (n: number) => `tokens:crossed:${n}`,
  // Tool lifecycle
  TOOL_START: 'tool:start',
  TOOL_COMPLETE: 'tool:complete',
  TOOL_ERROR: 'tool:error',
  // Session
  SESSION_IDLE: 'session:idle',
  // Milestones
  MILESTONE_TRIGGERED: 'milestone:triggered',
  MILESTONE_DISMISSED: 'milestone:dismissed',
  // Packs
  PACK_SAVED: 'pack:saved',
  PACK_ACTIVATED: 'pack:activated',
  // Leveling
  LEVEL_UP: 'level:up',
} as const;
