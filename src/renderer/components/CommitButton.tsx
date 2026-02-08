import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { useSound } from '../hooks/useSound';

interface CommitButtonProps {
  changedFiles: string[];
  visible: boolean;
  onSendFeedback?: (feedback: string) => void;
}

type ModalStep = 'reels' | 'editor' | 'diff' | 'committing' | 'success' | 'error';

export default function CommitButton({ changedFiles, visible, onSendFeedback }: CommitButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{
              scale: [1, 1.05, 1],
              transition: {
                scale: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
              },
            }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onClick={() => setModalOpen(true)}
            className="w-full py-2 rounded-lg font-bold text-black cursor-pointer"
            style={{
              backgroundColor: 'var(--accent-gold)',
              boxShadow: '0 0 15px rgba(251,191,36,0.5), 0 0 30px rgba(251,191,36,0.3)',
            }}
          >
            🎰 COMMIT
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && (
          <CommitModal
            changedFiles={changedFiles}
            onClose={() => setModalOpen(false)}
            onSendFeedback={onSendFeedback}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface CommitModalProps {
  changedFiles: string[];
  onClose: () => void;
  onSendFeedback?: (feedback: string) => void;
}

function CommitModal({ changedFiles, onClose, onSendFeedback }: CommitModalProps) {
  const { play } = useSound();
  const [step, setStep] = useState<ModalStep>('reels');
  const [lockedCount, setLockedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [commitHash, setCommitHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const closingRef = useRef(false);

  // Reel animation: lock files one by one
  useEffect(() => {
    if (step !== 'reels') return;
    if (changedFiles.length === 0) {
      setStep('editor');
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setLockedCount(i);
      if (i >= changedFiles.length) {
        clearInterval(interval);
        setTimeout(() => setStep('editor'), 400);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [step, changedFiles.length]);

  const handleConfirm = useCallback(async () => {
    const msg = message.trim() || 'feat: session changes';
    setStep('committing');
    try {
      const result = await window.gitAPI.commit(msg, changedFiles);
      if (result.success) {
        setCommitHash(result.hash ?? '');
        setStep('success');
        play('commit');
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        // Auto-close after 2s
        setTimeout(() => {
          if (!closingRef.current) {
            closingRef.current = true;
            onClose();
          }
        }, 2000);
      } else {
        setErrorMsg('Commit failed. Please try again.');
        setStep('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }, [message, changedFiles, play, onClose]);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setStep('editor');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'committing') onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="glass-card p-6 w-full max-w-[700px] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[var(--accent-gold)] text-center tracking-wider">
          🎰 COMMIT
        </h2>

        {/* Step 1: Reels */}
        {(step === 'reels' || step === 'editor' || step === 'committing' || step === 'success') && (
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {changedFiles.map((file, i) => {
              const locked = i < lockedCount;
              return (
                <motion.div
                  key={file}
                  className="flex items-center gap-2 text-sm font-mono px-2 py-1 rounded"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  initial={{ y: -20, opacity: 0 }}
                  animate={{
                    y: locked ? 0 : [0, -8, 8, -4, 4, 0],
                    opacity: 1,
                  }}
                  transition={
                    locked
                      ? { type: 'spring', stiffness: 300 }
                      : { y: { repeat: Infinity, duration: 0.3 }, opacity: { duration: 0.2 } }
                  }
                >
                  <span className="w-5 text-center">
                    {locked ? (
                      <span style={{ color: 'var(--accent-green)' }}>✓</span>
                    ) : (
                      <span className="animate-pulse">⋯</span>
                    )}
                  </span>
                  <span className="truncate text-[var(--text-primary)]">{file}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Step 2: Editor */}
        {step === 'editor' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="feat: session changes"
              rows={3}
              className="w-full rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {changedFiles.length} file{changedFiles.length !== 1 ? 's' : ''} changed
            </p>
            <div className="flex gap-2 justify-between">
              <button
                onClick={async () => {
                  setDiffLoading(true);
                  setStep('diff');
                  const d = await window.gitAPI.diff();
                  setDiffContent(d);
                  setDiffLoading(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--accent-blue)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Review Changes
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-black cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent-green)' }}
                >
                  CONFIRM
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2b: Diff viewer */}
        {step === 'diff' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            {diffLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-[var(--text-secondary)]">
                Loading diff…
              </div>
            ) : (
              <pre
                className="text-xs font-mono overflow-auto rounded-lg p-3 max-h-[50vh]"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}
              >
                {diffContent.split('\n').map((line, i) => {
                  let color = 'var(--text-secondary)';
                  let bg = 'transparent';
                  if (line.startsWith('+') && !line.startsWith('+++')) {
                    color = 'var(--accent-green)';
                    bg = 'rgba(63,185,80,0.08)';
                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                    color = 'var(--accent-red)';
                    bg = 'rgba(248,81,73,0.08)';
                  } else if (line.startsWith('@@')) {
                    color = 'var(--accent-purple)';
                  } else if (line.startsWith('diff ') || line.startsWith('index ')) {
                    color = 'var(--text-secondary)';
                  }
                  return (
                    <div key={i} style={{ color, backgroundColor: bg }}>{line || ' '}</div>
                  );
                })}
              </pre>
            )}

            {/* Feedback textarea */}
            {onSendFeedback && (
              <div className="flex gap-2">
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Send feedback to chat…"
                  className="flex-1 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && feedback.trim()) {
                      onSendFeedback(feedback.trim());
                      onClose();
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (feedback.trim()) {
                      onSendFeedback(feedback.trim());
                      onClose();
                    }
                  }}
                  disabled={!feedback.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent-purple)', color: 'white' }}
                >
                  Send
                </button>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setStep('editor')}
                className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg text-sm font-bold text-black cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-green)' }}
              >
                CONFIRM
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Committing spinner */}
        {step === 'committing' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--accent-gold)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Committing...
            </p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2 py-4"
          >
            <AnimatePresence>
              {changedFiles.map((file, i) => (
                <motion.span
                  key={file}
                  className="text-xs font-mono"
                  style={{ color: 'var(--text-secondary)' }}
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 0, y: -20 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  {file}
                </motion.span>
              ))}
            </AnimatePresence>
            <span className="text-3xl">📦</span>
            <p className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>
              Committed!
            </p>
            {commitHash && (
              <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {commitHash.slice(0, 7)}
              </p>
            )}
          </motion.div>
        )}

        {/* Error */}
        {step === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            <p className="text-sm text-center" style={{ color: 'var(--accent-red)' }}>
              {errorMsg}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                CLOSE
              </button>
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg text-sm font-bold text-black cursor-pointer"
                style={{ backgroundColor: 'var(--accent-gold)' }}
              >
                RETRY
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
