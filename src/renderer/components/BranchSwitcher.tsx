import { useState, useEffect, useRef } from 'react';

type Step = 'browse' | 'handle-changes' | 'new-branch';

interface BranchSwitcherProps {
  currentBranch: string;
  onSwitch: () => void;
  onClose: () => void;
}

export default function BranchSwitcher({ currentBranch, onSwitch, onClose }: BranchSwitcherProps) {
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [stashes, setStashes] = useState<{ index: number; message: string; branch: string }[]>([]);
  const [step, setStep] = useState<Step>('browse');
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchBase, setNewBranchBase] = useState<'current' | 'default'>('current');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [showStashes, setShowStashes] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load branches, default branch, and stashes
  useEffect(() => {
    if (!window.gitAPI) return;
    window.gitAPI.listBranches().then(setBranches);
    window.gitAPI.defaultBranch().then(setDefaultBranch);
    window.gitAPI.stashList().then(setStashes);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = branches.filter((b) =>
    b.toLowerCase().includes(search.toLowerCase()) && b !== currentBranch
  );

  const doSwitch = async (branch: string) => {
    setLoading(true);
    setError(null);
    const result = await window.gitAPI.switchBranch(branch);
    setLoading(false);
    if (result.success) {
      onSwitch();
      onClose();
    } else {
      setError(result.error || 'Switch failed');
    }
  };

  const handleBranchClick = async (branch: string) => {
    setError(null);
    const hasChanges = await window.gitAPI.hasChanges();
    if (hasChanges) {
      setPendingBranch(branch);
      setCommitMsg(`WIP on ${currentBranch}`);
      setStep('handle-changes');
    } else {
      doSwitch(branch);
    }
  };

  const handleStash = async () => {
    if (!pendingBranch) return;
    setLoading(true);
    setError(null);
    const stashResult = await window.gitAPI.stash(`Stash from ${currentBranch}`);
    if (!stashResult.success) {
      setError(stashResult.error || 'Stash failed');
      setLoading(false);
      return;
    }
    doSwitch(pendingBranch);
  };

  const handleCommitAndSwitch = async () => {
    if (!pendingBranch || !commitMsg.trim()) return;
    setLoading(true);
    setError(null);
    const commitResult = await window.gitAPI.commit(commitMsg.trim(), []);
    if (!commitResult.success) {
      setError('Commit failed — check your changes');
      setLoading(false);
      return;
    }
    doSwitch(pendingBranch);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setLoading(true);
    setError(null);
    const base = newBranchBase === 'default' ? defaultBranch : undefined;
    const result = await window.gitAPI.createBranch(newBranchName.trim(), base);
    setLoading(false);
    if (result.success) {
      onSwitch();
      onClose();
    } else {
      setError(result.error || 'Create failed');
    }
  };

  const handleStashPop = async (index: number) => {
    setLoading(true);
    setError(null);
    const result = await window.gitAPI.stashPop(index);
    if (result.success) {
      setStashes((prev) => prev.filter((s) => s.index !== index));
      onSwitch();
    } else {
      setError(result.error || 'Could not apply stash');
    }
    setLoading(false);
  };

  // --- Handle Changes Step ---
  if (step === 'handle-changes') {
    return (
      <div ref={ref} className="absolute top-full left-0 mt-1.5 z-50 w-80 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[var(--border-color)]">
          <div className="text-[11px] font-medium text-[var(--text-primary)] mb-1">You have unsaved changes</div>
          <div className="text-[10px] text-[var(--text-secondary)]">
            What should we do before switching to <span className="text-[var(--accent-green)] font-medium">{pendingBranch}</span>?
          </div>
        </div>

        {error && (
          <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-400/10">{error}</div>
        )}

        <div className="p-2 flex flex-col gap-1.5">
          <button
            onClick={handleStash}
            disabled={loading}
            className="w-full text-left px-3 py-2 rounded text-[11px] bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] transition-colors cursor-pointer disabled:opacity-50"
          >
            📦 Stash my changes
            <div className="text-[10px] opacity-70 mt-0.5">Save them for later — you can bring them back anytime</div>
          </button>

          <div className="px-3 py-2 rounded text-[11px] bg-[var(--accent-green)]/10">
            <div className="text-[var(--accent-green)] mb-1.5">💾 Commit my changes</div>
            <input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommitAndSwitch()}
              placeholder="Commit message…"
              className="w-full px-2 py-1 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent-green)]"
            />
            <button
              onClick={handleCommitAndSwitch}
              disabled={loading || !commitMsg.trim()}
              className="mt-1.5 px-2.5 py-1 rounded text-[10px] font-medium bg-[var(--accent-green)]/20 hover:bg-[var(--accent-green)]/30 text-[var(--accent-green)] transition-colors cursor-pointer disabled:opacity-50"
            >
              Commit & switch
            </button>
          </div>

          <button
            onClick={() => { setStep('browse'); setPendingBranch(null); setError(null); }}
            className="w-full text-center px-3 py-1.5 rounded text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- New Branch Step ---
  if (step === 'new-branch') {
    return (
      <div ref={ref} className="absolute top-full left-0 mt-1.5 z-50 w-80 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[var(--border-color)]">
          <div className="text-[11px] font-medium text-[var(--text-primary)]">Create new branch</div>
        </div>

        {error && (
          <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-400/10">{error}</div>
        )}

        <div className="p-3 flex flex-col gap-2">
          <input
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value.replace(/\s+/g, '-'))}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
            placeholder="my-new-branch"
            autoFocus
            className="w-full px-2.5 py-1.5 rounded text-[11px] font-mono bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent-green)]"
          />

          <div className="text-[10px] text-[var(--text-secondary)]">Start from:</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setNewBranchBase('current')}
              className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                newBranchBase === 'current'
                  ? 'border-[var(--accent-green)] text-[var(--accent-green)] bg-[var(--accent-green)]/10'
                  : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              📍 Current ({currentBranch})
            </button>
            <button
              onClick={() => setNewBranchBase('default')}
              className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                newBranchBase === 'default'
                  ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                  : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              🏠 Default ({defaultBranch})
            </button>
          </div>

          <div className="flex gap-1.5 mt-1">
            <button
              onClick={() => { setStep('browse'); setError(null); }}
              className="flex-1 px-2.5 py-1.5 rounded text-[10px] font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleCreateBranch}
              disabled={loading || !newBranchName.trim()}
              className="flex-1 px-2.5 py-1.5 rounded text-[10px] font-medium bg-[var(--accent-green)] text-black hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create & switch'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Browse Step (main view) ---
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1.5 z-50 w-80 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--border-color)]">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search branches…"
          className="w-full px-2.5 py-1.5 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent-green)]"
        />
      </div>

      {error && (
        <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-400/10">{error}</div>
      )}

      {/* Current branch */}
      <div className="px-3 py-1.5 border-b border-[var(--border-color)] flex items-center gap-2">
        <span className="text-[var(--accent-green)] text-[10px]">●</span>
        <span className="text-[11px] font-mono text-[var(--accent-green)] truncate flex-1">{currentBranch}</span>
        <span className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider">current</span>
      </div>

      {/* Branch list */}
      <div className="max-h-[180px] overflow-y-auto">
        {filtered.length === 0 && search && (
          <div className="px-3 py-3 text-[11px] text-[var(--text-secondary)] text-center">
            No branches matching "{search}"
          </div>
        )}
        {filtered.map((branch) => (
          <button
            key={branch}
            onClick={() => handleBranchClick(branch)}
            disabled={loading}
            className="w-full text-left px-3 py-1.5 text-[11px] font-mono truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {branch}
          </button>
        ))}
        {!search && filtered.length === 0 && branches.length <= 1 && (
          <div className="px-3 py-3 text-[11px] text-[var(--text-secondary)] text-center">
            No other branches yet
          </div>
        )}
      </div>

      {/* New branch button */}
      <div className="border-t border-[var(--border-color)]">
        <button
          onClick={() => setStep('new-branch')}
          className="w-full text-left px-3 py-2 text-[11px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>＋</span> New branch…
        </button>
      </div>

      {/* Stashes section */}
      {stashes.length > 0 && (
        <div className="border-t border-[var(--border-color)]">
          <button
            onClick={() => setShowStashes(!showStashes)}
            className="w-full text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-between"
          >
            <span>📦 Stashes ({stashes.length})</span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${showStashes ? 'rotate-180' : ''}`}><path d="M0 2l4 4 4-4z"/></svg>
          </button>
          {showStashes && stashes.map((s) => (
            <div key={s.index} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-primary)] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono truncate text-[var(--text-secondary)]">{s.message}</div>
                {s.branch && <div className="text-[9px] text-[var(--text-secondary)] opacity-60">on {s.branch}</div>}
              </div>
              <button
                onClick={() => handleStashPop(s.index)}
                disabled={loading}
                className="shrink-0 px-2 py-0.5 rounded text-[9px] font-medium border border-[var(--accent-gold)]/30 text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
