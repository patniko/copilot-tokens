import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSound } from '../hooks/useSound';

interface Attachment {
  path: string;
  name: string;
  previewUrl: string;
}

interface PromptBarProps {
  panelId?: string;
  onSend?: (prompt: string, attachments?: { path: string }[]) => void;
  onGeneratingChange?: (generating: boolean) => void;
  cwd?: string;
  onBrowseCwd?: () => void;
  onNewSession?: () => void;
  onLoadSession?: () => void;
  onSplitSession?: () => void;
}

const LINE_HEIGHT = 24;
const MAX_LINES = 6;
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

export default function PromptBar({ panelId, onSend, onGeneratingChange, cwd, onBrowseCwd, onNewSession, onLoadSession, onSplitSession }: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { play } = useSound();

  const setGenerating = useCallback(
    (value: boolean) => {
      setIsGenerating(value);
      onGeneratingChange?.(value);
    },
    [onGeneratingChange],
  );

  // Listen for session.idle to stop generating
  useEffect(() => {
    if (!window.copilotAPI?.onEvent) return;
    const cleanup = window.copilotAPI.onEvent((event: unknown) => {
      if (event && typeof event === 'object' && 'type' in event && (event as { type: string }).type === 'session.idle') {
        setGenerating(false);
      }
    }, panelId);
    return cleanup;
  }, [setGenerating, panelId]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxHeight = LINE_HEIGHT * MAX_LINES;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [prompt]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      attachments.forEach(a => URL.revokeObjectURL(a.previewUrl));
    };
  }, [attachments]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (!isImageFile(file.name)) continue;
      const previewUrl = URL.createObjectURL(file);
      // Use webkitRelativePath or file path if available
      const filePath = (file as File & { path?: string }).path || file.name;
      newAttachments.push({ path: filePath, name: file.name, previewUrl });
    }
    if (newAttachments.length) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSend = useCallback(() => {
    if (!cwd) {
      onBrowseCwd?.();
      return;
    }
    const trimmed = prompt.trim();
    if ((!trimmed && attachments.length === 0) || isGenerating) return;
    play('leverPull');
    const atts = attachments.length > 0 ? attachments.map(a => ({ path: a.path })) : undefined;
    window.copilotAPI?.sendMessage(trimmed || 'Describe this image.', atts, panelId);
    setGenerating(true);
    onSend?.(trimmed || 'Describe this image.', atts);
    setPrompt('');
    setAttachments([]);
  }, [cwd, onBrowseCwd, prompt, attachments, isGenerating, play, setGenerating, onSend, panelId]);

  const handleAbort = useCallback(() => {
    window.copilotAPI?.abort(panelId);
    setGenerating(false);
  }, [setGenerating, panelId]);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Paste handler for images — saves to temp file for SDK
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const buffer = await file.arrayBuffer();
        const savedPath = await window.utilAPI?.saveTempImage(buffer, ext);
        if (savedPath) {
          const previewUrl = URL.createObjectURL(file);
          setAttachments(prev => [...prev, { path: savedPath, name: `pasted.${ext}`, previewUrl }]);
        }
      }
    }
  }, []);

  // Drag-and-drop handlers
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);


  return (
    <div
      className={`border-t bg-[var(--bg-secondary)] p-4 transition-colors ${
        isDragging ? 'border-[var(--accent-purple)] bg-[var(--accent-purple)]/5' : 'border-[var(--border-color)]'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attachment thumbnails */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            className="flex gap-2 mb-3 flex-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {attachments.map((att, i) => (
              <motion.div
                key={att.previewUrl}
                className="relative group"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="w-16 h-16 object-cover rounded-lg border border-[var(--border-color)]"
                />
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  ✕
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white px-1 py-0.5 rounded-b-lg truncate">
                  {att.name}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-2.5 text-[var(--text-secondary)] hover:text-[var(--accent-purple)] transition-colors cursor-pointer text-lg"
          title="Attach image"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={attachments.length > 0 ? 'Add a message or press Enter to send…' : 'Enter your prompt…'}
          rows={1}
          className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none rounded-lg border border-[var(--border-color)] px-4 py-3 focus:border-[var(--accent-purple)] focus:shadow-[0_0_8px_var(--accent-purple)] transition-shadow"
          style={{ lineHeight: `${LINE_HEIGHT}px` }}
        />

        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.button
              key="stop"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={handleAbort}
              className="px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg text-sm whitespace-nowrap cursor-pointer"
            >
              ⏹ STOP
            </motion.button>
          ) : (
            <motion.div
              key="send-group"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-stretch"
            >
              <button
                onClick={handleSend}
                className="px-3 py-2.5 bg-[var(--accent-gold)] text-black font-bold rounded-l-lg cursor-pointer flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
              <div className="w-px bg-black/20" />
              <button
                onClick={() => setSendMenuOpen(!sendMenuOpen)}
                className="px-1.5 py-2.5 bg-[var(--accent-gold)] text-black font-bold rounded-r-lg cursor-pointer flex items-center justify-center hover:bg-[var(--accent-gold)]/80 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${sendMenuOpen ? 'rotate-180' : ''}`}><path d="M0 2l4 4 4-4z"/></svg>
              </button>

              {sendMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSendMenuOpen(false)} />
                  <div className="absolute bottom-full right-0 mb-2 z-50 w-44 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
                    <button
                      onClick={() => { setSendMenuOpen(false); onNewSession?.(); }}
                      className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <span className="text-[var(--text-secondary)]">+</span> New Session
                    </button>
                    <button
                      onClick={() => { setSendMenuOpen(false); onLoadSession?.(); }}
                      className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--text-secondary)]"><path d="M1.5 1.5v13h13v-13h-13zM0 1a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H1a1 1 0 01-1-1V1zm4.5 2.5h7v1h-7v-1zm0 3h7v1h-7v-1zm0 3h4v1h-4v-1z"/></svg>
                      Load Session
                    </button>
                    <button
                      onClick={() => { setSendMenuOpen(false); onSplitSession?.(); }}
                      className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--text-secondary)]">
                        <rect x="1" y="2" width="14" height="12" rx="1" />
                        <line x1="8" y1="2" x2="8" y2="14" />
                      </svg>
                      Split Session
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
