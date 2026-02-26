import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { DATA_DIR } from './data-dir';

// ── Schedule types ──

export interface TaskSchedule {
  type: 'interval' | 'daily' | 'weekly' | 'monthly';
  intervalMinutes?: number;       // for 'interval'
  timeOfDay?: string;             // "HH:MM" for daily/weekly/monthly
  dayOfWeek?: number;             // 0=Sunday..6=Saturday for 'weekly'
  dayOfMonth?: number;            // 1-31 for 'monthly'
}

export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  model: string;
  cwd: string;
  yoloMode: boolean;
  schedule: TaskSchedule;
  enabled: boolean;
  lastRunAt?: number;
  createdAt: number;
}

export interface TaskRunRecord {
  taskId: string;
  timestamp: number;
}

interface SchedulerStoreSchema {
  tasks: ScheduledTask[];
  runHistory: TaskRunRecord[];
}

const store = new Store<SchedulerStoreSchema>({
  name: 'scheduler',
  cwd: DATA_DIR,
  defaults: {
    tasks: [],
    runHistory: [],
  },
});

export class SchedulerService {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /** Start all enabled task timers. Call once at app startup. */
  start(): void {
    for (const task of this.listTasks()) {
      if (task.enabled) this.scheduleNext(task);
    }
  }

  /** Stop all timers. */
  stop(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  // ── CRUD ──

  listTasks(): ScheduledTask[] {
    return store.get('tasks');
  }

  addTask(task: Omit<ScheduledTask, 'id' | 'createdAt'>): ScheduledTask {
    const newTask: ScheduledTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    const tasks = store.get('tasks');
    tasks.push(newTask);
    store.set('tasks', tasks);
    if (newTask.enabled) this.scheduleNext(newTask);
    return newTask;
  }

  updateTask(id: string, updates: Partial<Omit<ScheduledTask, 'id' | 'createdAt'>>): ScheduledTask | null {
    const tasks = store.get('tasks');
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...updates };
    store.set('tasks', tasks);
    // Reschedule
    this.clearTimer(id);
    if (tasks[idx].enabled) this.scheduleNext(tasks[idx]);
    return tasks[idx];
  }

  deleteTask(id: string): boolean {
    const tasks = store.get('tasks');
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) return false;
    store.set('tasks', filtered);
    this.clearTimer(id);
    return true;
  }

  setTaskEnabled(id: string, enabled: boolean): ScheduledTask | null {
    return this.updateTask(id, { enabled });
  }

  // ── Run history ──

  getRunHistory(taskId?: string): TaskRunRecord[] {
    const all = store.get('runHistory');
    return taskId ? all.filter(r => r.taskId === taskId) : all;
  }

  private recordRun(taskId: string): void {
    const history = store.get('runHistory');
    history.push({ taskId, timestamp: Date.now() });
    // Keep last 500 entries
    if (history.length > 500) history.splice(0, history.length - 500);
    store.set('runHistory', history);

    // Update lastRunAt on the task
    const tasks = store.get('tasks');
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      tasks[idx].lastRunAt = Date.now();
      store.set('tasks', tasks);
    }
  }

  // ── Timer engine ──

  getNextFireTime(task: ScheduledTask): Date | null {
    const now = new Date();
    const s = task.schedule;

    switch (s.type) {
      case 'interval': {
        const mins = s.intervalMinutes ?? 60;
        if (task.lastRunAt) {
          const next = new Date(task.lastRunAt + mins * 60_000);
          return next > now ? next : new Date(now.getTime() + 1000);
        }
        // First run: fire after one interval from now
        return new Date(now.getTime() + mins * 60_000);
      }

      case 'daily': {
        const [h, m] = (s.timeOfDay ?? '09:00').split(':').map(Number);
        const target = new Date(now);
        target.setHours(h, m, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        return target;
      }

      case 'weekly': {
        const [h, m] = (s.timeOfDay ?? '09:00').split(':').map(Number);
        const dow = s.dayOfWeek ?? 1; // Monday
        const target = new Date(now);
        target.setHours(h, m, 0, 0);
        const currentDow = target.getDay();
        let daysAhead = dow - currentDow;
        if (daysAhead < 0 || (daysAhead === 0 && target <= now)) daysAhead += 7;
        target.setDate(target.getDate() + daysAhead);
        return target;
      }

      case 'monthly': {
        const [h, m] = (s.timeOfDay ?? '09:00').split(':').map(Number);
        const dom = s.dayOfMonth ?? 1;
        const target = new Date(now);
        target.setDate(dom);
        target.setHours(h, m, 0, 0);
        if (target <= now) target.setMonth(target.getMonth() + 1);
        return target;
      }

      default:
        return null;
    }
  }

  /** Human-readable description of the schedule. */
  static describeSchedule(s: TaskSchedule): string {
    switch (s.type) {
      case 'interval': {
        const mins = s.intervalMinutes ?? 60;
        if (mins < 60) return `Every ${mins} minute${mins !== 1 ? 's' : ''}`;
        const hrs = mins / 60;
        return hrs === Math.floor(hrs)
          ? `Every ${hrs} hour${hrs !== 1 ? 's' : ''}`
          : `Every ${mins} minutes`;
      }
      case 'daily':
        return `Daily at ${s.timeOfDay ?? '09:00'}`;
      case 'weekly': {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `${days[s.dayOfWeek ?? 1]}s at ${s.timeOfDay ?? '09:00'}`;
      }
      case 'monthly':
        return `Monthly on day ${s.dayOfMonth ?? 1} at ${s.timeOfDay ?? '09:00'}`;
      default:
        return 'Unknown schedule';
    }
  }

  private scheduleNext(task: ScheduledTask): void {
    this.clearTimer(task.id);
    const nextFire = this.getNextFireTime(task);
    if (!nextFire) return;

    const delayMs = Math.max(nextFire.getTime() - Date.now(), 1000);
    // Cap setTimeout to ~24 days (max safe 32-bit int). Re-evaluate if longer.
    const maxDelay = 2_147_483_647;
    if (delayMs > maxDelay) {
      // Re-check later
      this.timers.set(task.id, setTimeout(() => this.scheduleNext(task), maxDelay));
      return;
    }

    this.timers.set(task.id, setTimeout(() => {
      this.fireTask(task.id);
    }, delayMs));
  }

  private fireTask(taskId: string): void {
    const tasks = store.get('tasks');
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.enabled) return;

    this.recordRun(taskId);

    // Notify renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('scheduler:taskFired', task);
    }

    // Schedule next occurrence
    this.scheduleNext(task);
  }

  private clearTimer(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
  }
}
