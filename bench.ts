// Burnrate-bench v0 — entrypoint.  Run:  npx tsx bench.ts
//
// Loads the public matrix (+ an optional external corpus if one is wired in via env),
// runs every case through the shield, scores with the external judge, prints the matrix report.
//
// Any adversarial corpus is kept OUT of this public repo. If a local module is pointed at by the
// BENCH_EXTRA_CORPUS env var and exports a corpus, it is pulled in at runtime only.

import { MATRIX } from "./matrix.js";
import { defaultConfig, runAll } from "./runner.js";
import { simJudge } from "./judge.js";
import { startForkJudge } from "./fork-judge.js";
import { report } from "./report.js";
import type { BenchCase } from "./types.js";

async function loadExtraCorpus(): Promise<BenchCase[]> {
  // optional: point BENCH_EXTRA_CORPUS at a local module exporting `redAgentCases: BenchCase[]`.
  const extra = process.env.BENCH_EXTRA_CORPUS;
  if (!extra) return []; // not wired — public matrix only
  try {
    const mod: any = await import(extra);
    const cases: BenchCase[] = mod.redAgentCases ?? [];
    if (cases.length) console.log(`(loaded ${cases.length} external corpus case(s))`);
    return cases;
  } catch {
    return [];
  }
}

async function main() {
  const extra = await loadExtraCorpus();
  const cases = [...MATRIX, ...extra];

  if (process.env.JUDGE === "fork") {
    console.log("(judge: LIVE FORK — starting anvil, replaying actions on-chain, 0 real funds)");
    const fork = startForkJudge();
    try {
      const results = runAll(cases, defaultConfig(), fork.judge);
      report(results);
    } finally {
      fork.stop();
    }
    return;
  }

  const results = runAll(cases, defaultConfig(), simJudge);
  report(results);
}

main();
