# Rush Hour: Implementation Plan

A small, front-end-only puzzle game where you clear a jammed parking lot to pick up a queue of color-coded passengers. It has no server, no accounts and no network calls. It ships as static files and runs in any modern desktop or mobile browser.

> The game uses the mechanics of the bus-jam genre with original art, names and levels. It should not copy any specific commercial game's look or assets.

---

## 1. Game rules (what we're building)

**Board zones**
1. **Queue:** an ordered line of passengers, each with a color. Only the front passenger can board.
2. **Bays:** a fixed number of loading spots (default 5).
3. **Lot:** a grid of vehicles. Each vehicle has a color, a length (1–3 cells), a capacity (4 / 6 / 10) and a facing direction (↑ ↓ ← →).

**Turn**
- The player taps a vehicle in the lot.
- If every cell from the vehicle's front to the edge of the grid (in its facing direction) is empty **and** a bay is free, the vehicle drives out and parks in the leftmost free bay.
- Otherwise, the vehicle shakes and nothing changes. A blocked tap does not count as a move.

**Boarding (automatic after every change)**
- While the front passenger's color matches a parked vehicle that still has seats, that passenger boards. If more than one vehicle matches, they board the one that has been waiting longest.
- A full vehicle departs and frees its bay.

**End states**
- **Win:** the queue is empty.
- **Lose:** every bay is occupied and none of the parked vehicles matches the front passenger.
- **Level invariant:** for each color, total vehicle capacity equals the number of passengers of that color.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite** + **TypeScript** | Instant dev server, outputs plain static files, no framework needed. |
| UI | Vanilla TS + DOM/CSS (no React) | The scene is small (fewer than 50 elements). CSS transforms handle animation, and taps hit real elements. |
| State | A single pure `GameState` object plus reducer-style functions | Easy to test, undo and serialize. |
| Persistence | `localStorage` (wrapped in try/catch) | Saves unlocked levels and best move counts. The game still works if storage isn't available. |
| Tests | **Vitest** (engine), **Playwright** (smoke test at phone and desktop sizes) | |
| Hosting | GitHub Pages via a GitHub Actions workflow (optional) | Static hosting only. |

There are no runtime dependencies. The only dev dependencies are `vite`, `typescript`, `vitest` and `@playwright/test`.

---

## 3. Project layout

```
rushhour/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ public/
│  └─ icon.svg
├─ src/
│  ├─ main.ts              # bootstraps app, routes between screens
│  ├─ engine/
│  │  ├─ types.ts          # Color, Dir, Vehicle, Level, GameState
│  │  ├─ grid.ts           # occupancy map, exit-path check
│  │  ├─ game.ts           # tapVehicle(), board(), status(), undo stack
│  │  ├─ solver.ts         # DFS/BFS solvability check (used by tests + generator)
│  │  └─ generator.ts      # random solvable level builder (seeded RNG)
│  ├─ levels/
│  │  └─ levels.ts         # ~10 hand-authored levels as data
│  ├─ ui/
│  │  ├─ render.ts         # state → DOM (lot, bays, queue, HUD)
│  │  ├─ input.ts          # pointer handling
│  │  ├─ animate.ts        # drive-out / shake / board / depart transitions
│  │  └─ screens.ts        # level select, win / lose overlays
│  ├─ storage.ts           # safe localStorage wrapper
│  └─ styles.css
└─ tests/
   ├─ engine.test.ts
   ├─ levels.test.ts       # every shipped level is valid + solvable
   └─ e2e.spec.ts          # Playwright smoke test
```

---

## 4. Data model

```ts
type Color = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'teal';
type Dir = 'up' | 'down' | 'left' | 'right';

interface Vehicle {
  id: string;
  color: Color;
  x: number; y: number;      // tail cell (top-left of its footprint)
  length: 1 | 2 | 3;         // cells along its facing axis
  dir: Dir;
  capacity: number;          // seats
}

interface Level {
  id: string;
  name: string;
  cols: number; rows: number;
  bays: number;
  vehicles: Vehicle[];
  queue: Color[];            // front of line = index 0
}

interface Bay { vehicle: Vehicle; seatsLeft: number; parkedAt: number }

interface GameState {
  level: Level;
  lot: Vehicle[];            // vehicles still in the lot
  bays: (Bay | null)[];
  queue: Color[];            // remaining passengers
  moves: number;
  history: GameState[];      // for undo (capped, e.g. 50)
  status: 'playing' | 'won' | 'lost';
}
```

**Core functions** (pure: each takes a state and returns a new state)
- `canExit(state, vehicleId): boolean` walks the cells ahead of the vehicle to the grid edge.
- `tapVehicle(state, vehicleId): { state, result: 'moved' | 'blocked' | 'no-bay' }`
- `board(state): { state, events[] }` repeatedly boards the front passenger and departs full vehicles. It returns events so the UI can animate them.
- `status(state)` returns win, lose or playing.
- `undo(state)`

---

## 5. Levels

**Hand-authored levels** (`levels.ts`): about 10 levels that ramp in difficulty.
- Levels 1–3: small 5×5 lot, 2–3 colors, plenty of bays, to teach the controls.
- Levels 4–7: 6×7 lot, 4–5 colors, ordering starts to matter.
- Levels 8–10: 7×8 lot, 6+ colors, fewer bays, longer vehicles that block more.

**Random generator** (for an "Endless" mode, built after the core game works):
1. Place vehicles one at a time so that each new vehicle's exit path is clear of all vehicles already placed. Removing them in reverse placement order is then always possible.
2. Build the queue from that removal order: one run of passengers per vehicle, sized to its capacity. Then shuffle neighboring runs slightly, keeping within what the bay count can absorb.
3. Run the solver to confirm the level is solvable, and regenerate if it isn't. Use a seeded RNG so a level can be shared by its seed number.

**Validation test:** every shipped level passes the capacity invariant and `solver.ts` finds a solution.

---

## 6. UI and responsive layout

**Layout**
- **Portrait (phones):** stacked vertically, with the queue on top, the bays in the middle and the lot below, like the reference screenshot.
- **Landscape or desktop (aspect ratio wider than about 4:3):** two columns, with the queue and bays on the left and the lot on the right.
- One CSS variable, `--cell`, sizes everything. It is computed from `min(viewport width, viewport height)` and the grid dimensions, so the lot always fits without scrolling.

**Rendering**
- The lot is a positioned container. Each vehicle is an absolutely positioned `<button>` placed with `transform: translate()`, which gives smooth animation and works with the keyboard.
- Vehicles are rounded rectangles in their color, with an arrow glyph, small windows and a seat-count badge, all drawn with CSS or inline SVG. There are no image assets.
- The queue shows the first ~40 passengers as colored dots along a short serpentine path, with a "+N more" label after that.
- Bays show the parked vehicle and how many seats are left.

**Animations** (CSS transitions, 150–300 ms)
- Drive-out: slide off the grid edge, then fade in at the bay.
- Blocked: a short shake along the vehicle's facing axis.
- Boarding: a dot shrinks into the vehicle and the badge counts down.
- Depart: the vehicle slides out of its bay.
- Input is ignored while an animation plays, so taps can't conflict.

**Input**
- Use `pointerup` on vehicle buttons, which works the same for mouse, touch and pen.
- Set `touch-action: manipulation` to stop double-tap zoom, and add a viewport meta tag.
- Desktop keyboard: Tab/arrow keys move focus between vehicles, Enter/Space taps, **U** undoes and **R** restarts.

**HUD and screens**
- Top bar: level name, move counter, Undo, Restart and Menu.
- Level select: a grid of level buttons that unlock as you progress, plus an Endless button.
- Win overlay shows the move count with Next and Replay buttons. Lose overlay shows "Out of bays" with Undo and Restart buttons.

**Accessibility**
- Each vehicle has an `aria-label` such as "Blue bus, 10 seats, facing left".
- Every color also gets a distinct pattern or shape on its passengers and vehicles, so the game works for color-blind players.
- Respect `prefers-reduced-motion`.

---

## 7. Milestones

| # | Milestone | Done when |
|---|---|---|
| 1 | **Scaffold:** Vite + TS + Vitest, base styles, empty screen | `npm run dev` serves a page and `npm test` runs. |
| 2 | **Engine:** types, exit check, tap, boarding, win/lose, undo | Unit tests cover blocked and clear exits, full bays, multi-vehicle boarding, departure, win and lose. |
| 3 | **Static render:** draw lot, bays and queue from one level | Level 1 shows correctly at 375×812 and 1440×900. |
| 4 | **Interaction and animation:** taps, shake, drive-out, boarding, depart | Level 1 can be played to the end by hand. |
| 5 | **Levels and screens:** 10 levels, level select, win/lose overlays, saved progress | Every level passes the solvability test, and progress survives a reload. |
| 6 | **Polish:** keyboard controls, aria labels, color-blind patterns, reduced motion | |
| 7 | **(Optional) Endless mode:** seeded generator | 1,000 generated seeds all solve in tests. |
| 8 | **(Optional) Deploy:** GitHub Pages workflow, PWA manifest for offline play and "Add to Home Screen" | |

---

## 8. Out of scope

- Any back end, accounts, leaderboards, ads, purchases or analytics.
- Boosters such as extra bays, shuffle or helicopter lifts. These are easy to add later as engine functions if wanted.
- Stacked or hidden vehicles, locks and mystery colors. These are possible v2 mechanics.

## 9. Open questions

1. Should a blocked tap count as a move? The plan says no.
2. Should tapping be allowed when all bays are full? The plan says no: the vehicle shakes and shows an "Out of bays" hint.
3. Is GitHub Pages the hosting target, or will it be served some other way?
