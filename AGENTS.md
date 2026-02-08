# AGENTS.md — Copilot Tokens

## Project Overview

**Copilot Tokens** is a gamified Electron desktop client for GitHub Copilot. It wraps the `@github/copilot-sdk` in a slot-machine-themed UI that tracks AI interactions as "tokens," awards milestones, and visualizes coding sessions with animations, sounds, and themes.

## Tech Stack

- **Runtime:** Electron 40 (single-instance), packaged with Electron Forge
- **Build:** Vite 7 with three configs — `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- **Frontend:** React 19 + Tailwind CSS 4 + Motion (Framer Motion)
- **State persistence:** `electron-store` (auth, permissions, stats, packs)
- **Language:** TypeScript (strict), type-check with `npx tsc --noEmit`

## Architecture

```
src/
├── main/           # Electron main process
│   ├── main.ts             # App entry, window creation, single-instance lock
│   ├── copilot-service.ts  # Copilot SDK wrapper (sessions, streaming, models, MCP)
│   ├── permission-service.ts # Tool permission evaluation & persistent rules
│   ├── auth-service.ts     # GitHub auth (OAuth Device Flow + gh CLI detection)
│   ├── ipc-handlers.ts     # ~40 IPC handlers bridging main ↔ renderer
│   ├── stats-service.ts    # Session stats, streaks, achievements, level progress
│   ├── pack-service.ts     # CRUD for milestone/sound/theme packs
│   └── data-dir.ts         # Data directory resolution
├── preload/
│   └── preload.ts          # Context-isolated bridge (copilotAPI, statsAPI, gitAPI, etc.)
└── renderer/
    ├── App.tsx             # Root component — orchestrates panels, modals, state
    ├── components/
    │   ├── ReelArea.tsx        # Chat message feed with animated tiles
    │   ├── PromptBar.tsx       # User input bar
    │   ├── TokenDashboard.tsx  # Live token counters, context bar, git stats
    │   ├── PermissionDialog.tsx # Tool permission approval UI
    │   ├── SplitLayout.tsx     # Multi-panel chat with draggable dividers
    │   ├── Settings.tsx        # App settings panel
    │   ├── PackStudio.tsx      # Editor for custom milestone/sound/theme packs
    │   ├── Leaderboard.tsx     # Session leaderboard
    │   ├── SessionBrowser.tsx  # Browse & replay past sessions
    │   ├── LevelBadge.tsx      # Level tier display
    │   ├── LevelUpOverlay.tsx  # Level-up celebration animation
    │   ├── MilestoneOverlay.tsx # Milestone achievement animation
    │   ├── AvatarMenu.tsx      # GitHub user avatar & auth menu
    │   ├── DiffViewer.tsx      # Unified diff viewer
    │   ├── CommitButton.tsx    # Git commit integration
    │   └── tiles/              # Tool-specific UI tiles
    │       ├── BashTile.tsx
    │       ├── FileEditTile.tsx
    │       ├── FileReadTile.tsx
    │       ├── WebFetchTile.tsx
    │       ├── GenericToolTile.tsx
    │       ├── UserBubble.tsx
    │       ├── MessageTile.tsx
    │       └── IntentBadge.tsx
    ├── lib/
    │   ├── level-system.ts     # 100 levels across 5 categories, polynomial scaling
    │   ├── milestones.ts       # 9 built-in milestones + custom pack support
    │   ├── sound-manager.ts    # Procedural audio (11 sounds, sine/square/sawtooth)
    │   ├── themes.ts           # 3 built-in themes (Neon Arcade, Retro Casino, Minimal)
    │   ├── tile-registry.ts    # Registry for custom tool tile components
    │   ├── register-tiles.ts   # Built-in tile registrations
    │   ├── party-bus.ts        # Event emitter for cross-component pub/sub
    │   ├── render-inline.ts    # Inline markdown rendering helpers
    │   └── types.ts            # Shared renderer types
    ├── hooks/                  # React hooks
    └── types/
        └── global.d.ts         # Global type declarations
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run start` | Launch app via `electron-forge start` |
| `npm run package` | Package app for distribution |
| `npm run make` | Build platform-specific installers |
| `npx tsc --noEmit` | Type-check without emitting |

## Key Patterns & Conventions

### IPC Communication
- All renderer ↔ main communication goes through typed IPC handlers in `ipc-handlers.ts`
- Preload script exposes namespaced APIs: `copilotAPI`, `statsAPI`, `gitAPI`, `cwdAPI`, `authAPI`, `modelAPI`, `mcpAPI`, `packAPI`, `utilAPI`
- Copilot events are routed per-panel via `copilot:event:{panelId}` channels

### Split Panel Sessions
- Each chat panel has a `panelId` (`'main'`, `'split'`, etc.)
- `CopilotService` maintains a `Map<panelId, session>`
- IPC messages include `panelId` for routing

### Permission System
- Reads under CWD auto-approve; writes/shell/URL require user approval
- "YOLO mode" skips all permission dialogs
- Rules persist in electron-store and support "always allow" patterns

### Gamification
- **Tokens:** Input/output tokens tracked per session and lifetime
- **Levels:** 100 levels across 5 categories (tokens, messages, toolCalls, files, lines); all must fill to level up
- **Tiers:** Novice → Adept → Skilled → Veteran → Expert → Master → Legendary
- **Milestones:** Triggered at token/file/line thresholds with visual effects (sparkle, confetti, jackpot)
- **Sounds:** Procedurally generated — no audio files, all synthesized at runtime
- **Themes:** CSS variable-driven with accent colors, glow effects, and particle toggles

### Event System (PartyBus)
- Lightweight pub/sub for decoupled component communication
- Events: token thresholds, tool lifecycle, session idle, milestones, level-up

### Packaging
- `@github/copilot-sdk` is bundled by Vite (not externalized)
- `@github/copilot` (CLI runtime) is copied via `packageAfterCopy` hook and ASAR-unpacked (has native `.node` binaries)

## Animation Library
Use `motion/react` (not `framer-motion`):
```tsx
import { motion } from 'motion/react'
```

## Styling
- Tailwind CSS 4 via `@tailwindcss/vite` plugin
- Theme colors applied as CSS variables; components reference them for consistency
- Global styles in `src/renderer/global.css`

## Adding a New Tool Tile
1. Create component in `src/renderer/components/tiles/`
2. Export from `src/renderer/components/tiles/index.ts`
3. Register in `src/renderer/lib/register-tiles.ts` with the tool name key
4. The tile receives tool call data and renders accordingly

## Adding a New IPC Handler
1. Add handler in `src/main/ipc-handlers.ts`
2. Expose via preload in `src/preload/preload.ts` under the appropriate API namespace
3. Call from renderer through the typed bridge (e.g., `window.copilotAPI.myMethod()`)
