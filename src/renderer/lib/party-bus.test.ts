import { describe, it, expect, vi, beforeEach } from 'vitest';
import { partyBus, PartyEvents } from './party-bus';

describe('partyBus', () => {
  beforeEach(() => {
    partyBus.clear();
  });

  it('on() subscribes and emit() calls the listener with correct args', () => {
    const fn = vi.fn();
    partyBus.on('test', fn);
    partyBus.emit('test', 'hello');
    expect(fn).toHaveBeenCalledWith('hello');
  });

  it('on() returns an unsubscribe function that works', () => {
    const fn = vi.fn();
    const unsub = partyBus.on('test', fn);
    unsub();
    partyBus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('multiple listeners on the same event all get called', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    partyBus.on('test', fn1);
    partyBus.on('test', fn2);
    partyBus.emit('test', 42);
    expect(fn1).toHaveBeenCalledWith(42);
    expect(fn2).toHaveBeenCalledWith(42);
  });

  it('off() removes a specific listener', () => {
    const fn = vi.fn();
    partyBus.on('test', fn);
    partyBus.off('test', fn);
    partyBus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('emit() with no listeners does not throw', () => {
    expect(() => partyBus.emit('nonexistent', 1, 2, 3)).not.toThrow();
  });

  it('clear() removes all listeners for all events', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    partyBus.on('a', fn1);
    partyBus.on('b', fn2);
    partyBus.clear();
    partyBus.emit('a');
    partyBus.emit('b');
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('listeners receive multiple arguments', () => {
    const fn = vi.fn();
    partyBus.on('multi', fn);
    partyBus.emit('multi', 'a', 2, true, { key: 'val' });
    expect(fn).toHaveBeenCalledWith('a', 2, true, { key: 'val' });
  });

  it('unsubscribing one listener does not affect others', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const unsub1 = partyBus.on('test', fn1);
    partyBus.on('test', fn2);
    unsub1();
    partyBus.emit('test', 'data');
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledWith('data');
  });

  it('same listener reference added twice fires once (Set semantics)', () => {
    const fn = vi.fn();
    partyBus.on('test', fn);
    partyBus.on('test', fn);
    partyBus.emit('test');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('after clear(), previously registered listeners are not called', () => {
    const fn = vi.fn();
    partyBus.on('test', fn);
    partyBus.clear();
    partyBus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('on() for different events are isolated', () => {
    const fnA = vi.fn();
    const fnB = vi.fn();
    partyBus.on('eventA', fnA);
    partyBus.on('eventB', fnB);
    partyBus.emit('eventA', 'only-a');
    expect(fnA).toHaveBeenCalledWith('only-a');
    expect(fnB).not.toHaveBeenCalled();
  });
});

describe('PartyEvents', () => {
  it('TOKENS_CROSSED returns parameterized event names', () => {
    expect(PartyEvents.TOKENS_CROSSED(1000)).toBe('tokens:crossed:1000');
    expect(PartyEvents.TOKENS_CROSSED(5000)).toBe('tokens:crossed:5000');
    expect(PartyEvents.TOKENS_CROSSED(0)).toBe('tokens:crossed:0');
  });

  it('static string events have correct values', () => {
    expect(PartyEvents.TOOL_START).toBe('tool:start');
    expect(PartyEvents.TOOL_COMPLETE).toBe('tool:complete');
    expect(PartyEvents.TOOL_ERROR).toBe('tool:error');
    expect(PartyEvents.SESSION_IDLE).toBe('session:idle');
    expect(PartyEvents.MILESTONE_TRIGGERED).toBe('milestone:triggered');
    expect(PartyEvents.MILESTONE_DISMISSED).toBe('milestone:dismissed');
    expect(PartyEvents.PACK_SAVED).toBe('pack:saved');
    expect(PartyEvents.PACK_ACTIVATED).toBe('pack:activated');
    expect(PartyEvents.LEVEL_UP).toBe('level:up');
  });
});
