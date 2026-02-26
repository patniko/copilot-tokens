/**
 * Curated demo session data — based on a real coding session building CLI features.
 * Each step produces CopilotEvents when replayed by the DemoReplayService.
 */

export interface DemoStep {
  /** Delay in ms before this step plays */
  delay: number;
  /** The CopilotEvent(s) to emit */
  events: Record<string, unknown>[];
}

let _toolId = 0;
function toolId(): string {
  return `demo-tool-${++_toolId}`;
}

function userMsg(content: string, delay = 2500): DemoStep {
  return { delay, events: [{ type: 'user.message', content }] };
}

function turnStart(_id: string, delay = 200): DemoStep {
  return { delay, events: [] };
}

function turnEnd(_id: string, delay = 100): DemoStep {
  return { delay, events: [] };
}

function assistantText(content: string, delay = 100): DemoStep {
  // Break content into chunks for streaming effect
  const chunkSize = 12;
  const events: Record<string, unknown>[] = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    events.push({ type: 'assistant.message_delta', delta: content.slice(i, i + chunkSize) });
  }
  events.push({ type: 'assistant.message', content });
  return { delay, events };
}

function intent(text: string, delay = 50): DemoStep {
  return { delay, events: [{ type: 'assistant.intent', intent: text }] };
}

function toolStart(name: string, args: Record<string, unknown>, id: string, delay = 300): DemoStep {
  return { delay, events: [{ type: 'tool.start', toolCallId: id, toolName: name, args }] };
}

function toolComplete(id: string, success = true, result?: string, delay = 600): DemoStep {
  return { delay, events: [{ type: 'tool.complete', toolCallId: id, success, result }] };
}

function subagentStart(tcId: string, name: string, displayName: string, desc: string, delay = 200): DemoStep {
  return { delay, events: [{ type: 'subagent.started', toolCallId: tcId, name, displayName, description: desc }] };
}

function subagentDone(tcId: string, name: string, delay = 800): DemoStep {
  return { delay, events: [{ type: 'subagent.completed', toolCallId: tcId, name }] };
}

function usage(inputTokens: number, outputTokens: number, delay = 100): DemoStep {
  return { delay, events: [{ type: 'assistant.usage', inputTokens, outputTokens, model: 'claude-sonnet-4' }] };
}

function contextUsage(current: number, limit: number, delay = 50): DemoStep {
  return { delay, events: [{ type: 'session.usage_info', currentTokens: current, tokenLimit: limit }] };
}

function idle(delay = 1500): DemoStep {
  return { delay, events: [{ type: 'session.idle' }] };
}

// ---------------------------------------------------------------------------
// The actual demo script — a realistic coding session
// ---------------------------------------------------------------------------

export function buildDemoScript(): DemoStep[] {
  _toolId = 0;

  // Pre-generate tool IDs for paired start/complete
  const t1 = toolId(), t2 = toolId(), t3 = toolId(), t4 = toolId();
  const t5 = toolId(), t6 = toolId(), t7 = toolId(), t8 = toolId();
  const t9 = toolId(), t10 = toolId(), t11 = toolId(), t12 = toolId();
  const t13 = toolId(), t14 = toolId(), t15 = toolId(), t16 = toolId();
  const t17 = toolId(), t18 = toolId(), t19 = toolId(), t20 = toolId();
  const t21 = toolId(), t22 = toolId(), t23 = toolId(), t24 = toolId();
  const t25 = toolId(), t26 = toolId(), t27 = toolId(), t28 = toolId();

  return [
    // ── Turn 1: User wants a CLI run command ──
    userMsg('can you create an easy way to run the adapters from the command line? add an arg to easily pop the dashboard', 1000),
    turnStart('0'),
    intent('Exploring CLI and adapters'),
    subagentStart(t1, 'explore', 'Explore Agent', 'Fast codebase exploration and analysis'),
    subagentDone(t1, 'explore'),
    assistantText('Now I have the full picture. Let me add a `run` command that just runs an adapter and pops the dashboard — no specs required.'),
    usage(3500, 1200),
    contextUsage(4700, 200000),
    turnEnd('0'),

    // Tool calls — reading existing code
    turnStart('1'),
    intent('Adding CLI run command'),
    toolStart('view', { path: 'src/cli/index.ts' }, t2),
    toolStart('view', { path: 'package.json' }, t3),
    toolComplete(t2, true, '// CLI entry point with compare and verify commands...'),
    toolComplete(t3, true, '{ "name": "signal", "scripts": { ... } }'),
    usage(7000, 2000),
    turnEnd('1'),

    // Creating the run command
    turnStart('2'),
    toolStart('edit', { path: 'src/cli/index.ts', description: 'Add run command handler' }, t4),
    toolComplete(t4, true, 'Applied edit to src/cli/index.ts'),
    toolStart('edit', { path: 'src/cli/index.ts', description: 'Wire dashboard flag' }, t5),
    toolComplete(t5, true, 'Applied edit to src/cli/index.ts'),
    toolStart('edit', { path: 'package.json', description: 'Add npm scripts' }, t6),
    toolComplete(t6, true, 'Applied edit to package.json'),
    usage(11000, 3500),
    contextUsage(17700, 200000),
    turnEnd('2'),

    // Verify it works
    turnStart('3'),
    assistantText('Now let me verify it compiles and the self adapter actually works:'),
    toolStart('bash', { command: 'npm run build && npm run run -- --help' }, t7),
    toolComplete(t7, true, '✓ Built successfully\n\nUsage: signal run [options]\n\nRun a single adapter and optionally open the dashboard\n\nOptions:\n  -a, --adapter <name>  Adapter to use (default: "self")\n  -w, --web             Open web dashboard\n  --command <cmd>       Command for process adapter\n  -h, --help            display help'),
    toolStart('bash', { command: 'npm run run -- -w' }, t8),
    toolComplete(t8, true, 'Running adapter: self...\n✓ Captured 14 signals in 2.3s\n✓ Dashboard opened at http://localhost:3847'),
    assistantText(`All working. Here's what was added:

**New \`run\` command** — runs any adapter, captures a trace, and shows the dashboard:

\`\`\`bash
# Self adapter — terminal dashboard (default)
signal run

# Self adapter — pop the web dashboard
signal run -w

# Process adapter — probe any CLI tool
signal run -a process --command "my-tool arg1 arg2" -w
\`\`\`

**npm scripts** added to \`package.json\`:
- \`npm run run\` — quick-run the default (self) adapter
- \`npm run dashboard\` — open the web dashboard`),
    usage(16000, 5000),
    contextUsage(27700, 200000),
    idle(),
    turnEnd('3'),

    // ── Turn 2: User reports a bug ──
    userMsg('why does every preset function look the same in the waveform? shouldn\'t there be some difference between the presets?', 3000),
    turnStart('4'),
    intent('Investigating preset differences'),
    toolStart('bash', { command: 'cat traces/latest.jsonl | head -50' }, t9),
    toolComplete(t9, true, '{"probe":"ping","signal":"state/transition","data":{"from":"init","to":"starting"}}\n{"probe":"auth","signal":"jsonrpc.in/request","data":{"method":"auth.getStatus"}}\n{"probe":"auth","signal":"state/transition","data":{"to":"authenticated"}}'),
    toolStart('view', { path: 'src/adapters/copilot-core/adapter.ts' }, t10),
    toolComplete(t10, true, '// CopilotCoreAdapter implementation...'),
    assistantText(`The traces are identical because the adapter sends the **same prompt** to all three presets. The preset changes which tools the runtime exposes, but if the prompt triggers the same behavior, you get identical waveforms.

Let me check and fix this — the default prompt should be preset-aware:`),
    usage(22000, 8000),
    contextUsage(41700, 200000),
    turnEnd('4'),

    // Fix the prompts
    turnStart('5'),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Add preset-specific prompts' }, t11),
    toolComplete(t11, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    assistantText(`That said — the preset-specific prompts will help differentiate, but the **0 tools** across all presets is the bigger signal. That means either:

1. **\`tools.list\` is failing silently** — the adapter catches the error but the response format doesn't match what it expects
2. **Auth is failing** — if \`auth.getStatus\` errors, the session may proceed without proper auth
3. **The runtime isn't returning tools in the expected format** — the adapter expects an array, but the runtime may use a different shape

Let me fix the tools parsing and auth detection:`),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Fix tools response parsing' }, t12),
    toolComplete(t12, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Fix auth status detection' }, t13),
    toolComplete(t13, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    usage(30000, 12000),
    contextUsage(61700, 200000),
    idle(),
    turnEnd('5'),

    // ── Turn 3: gh auth token ──
    userMsg('can we use gh auth token to just pass a token to it when we run it?', 3000),
    turnStart('6'),
    intent('Adding gh auth integration'),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Auto-inject gh auth token' }, t14),
    toolComplete(t14, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    assistantText('Done. The adapter now runs `gh auth token` before spawning the runtime and passes it as `GITHUB_TOKEN` in the environment. It\'s silent if `gh` isn\'t installed or not logged in — just falls back to whatever\'s already in the env.'),
    usage(40000, 18000),
    contextUsage(89700, 200000),
    idle(),
    turnEnd('6'),

    // ── Turn 4: Review and fix ──
    userMsg('review the latest run and help me finalize this. the data still looks wrong — i would expect some difference between presets', 3500),
    turnStart('7'),
    intent('Reviewing trace data'),
    toolStart('bash', { command: 'signal run -a copilot-core --binary ./runtime --save-trace traces/debug.jsonl' }, t15),
    toolComplete(t15, true, 'Running adapter: copilot-core...\n✓ Auth: gh token injected\n✓ Tools detected: 7 (cli), 6 (filesystem), 0 (minimal)\n⚠ All sessions timed out at 120s', 1200),
    toolStart('view', { path: 'traces/debug.jsonl' }, t16),
    toolComplete(t16, true, '{"probe":"tools","signal":"jsonrpc.out/response","data":{"tools":{"tools":[{"name":"task_complete"},{"name":"bash"},...]}}}'),
    assistantText(`Two clear issues in the trace:

1. **Auth**: \`auth.getStatus\` returns \`{"status":"unauthorized"}\` but the adapter treats it as success — the session then fails at the LLM call with "missing required Authorization header"
2. **Tools parsing**: response is \`{"tools":{"tools":[...]}}\` (nested) but the adapter checks \`Array.isArray(tools)\` on the outer object, so it always sees 0

Let me fix both:`),
    usage(55000, 25000),
    contextUsage(129700, 200000),
    turnEnd('7'),

    // Apply fixes
    turnStart('8'),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Unwrap nested tools response' }, t17),
    toolComplete(t17, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Fix auth status check' }, t18),
    toolComplete(t18, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Pass preset to tools.list' }, t19),
    toolComplete(t19, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    assistantText(`Clean. Here's what was wrong and what changed:

**Tools showing 0**: The runtime returns \`{"tools":{"tools":[...]}}\` (nested object). The adapter was checking \`Array.isArray(tools)\` on the outer object → always false → 0 tools. Now it unwraps the nesting correctly.

**Identical presets**: All three presets hit the same auth wall — \`status: "unauthorized"\` → LLM call fails. The adapter was masking this by labeling it \`authenticated\`. Now it correctly emits \`state: unauthorized\`.`),
    usage(75000, 40000),
    contextUsage(189700, 200000),
    idle(),
    turnEnd('8'),

    // ── Turn 5: Still broken, keep debugging ──
    userMsg('still the same — all waveforms are identical', 3000),
    turnStart('9'),
    intent('Debugging waveform differences'),
    toolStart('bash', { command: 'signal compare -a copilot-core --binary ./runtime --timeout 300 --save-trace traces/compare.jsonl' }, t20),
    toolComplete(t20, true, 'Running 3 presets in parallel...\n✓ cli: 7 tools, 27 signals, timeout at 300s\n✓ filesystem: 6 tools, 27 signals, timeout at 300s\n✓ minimal: 0 tools, 27 signals, timeout at 300s\n\nDiff: No behavioral differences detected', 1500),
    assistantText(`The tools column IS different now (7/6/0) — but the diff says "No behavioral differences" because it only compares signal *type* keys, not the data inside them. All three presets emit the same signal *types* in the same quantities — the differences are buried in payloads.

Two things to fix: make the diff data-aware for key signals, and check why all three sessions timeout identically.`),
    toolStart('view', { path: 'src/analysis/diff.ts' }, t21),
    toolComplete(t21, true, '// Diff engine — compares signal type counts across traces...'),
    toolStart('edit', { path: 'src/analysis/diff.ts', description: 'Decompose state and tool signals for richer diff' }, t22),
    toolComplete(t22, true, 'Applied edit to src/analysis/diff.ts'),
    usage(100000, 55000),
    contextUsage(269700, 200000),
    turnEnd('9'),

    // Fix timeout issue
    turnStart('10'),
    assistantText('Now I see the real problem. The 120s timeout fires before the second LLM call completes. Let me bump it and fix the diff:'),
    toolStart('edit', { path: 'src/adapters/copilot-core/adapter.ts', description: 'Increase default timeout to 300s' }, t23),
    toolComplete(t23, true, 'Applied edit to src/adapters/copilot-core/adapter.ts'),
    toolStart('edit', { path: 'src/cli/index.ts', description: 'Add --timeout CLI flag' }, t24),
    toolComplete(t24, true, 'Applied edit to src/cli/index.ts'),
    toolStart('bash', { command: 'npm run build && signal compare --timeout 300 -a copilot-core --binary ./runtime' }, t25),
    toolComplete(t25, true, 'Running 3 presets in parallel...\n✓ cli: 7 tools, completed in 180s\n✓ filesystem: 6 tools, completed in 165s\n✓ minimal: 0 tools, completed in 95s\n\nDiff:\n  + state/authenticated → state/unauthorized (minimal)\n  + tool.out/task_complete (cli, filesystem only)\n  + tool.out/bash (cli only)\n  3 behavioral differences found', 1800),
    assistantText(`Now the diff surfaces real behavioral differences! The state transitions are decomposed and tool signals show tool names.

Here's the summary of all fixes:

| Problem | Cause | Fix |
|---------|-------|-----|
| **0 tools for all presets** | Nested response format | Unwrap \`tools.tools\` |
| **Same tools for all presets** | Missing \`preset\` param | Pass \`{sessionId, preset}\` to \`tools.list\` |
| **Auth fails at LLM call** | No token in env | Auto-inject \`gh auth token\` |
| **Identical waveforms** | Diff only compared type counts | Decompose state/tool signal data |
| **All sessions timeout** | 120s too short for 2+ LLM calls | Default 300s + \`--timeout\` flag |`),
    usage(130000, 80000),
    contextUsage(379700, 200000),
    idle(),
    turnEnd('10'),

    // ── Turn 6: Add CLI argument for specs ──
    userMsg('nice! now can we also make it show specs in the side panel when viewing results?', 3500),
    turnStart('11'),
    intent('Adding spec viewer'),
    toolStart('view', { path: 'src/dashboard/web/components/SidePanel.tsx' }, t26),
    toolComplete(t26, true, '// SidePanel component with trace details...'),
    toolStart('edit', { path: 'src/dashboard/web/components/SidePanel.tsx', description: 'Add spec viewer tab' }, t27),
    toolComplete(t27, true, 'Applied edit to SidePanel.tsx'),
    toolStart('edit', { path: 'src/dashboard/web/components/SidePanel.tsx', description: 'Render spec YAML with syntax highlighting' }, t28),
    toolComplete(t28, true, 'Applied edit to SidePanel.tsx'),
    assistantText(`Done. The side panel now has a "Specs" tab that shows the YAML configuration for each scenario. You can view the spec that drove each trace run, making it easy to understand what each preset was testing.

The spec viewer includes:
- Syntax-highlighted YAML rendering
- Collapsible sections for large specs
- Links between spec entries and their corresponding waveform signals`),
    usage(160000, 120000),
    contextUsage(529700, 200000),
    idle(2000),
    turnEnd('11'),
  ];
}
