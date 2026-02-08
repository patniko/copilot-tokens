import { useState, useRef, useCallback, useEffect } from 'react';
import ReelArea from './ReelArea';
import PromptBar from './PromptBar';
import type { PermissionRequestData, PermissionDecision } from './PermissionDialog';

export interface PanelData {
  id: string;
  userPrompt: string | null;
  resetKey: number;
}

interface ChatPanelProps {
  panelId: string;
  userPrompt: string | null;
  onUsage?: (input: number, output: number) => void;
  onSend: (prompt: string) => void;
  cwd: string;
  onBrowseCwd: () => void;
  permissionRequest?: PermissionRequestData | null;
  onPermissionRespond?: (decision: PermissionDecision) => void;
  resetKey: number;
  showClose?: boolean;
  onClose?: () => void;
  onNewSession: () => void;
  onLoadSession: () => void;
  onSplitSession: () => void;
}

function ChatPanel({ panelId, userPrompt, onUsage, onSend, cwd, onBrowseCwd, permissionRequest, onPermissionRespond, resetKey, showClose, onClose, onNewSession, onLoadSession, onSplitSession }: ChatPanelProps) {
  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {showClose && (
        <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            {panelId === 'main' ? 'Main' : panelId.replace('split-', '#')}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer text-xs px-1"
            title="Close panel"
          >
            ✕
          </button>
        </div>
      )}
      <ReelArea key={resetKey} panelId={panelId} userPrompt={userPrompt} onUsage={onUsage} permissionRequest={permissionRequest} onPermissionRespond={onPermissionRespond} />
      <PromptBar panelId={panelId} onSend={onSend} cwd={cwd} onBrowseCwd={onBrowseCwd} onNewSession={onNewSession} onLoadSession={onLoadSession} onSplitSession={onSplitSession} />
    </div>
  );
}

interface SplitLayoutProps {
  panels: PanelData[];
  onUsage: (input: number, output: number) => void;
  onPanelSend: (panelId: string, prompt: string) => void;
  cwd: string;
  onBrowseCwd: () => void;
  permissionRequest?: PermissionRequestData | null;
  onPermissionRespond?: (decision: PermissionDecision) => void;
  onNewSession: () => void;
  onLoadSession: () => void;
  onSplitSession: () => void;
  onClosePanel: (panelId: string) => void;
}

export default function SplitLayout({
  panels,
  onUsage,
  onPanelSend,
  cwd,
  onBrowseCwd,
  permissionRequest,
  onPermissionRespond,
  onNewSession,
  onLoadSession,
  onSplitSession,
  onClosePanel,
}: SplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<number[]>([]);
  const dragState = useRef<{ index: number; startX: number; startSizes: number[] } | null>(null);

  // Keep sizes in sync with panel count — equal distribution on add/remove
  useEffect(() => {
    setSizes(panels.map(() => 1 / panels.length));
  }, [panels.length]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handleIndex: number) => {
    e.preventDefault();
    dragState.current = { index: handleIndex, startX: e.clientX, startSizes: [...sizes] };
  }, [sizes]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current || !containerRef.current) return;
      const { index, startX, startSizes } = dragState.current;
      const rect = containerRef.current.getBoundingClientRect();
      const delta = (e.clientX - startX) / rect.width;
      const newSizes = [...startSizes];
      const minSize = 0.15;
      const left = Math.max(minSize, newSizes[index] + delta);
      const right = Math.max(minSize, newSizes[index + 1] - delta);
      const total = newSizes[index] + newSizes[index + 1];
      newSizes[index] = Math.min(left, total - minSize);
      newSizes[index + 1] = total - newSizes[index];
      setSizes(newSizes);
    };
    const handleMouseUp = () => { dragState.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const isSplit = panels.length > 1;

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
      {panels.map((panel, i) => (
        <div key={panel.id} className="contents">
          <div style={{ width: `${(sizes[i] ?? 1 / panels.length) * 100}%` }} className="flex flex-col min-h-0 overflow-hidden">
            <ChatPanel
              panelId={panel.id}
              userPrompt={panel.userPrompt}
              onUsage={onUsage}
              onSend={(prompt) => onPanelSend(panel.id, prompt)}
              cwd={cwd}
              onBrowseCwd={onBrowseCwd}
              permissionRequest={i === 0 ? permissionRequest : undefined}
              onPermissionRespond={i === 0 ? onPermissionRespond : undefined}
              resetKey={panel.resetKey}
              showClose={isSplit}
              onClose={() => onClosePanel(panel.id)}
              onNewSession={onNewSession}
              onLoadSession={onLoadSession}
              onSplitSession={onSplitSession}
            />
          </div>
          {i < panels.length - 1 && (
            <div
              onMouseDown={(e) => handleMouseDown(e, i)}
              className="w-1 shrink-0 bg-[var(--border-color)] hover:bg-[var(--accent-purple)] transition-colors cursor-col-resize relative"
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
