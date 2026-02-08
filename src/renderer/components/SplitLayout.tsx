import { useState, useRef, useCallback, useEffect } from 'react';
import ReelArea from './ReelArea';
import PromptBar from './PromptBar';
import type { PermissionRequestData, PermissionDecision } from './PermissionDialog';

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
}

function ChatPanel({ panelId, userPrompt, onUsage, onSend, cwd, onBrowseCwd, permissionRequest, onPermissionRespond, resetKey, showClose, onClose }: ChatPanelProps) {
  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {showClose && (
        <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            Panel {panelId.split(':').pop()}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer text-xs px-1"
            title="Close split"
          >
            ✕
          </button>
        </div>
      )}
      <ReelArea key={resetKey} panelId={panelId} userPrompt={userPrompt} onUsage={onUsage} permissionRequest={permissionRequest} onPermissionRespond={onPermissionRespond} />
      <PromptBar panelId={panelId} onSend={onSend} cwd={cwd} onBrowseCwd={onBrowseCwd} />
    </div>
  );
}

interface SplitLayoutProps {
  isSplit: boolean;
  onCloseSplit: () => void;
  userPrompt: string | null;
  onUsage: (input: number, output: number) => void;
  onSend: (prompt: string) => void;
  cwd: string;
  onBrowseCwd: () => void;
  permissionRequest?: PermissionRequestData | null;
  onPermissionRespond?: (decision: PermissionDecision) => void;
  resetKey: number;
  /** Second panel gets its own prompt/reset state from parent */
  userPromptRight: string | null;
  onSendRight: (prompt: string) => void;
  resetKeyRight: number;
}

export default function SplitLayout({
  isSplit,
  onCloseSplit,
  userPrompt,
  onUsage,
  onSend,
  cwd,
  onBrowseCwd,
  permissionRequest,
  onPermissionRespond,
  resetKey,
  userPromptRight,
  onSendRight,
  resetKeyRight,
}: SplitLayoutProps) {
  const [splitRatio, setSplitRatio] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
    };
    const handleMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Single panel (no split)
  if (!isSplit) {
    return (
      <ChatPanel
        panelId="main"
        userPrompt={userPrompt}
        onUsage={onUsage}
        onSend={onSend}
        cwd={cwd}
        onBrowseCwd={onBrowseCwd}
        permissionRequest={permissionRequest}
        onPermissionRespond={onPermissionRespond}
        resetKey={resetKey}
      />
    );
  }

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div style={{ width: `${splitRatio * 100}%` }} className="flex flex-col overflow-hidden">
        <ChatPanel
          panelId="main"
          userPrompt={userPrompt}
          onUsage={onUsage}
          onSend={onSend}
          cwd={cwd}
          onBrowseCwd={onBrowseCwd}
          permissionRequest={permissionRequest}
          onPermissionRespond={onPermissionRespond}
          resetKey={resetKey}
          showClose={true}
          onClose={onCloseSplit}
        />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 shrink-0 bg-[var(--border-color)] hover:bg-[var(--accent-purple)] transition-colors cursor-col-resize relative group"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Right panel */}
      <div style={{ width: `${(1 - splitRatio) * 100}%` }} className="flex flex-col overflow-hidden">
        <ChatPanel
          panelId="split"
          userPrompt={userPromptRight}
          onUsage={onUsage}
          onSend={onSendRight}
          cwd={cwd}
          onBrowseCwd={onBrowseCwd}
          resetKey={resetKeyRight}
          showClose={true}
          onClose={onCloseSplit}
        />
      </div>
    </div>
  );
}
