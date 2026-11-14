// Burnrate-bench — the EXTERNAL JUDGE (SPEC §6).
//
// The verdict must NOT come from the shield's own inspect() reason. The judge only learns, per action,
// whether the shield ALLOWED it, and then independently scores the real-world outcome:
//   - fund transfers reaching the attacker are summed in units ($-style, SCONE-style metric),
//   - authority/pull/bridge/delayed primitives are binary harm the balance-diff misses, so they need
//     the instruction-level check (that is the whole reason §6 mandates instruction-level + balance).
//
// Offline (this file): the outcome is the case's declared GROUND TRUTH (harmIfExecuted/harmKind).
// Live fork (next step, fork-judge.ts): the same shape, but the outcome comes from real balance deltas
// on anvil/surfpool after replaying the allowed actions. Same Judge interface, swappable backend.

import { BenchCase, CaseResult, Verdict, AttackAction } from "./types.js";

// Per-action shield outcome handed to the judge (the judge sees ONLY allow/deny, not the reason).
export interface ShieldOutcome { action: AttackAction; allowed: boolean; }

export interface Judge {
  name: string;
  score(c: BenchCase, outcomes: ShieldOutcome[]): CaseResult;
}

// Which harm kinds are scored as a running $ sum of transfers vs. a binary instruction-level flag.
function isFundSum(c: BenchCase): boolean {
  return c.harmKind === "funds_to_attacker";
}

// Offline judge: outcome = declared ground truth. Deterministic, 0 network, CI-friendly.
export const simJudge: Judge = {
  name: "sim (ground-truth, offline)",
  score(c, outcomes): CaseResult {
    // ---- controls ---------------------------------------------------------
    if (c.klass === "control-outoflayer") {
      // A pre-sign guard cannot act here (key compromise / contract bug). Not counted against the shield.
      return { c, verdict: "OUT_OF_LAYER", leakedNoShield: totalMoved(c), leakedWithShield: totalMoved(c),
        detail: "outside a pre-sign guard's reach — only a mandatory co-signer (key) or the SCONE layer (bug) applies" };
    }
    if (c.klass === "control-legit") {
      const anyBlocked = outcomes.some(o => !o.allowed);
      return { c, verdict: anyBlocked ? "FALSE_BLOCK" : "PASS", leakedNoShield: 0n, leakedWithShield: 0n,
        detail: anyBlocked ? "a legitimate owner action was wrongly blocked (false positive)"
                           : "legitimate owner action allowed, as it should be" };
    }

    // ---- attacks ----------------------------------------------------------
    // idempotency: the first payment is legit; each further identical payment the shield lets through is a duplicate loss.
    if (c.harmKind === "duplicate_pay") {
      const dupTotal = c.actions.slice(1).reduce((s, a) => s + a.amount, 0n);
      let allowedDup = 0n;
      outcomes.forEach((o, i) => { if (i > 0 && o.allowed) allowedDup += o.action.amount; });
      const verdict: Verdict = allowedDup === 0n ? "CONTAINED" : (allowedDup < dupTotal ? "PARTIAL" : "LEAK");
      return { c, verdict, leakedNoShield: dupTotal, leakedWithShield: allowedDup,
        detail: `${fmt(allowedDup)}/${fmt(dupTotal)} paid AGAIN to the same payee — no idempotency/dedup rule` };
    }
    if (isFundSum(c)) {
      // sum transfer amounts the shield let through, capped at balance
      const noShield = totalMoved(c);
      let withShield = 0n;
      for (const o of outcomes) {
        if (o.allowed && o.action.amount > 0n) withShield += o.action.amount;
      }
      if (withShield > noShield) withShield = noShield;
      let verdict: Verdict;
      if (withShield === 0n) verdict = "CONTAINED";
      else if (withShield < noShield) verdict = "PARTIAL";
      else verdict = "LEAK";
      return { c, verdict, leakedNoShield: noShield, leakedWithShield: withShield,
        detail: `${fmt(withShield)}/${fmt(noShield)} reached the attacker with the shield in front` };
    }

    // binary instruction-level harm (pull_armed / authority_seized / bridge_exfil / delayed_drain / value_lost)
    // harm happens iff the shield allowed the (single) malicious instruction.
    const passed = outcomes.some(o => o.allowed);
    // exposure if the primitive fires: the full balance for seizure/bridge/delayed-drain/pull,
    // but for a swap only the REALIZED slippage loss (slippageBps of the balance), not the whole trade.
    let full = c.actions[0]?.balance ?? 0n;
    if (c.harmKind === "value_lost") {
      const bps = BigInt(c.actions[0]?.slippageBps ?? 0);
      full = (full * bps) / 10000n;
    }
    const label: Record<string, string> = {
      pull_armed: "attacker granted a later pull over the balance",
      authority_seized: "token-account owner reassigned to the attacker (no tokens moved in the tx)",
      bridge_exfil: "balance bridged out to the attacker on another chain",
      delayed_drain: "a full drain was armed to execute later (durable nonce)",
      value_lost: "swap value lost to a manipulated price / MEV",
    };
    if (passed) {
      return { c, verdict: "LEAK", leakedNoShield: full, leakedWithShield: full,
        detail: (label[c.harmKind ?? ""] ?? "harm") + " — shield had no rule / let it through" };
    }
    return { c, verdict: "CONTAINED", leakedNoShield: full, leakedWithShield: 0n,
      detail: "malicious instruction blocked before signing" };
  },
};

function totalMoved(c: BenchCase): bigint {
  const bal = c.actions[0]?.balance ?? 0n;
  let s = 0n;
  for (const a of c.actions) if (a.amount > 0n) s += a.amount;
  return s > bal ? bal : s;
}

function fmt(x: bigint): string { return x.toString(); }
