import { useMemo } from 'react';
import Markdown from 'react-markdown';

interface MessageTileProps {
  content: string;
  isStreaming: boolean;
}

/**
 * Collapse single newlines to spaces (preserving double-newline paragraph breaks and code blocks).
 * Streaming deltas often insert `\n` mid-sentence which markdown renders as <br>.
 */
function normalizeNewlines(text: string): string {
  // Protect fenced code blocks from being modified
  const blocks: string[] = [];
  const placeholder = '\x00CB\x00';
  let normalized = text.replace(/```[\s\S]*?```/g, (match) => {
    blocks.push(match);
    return placeholder;
  });

  // Collapse single \n (not preceded/followed by another \n) into space
  normalized = normalized.replace(/([^\n])\n([^\n])/g, '$1 $2');

  // Restore code blocks
  let i = 0;
  normalized = normalized.replace(new RegExp(placeholder.replace(/\x00/g, '\\x00'), 'g'), () => blocks[i++]);

  return normalized;
}

export default function MessageTile({ content, isStreaming }: MessageTileProps) {
  const normalizedContent = useMemo(() => normalizeNewlines(content), [content]);
  return (
    <div className="w-full text-left overflow-hidden message-markdown" style={{ color: 'var(--text-primary)' }}>
      <Markdown
        components={{
          code({ className, children, ...props }) {
            const isBlock = className?.startsWith('language-');
            if (isBlock) {
              return (
                <pre
                  className="my-2 p-3 rounded-lg text-sm overflow-x-auto"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    fontFamily: 'monospace',
                    color: 'var(--accent-green)',
                  }}
                >
                  <code className={className} {...props}>{children}</code>
                </pre>
              );
            }
            return (
              <code
                className="px-1 py-0.5 rounded text-[0.85em]"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontFamily: 'monospace' }}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            // The <pre> is handled inside the code component above
            return <>{children}</>;
          },
        }}
      >
        {normalizedContent}
      </Markdown>
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
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
