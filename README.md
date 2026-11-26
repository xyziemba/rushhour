# Puzzle Lot

Small puzzle games that run in the browser. It's front end only: no server, no accounts and no tracking. It works on phones and desktops, and is live at **https://xyziemba.github.io/rushhour/**.

## Games

| Game | Idea |
|---|---|
| **Bus Jam** | Drive vehicles out of a jammed lot to pick up a line of color-coded passengers |
| **Arrow Escape** | Tap arrows to fly them off the board; crashing costs a heart |
| **Tile Tray** | Pick uncovered tiles into a 7-slot tray; three of a kind clear |
| **Color Tubes** | Pour colored layers until each tube holds one color |
| **Screw Sort** | Unscrew layered plates and box screws by color |
| **Pipe Turn** | Rotate pipes until water reaches every tile |
| **Block Fit** | Place pieces on an 8×8 board, clear rows and columns, hit the target score |
| **Color Links** | Connect matching dots and fill the whole board |
| **Crate Push** | Push every crate onto a target (no pulling) |
| **Slide Out** | Slide blocks along their length to free the red one |
| **Hex Stack** | Place hex stacks; matching tops merge, ten of a color clear |
| **Conveyor Sorter** | Real-time: flip belt switches to route parcels to their bins |
| **Train Switches** | Set the switches, press Go, and get every train to its station without a crash |

Every game has 10 campaign levels with 1–3 star ratings and an Endless mode. On the home screen, "Show color symbols" adds shapes for players who find colors hard to tell apart, and "Relaxed speed" slows the timed game. Keys: `U` undo, `R` restart, `Esc` back (`P` pauses the timed game).

## Offline / install

The site is a Progressive Web App and works with no connection. Open it once while online: a service worker (`vite-plugin-pwa`) caches every game. To install it on an iPad or iPhone, open the site in Safari and choose **Share → Add to Home Screen**. It then opens full screen from its icon, even in airplane mode. Install it instead of using a Safari tab: Safari may clear a site's cached files and saved progress after about a week of not visiting, but home-screen apps are exempt. A newly deployed version downloads in the background and switches over the next time you return to the home screen, never in the middle of a level.

## Development

```sh
npm install
npm run dev         # local dev server
npm test            # rules + level tests (Vitest)
npm run build       # static build in dist/
npm run gen-levels  # re-generate the pre-built campaigns (Slide Out, Crate Push)
```

### Layout

| Path | What |
|---|---|
| `src/main.ts` | Boot and routing (`#/`, `#/<game>`, `#/<game>/level/N`, `#/<game>/endless/SEED`) |
| `src/shell/` | Everything games share: `game-shell.ts` (HUD, undo, win/lose), hub and level-select pages, storage, router, palette, CSS |
| `src/lib/` | Seeded RNG, grid and hex helpers, BFS/DFS solver |
| `src/games/registry.ts` | The list of games shown in the hub; each is loaded on demand |
| `src/games/<id>/` | One game: `index.ts` (its `GameModule`), `rules.ts`, `generate.ts`, `levels.ts`, `view.ts`, `style.css` |
| `tests/` | `all-games.test.ts` checks every registered game, plus per-game rule tests |

### Adding a game

1. Create `src/games/<id>/` and export a `GameModule` (see `src/shell/types.ts`) as the default export of `index.ts`.
2. Give every campaign level and endless level a `solution` (a winning move list). Real-time games provide an `autoplay` bot instead.
3. Add an entry to `src/games/registry.ts`.

`tests/all-games.test.ts` then checks automatically that every campaign level and a batch of endless seeds are deterministic and that their solutions win. If a campaign is too slow to generate in the browser, pre-generate it into JSON (see `scripts/gen-levels.ts`).

## Deploying

`.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`.
