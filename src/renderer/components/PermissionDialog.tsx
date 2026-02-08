import { motion, AnimatePresence } from 'motion/react';
import { useCallback } from 'react';

export interface PermissionRequestData {
  kind: 'shell' | 'write' | 'mcp' | 'read' | 'url';
  toolCallId?: string;
  cwd?: string;
  [key: string]: unknown;
}

export type PermissionDecision = 'allow' | 'deny' | 'always';

interface PermissionDialogProps {
  request: PermissionRequestData | null;
  onRespond: (decision: PermissionDecision) => void;
}

const kindMeta: Record<string, { icon: string; label: string; color: string }> = {
  shell: { icon: '⚡', label: 'Run Shell Command', color: 'var(--accent-red)' },
  write: { icon: '✏️', label: 'Write File', color: 'var(--accent-gold)' },
  read:  { icon: '📖', label: 'Read File', color: 'var(--accent-blue)' },
  mcp:   { icon: '🔌', label: 'MCP Server Call', color: 'var(--accent-purple)' },
  url:   { icon: '🌐', label: 'Fetch URL', color: 'var(--accent-green)' },
};

function getDetail(request: PermissionRequestData): string {
  if (request.kind === 'shell') {
    return String(request.command ?? request.cmd ?? request.script ?? '');
  }
  if (request.kind === 'write' || request.kind === 'read') {
    return String(request.path ?? request.file ?? request.filePath ?? '');
  }
  if (request.kind === 'url') {
    return String(request.url ?? '');
  }
  if (request.kind === 'mcp') {
    return String(request.serverName ?? request.tool ?? request.method ?? '');
  }
  const extra = Object.entries(request)
    .filter(([k]) => !['kind', 'toolCallId', 'cwd'].includes(k))
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
  return extra || '(no details)';
}

function truncatePath(p: string, max = 50): string {
  if (p.length <= max) return p;
  return '…' + p.slice(-max + 1);
}

export default function PermissionDialog({ request, onRespond }: PermissionDialogProps) {
  const handleAllow = useCallback(() => onRespond('allow'), [onRespond]);
  const handleAlways = useCallback(() => onRespond('always'), [onRespond]);
  const handleDeny = useCallback(() => onRespond('deny'), [onRespond]);

  const meta = request ? (kindMeta[request.kind] ?? { icon: '❓', label: request.kind, color: 'var(--text-secondary)' }) : null;
  const detail = request ? getDetail(request) : '';
  const cwdLabel = request?.cwd ? truncatePath(request.cwd) : 'project';

  return (
    <AnimatePresence>
      {request && meta && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-card w-full max-w-md overflow-hidden"
              style={{ borderColor: meta.color, borderWidth: '1px' }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div
                className="px-5 py-3 flex items-center gap-3 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
              >
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: meta.color }}>
                    Permission Required
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">{meta.label}</p>
                </div>
              </div>

              {/* Detail */}
              <div className="px-5 py-4">
                <div
                  className="font-mono text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {detail || JSON.stringify(request, null, 2)}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-3 flex flex-col gap-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleDeny}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:border-[var(--accent-red)] transition-colors cursor-pointer"
                  >
                    Deny
                  </button>
                  <button
                    onClick={handleAllow}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-green)] hover:text-[var(--accent-green)] transition-colors cursor-pointer"
                  >
                    Allow Once
                  </button>
                  <button
                    onClick={handleAlways}
                    className="px-4 py-2 text-sm font-bold rounded-lg text-black cursor-pointer"
                    style={{ background: meta.color }}
                    title={`Always allow ${request.kind} in ${cwdLabel}`}
                  >
                    Always Allow in Project
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
