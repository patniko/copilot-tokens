import { useRef, useEffect } from 'react';

export type TabActivity = 'idle' | 'active' | 'waiting';

export interface ProjectTab {
  id: string;
  cwd: string;
  gitBranch: string | null;
  changedFiles: string[];
  panels: { id: string; userPrompt: string | null; resetKey: number; initialEvents?: Record<string, unknown>[] }[];
  panelCounter: number;
  yoloMode: boolean;
}

interface TabBarProps {
  tabs: ProjectTab[];
  activeTabId: string;
  tabActivity: Record<string, TabActivity>;
  onSwitchTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
}

function basename(path: string): string {
  if (!path) return 'New Tab';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || path;
}

export default function TabBar({ tabs, activeTabId, tabActivity, onSwitchTab, onAddTab, onCloseTab }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  return (
    <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div ref={scrollRef} className="flex items-end overflow-x-auto flex-1 min-w-0 no-scrollbar" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const activity = tabActivity[tab.id] ?? 'idle';
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onSwitchTab(tab.id)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-[var(--border-color)] max-w-[180px] min-w-[80px] cursor-pointer transition-colors shrink-0 ${
                isActive
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-b-2 border-b-[var(--accent-purple)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]/50'
              }`}
            >
              {activity === 'active' && (
                <span className="relative flex h-2 w-2 shrink-0" title="Agent working">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
              {activity === 'waiting' && (
                <span className="relative flex h-2 w-2 shrink-0" title="Waiting for input">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
              )}
              {tab.yoloMode && <span className="text-[var(--accent-gold)] text-[8px]">⚡</span>}
              <span className="truncate flex-1 text-left">{basename(tab.cwd)}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity text-[10px] shrink-0"
                >
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={onAddTab}
        className="px-2 py-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer shrink-0 text-sm"
        title="New project tab"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        +
      </button>
    </div>
  );
}
