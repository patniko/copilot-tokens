import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { useSound } from '../hooks/useSound';
import DiffViewer from './DiffViewer';

interface CommitButtonProps {
  changedFiles: string[];
  visible: boolean;
  onSendFeedback?: (feedback: string) => void;
  onCommitSuccess?: () => void;
  onFilesChanged?: () => void;
}

type ModalStep = 'editor' | 'diff' | 'committing' | 'success' | 'error';

export default function CommitButton({ changedFiles, visible, onSendFeedback, onCommitSuccess, onFilesChanged }: CommitButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const disabled = !visible;

  return (
    <>
      <motion.button
        animate={
          disabled
            ? { scale: 1 }
            : {
                scale: [1, 1.05, 1],
                transition: {
                  scale: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
                },
              }
        }
        onClick={() => !disabled && setModalOpen(true)}
        className={`px-8 py-2 rounded-lg font-bold text-black ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
        style={{
          backgroundColor: 'var(--accent-gold)',
          boxShadow: disabled ? 'none' : '0 0 15px rgba(251,191,36,0.5), 0 0 30px rgba(251,191,36,0.3)',
        }}
        disabled={disabled}
      >
        🎰 COMMIT
      </motion.button>

      <AnimatePresence>
        {modalOpen && (
          <CommitModal
            changedFiles={changedFiles}
            onClose={() => setModalOpen(false)}
            onSendFeedback={onSendFeedback}
            onCommitSuccess={onCommitSuccess}
            onFilesChanged={onFilesChanged}
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
  onCommitSuccess?: () => void;
  onFilesChanged?: () => void;
}

function CommitModal({ changedFiles, onClose, onSendFeedback, onCommitSuccess, onFilesChanged }: CommitModalProps) {
  const { play } = useSound();
  const [step, setStep] = useState<ModalStep>('editor');
  const [message, setMessage] = useState('');
  const [commitHash, setCommitHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [undoConfirm, setUndoConfirm] = useState<string | null>(null); // file path or '__all__'
  const [localFiles, setLocalFiles] = useState(changedFiles);
  const closingRef = useRef(false);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(autoCloseTimeoutRef.current);
  }, []);

  const handleUndo = useCallback(async (file: string) => {
    const result = await window.gitAPI.checkout(file);
    if (result.success) {
      setLocalFiles((prev) => prev.filter((f) => f !== file));
      onFilesChanged?.();
    }
    setUndoConfirm(null);
  }, [onFilesChanged]);

  const handleUndoAll = useCallback(async () => {
    const result = await window.gitAPI.checkoutAll();
    if (result.success) {
      setLocalFiles([]);
      onFilesChanged?.();
      onClose();
    }
    setUndoConfirm(null);
  }, [onFilesChanged, onClose]);

  const handleConfirm = useCallback(async () => {
    const msg = message.trim() || 'feat: session changes';
    setStep('committing');
    try {
      const result = await window.gitAPI.commit(msg, localFiles);
      if (result.success) {
        setCommitHash(result.hash ?? '');
        setStep('success');
        play('commit');
        onCommitSuccess?.();
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        autoCloseTimeoutRef.current = setTimeout(() => {
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
  }, [message, localFiles, play, onClose, onCommitSuccess]);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setStep('editor');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'committing') onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.12 }}
        className={`glass-card p-6 flex flex-col gap-4 ${step === 'diff' ? 'w-full h-full max-w-none max-h-none m-4 rounded-xl' : 'w-full max-w-[700px]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[var(--accent-gold)] text-center tracking-wider">
          🎰 COMMIT
        </h2>

        {/* Editor step */}
        {step === 'editor' && (
          <div className="flex flex-col gap-3">
            {/* File list with undo buttons */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {localFiles.map((file) => (
                <div
                  key={file}
                  className="flex items-center gap-2 text-sm font-mono px-2 py-1 rounded group"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                >
                  <span className="w-5 text-center" style={{ color: 'var(--accent-green)' }}>✓</span>
                  <span className="truncate text-[var(--text-primary)] flex-1">{file}</span>
                  {undoConfirm === file ? (
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-[var(--text-secondary)]">Revert?</span>
                      <button
                        onClick={() => handleUndo(file)}
                        className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-bold"
                        style={{ backgroundColor: 'var(--accent-red)', color: 'white' }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setUndoConfirm(null)}
                        className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer text-[var(--text-secondary)]"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setUndoConfirm(file)}
                      className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-secondary)] hover:text-[var(--accent-red)]"
                    >
                      Undo
                    </button>
                  )}
                </div>
              ))}
            </div>

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
              {localFiles.length} file{localFiles.length !== 1 ? 's' : ''} changed
            </p>

            {/* Undo All confirmation */}
            {undoConfirm === '__all__' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-red)' }}>
                <span className="text-[var(--accent-red)] font-bold">Revert all changes?</span>
                <span className="text-[var(--text-secondary)]">This cannot be undone.</span>
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={handleUndoAll}
                    className="px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-red)', color: 'white' }}
                  >
                    Yes, revert all
                  </button>
                  <button
                    onClick={() => setUndoConfirm(null)}
                    className="px-2 py-1 rounded text-[10px] cursor-pointer text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
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
                {localFiles.length > 1 && undoConfirm !== '__all__' && (
                  <button
                    onClick={() => setUndoConfirm('__all__')}
                    className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--accent-red)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    Undo All
                  </button>
                )}
              </div>
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
                  disabled={localFiles.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-black cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent-green)' }}
                >
                  CONFIRM
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diff viewer */}
        {step === 'diff' && (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {diffLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-[var(--text-secondary)]">
                Loading diff…
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto rounded-lg">
                <DiffViewer
                  diffText={diffContent}
                  onComment={onSendFeedback ? (comment) => { onSendFeedback(comment); onClose(); } : undefined}
                />
              </div>
            )}

            <div className="flex gap-2 justify-between">
              <button
                onClick={() => setStep('editor')}
                className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                ← Back
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Committing spinner */}
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
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="text-3xl">📦</span>
            <p className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>
              Committed!
            </p>
            {commitHash && (
              <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {commitHash.slice(0, 7)}
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4">
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
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
