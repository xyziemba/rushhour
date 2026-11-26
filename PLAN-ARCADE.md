# Puzzle Arcade: Hub Restructure + 12 New Games

This plan turns the single-game site into a hub of small, tap-friendly puzzle games that share one shell. Everything stays front-end only and static on GitHub Pages, and every game must work on phones and desktops.

> **Name.** The site is **Puzzle Lot**, and the original game is **Bus Jam** inside it. The repository keeps its `rushhour` name, so the Pages URL doesn't change.

---

## 1. Goals and ground rules

- **One shell, many games.** The top bar, undo/restart, level select, win/lose screens, saved progress, toasts, keyboard shortcuts and theming are written once. Each game supplies only its rules, its board rendering and its level generator.
- **Each game should feel like the current one:** one screen, short sessions, tap or drag to play, clear win and loss states, and undo where it makes sense.
- **Levels are generated from seeds,** and every turn-based game comes with *proof* that its levels can be won. The generator either records a winning move list or a solver finds one, and a shared test replays it for every campaign level and many endless seeds.
- **Original look and names.** The games use the genre's mechanics only, with no copied art, names or level designs from existing apps.
- **The menu loads fast.** Each game is code-split (`import()`), so opening the hub doesn't download all 13 games.
- **The same minimum bar for every game:** playable at 320 px wide with no sideways scrolling, works with touch, mouse and keyboard, supports reduced motion, and offers the color-symbol mode wherever color matters.

---

## 2. Target structure

```
src/
├─ main.ts                    # boot: router → hub or game
├─ shell/
│  ├─ router.ts               # #/  ·  #/<game>  ·  #/<game>/level/N  ·  #/<game>/endless/SEED
│  ├─ hub.ts                  # game picker (cards with icon, name, progress)
│  ├─ level-select.ts         # generic per-game level grid + endless button
│  ├─ game-shell.ts           # HUD, history/undo, status checks, overlays, toast, keys
│  ├─ storage.ts              # namespaced progress: { [gameId]: GameProgress } + settings
│  ├─ input.ts                # tap + drag helpers (pointer capture, tap-to-select fallback)
│  ├─ fit.ts                  # ResizeObserver → --cell sizing for any board
│  ├─ palette.ts              # 8 colors + symbols (shared)
│  └─ shell.css               # tokens, buttons, HUD, overlay, hub, level-select
├─ lib/
│  ├─ rng.ts                  # mulberry32, shuffle, pick, weighted
│  ├─ grid.ts                 # square-grid helpers (neighbors, bounds, keys)
│  ├─ hex.ts                  # axial hex coords, neighbors, pixel layout
│  └─ search.ts               # generic BFS / DFS-with-memo solver (node-capped)
├─ games/
│  ├─ registry.ts             # ordered list of { id, title, icon, load: () => import(...) }
│  ├─ bus-jam/                # the current game, moved here
│  ├─ tile-tray/
│  ├─ color-tubes/
│  ├─ … one folder per game
└─ tests/
   ├─ shell.test.ts
   ├─ all-games.test.ts       # registry-driven: every level valid + winnable
   └─ games/<id>.test.ts      # rules tests per game
```

Each game folder has the same layout:

```
games/<id>/
├─ index.ts      # exports the GameModule
├─ rules.ts      # pure state + moves (no DOM)
├─ generate.ts   # seeded generator (+ recorded solution)
├─ levels.ts     # campaign params
├─ view.ts       # DOM rendering + input + animation
└─ style.css     # scoped under .g-<id>
```

### 2.1 The `GameModule` contract

```ts
type Status = 'playing' | 'won' | 'lost';

interface GameModule<Level, State, Move> {
  id: string;                 // 'bus-jam', 'tile-tray', ...
  title: string;
  tagline: string;
  howToPlay: string[];        // bullet list for the help sheet
  kind: 'turn' | 'realtime';  // realtime games: no undo, shell shows pause instead

  campaign: { count: number; params(i: number): unknown; name(i: number): string };
  generate(params: unknown): Level & { solution?: Move[] };
  endless?(seed: number, streak: number): unknown;     // returns params

  init(level: Level): State;
  apply(state: State, move: Move): { state: State; events: unknown[] } | null;  // null = illegal
  status(state: State): Status;
  lossMessage?(state: State): { title: string; body: string };
  score?(state: State): { moves: number; stars?: 1 | 2 | 3 };

  mountView(el: HTMLElement, ctx: ViewContext<State, Move>): GameView<State>;
}

interface ViewContext<State, Move> {
  play(move: Move): Promise<void>;  // shell applies + records history + asks view to animate
  symbols: boolean;
  reducedMotion: boolean;
  toast(msg: string): void;
}

interface GameView<State> {
  render(state: State): void;                                     // full redraw (undo/restart)
  animate(prev: State, next: State, events: unknown[]): Promise<void>;
  destroy(): void;
}
```

The shell owns the **history stack, the move counter, status checks and overlays**. Games never touch them. This makes undo, restart and win/lose behave the same everywhere, and it lets one test file check every game.

**Real-time games** (Conveyor Sorter, Train Switches when running) also implement `tick(state, dtMs)`. The shell then runs a `requestAnimationFrame` loop with pause/resume and hides the undo button.

### 2.2 Routing and saved data

- `#/` → hub · `#/<game>` → that game's level select · `#/<game>/level/N` · `#/<game>/endless/SEED`
- **Backward compatibility:** `#/level/N` and `#/endless/SEED` redirect to `#/bus-jam/...`.
- **Storage key** `puzzlelot:v2`:
  ```ts
  { settings: { symbols: boolean },
    games: { [id]: { unlocked: number; best: Record<string, number>; stars: Record<string, 1|2|3>; endlessStreak: number } } }
  ```
  On first load, existing `rushhour:v1` data migrates into `games['bus-jam']`. Every read and write is wrapped in try/catch.

### 2.3 Shared tests

`all-games.test.ts` loops over the registry. For each game:
1. Every campaign level generates **deterministically** (same JSON twice).
2. `apply`-replaying the level's `solution` from `init` reaches `won`. Score-target games instead play a short scripted session without crashing.
3. 200 endless seeds generate within a time budget (< 50 ms each) and replay to a win.
4. `init(level)` starts in `playing`.

Per-game rule tests live in `tests/games/<id>.test.ts`.

### 2.4 Hub UI

- A grid of game cards. Each card has an inline-SVG icon (no image files), a name, a one-line tagline and progress (e.g. "4/10 ★7").
- A settings sheet with the color-symbol toggle and a "reset progress" button that asks for confirmation.
- The last-played game is highlighted, so returning players can tap straight back in.
- Every game's level select has the same layout: 10 levels, Endless, and How to play.

---

## 3. Phases

| Phase | Contents | Done when |
|---|---|---|
| **0. Restructure** | Shell + lib + registry; move the current game into `games/bus-jam`; hub; storage migration; old-URL redirects; shared tests; code-splitting. **No gameplay changes.** | Bus Jam plays exactly as before at `#/bus-jam`, old links and progress still work, and all tests pass. |
| **1. Quick wins** | Arrow Escape, Tile Tray, Color Tubes | Each has 10 levels + endless, passes the shared tests, and is checked at phone and desktop sizes. |
| **2. Core set** | Screw Sort, Pipe Turn, Block Fit | Same, plus drag input in `shell/input.ts` (needed by Block Fit). |
| **3. Thinkers** | Color Links, Crate Push, Sliding Block | Same, plus the shared solver in `lib/search.ts`. |
| **4. Big ones** | Hex Stack, Conveyor Sorter, Train Switches | Same, plus real-time support in the shell (tick loop, pause). |

Each phase ships as its own PR, and a game can be dropped from a phase without blocking the others.

---

## 4. Game specs

Effort: **S** about a day · **M** 2–3 days · **L** 4+ days (for one focused build pass, including tests).

### 4.1 Bus Jam *(existing, phase 0)*
This is today's game, moved into `games/bus-jam` without rule changes. **Optional upgrade:** star ratings based on move count compared with the stored solution length.

---

### 4.2 Arrow Escape *(phase 1, S)*
**Play:** A tangle of arrow pieces sits on a grid. Tap a piece and it flies out in its arrow's direction if its path is clear. Clear the whole board.
**Losing:** you get **3 crash lives**. Tapping a blocked piece costs one, and the blocking piece flashes.
**Model:** reuses Bus Jam's `grid.ts`/`exitPath`; state = pieces + lives.
**Generator:** Bus Jam's `placeVehicles` at higher density (more pieces per cell). Reverse placement order is the stored solution.
**Difficulty:** board size, piece count, and how much pieces block each other.
**Stars:** 3 = no crashes, 2 = one crash.
**UI:** pieces drawn as long arrows instead of vehicles, so it looks different from Bus Jam.

---

### 4.3 Tile Tray *(phase 1, M)*
**Play:** Tiles with simple icons are stacked in overlapping layers. Only uncovered tiles can be tapped. A tapped tile moves into a **7-slot tray**, which keeps matching icons next to each other. **Three of a kind clear.** You win when the board is empty.
**Losing:** the tray fills to 7 with no triple.
**Model:** `Tile { id, icon, layer, x, y }` on a half-cell grid, so tiles can overlap by half. A tile is covered if any tile in a higher layer overlaps it. The tray is a list of icons.
**Generator** (guaranteed winnable):
1. Lay out positions and layers first (pyramids and other patterns, chosen from seeded templates plus random jitter).
2. Pick a random removal order that respects covering, i.e. a random topological order.
3. Assign icons along that order in groups of 3. Like Bus Jam's `bury`, a `spread` knob lets groups interleave as long as the tray never holds more than `7 − 1` tiles. Store the order as the solution.
**Difficulty:** tile count (36 → 150), layers, icon variety, spread.
**UI:** Icons are simple inline-SVG shapes and fruit-like glyphs in our palette, each with a distinct shape so color isn't the only cue. Tray slots sit along the bottom, and a triple pops when it clears.

---

### 4.4 Color Tubes *(phase 1, S–M)*
**Play:** Tubes hold up to 4 colored layers. Tap a tube, then tap another, to pour. Only the top color pours: as many matching layers as fit, and only onto an empty tube or a matching top. You win when every tube is empty or full of one color.
**Losing:** no legal pours are left. Undo still works.
**Generator:** shuffle `n` colors × 4 layers into `n` tubes, plus 2 empty tubes. A memoized DFS solver (`lib/search.ts`, capped at 200k nodes) checks it and records the solution; reject and retry if no solution is found. Levels are small enough (≤ 12 colors) that this is fast.
**Difficulty:** colors (3 → 12), number of empty tubes (2 → 1), tube height (4 → 5).
**Stars:** compare the player's pour count with the solver's solution length.
**UI:** tubes are rounded rectangles in a wrapping flex row. The selected tube lifts, and pours animate as liquid moving across. The tap-tap input also works from the keyboard (arrow keys + Enter).

---

### 4.5 Screw Sort *(phase 2, M)*
**Play:** Colored screws pin overlapping plates. Colored **boxes** take 3 screws each. Two boxes are open at a time, and more wait in a queue. Tapping a screw that isn't covered by a plate above:
- moves it into the open box of its color, or otherwise into one of **5 spare holes**;
- full boxes leave and the next box arrives;
- screws in spare holes move into a matching box automatically;
- when a plate has no screws left, it falls and uncovers what was underneath.
**Losing:** all spare holes are full and none of their screws fit an open box.
**Model:** plates (a polygon on a coarse grid + layer), screws (plate id, position, color), the box queue and the holes. It's Bus Jam's queue/bay logic with screws instead of passengers.
**Generator:** place plates top-down, then plan the removal order the way Bus Jam's `planQueue` does. The box queue comes from that plan, with `bury` controlling how often a needed screw is buried. Store the solution.
**Difficulty:** plates, layers, colors, number of spare holes (5 → 4), bury.
**UI:** plates are translucent rounded shapes in muted tones. Screws are colored circles with a slot. A falling plate drops and fades.

---

### 4.6 Pipe Turn *(phase 2, S)*
**Play:** The grid is full of pipe pieces (straight, elbow, T, cross). Tap a piece to rotate it 90°. Connect every piece to the water source with no open ends. Water fills the connected pipes as you go.
**Losing:** none. Stars depend on the number of rotations.
**Generator:** build a random spanning tree from the source (randomized DFS or Prim's), derive each cell's pipe shape from its tree edges, then rotate every piece randomly. The solution is "rotate each piece back", which is easy to store.
**Difficulty:** grid size (4×4 → 9×9), wrap-around edges in late levels, locked pieces.
**UI:** SVG pipe pieces with a CSS rotation transition. Connected pipes turn blue.

---

### 4.7 Block Fit *(phase 2, M)*
**Play:** An 8×8 board and a tray of 3 shapes. Drag a shape onto the board; tap-select-then-tap-cell also works. Full rows and columns clear, and once all 3 shapes are placed, 3 new ones appear.
**Goal for each level:** reach a target score, or clear the target cells, before getting stuck.
**Losing:** none of the shapes in the tray fit anywhere.
**Model:** board bitmask, tray, score, seeded piece sequence.
**Generator:** a seeded piece sequence plus a target. A greedy bot plays the sequence in the tests, and the target is set at about 70% of the bot's score, which shows the target is reachable. Endless mode is a pure high-score run.
**Difficulty:** target score, blocked starting cells, harder shape mix.
**UI:** a ghost preview while dragging, and a flash when rows clear. The shape lifts above the finger so the finger doesn't hide it.
**Undo:** one undo per level, so a single misplaced shape can be taken back.

---

### 4.8 Color Links *(phase 3, M)*
**Play:** The grid has pairs of colored dots. Drag to draw a path between each pair. Paths can't cross, and the level is solved when every pair is connected and **every cell is filled**.
**Losing:** none. Stars are based on how many times you redraw a path.
**Generator:**
1. Cover the grid with a random set of paths: start from a random Hamiltonian-like snake, then split it into segments of length ≥ 3, and repair or merge any segment that's too short.
2. The segment endpoints become the dots, and the paths are the stored solution. Any other valid fill also counts as a win.
**Difficulty:** grid size (5×5 → 10×10), number of pairs.
**UI:** drag input from `shell/input.ts`. Starting a new path from a dot erases that color's old path, and dragging back over your own path shortens it. Keyboard alternative: select a dot, then use arrow keys to extend the path.

---

### 4.9 Crate Push *(phase 3, L)*
**Play:** Walk a little mover around the grid with swipes, arrow keys or tap-to-step. Push crates (never pull them) onto all the target squares.
**Losing:** none, but the game detects deadlocks (a crate in a corner that isn't a target) and suggests undo.
**Generator:** reverse play. Start with every crate on a target, then let the mover make random **pull** moves for N steps, so every resulting layout is reachable. Walls come from seeded room templates. A BFS solver (crates + normalized mover position) confirms solvability and gives the optimal push count; levels below a difficulty threshold are rejected.
**Difficulty:** room size (6×6 → 9×9), crates (1 → 4), minimum optimal pushes.
**Stars:** compared with the solver's optimal number of pushes.
**Risk:** the solver can get slow with 4 crates in large rooms. Mitigation: a node cap plus small rooms, and cache the generated levels inside `levels.ts` if needed.

---

### 4.10 Sliding Block *(phase 3, M)*
**Play:** Blocks slide only along their long axis. Drag a block to slide it any distance. Free the highlighted block through the exit on the right.
**Losing:** none. Stars compare your moves with the optimum.
**Generator:** place random blocks on a 6×6 board with the target block in the exit row. A BFS solver finds the optimal move count; keep a layout only if the optimum falls inside the level's band (e.g. 8–12 moves for mid levels).
**Difficulty:** the optimal move band (3 → 30+).
**UI:** blocks follow the finger while dragging and snap to cells, and the exit gap is marked in the wall. Keyboard: select a block, then use arrow keys.
**Naming:** give it an original name such as "Slide Out". Don't use the name of the board game this genre is known for.

---

### 4.11 Hex Stack *(phase 4, L)*
**Play:** A hex board, plus 3 stacks of colored hex tiles offered at a time. Place a stack on an empty hex. When neighboring stacks have the same top color, their top tiles slide together into one stack, and this can chain. **10 or more of one color on top clears** and scores.
**Goal for each level:** reach the target score. **Losing:** the board fills up.
**Model:** axial hex coordinates (`lib/hex.ts`), each cell holds a stack (an array of colors); a seeded sequence of offered stacks.
**Merge rule (deterministic):** after a placement, repeatedly find a neighbor with the same top color and move that run onto the stack with more of that color (ties go to the newly placed stack), until nothing changes; then clear any stack with ≥ 10 of its top color.
**Generator:** seeded offer sequence + target, calibrated with a greedy bot like Block Fit.
**UI:** SVG hexes with stack height shown as offset layers. Merges animate tile by tile, with a short delay per tile.
**Risk:** chained merges are easy to get subtly wrong. Write the rules test-first, with hand-built boards.

---

### 4.12 Conveyor Sorter *(phase 4, M, real-time)*
**Play:** Colored parcels ride a branching conveyor. Tap a junction to flip its gate. Route each parcel into the bin of its color.
**Goal for each level:** sort N parcels. **Losing:** 3 misroutes.
**Model:** a belt graph (tree) with junction states and parcels (position along an edge). `tick(dt)` advances them.
**Generator:** seeded layouts from tree templates (2 → 6 bins), plus a spawn script (colors and timing) that speeds up over the level. Winnability is checked by a test bot that flips each gate correctly the moment a parcel reaches it; the spawn gap always leaves enough time for that.
**Difficulty:** number of bins, spawn rate, belt speed, junctions that need two flips.
**UI:** SVG belts with a scrolling dash pattern. Gates show an arrow. Pause when the tab is hidden (`visibilitychange`). No undo.
**Accessibility:** a "relaxed" setting that slows everything to 60%.

---

### 4.13 Train Switches *(phase 4, L)*
**Play (planning mode):** a track map with colored stations and several switches. Set the switches, then press **Go**: the trains run at the same time. Each train must reach the station of its color with no collisions. If one fails, you see where, reset and try again.
**Optional later:** a live mode where switches can be flipped while trains run, reusing the real-time loop.
**Losing:** none in planning mode. Stars are based on the number of runs.
**Model:** a track graph with switch nodes, plus trains (color, start, departure time); the simulation runs in discrete ticks.
**Generator:** track layouts from seeded templates. Brute-force every switch setting (2^k, k ≤ 10) to confirm there's exactly one, or at least one, that works, and store it as the solution. Raise difficulty by adding trains whose paths share track segments, so timing matters.
**UI:** SVG tracks; a switch is a tappable pivot. Trains are short colored capsules that move along SVG paths (`getPointAtLength`).

---

## 5. Shared pieces built along the way

| Piece | Needed by | Phase |
|---|---|---|
| `GameShell` (history, HUD, overlays, keys) | all | 0 |
| Level select, hub, storage v2, router | all | 0 |
| `lib/rng.ts`, `lib/grid.ts` | all | 0 |
| Tap-tap selection helper | Color Tubes, Sliding Block, Block Fit fallback | 1 |
| Drag input (pointer capture, ghost preview, lift above finger) | Block Fit, Color Links, Sliding Block | 2 |
| `lib/search.ts` (BFS/DFS + memo + node cap) | Color Tubes, Crate Push, Sliding Block, Train Switches | 1 → 3 |
| Star rating vs par | most turn-based games | 1 |
| Greedy calibration bot harness | Block Fit, Hex Stack | 2 |
| `lib/hex.ts` | Hex Stack | 4 |
| Real-time loop + pause | Conveyor, Train Switches (live) | 4 |

---

## 6. Testing and quality bar (every game)

- **Rules unit tests:** legal and illegal moves, win, loss and edge cases.
- **Shared registry tests** (§2.3): deterministic generation, winnable campaign, 200 endless seeds within the time budget.
- **Browser check** at iPhone SE (320×568), iPhone 13 and 1280×800: no console errors, no sideways scrolling, and one level played to a win by a script that replays the stored solution through the UI.
- **Bundle budget:** hub JS ≤ 30 kB gzip, each game chunk ≤ 25 kB gzip.
- CI (`deploy.yml`) already runs `npm test` before building, so a broken level blocks the deploy.

---

## 7. Effort summary

| Phase | Games | Rough size |
|---|---|---|
| 0 | Restructure | M |
| 1 | Arrow Escape (S), Tile Tray (M), Color Tubes (S–M) | M–L |
| 2 | Screw Sort (M), Pipe Turn (S), Block Fit (M) | L |
| 3 | Color Links (M), Crate Push (L), Sliding Block (M) | L |
| 4 | Hex Stack (L), Conveyor Sorter (M), Train Switches (L) | L+ |

---

## 8. Decisions

1. **Name:** Puzzle Lot. The repo stays `rushhour`, so the URL is unchanged.
2. **Real-time games:** keep them (Conveyor Sorter, live Train Switches).
3. **Stars:** 1–3 stars in every game. Bus Jam can't use move counts, because a win always takes exactly one tap per vehicle, so its stars reward undo-free play instead (★★★ no undos, ★★ up to two).
4. **Order:** phases as listed.

## 9. Status

All phases are built: 13 games, each with 10 levels, stars and Endless mode.

**Differences from the plan:**
- **Slide Out and Crate Push campaigns are pre-generated.** Finding hard puzzles takes seconds, so `npm run gen-levels` writes them to JSON, and the tests confirm that the stored pars are optimal. Endless puzzles for these two still generate in the browser and can take up to about a second.
- **Tile Tray uses 12 inline-SVG icons** instead of emoji, so they look the same on every device.
- **Train Switches is planning mode only.** The live mode (flipping switches while trains run) is not built.
- **Conveyor Sorter:** "Relaxed speed" is a setting on the home screen (60% speed). Levels are checked so that playing with no input loses.
- **Color Links has no keyboard drawing yet.** It needs a mouse or touch.
- **Color Tubes uses at most 8 colors** (the shared palette) instead of 12.
