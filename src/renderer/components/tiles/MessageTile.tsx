import { type ReactNode } from 'react';

interface MessageTileProps {
  content: string;
  isStreaming: boolean;
}

function parseInlineCode(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(
      <code
        key={key++}
        className="px-1.5 py-0.5 rounded text-sm"
        style={{
          backgroundColor: 'rgba(255,255,255,0.1)',
          fontFamily: 'monospace',
        }}
      >
        {match[1]}
      </code>,
    );
    last = regex.lastIndex;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

function renderContent(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > last) {
      blocks.push(
        <span key={key++}>{parseInlineCode(content.slice(last, match.index))}</span>,
      );
    }
    blocks.push(
      <pre
        key={key++}
        className="my-2 p-3 rounded-lg text-sm overflow-x-auto"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          border: '1px solid var(--border-color)',
          fontFamily: 'monospace',
          color: 'var(--accent-green)',
        }}
      >
        <code>{match[2]}</code>
      </pre>,
    );
    last = codeBlockRegex.lastIndex;
  }
  if (last < content.length) {
    blocks.push(
      <span key={key++}>{parseInlineCode(content.slice(last))}</span>,
    );
  }
  return blocks;
}

export default function MessageTile({ content, isStreaming }: MessageTileProps) {
  return (
    <div className="w-full text-left" style={{ color: 'var(--text-primary)' }}>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {renderContent(content)}
        {isStreaming && (
          <span
            className="streaming-cursor"
            style={{
              color: 'var(--accent-purple)',
              textShadow: '0 0 8px var(--accent-purple)',
              animation: 'blink-cursor 500ms steps(1) infinite',
            }}
          >
            ▌
          </span>
        )}
      </div>
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
