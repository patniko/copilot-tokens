import { buildDemoScript, type DemoStep } from './demo-session';

export class DemoReplayService {
  private steps: DemoStep[] = [];
  private stepIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private panelId = 'main';
  private onCompleteCallback: (() => void) | null = null;
  /** Delay multiplier per message_delta chunk (ms). Controls streaming speed. */
  private deltaDelay = 25;

  get isRunning(): boolean {
    return this.running;
  }

  set onComplete(cb: (() => void) | null) {
    this.onCompleteCallback = cb;
  }

  start(panelId: string): void {
    this.stop();
    this.panelId = panelId;
    this.steps = buildDemoScript();
    this.stepIndex = 0;
    this.running = true;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (!this.running || this.stepIndex >= this.steps.length) {
      this.running = false;
      this.onCompleteCallback?.();
      return;
    }

    const step = this.steps[this.stepIndex];
    this.timer = setTimeout(() => {
      if (!this.running) return;
      this.playStep(step);
      this.stepIndex++;
      this.scheduleNext();
    }, step.delay);
  }

  private playStep(step: DemoStep): void {
    const events = step.events;
    if (events.length === 0) return;

    // Check if this step contains streaming deltas
    const hasDeltas = events.some(e => e.type === 'assistant.message_delta');

    if (hasDeltas) {
      // Stagger deltas for streaming effect, emit non-deltas immediately
      let deltaIndex = 0;
      for (const event of events) {
        if (event.type === 'assistant.message_delta') {
          const delay = deltaIndex * this.deltaDelay;
          setTimeout(() => {
            if (!this.running) return;
            this.emit(event);
          }, delay);
          deltaIndex++;
        } else {
          // Final assistant.message — emit after all deltas
          const finalDelay = deltaIndex * this.deltaDelay + 50;
          setTimeout(() => {
            if (!this.running) return;
            this.emit(event);
          }, finalDelay);
        }
      }
    } else {
      // Emit all events in this step immediately
      for (const event of events) {
        this.emit(event);
      }
    }
  }

  private emit(event: Record<string, unknown>): void {
    // user.message events are handled by the ReelArea via the normal message flow,
    // but during demo mode we inject them directly as events
    window.copilotAPI?.emitDemoEvent(event, this.panelId);
  }
}
