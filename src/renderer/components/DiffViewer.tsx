import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseDiff, Diff, Hunk, Decoration } from 'react-diff-view';
import type { ChangeData } from 'react-diff-view';
import 'react-diff-view/style/index.css';

interface DiffViewerProps {
  diffText: string;
  onComment?: (comment: string) => void;
}

interface SavedComment {
  id: number;
  fileName: string;
  lineNumber: number | null;
  lineContent: string;
  text: string;
}

interface PendingInput {
  fileName: string;
  lineNumber: number | null;
  lineContent: string;
}

function countChanges(hunks: { changes: { type: string }[] }[]): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const h of hunks) {
    for (const c of h.changes) {
      if (c.type === 'insert') added++;
      else if (c.type === 'delete') removed++;
    }
  }
  return { added, removed };
}

function getLineNumber(change: ChangeData): number | null {
  if ('lineNumber' in change && typeof change.lineNumber === 'number') return change.lineNumber;
  if ('newLineNumber' in change && typeof change.newLineNumber === 'number') return change.newLineNumber;
  if ('oldLineNumber' in change && typeof change.oldLineNumber === 'number') return change.oldLineNumber;
  return null;
}

function useViewType(): 'unified' | 'split' {
  const [wide, setWide] = useState(window.innerWidth >= 1000);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1000);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide ? 'split' : 'unified';
}

let nextId = 0;

export default function DiffViewer({ diffText, onComment }: DiffViewerProps) {
  const [comments, setComments] = useState<SavedComment[]>([]);
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const [inputText, setInputText] = useState('');
  const [collapsedFiles, setCollapsedFiles] = useState<Set<number>>(new Set());
  const viewType = useViewType();

  const files = useMemo(() => {
    try {
      return parseDiff(diffText, { nearbySequences: 'zip' });
    } catch {
      return [];
    }
  }, [diffText]);

  const handleAddComment = useCallback(() => {
    if (!inputText.trim() || !pendingInput) return;
    setComments((prev) => [...prev, {
      id: nextId++,
      fileName: pendingInput.fileName,
      lineNumber: pendingInput.lineNumber,
      lineContent: pendingInput.lineContent,
      text: inputText.trim(),
    }]);
    setPendingInput(null);
    setInputText('');
  }, [inputText, pendingInput]);

  const handleRemoveComment = useCallback((id: number) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleSendAll = useCallback(() => {
    if (!onComment || comments.length === 0) return;
    const msg = comments.map((c) => {
      const loc = c.lineNumber ? ` (line ${c.lineNumber})` : '';
      return `**\`${c.fileName.split('/').pop()}${loc}\`** → \`${c.lineContent.trim().slice(0, 60)}\`\n${c.text}`;
    }).join('\n\n---\n\n');
    onComment(`Please address these review comments:\n\n${msg}`);
    setComments([]);
  }, [comments, onComment]);

  const toggleCollapse = useCallback((fi: number) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fi)) next.delete(fi);
      else next.add(fi);
      return next;
    });
  }, []);

  if (files.length === 0) {
    return (
      <div className="text-sm text-[var(--text-secondary)] py-4 text-center">
        No changes to display
      </div>
    );
  }

  return (
    <div className="diff-viewer-container flex flex-col gap-2">
      {files.map((file, fi) => {
        const fileName = file.newPath === '/dev/null' ? file.oldPath : file.newPath;
        const friendlyName = fileName.split('/').pop() || fileName;
        const parentDir = fileName.split('/').slice(-3, -1).join('/');
        const { added, removed } = countChanges(file.hunks);
        const collapsed = collapsedFiles.has(fi);

        return (
          <div key={fi} className="rounded-lg overflow-hidden border border-[var(--border-color)]">
            {/* File header — clickable to collapse */}
            <button
              onClick={() => toggleCollapse(fi)}
              className="w-full px-3 py-2 flex items-center gap-2 text-xs font-mono cursor-pointer hover:bg-[rgba(255,255,255,0.03)] transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: collapsed ? 'none' : '1px solid var(--border-color)' }}
            >
              <span className="text-[var(--text-secondary)] text-[10px]">{collapsed ? '▸' : '▾'}</span>
              <span className="text-[var(--text-primary)] font-medium">{friendlyName}</span>
              {parentDir && <span className="text-[var(--text-secondary)]">{parentDir}</span>}
              <span className="ml-auto flex gap-2">
                {added > 0 && <span style={{ color: 'var(--accent-green)' }}>+{added}</span>}
                {removed > 0 && <span style={{ color: 'var(--accent-red)' }}>-{removed}</span>}
              </span>
            </button>

            {/* Diff hunks — collapsible */}
            {!collapsed && (
              <Diff
                viewType={viewType}
                diffType={file.type}
                hunks={file.hunks}
                gutterEvents={onComment ? {
                  onClick(e: { change: ChangeData }) {
                    setPendingInput({
                      lineContent: e.change.content,
                      lineNumber: getLineNumber(e.change),
                      fileName,
                    });
                    setInputText('');
                  },
                } as Record<string, unknown> : undefined}
              >
                {(hunks) =>
                  hunks.flatMap((hunk) => [
                    <Decoration key={'deco-' + hunk.content}>
                      <div
                        className="px-3 py-1 text-[10px] font-mono"
                        style={{ backgroundColor: 'rgba(168,85,247,0.08)', color: 'var(--accent-purple)' }}
                      >
                        {hunk.content}
                      </div>
                    </Decoration>,
                    <Hunk key={hunk.content} hunk={hunk} />,
                  ])
                }
              </Diff>
            )}
          </div>
        );
      })}

      {/* Inline comment input for the clicked line */}
      {pendingInput && (
        <div
          className="rounded-lg border overflow-hidden sticky bottom-0"
          style={{ borderColor: 'var(--accent-purple)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="px-3 py-2 text-xs font-mono border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(168,85,247,0.06)' }}>
            <span className="text-[var(--accent-purple)]">{pendingInput.fileName.split('/').pop()}</span>
            {pendingInput.lineNumber && (
              <span className="text-[var(--text-secondary)] ml-1">:{pendingInput.lineNumber}</span>
            )}
            <span className="text-[var(--text-secondary)] ml-2">→</span>
            <code className="ml-2 text-[var(--text-secondary)]">{pendingInput.lineContent.trim().slice(0, 80)}</code>
          </div>
          <div className="p-2 flex gap-2">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="What should change here?"
              autoFocus
              className="flex-1 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddComment();
                if (e.key === 'Escape') setPendingInput(null);
              }}
            />
            <button
              onClick={handleAddComment}
              disabled={!inputText.trim()}
              className="px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent-purple)', color: 'white' }}
            >
              Add
            </button>
            <button
              onClick={() => setPendingInput(null)}
              className="px-2 py-1.5 rounded-md text-xs cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Batched comments list + send all */}
      {comments.length > 0 && (
        <div className="rounded-lg border border-[var(--border-color)] overflow-hidden sticky bottom-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
            {comments.length} comment{comments.length !== 1 ? 's' : ''} queued
          </div>
          <div className="flex flex-col divide-y divide-[var(--border-color)] max-h-40 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="px-3 py-2 flex items-start gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="text-[var(--accent-purple)] font-mono">{c.fileName.split('/').pop()}</span>
                  {c.lineNumber && <span className="text-[var(--text-secondary)] font-mono">:{c.lineNumber}</span>}
                  <span className="text-[var(--text-secondary)] ml-1">→</span>
                  <code className="ml-1 text-[var(--text-secondary)]">{c.lineContent.trim().slice(0, 40)}</code>
                  <p className="text-[var(--text-primary)] mt-0.5">{c.text}</p>
                </div>
                <button
                  onClick={() => handleRemoveComment(c.id)}
                  className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--accent-red)] cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-[var(--border-color)] flex justify-end">
            <button
              onClick={handleSendAll}
              className="px-4 py-1.5 rounded-md text-xs font-bold cursor-pointer"
              style={{ backgroundColor: 'var(--accent-purple)', color: 'white' }}
            >
              Send All to Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
