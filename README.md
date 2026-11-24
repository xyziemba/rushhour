# Rush Hour

A small puzzle game you play in the browser. Clear a jammed parking lot to pick up a line of color-coded passengers. It's front end only: no server, no accounts and no tracking. It works on phones and desktops.

## How to play

- Tap a vehicle to drive it out of the lot the way its arrow points. It needs a clear path to the edge.
- Vehicles that leave park in a loading bay.
- Passengers at the front of the line board parked vehicles of their color. Full vehicles depart and free their bay.
- You lose if every bay is full and nobody at the front can board.
- Keys: `U` undo, `R` restart, `Esc` menu.

The game has 10 campaign levels plus an Endless mode with random puzzles. Turn on "Show color symbols" in the menu if colors are hard to tell apart.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # engine + level tests (Vitest)
npm run build    # static build in dist/
```

### Layout

| Path | What |
|---|---|
| `src/engine/` | Pure game logic: rules (`game.ts`), grid helpers, level generator, solver |
| `src/levels/levels.ts` | Campaign level parameters (seeded, deterministic) |
| `src/ui/game-view.ts` | Board rendering, input and animation |
| `src/main.ts` | Hash routing (`#/`, `#/level/N`, `#/endless/SEED`) and menu |
| `tests/` | Rule tests and level checks |

Every level is generated from a seed. The generator records a winning tap order, and the tests replay it, so every campaign level and 1,000 endless seeds are known to be winnable.

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. One-time setup: in the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. The site will be at `https://<owner>.github.io/rushhour/`.
