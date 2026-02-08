import { useState } from 'react';

interface GenericToolTileProps {
  title: string;
  data: Record<string, unknown>;
}

export default function GenericToolTile({ title, data }: GenericToolTileProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="glass-card w-full p-4"
      style={{ borderLeft: '4px solid var(--accent-gold)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span>⚙️</span>
        <span
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </span>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs cursor-pointer mb-2"
        style={{ color: 'var(--accent-blue)', background: 'none', border: 'none' }}
      >
        {expanded ? 'Hide data' : 'Show data'}
      </button>

      {/* JSON Data */}
      {expanded && (
        <pre
          className="text-xs font-mono overflow-x-auto rounded-lg p-3"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: 'var(--text-secondary)',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
