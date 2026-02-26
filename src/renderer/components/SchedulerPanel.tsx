import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type ScheduleType = 'interval' | 'daily' | 'weekly' | 'monthly';

interface TaskSchedule {
  type: ScheduleType;
  intervalMinutes?: number;
  timeOfDay?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

interface ScheduledTask {
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

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function describeSchedule(s: TaskSchedule): string {
  switch (s.type) {
    case 'interval': {
      const mins = s.intervalMinutes ?? 60;
      if (mins < 60) return `Every ${mins}m`;
      const hrs = mins / 60;
      return hrs === Math.floor(hrs) ? `Every ${hrs}h` : `Every ${mins}m`;
    }
    case 'daily':
      return `Daily at ${s.timeOfDay ?? '09:00'}`;
    case 'weekly':
      return `${DAYS_OF_WEEK[s.dayOfWeek ?? 1]}s at ${s.timeOfDay ?? '09:00'}`;
    case 'monthly':
      return `Day ${s.dayOfMonth ?? 1} at ${s.timeOfDay ?? '09:00'}`;
    default:
      return 'Unknown';
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff < 0) return 'now';
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)}s`;
  if (diff < 3600_000) return `in ${Math.ceil(diff / 60_000)}m`;
  if (diff < 86400_000) {
    const hrs = Math.floor(diff / 3600_000);
    const mins = Math.ceil((diff % 3600_000) / 60_000);
    return mins > 0 ? `in ${hrs}h ${mins}m` : `in ${hrs}h`;
  }
  return `in ${Math.floor(diff / 86400_000)}d`;
}

const emptySchedule: TaskSchedule = { type: 'interval', intervalMinutes: 60 };

interface SchedulerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: { id: string; name: string }[];
  currentModel: string;
  currentCwd: string;
}

export default function SchedulerPanel({ isOpen, onClose, availableModels, currentModel, currentCwd }: SchedulerPanelProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [editingTask, setEditingTask] = useState<Partial<ScheduledTask> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const loadTasks = useCallback(() => {
    window.schedulerAPI?.list().then(setTasks).catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) loadTasks();
  }, [isOpen, loadTasks]);

  const handleSave = useCallback(async () => {
    if (!editingTask || !editingTask.name || !editingTask.prompt) return;
    const taskData = {
      name: editingTask.name,
      prompt: editingTask.prompt,
      model: editingTask.model || currentModel,
      cwd: editingTask.cwd || currentCwd,
      yoloMode: editingTask.yoloMode ?? true,
      schedule: editingTask.schedule || emptySchedule,
      enabled: editingTask.enabled ?? true,
    };
    if (isNew) {
      await window.schedulerAPI?.add(taskData);
    } else if (editingTask.id) {
      await window.schedulerAPI?.update(editingTask.id, taskData);
    }
    setEditingTask(null);
    loadTasks();
  }, [editingTask, isNew, currentModel, currentCwd, loadTasks]);

  const handleDelete = useCallback(async (id: string) => {
    await window.schedulerAPI?.delete(id);
    loadTasks();
  }, [loadTasks]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    await window.schedulerAPI?.setEnabled(id, enabled);
    loadTasks();
  }, [loadTasks]);

  const handleRunNow = useCallback(async (id: string) => {
    await window.schedulerAPI?.runNow(id);
    onClose();
  }, [onClose]);

  const startNew = useCallback(() => {
    setEditingTask({
      name: '',
      prompt: '',
      model: currentModel,
      cwd: currentCwd,
      yoloMode: true,
      schedule: { ...emptySchedule },
      enabled: true,
    });
    setIsNew(true);
  }, [currentModel, currentCwd]);

  const startEdit = useCallback((task: ScheduledTask) => {
    setEditingTask({ ...task });
    setIsNew(false);
  }, []);

  const handleBrowseCwd = useCallback(async () => {
    const dir = await window.cwdAPI?.browse();
    if (dir) {
      setEditingTask(prev => prev ? { ...prev, cwd: dir } : prev);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="w-[640px] max-h-[85vh] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              ⏰ Scheduled Tasks
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={startNew}
                className="px-3 py-1 text-xs rounded bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/30 transition-colors cursor-pointer font-medium"
              >
                + New Task
              </button>
              <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-lg">✕</button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {editingTask ? (
              <TaskEditor
                task={editingTask}
                isNew={isNew}
                onChange={setEditingTask}
                onSave={handleSave}
                onCancel={() => setEditingTask(null)}
                onBrowseCwd={handleBrowseCwd}
                availableModels={availableModels}
              />
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <div className="text-3xl mb-3">⏰</div>
                <p className="text-sm">No scheduled tasks yet.</p>
                <p className="text-xs mt-1">Create one to auto-run prompts on a schedule.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={() => startEdit(task)}
                    onToggle={(enabled) => handleToggle(task.id, enabled)}
                    onDelete={() => handleDelete(task.id)}
                    onRunNow={() => handleRunNow(task.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Task list row ──

function TaskRow({ task, onEdit, onToggle, onDelete, onRunNow }: {
  task: ScheduledTask;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onRunNow: () => void;
}) {
  const [nextFire, setNextFire] = useState<number | null>(null);

  useEffect(() => {
    if (!task.enabled) { setNextFire(null); return; }
    let cancelled = false;
    const fetch = () => {
      window.schedulerAPI?.getNextFireTime(task.id).then((ts) => {
        if (!cancelled) setNextFire(ts);
      });
    };
    fetch();
    const interval = setInterval(fetch, 30_000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [task.id, task.enabled, task.lastRunAt]);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
      task.enabled
        ? 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
        : 'border-[var(--border-color)]/50 bg-[var(--bg-secondary)]/50 opacity-60'
    }`}>
      {/* Toggle */}
      <button
        onClick={() => onToggle(!task.enabled)}
        className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer shrink-0 ${
          task.enabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--text-secondary)]/30'
        }`}
      >
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
          task.enabled ? 'left-4' : 'left-0.5'
        }`} />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-primary)] truncate">{task.name}</span>
          {task.yoloMode && <span className="text-[8px] text-[var(--accent-gold)]">⚡YOLO</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] mt-0.5">
          <span>📅 {describeSchedule(task.schedule)}</span>
          <span>·</span>
          <span className="truncate max-w-[120px]">📁 {task.cwd.split('/').pop() || task.cwd}</span>
        </div>
        {/* Last run / Next run row */}
        <div className="flex items-center gap-3 text-[10px] mt-1">
          {task.lastRunAt && (
            <span className="text-[var(--text-secondary)]">
              Last run: <span className="text-[var(--text-primary)]">{timeAgo(task.lastRunAt)}</span>
            </span>
          )}
          {task.enabled && nextFire && (
            <span className="text-[var(--text-secondary)]">
              Next: <span className="text-[var(--accent-purple)]">{timeUntil(nextFire)}</span>
            </span>
          )}
          {!task.enabled && (
            <span className="text-[var(--text-secondary)] italic">Paused</span>
          )}
        </div>
      </div>

      {/* Run now */}
      <button
        onClick={onRunNow}
        className="text-[var(--text-secondary)] hover:text-[var(--accent-green)] transition-colors cursor-pointer shrink-0 p-1 rounded hover:bg-[var(--accent-green)]/10"
        title="Run now"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer text-xs px-1 shrink-0"
        title="Delete task"
      >
        🗑
      </button>
    </div>
  );
}

// ── Task editor form ──

function TaskEditor({ task, isNew, onChange, onSave, onCancel, onBrowseCwd, availableModels }: {
  task: Partial<ScheduledTask>;
  isNew: boolean;
  onChange: (task: Partial<ScheduledTask>) => void;
  onSave: () => void;
  onCancel: () => void;
  onBrowseCwd: () => void;
  availableModels: { id: string; name: string }[];
}) {
  const schedule = task.schedule || emptySchedule;

  const updateSchedule = (updates: Partial<TaskSchedule>) => {
    onChange({ ...task, schedule: { ...schedule, ...updates } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
          {isNew ? 'New Task' : 'Edit Task'}
        </h3>
        <button onClick={onCancel} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs cursor-pointer">← Back</button>
      </div>

      {/* Name */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Name</label>
        <input
          type="text"
          value={task.name || ''}
          onChange={e => onChange({ ...task, name: e.target.value })}
          placeholder="e.g. Run tests, Code review..."
          className="w-full px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-purple)]"
        />
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Prompt</label>
        <textarea
          value={task.prompt || ''}
          onChange={e => onChange({ ...task, prompt: e.target.value })}
          placeholder="What should the agent do?"
          rows={3}
          className="w-full px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-purple)] resize-none"
        />
      </div>

      {/* Model + CWD row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Model</label>
          <select
            value={task.model || ''}
            onChange={e => onChange({ ...task, model: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)] cursor-pointer"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Working Directory</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={task.cwd || ''}
              onChange={e => onChange({ ...task, cwd: e.target.value })}
              className="flex-1 px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)] truncate"
              readOnly
            />
            <button
              onClick={onBrowseCwd}
              className="px-2 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              📁
            </button>
          </div>
        </div>
      </div>

      {/* YOLO toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange({ ...task, yoloMode: !task.yoloMode })}
          className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${
            task.yoloMode ? 'bg-[var(--accent-gold)]' : 'bg-[var(--text-secondary)]/30'
          }`}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            task.yoloMode ? 'left-4' : 'left-0.5'
          }`} />
        </button>
        <span className="text-xs text-[var(--text-secondary)]">
          ⚡ YOLO Mode {task.yoloMode ? <span className="text-[var(--accent-gold)]">(ON)</span> : '(OFF)'}
        </span>
      </div>

      {/* Schedule */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-2">Schedule</label>
        <div className="flex gap-2 mb-3">
          {(['interval', 'daily', 'weekly', 'monthly'] as ScheduleType[]).map(type => (
            <button
              key={type}
              onClick={() => updateSchedule({ type })}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer capitalize ${
                schedule.type === type
                  ? 'border-[var(--accent-purple)] bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]'
                  : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Schedule-specific fields */}
        <div className="flex gap-3 items-end">
          {schedule.type === 'interval' && (
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] mb-1">Every (minutes)</label>
              <input
                type="number"
                min={1}
                value={schedule.intervalMinutes ?? 60}
                onChange={e => updateSchedule({ intervalMinutes: Math.max(1, parseInt(e.target.value) || 60) })}
                className="w-24 px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)]"
              />
            </div>
          )}

          {(schedule.type === 'daily' || schedule.type === 'weekly' || schedule.type === 'monthly') && (
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] mb-1">Time</label>
              <input
                type="time"
                value={schedule.timeOfDay ?? '09:00'}
                onChange={e => updateSchedule({ timeOfDay: e.target.value })}
                className="px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)]"
              />
            </div>
          )}

          {schedule.type === 'weekly' && (
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] mb-1">Day</label>
              <select
                value={schedule.dayOfWeek ?? 1}
                onChange={e => updateSchedule({ dayOfWeek: parseInt(e.target.value) })}
                className="px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)] cursor-pointer"
              >
                {DAYS_OF_WEEK.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
            </div>
          )}

          {schedule.type === 'monthly' && (
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] mb-1">Day of month</label>
              <input
                type="number"
                min={1}
                max={31}
                value={schedule.dayOfMonth ?? 1}
                onChange={e => updateSchedule({ dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
                className="w-20 px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)]"
              />
            </div>
          )}
        </div>

        <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
          📅 {describeSchedule(schedule)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={!task.name || !task.prompt}
          className="flex-1 px-4 py-2 text-xs font-bold rounded-lg bg-[var(--accent-purple)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isNew ? 'Create Task' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
