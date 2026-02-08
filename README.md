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

## ✨ Features

### 🤖 Full Copilot Agent
- Agentic coding powered by the `@github/copilot-sdk` — file edits, shell commands, web fetches, and more
- Multi-panel chat with draggable split panes for parallel conversations
- Tool permission system with YOLO mode for the brave
- Model selector with live context window tracking
- MCP server support for extensible tool integrations

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
- Browse past sessions in the Session Browser
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
│   ├── copilot-service    SDK wrapper — sessions, streaming, models, MCP
│   ├── permission-service Tool permission rules & evaluation
│   ├── auth-service       GitHub OAuth Device Flow + gh CLI detection
│   ├── stats-service      Lifetime stats, streaks, level progress
│   └── pack-service       Custom milestone/sound/theme pack CRUD
├── preload/           Context-isolated bridge
│   └── preload            Typed APIs: copilot, stats, git, auth, model, pack
└── renderer/          React 19 + Tailwind 4 + Motion
    ├── App                Root — panels, modals, state orchestration
    ├── components/
    │   ├── ReelArea           Animated chat message feed
    │   ├── TokenDashboard     Live counters & context progress
    │   ├── SplitLayout        Multi-panel with draggable dividers
    │   ├── PermissionDialog   Tool approval UI
    │   ├── PackStudio         Theme/milestone/sound editor
    │   ├── SessionBrowser     Past session explorer
    │   ├── DiffViewer         Unified diff rendering
    │   └── tiles/             Per-tool UI components
    └── lib/
        ├── level-system       100-level polynomial progression
        ├── milestones         Threshold-based achievement triggers
        ├── sound-manager      Web Audio procedural synthesis
        ├── themes             CSS variable-driven theming
        └── party-bus          Cross-component event pub/sub
```

### Design Principles

- **Three-process Electron architecture** — main (Node.js), preload (context bridge), renderer (browser). All IPC is typed end-to-end.
- **No external audio files** — all sounds are procedurally generated with the Web Audio API.
- **CSS variable theming** — themes swap a set of CSS custom properties; components reference variables, never hard-coded colors.
- **Event-driven gamification** — a lightweight pub/sub bus (PartyBus) decouples game events from UI, so milestones, level-ups, and celebrations trigger without tight coupling.
- **Persistent state** — auth, permissions, stats, packs, and level progress all persist via `electron-store`.

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

### Custom Tool Tiles

1. Create a component in `src/renderer/components/tiles/`
2. Export from the barrel `index.ts`
3. Register in `src/renderer/lib/register-tiles.ts` with the tool name as key

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
