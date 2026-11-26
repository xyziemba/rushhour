# Puzzle Lot

Small puzzle games that run in the browser. It's front end only: no server, no accounts and no tracking. It works on phones and desktops, and is live at **https://xyziemba.github.io/rushhour/**.

## Games

| Game | Status |
|---|---|
| **Bus Jam**: clear a jammed parking lot to pick up a line of color-coded passengers | ✅ Playable |
| Arrow Escape, Tile Tray, Color Tubes, Screw Sort, Pipe Turn, Block Fit, Color Links, Crate Push, Sliding Block, Hex Stack, Conveyor Sorter, Train Switches | Planned, see [`PLAN-ARCADE.md`](PLAN-ARCADE.md) |

Every game has 10 campaign levels with 1–3 star ratings, and most have an Endless mode. "Show color symbols" on the home screen adds shapes for players who find the colors hard to tell apart. Keys: `U` undo, `R` restart, `Esc` back.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # rules + level tests (Vitest)
npm run build    # static build in dist/
```

### Layout

| Path | What |
|---|---|
| `src/main.ts` | Boot and routing (`#/`, `#/<game>`, `#/<game>/level/N`, `#/<game>/endless/SEED`) |
| `src/shell/` | Everything games share: `game-shell.ts` (HUD, undo, win/lose), hub and level-select pages, storage, router, palette, CSS |
| `src/lib/` | Seeded RNG and grid helpers |
| `src/games/registry.ts` | The list of games shown in the hub; each is loaded on demand |
| `src/games/<id>/` | One game: `index.ts` (its `GameModule`), `rules.ts`, `generate.ts`, `levels.ts`, `view.ts`, `style.css` |
| `tests/` | `all-games.test.ts` checks every registered game, plus per-game rule tests |

### Adding a game

1. Create `src/games/<id>/` and export a `GameModule` (see `src/shell/types.ts`) as the default export of `index.ts`.
2. Give every campaign level and endless level a `solution` (a winning move list).
3. Add an entry to `src/games/registry.ts`.

`tests/all-games.test.ts` then checks automatically that every campaign level and 200 endless seeds are deterministic and that their solutions win.

## Deploying

`.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`.
