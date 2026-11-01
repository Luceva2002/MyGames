import { GAMES, playerCounts, simulate } from "../src";
import { checks } from "./rules";

let failed = 0;
for (const game of GAMES) {
  const all = playerCounts(game.meta);
  const counts = [...new Set([all[0], all[Math.floor(all.length / 2)], all[all.length - 1]])];
  for (const players of counts) {
    let wins = 0;
    let steps = 0;
    let runs = 0;
    try {
      runs = game.meta.id === 'scacchi' ? 2 : game.meta.id === 'dama' || game.meta.id === 'mosaico' ? 6 : 40;
      for (let seed = 1; seed <= runs; seed++) {
        let r;
        try {
          r = simulate(game, players, seed * 7919);
        } catch (e) {
          if (seed === 1 && /si gioca in/.test(String((e as Error).message))) throw e;
          throw new Error(`seed ${seed * 7919}: ${(e as Error).stack}`);
        }
        if (r.result.winners.length) wins++;
        steps += r.steps;
      }
      console.log(`✓ ${game.meta.id} ${players}p  — ${runs} partite, ${wins} con vincitore, ${Math.round(steps / runs)} mosse in media`);
    } catch (e) {
      const msg = String((e as Error).message);
      if (/si gioca in/.test(msg)) continue;
      failed++;
      console.log(`✗ ${game.meta.id} ${players}p: ${msg}`);
    }
  }
}
for (const extra of checks) {
  try {
    extra.fn();
    console.log(`✓ ${extra.name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${extra.name}: ${(e as Error).message}`);
  }
}
if (failed) {
  console.log(`\n${failed} test falliti`);
  process.exit(1);
}
