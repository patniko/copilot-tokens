import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AgentConfig {
  name: string;
  displayName?: string;
  description?: string;
  tools?: string[] | null;
  prompt: string;
}

interface AgentPickerProps {
  onAgentChange?: () => void;
}

const PRESETS: AgentConfig[] = [
  { name: 'code-expert', displayName: 'Code Expert', description: 'Deep technical expertise', prompt: 'You are a senior software engineer. Focus on code quality, performance, and best practices. Always explain your reasoning.' },
  { name: 'careful-reviewer', displayName: 'Careful Reviewer', description: 'Thorough and methodical', prompt: 'You are extremely thorough and careful. Always ask clarifying questions before making changes. Double-check your work.' },
  { name: 'creative-writer', displayName: 'Creative Writer', description: 'Expressive and creative', prompt: 'You are creative and expressive. Use vivid language, metaphors, and engaging explanations. Make technical content accessible.' },
];

export default function AgentPicker({ onAgentChange }: AgentPickerProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  useEffect(() => {
    window.agentsAPI.get().then((a) => {
      setAgents(a);
      if (a.length > 0) setActiveAgent(a[0]);
    });
  }, []);

  const selectAgent = async (agent: AgentConfig | null) => {
    setActiveAgent(agent);
    if (agent) {
      const custom = agents.filter((a) => !PRESETS.some((p) => p.name === a.name));
      const isPreset = PRESETS.some((p) => p.name === agent.name);
      const next = isPreset ? [agent, ...custom] : [agent, ...custom.filter((a) => a.name !== agent.name)];
      await window.agentsAPI.set(next);
      setAgents(next);
    } else {
      await window.agentsAPI.set([]);
      setAgents([]);
    }
    setOpen(false);
    onAgentChange?.();
  };

  const saveNewAgent = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !newPrompt.trim()) return;
    const agent: AgentConfig = {
      name: trimmed.toLowerCase().replace(/\s+/g, '-'),
      displayName: trimmed,
      prompt: newPrompt.trim(),
    };
    const updated = [...agents, agent];
    setAgents(updated);
    setCreating(false);
    setNewName('');
    setNewPrompt('');
    await selectAgent(agent);
  };

  const customAgents = agents.filter((a) => !PRESETS.some((p) => p.name === a.name));
  const label = activeAgent?.displayName || activeAgent?.name || 'Default Agent';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 transition-colors cursor-pointer text-xs ${
          activeAgent
            ? 'text-[var(--accent-purple)] hover:text-[var(--accent-gold)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        🤖 {label}
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="currentColor"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M0 2l4 4 4-4z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setCreating(false); }} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden"
            >
              {/* Default Agent */}
              <button
                onClick={() => selectAgent(null)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  !activeAgent
                    ? 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                }`}
              >
                <span>Default Agent</span>
                {!activeAgent && <span>✓</span>}
              </button>

              {/* Presets */}
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => selectAgent(p)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    activeAgent?.name === p.name
                      ? 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate">{p.displayName}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">{p.description}</div>
                  </div>
                  {activeAgent?.name === p.name && <span className="shrink-0">✓</span>}
                </button>
              ))}

              {/* Divider + Custom Agents */}
              {customAgents.length > 0 && (
                <>
                  <div className="border-t border-[var(--border-color)]" />
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                    Custom
                  </div>
                  {customAgents.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => selectAgent(a)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        activeAgent?.name === a.name
                          ? 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      <span className="truncate">{a.displayName || a.name}</span>
                      {activeAgent?.name === a.name && <span className="shrink-0">✓</span>}
                    </button>
                  ))}
                </>
              )}

              {/* Divider + New Agent */}
              <div className="border-t border-[var(--border-color)]" />

              {creating ? (
                <div className="p-3 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Agent name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-purple)]"
                    autoFocus
                  />
                  <textarea
                    placeholder="System prompt…"
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-purple)] resize-none"
                  />
                  <button
                    onClick={saveNewAgent}
                    disabled={!newName.trim() || !newPrompt.trim()}
                    className="w-full px-2 py-1 text-xs rounded bg-[var(--accent-purple)] text-white cursor-pointer transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full text-left px-3 py-2 text-xs text-[var(--accent-purple)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer"
                >
                  + New Agent
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
