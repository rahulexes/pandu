# 🎴 PANDU — Multiplayer Online Card Game

A mobile-first, server-authoritative online multiplayer card game built with **Next.js 15**, **React 19**, **Socket.IO**, **Tailwind CSS 4**, and **Motion**.

Playable completely online through **private room links** or **room codes** across Android, iOS, tablets, and desktop browsers.

---

## 🌟 Key Features

- 🎮 **Modes**: Individual Mode & Team Mode (up to 4 teams of 4 players).
- 🔒 **Server-Authoritative Anti-Cheat**: Hidden cards are never sent to unauthorized clients.
- ⚡ **Real-Time Special Powers**:
  - **7 / 8**: Look at one of your own cards (5s peek).
  - **9 / 10**: Look at another player's card (5s peek).
  - **Q (Queen)**: Blind card exchange between players/teams.
  - **J (Jack / X Reaction)**: Instant-reaction discard race with 1-penalty validation.
- 👑 **PANDU Endgame Flow**: Strategic call triggers final turn sequence with caller going last (Queen-dependent in Team Mode).
- 🏆 **Dynamic Scoring**: A=1, 2–10=face value, J=11, Q=12, K=0. Lowest score wins with tie handling.
- 🔊 **Zero-Dependency Web Audio Synthesizer**: Realistic card shuffles, flips, chimes, alarms, victory fanfares, and haptic vibration on mobile.
- 🎨 **Responsive Mobile Portrait UI**: Glassmorphism dark theme, 3D card flips, avatar picker, and real-time room synchronization.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Both Server and Web App
```bash
pnpm dev
```

- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **Game Server**: [http://localhost:3001](http://localhost:3001)

### 3. Run Automated Tests
```bash
cd apps/server && npx vitest run
```

---

## 🏗️ Architecture

```
PANDU/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/            # App router (Home, Room Lobby, Game Table)
│   │   │   ├── components/     # 3D Cards, Avatars, DeckStack, Scoreboard
│   │   │   ├── hooks/          # Socket.IO client hooks with haptics
│   │   │   ├── lib/            # Web Audio synthesizer sound engine
│   │   │   └── stores/         # Zustand state stores
│   │   └── public/
│   │
│   └── server/                 # Node.js + Socket.IO server
│       ├── src/
│       │   ├── engine/         # Deck, State Machine, Turn System, Special Powers, X Reaction, PANDU, Scoring
│       │   ├── rooms/          # Room & RoomManager controller
│       │   ├── network/        # SocketManager event routing
│       │   └── index.ts        # Server entry point
│       └── tests/              # Vitest engine & e2e multiplayer tests
│
└── packages/
    └── shared/                 # Shared constants, types, game states, socket events
```

---

## 📱 Mobile Experience
- Optimized for Android & iOS mobile portrait orientation.
- Prevents accidental zooming and supports double-tap card interactions.
- Haptic feedback on supported mobile devices.
- Toggle sound on/off with persistent preferences.
