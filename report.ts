// Burnrate-bench — console report. Prints the matrix as a table (SCONE-style $-leaked columns),
// a verdict tally, and an honest "gaps" section that ties every LEAK/PARTIAL to the SPEC §4 roadmap.

import { CaseResult, Verdict } from "./types.js";

const MARK: Record<Verdict, string> = {
  CONTAINED: "✅ CONTAINED",
  PARTIAL:   "🟠 PARTIAL",
  LEAK:      "❌ LEAK",
  PASS:      "✅ PASS",
  FALSE_BLOCK: "❌ FALSE-BLOCK",
  OUT_OF_LAYER: "⚪ OUT-OF-LAYER",
  ANOMALY:   "⚠️ ANOMALY",
};

function pad(s: string, n: number): string { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }

export function report(results: CaseResult[]): void {
  console.log("\n=== Burnrate-bench v0 — matrix × external judge ===");
  console.log("judge: external oracle (no funds moved) · leaked = units reaching the attacker\n");

  console.log(pad("#", 5) + pad("primitive", 40) + pad("chain", 8) + pad("rule", 30) + pad("noGuard", 9) + pad("shield", 8) + "verdict");
  console.log("-".repeat(124));
  for (const r of results) {
    console.log(
      pad(r.c.id, 5) +
      pad(r.c.primitive, 40) +
      pad(r.c.chain, 8) +
      pad(r.c.rule, 30) +
      pad(r.leakedNoShield.toString(), 9) +
      pad(r.leakedWithShield.toString(), 8) +
      MARK[r.verdict]
    );
  }

  // tally
  const tally: Record<Verdict, number> = {
    CONTAINED: 0, PARTIAL: 0, LEAK: 0, PASS: 0, FALSE_BLOCK: 0, OUT_OF_LAYER: 0, ANOMALY: 0,
  };
  for (const r of results) tally[r.verdict]++;
  console.log("\n--- tally ---");
  console.log(Object.entries(tally).filter(([, n]) => n > 0).map(([v, n]) => `${v}: ${n}`).join("  ·  "));

  // honest failures — the whole point of an independent bench
  const fails = results.filter(r => r.verdict === "LEAK" || r.verdict === "PARTIAL" || r.verdict === "FALSE_BLOCK");
  console.log("\n--- where the shield does NOT fully hold (SPEC §4 roadmap) ---");
  if (fails.length === 0) {
    console.log("  none in this corpus — add red-agent (A) cases before trusting that.");
  } else {
    for (const r of fails) {
      console.log(`  ${pad(r.c.id, 5)} ${pad(r.verdict, 12)} ${r.c.primitive}`);
      console.log(`        ${r.detail}`);
      if (r.c.note) console.log(`        ↳ ${r.c.note}`);
    }
  }

  // aggregate $-style metric (attacks only)
  const atk = results.filter(r => r.c.klass === "attack");
  const noG = atk.reduce((s, r) => s + r.leakedNoShield, 0n);
  const wG = atk.reduce((s, r) => s + r.leakedWithShield, 0n);
  const pct = noG === 0n ? 0 : Number((wG * 10000n) / noG) / 100;
  console.log(`\n--- SCONE-style metric (attacks only) ---`);
  console.log(`  leaked with NO guard:  ${noG} units`);
  console.log(`  leaked WITH shield:    ${wG} units  (${pct.toFixed(1)}% of the undefended loss still gets through)`);
  console.log(`  prevented:             ${noG - wG} units  (${(100 - pct).toFixed(1)}%)\n`);
}
