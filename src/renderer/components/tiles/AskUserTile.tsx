import { useState } from 'react';
import { motion } from 'motion/react';
import { renderInline } from '../../lib/render-inline';

interface AskUserTileProps {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
  onRespond: (answer: string) => void;
  responded?: boolean;
  selectedAnswer?: string;
}

export default function AskUserTile({
  question,
  choices,
  allowFreeform = true,
  onRespond,
  responded,
  selectedAnswer,
}: AskUserTileProps) {
  const [freeformText, setFreeformText] = useState('');

  const handleChoice = (choice: string) => {
    if (responded) return;
    onRespond(choice);
  };

  const handleSubmitFreeform = () => {
    if (responded || !freeformText.trim()) return;
    onRespond(freeformText.trim());
  };

  return (
    <div
      className="glass-card w-full p-4 overflow-hidden"
      style={{ borderLeft: '4px solid var(--accent-gold)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span>💬</span>
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: 'var(--accent-gold)' }}
        >
          Question
        </span>
        {responded && (
          <span className="text-xs ml-auto" style={{ color: 'var(--accent-green)' }}>✓ Answered</span>
        )}
      </div>

      {/* Question */}
      <div
        className="text-sm mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        {renderInline(question)}
      </div>

      {/* Choices */}
      {choices && choices.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {choices.map((choice, i) => {
            const isSelected = responded && selectedAnswer === choice;
            return (
              <motion.button
                key={i}
                onClick={() => handleChoice(choice)}
                disabled={responded}
                whileHover={responded ? {} : { scale: 1.02 }}
                whileTap={responded ? {} : { scale: 0.98 }}
                className="text-left text-sm px-3 py-2 rounded-lg cursor-pointer"
                style={{
                  background: isSelected ? 'var(--accent-gold)' : 'var(--bg-secondary)',
                  color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                  border: `1px solid ${isSelected ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                  opacity: responded && !isSelected ? 0.5 : 1,
                  cursor: responded ? 'default' : 'pointer',
                }}
              >
                {renderInline(choice)}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Freeform input */}
      {allowFreeform && !responded && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={freeformText}
            onChange={(e) => setFreeformText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitFreeform()}
            placeholder="Type your answer…"
            className="flex-1 text-sm px-3 py-2 rounded-lg"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              outline: 'none',
            }}
          />
          <motion.button
            onClick={handleSubmitFreeform}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm px-4 py-2 rounded-lg cursor-pointer font-bold"
            style={{
              background: 'var(--accent-gold)',
              color: 'var(--bg-primary)',
              border: 'none',
              opacity: freeformText.trim() ? 1 : 0.5,
            }}
          >
            Send
          </motion.button>
        </div>
      )}

      {/* Show freeform answer after responding (when it wasn't a choice) */}
      {responded && selectedAnswer && (!choices || !choices.includes(selectedAnswer)) && (
        <div
          className="text-sm mt-2 px-3 py-2 rounded-lg"
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--accent-gold)',
          }}
        >
          <span style={{ color: 'var(--accent-green)', marginRight: 6 }}>✓</span>
          {renderInline(selectedAnswer)}
        </div>
      )}
    </div>
  );
}
