// Burnrate-bench v0 — entrypoint.  Run:  npx tsx bench.ts
//
// Loads the public matrix (+ any private red-agent cases if the attacker repo is wired in),
// runs every case through the shield, scores with the external judge, prints the matrix report.
//
// Red-agent (core A) cases are NEVER in this public repo. If the private burnrate-attacker repo is
// present as a sibling and exports a corpus, we pull it in here at runtime only — the code stays private.

import { MATRIX } from "./matrix.js";
import { defaultConfig, runAll } from "./runner.js";
import { simJudge } from "./judge.js";
import { startForkJudge } from "./fork-judge.js";
import { report } from "./report.js";
import type { BenchCase } from "./types.js";

async function loadRedAgentCases(): Promise<BenchCase[]> {
  // optional: ../burnrate-attacker/bench-corpus.ts may export `redAgentCases: BenchCase[]`
  try {
    const mod: any = await import("../burnrate-attacker/bench-corpus.js");
    const cases: BenchCase[] = mod.redAgentCases ?? [];
    if (cases.length) console.log(`(loaded ${cases.length} private red-agent cases from burnrate-attacker)`);
    return cases;
  } catch {
    return []; // not present / not wired — public matrix only
  }
}

async function main() {
  const redAgent = await loadRedAgentCases();
  const cases = [...MATRIX, ...redAgent];

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
