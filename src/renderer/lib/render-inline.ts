import { type ReactNode, createElement } from 'react';

/**
 * Render inline markdown: `code`, **bold**, *italic*
 * Shared across all tile components for consistent rendering.
 */
export function renderInline(text: string): ReactNode[] {
  // Pattern matches: `code`, **bold**, *italic*  (in that priority order)
  const regex = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[1] !== undefined) {
      // inline code
      parts.push(
        createElement('code', {
          key: key++,
          className: 'px-1 py-0.5 rounded text-[0.85em]',
          style: { backgroundColor: 'rgba(255,255,255,0.1)', fontFamily: 'monospace' },
        }, match[1]),
      );
    } else if (match[2] !== undefined) {
      // bold
      parts.push(createElement('strong', { key: key++ }, match[2]));
    } else if (match[3] !== undefined) {
      // italic
      parts.push(createElement('em', { key: key++ }, match[3]));
    }
    last = regex.lastIndex;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}
