import { motion, AnimatePresence } from 'motion/react';
import { useCallback, useState } from 'react';

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

function getIntention(request: PermissionRequestData): string | null {
  const v = request.intention ?? request.description ?? request.title;
  return v ? String(v) : null;
}

/** Fields to skip when building a fallback summary */
const SKIP_FIELDS = new Set(['kind', 'toolCallId', 'cwd', 'intention', 'description', 'title',
  'canOfferSessionApproval', 'hasWriteFileRedirection', 'commands', 'fileName', 'diff', 'newFileContents']);

function getDetail(request: PermissionRequestData): string {
  if (request.kind === 'shell') {
    return String(request.fullCommandText ?? request.command ?? request.cmd ?? request.script ?? '');
  }
  if (request.kind === 'write' || request.kind === 'read') {
    const paths = request.possiblePaths as string[] | undefined;
    if (paths?.length) return paths.join('\n');
    return String(request.fileName ?? request.path ?? request.file ?? request.filePath ?? request.fullCommandText ?? '');
  }
  if (request.kind === 'url') {
    const urls = request.possibleUrls as string[] | undefined;
    if (urls?.length) return urls.join('\n');
    return String(request.url ?? '');
  }
  if (request.kind === 'mcp') {
    const server = request.serverName ?? request.server ?? '';
    const tool = request.tool ?? request.method ?? request.name ?? '';
    if (server && tool) return `${server} → ${tool}`;
    return String(server || tool || '');
  }
  // Fallback: show key fields as a readable summary
  const parts: string[] = [];
  for (const [k, v] of Object.entries(request)) {
    if (SKIP_FIELDS.has(k)) continue;
    if (v === null || v === undefined || v === '' || v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object') continue;
    parts.push(`${k}: ${String(v)}`);
  }
  return parts.join('\n');
}

const shakeKeyframes = {
  x: [0, -3, 3, -2, 2, -1, 1, 0],
};

export default function PermissionDialog({ request, onRespond }: PermissionDialogProps) {
  const handleAllow = useCallback(() => onRespond('allow'), [onRespond]);
  const handleAlways = useCallback(() => onRespond('always'), [onRespond]);
  const handleDeny = useCallback(() => onRespond('deny'), [onRespond]);
  const [showRaw, setShowRaw] = useState(false);

  const meta = request ? (kindMeta[request.kind] ?? { icon: '❓', label: request.kind, color: 'var(--text-secondary)' }) : null;
  const intention = request ? getIntention(request) : null;
  const detail = request ? getDetail(request) : '';

  return (
    <AnimatePresence>
      {request && meta && (
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -10, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <motion.div
            animate={shakeKeyframes}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: meta.color, background: 'var(--bg-secondary)' }}
          >
            {/* Header */}
            <div className="px-4 py-2.5 flex items-center gap-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-lg">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                {intention && (
                  <span className="text-xs text-[var(--text-secondary)] ml-2">— {intention}</span>
                )}
              </div>
            </div>

            {/* Detail or raw payload toggle */}
            <div className="px-4 py-2">
              {detail ? (
                <div
                  className="font-mono text-xs px-3 py-2 rounded-md overflow-x-auto whitespace-pre-wrap break-all max-h-28 overflow-y-auto"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {detail}
                </div>
              ) : showRaw ? (
                <pre
                  className="font-mono text-xs px-3 py-2 rounded-md overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
                >
                  {JSON.stringify(request, null, 2)}
                </pre>
              ) : (
                <button
                  onClick={() => setShowRaw(true)}
                  className="text-xs cursor-pointer"
                  style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
                >
                  Show details
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 py-2.5 flex items-center justify-end gap-2">
              <button
                onClick={handleDeny}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:border-[var(--accent-red)] transition-colors cursor-pointer"
              >
                Deny
              </button>
              <button
                onClick={handleAllow}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-green)] hover:text-[var(--accent-green)] transition-colors cursor-pointer"
              >
                Allow
              </button>
              <button
                onClick={handleAlways}
                className="px-3 py-1.5 text-xs font-bold rounded-md text-black cursor-pointer"
                style={{ background: meta.color }}
              >
                Always Allow
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
