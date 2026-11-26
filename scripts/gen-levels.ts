/**
 * Pre-generates campaign levels for games whose generators are too slow to
 * run while the player waits. Run with:  npm run gen-levels [-- <game-id>]
 * The output JSON is committed; tests replay every stored solution.
 */
import { writeFileSync } from 'node:fs';
import * as slide from '../src/games/slide-out/rules';
import { SLIDE_PARAMS } from '../src/games/slide-out/params';
import * as crate from '../src/games/crate-push/rules';
import { CRATE_PARAMS } from '../src/games/crate-push/params';

const only = process.argv[2];

if (!only || only === 'slide-out') {
  const levels = SLIDE_PARAMS.map((p) => {
    const t = Date.now();
    const lv = slide.generate({ ...p, attempts: 600 });
    console.log(`slide-out ${p.id}: par ${lv.par} (${Date.now() - t}ms)`);
    return lv;
  });
  writeFileSync('src/games/slide-out/levels.json', JSON.stringify(levels) + '\n');
}

if (!only || only === 'crate-push') {
  const levels = CRATE_PARAMS.map((p) => {
    const t = Date.now();
    const lv = crate.generate({ ...p, attempts: 150 });
    console.log(`crate-push ${p.id}: ${lv.crates.length} crates, par ${lv.par} (${Date.now() - t}ms)`);
    return lv;
  });
  writeFileSync('src/games/crate-push/levels.json', JSON.stringify(levels) + '\n');
}
