<div align="center">

<img src="logo-128.png" width="96" alt="Copilot Tokens logo" />

# Copilot Tokens

**A gamified desktop client for GitHub Copilot**

Turn every AI interaction into a slot-machine experience — track tokens, hit milestones, level up, and make coding with Copilot feel like winning.

[![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://typescriptlang.org)
[![Copilot SDK](https://img.shields.io/badge/@github/copilot--sdk-0.1-000?logo=github)](https://github.com/github/copilot-sdk)

</div>

---

## What is this?

Copilot Tokens wraps the full power of GitHub Copilot's agentic coding assistant inside a desktop app that makes every session feel alive. It's not a toy — underneath the animations is a complete multi-panel AI coding environment with tool permissions, diff viewing, git integration, and session replay. The gamification layer sits on top, giving you real-time feedback on how you and the AI are working together.

## See it in action

### Code Review
Watch the agent review code changes, provide feedback, and the full tool execution pipeline in action.

https://github.com/user-attachments/assets/50c1a7e9-4c68-4fc7-a6ea-5ac5b9bc5245

### YOLO Mode
One click to skip all permission prompts. The satisfying toggle, the flash — and then the agent runs free.

https://github.com/user-attachments/assets/9114175d-fdfa-49ac-9e05-70f0424dd5c2

### Achievements & Leveling
Hit milestones, earn badges, and level up across 5 categories. Every session adds to your progress.

https://github.com/user-attachments/assets/aebbbfef-adf1-4698-952e-d364885c73ba

### Settings & SDK Features
Toggle SDK capabilities on and off — reasoning chains, custom tools, infinite sessions, hooks, and more. All configurable from the Settings panel.

https://github.com/user-attachments/assets/eb9cf6c9-538d-4dc9-99af-94f7f091c104

### The Million Token Club
What happens when you hit 1,000,000 tokens? Find out.

https://github.com/user-attachments/assets/f5ace29b-541d-4e67-9185-b7786d96e9b1

---

## ✨ Features

### 🤖 Full Copilot Agent
- Agentic coding powered by the `@github/copilot-sdk` — file edits, shell commands, web fetches, and more
- Multi-panel chat with draggable split panes for parallel conversations
- Tool permission system with YOLO mode for the brave
- Model selector with live context window tracking
- MCP server support for extensible tool integrations
- **Custom agents** — pick from presets or create your own personas with tailored system prompts

### 🧠 SDK Feature Showcase
Every feature toggleable from Settings — turn things on and off to match your preferences:
- **Reasoning chains** — stream the model's chain-of-thought in a collapsible thinking panel with effort selector (low → max)
- **Ask user flow** — the agent asks clarifying questions mid-task with interactive choice buttons
- **Native tools** — desktop notifications, clipboard read/write, system info, app launching, sound playback via `defineTool()`
- **Infinite sessions** — conversations never die; auto-compaction keeps the context window managed
- **Session hooks** — pre/post tool hooks, prompt validation, error recovery, session summaries
- **Session events** — error banners, model change notifications, truncation warnings, shutdown report cards

### 🎰 Live Token Dashboard
- Real-time odometer counters for input tokens, output tokens, and totals
- Context window progress bar showing actual session utilization with compaction awareness
- Git stats — files changed, lines added/removed — polled live from your working directory

### 🏆 Leveling & Milestones
- **100 levels** across 5 categories: tokens, messages, tool calls, files, and lines changed
- **7 tiers** from Novice to Legendary — all category bars must fill to level up
- **Milestone celebrations** at token/file/line thresholds with sparkle, confetti, and jackpot effects
- Level-up overlays with animated fanfare

### 🎨 Themes & Customization
- **Neon Arcade** — dark GitHub palette with neon glows and particles
- **Retro Casino** — warm reds and golds with a vintage feel
- **Minimal** — clean and distraction-free
- Create your own themes, milestone packs, and sound packs in the Pack Studio

### 🔊 Procedural Audio
Every sound is synthesized at runtime — no audio files. Lever pulls, token ticks, milestone chimes, jackpot fanfares, and celebration sequences are all generated from oscillators and envelopes using the Web Audio API.

### 📼 Session Recording & Replay
- Every session is automatically recorded — messages, tool calls, stats, and timing
- Browse past sessions or resume SDK sessions with full conversation history
- Full replay with timeline scrubbing

### 🔒 Permission System
- Reads under your working directory auto-approve
- Writes, shell commands, and URL fetches prompt for approval
- "Always allow" rules persist across sessions
- YOLO mode bypasses all dialogs (with a satisfying toggle sound)

## Architecture

```
src/
├── main/              Electron main process
│   ├── copilot-service    SDK wrapper — sessions, streaming, tools, hooks, agents
│   ├── permission-service Tool permission rules & evaluation
│   ├── auth-service       GitHub OAuth Device Flow + gh CLI detection
│   ├── stats-service      Lifetime stats, streaks, level progress
│   └── pack-service       Custom milestone/sound/theme pack CRUD
├── preload/           Context-isolated bridge
│   └── preload            13 typed APIs: copilot, stats, git, auth, model,
│                          settings, features, sessions, agents, pack, mcp, cwd, util
└── renderer/          React 19 + Tailwind 4 + Motion
    ├── App                Root — panels, modals, state orchestration
    ├── components/
    │   ├── ReelArea           Animated chat feed (30+ event types)
    │   ├── TokenDashboard     Live counters & context progress
    │   ├── SplitLayout        Multi-panel with draggable dividers
    │   ├── PermissionDialog   Tool approval UI
    │   ├── Settings           General, SDK Features, System Prompt tabs
    │   ├── AgentPicker        Custom agent personas & presets
    │   ├── HooksIndicator     Hook pipeline activity display
    │   ├── PackStudio         Theme/milestone/sound editor
    │   ├── SessionBrowser     Past sessions + SDK session resume
    │   ├── DiffViewer         Unified diff rendering
    │   └── tiles/             16 per-tool UI components
    │       ├── ReasoningTile      Chain-of-thought streaming
    │       ├── AskUserTile        Interactive choice buttons
    │       ├── SessionEventTiles  Error/compaction/shutdown banners
    │       ├── NativeToolTiles    Notification/clipboard/system info
    │       ├── SqlTile, MemoryTile, SubagentTile, SkillTile
    │       └── BashTile, FileEditTile, FileReadTile, WebFetchTile...
    └── lib/
        ├── level-system       100-level polynomial progression
        ├── milestones         Threshold-based achievement triggers
        ├── sound-manager      Web Audio procedural synthesis
        ├── themes             CSS variable-driven theming
        ├── tile-registry      Plugin-style tile registration
        └── party-bus          Cross-component event pub/sub
```

### Design Principles

- **Three-process Electron architecture** — main (Node.js), preload (context bridge), renderer (browser). All IPC is typed end-to-end.
- **No external audio files** — all sounds are procedurally generated with the Web Audio API.
- **CSS variable theming** — themes swap a set of CSS custom properties; components reference variables, never hard-coded colors.
- **Event-driven gamification** — a lightweight pub/sub bus (PartyBus) decouples game events from UI, so milestones, level-ups, and celebrations trigger without tight coupling.
- **Everything is toggleable** — every SDK feature (reasoning, tools, hooks, agents, sessions) can be turned on/off from Settings without restarting the app.
- **Persistent state** — auth, permissions, stats, packs, feature flags, and level progress all persist via `electron-store`.

## Getting Started

### Prerequisites

- Node.js 20+
- A GitHub account with Copilot access
- The [GitHub Copilot CLI](https://docs.github.com/en/copilot) installed (`copilot` in your PATH)

### Install & Run

```bash
npm install
npm run start
```

On first launch, you'll authenticate via GitHub OAuth Device Flow (or it picks up your existing `gh` CLI session).

### Build for Distribution

```bash
# Package the app
npm run package

# Create platform-specific installers
npm run make
```

## Extending

### Custom Tool Tiles

1. Create a component in `src/renderer/components/tiles/`
2. Export from the barrel `index.ts`
3. Register in `src/renderer/lib/register-tiles.ts` with the tool name as key

### Custom Themes

Create themes in the Pack Studio or register them programmatically. A theme is a set of color tokens and effect flags:

```ts
{
  name: 'my-theme',
  label: 'My Theme',
  colors: { bgPrimary, bgSecondary, border, textPrimary, textSecondary,
            accentGold, accentPurple, accentBlue, accentGreen, accentRed },
  effects: { neonGlow: true, particles: false }
}
```

### Custom Milestones

Define milestones that trigger at token, file, or line thresholds with visual effects (sparkle, banner, confetti, jackpot, mega) and sound cues.

### Custom Agents

Create agent personas from the Agent Picker or via the `agentsAPI`. Each agent gets a name, description, system prompt, and optional tool restrictions.

### Native Tools via `defineTool()`

The app registers Electron-native tools that the AI agent can call: desktop notifications, clipboard read/write, system info, URL opening, and sound playback. Add your own in `buildNativeTools()` in `copilot-service.ts`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 40 |
| Bundler | Vite 7 + Electron Forge |
| Frontend | React 19, Tailwind CSS 4, Motion |
| AI | `@github/copilot-sdk` |
| Persistence | `electron-store` |
| Language | TypeScript (strict) |

## License

MIT
