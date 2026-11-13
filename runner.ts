// Burnrate-bench — runner. For each case: thread the actions through the shield (per SPEC §7),
// collect per-action allow/deny, then hand them to the EXTERNAL judge for the verdict.
//
// The shield adapter is honest about its vocabulary: a primitive the shield has no branch for
// (spl_delegate / set_authority / bridge / durable_nonce / set_code) is reported as ALLOWED with a
// "no rule" note — because a real integration would pass it straight through. That is how the bench
// surfaces the gaps instead of hiding them.

import { inspect, newState, ShieldConfig, ShieldState, ProposedTx, Decision } from "./shield.js";
import { AttackAction, BenchCase, CaseResult, SHIELD_KNOWS } from "./types.js";
import { Judge, ShieldOutcome } from "./judge.js";

// Default owner policy. One allowlisted dest, 50% single-tx drain cap, 50% velocity cap, 3% slippage.
export function defaultConfig(): ShieldConfig {
  return {
    allowlist: new Set<string>(["0xowner"]),
    maxFractionBps: 5000,
    velocityCapBps: 5000,
    maxSlippageBps: 300,
  };
}

// Map an AttackAction onto a ProposedTx the shield can read, or report "no rule" for a gap primitive.
export function evalShield(a: AttackAction, cfg: ShieldConfig, state: ShieldState): Decision {
  if (!SHIELD_KNOWS.has(a.kind)) {
    return { allow: true, reason: `no shield rule for '${a.kind}' — outside the current action vocabulary` };
  }
  // spl_transfer reuses the chain-agnostic transfer math (erc20_transfer path).
  const kind = a.kind === "spl_transfer" ? "erc20_transfer" : a.kind;
  const tx: ProposedTx = {
    kind: kind as ProposedTx["kind"],
    to: a.to, asset: a.asset, amount: a.amount, balance: a.balance,
    unlimited: a.unlimited, provenance: a.provenance, slippageBps: a.slippageBps,
  };
  return inspect(tx, cfg, state);
}

export function runCase(c: BenchCase, cfg: ShieldConfig, judge: Judge): CaseResult {
  const start = c.actions[0]?.balance ?? 0n;
  const state = newState(start);              // one session per case (velocity accumulates across its actions)
  const outcomes: ShieldOutcome[] = c.actions.map(a => ({ action: a, allowed: evalShield(a, cfg, state).allow }));
  return judge.score(c, outcomes);
}

export function runAll(cases: BenchCase[], cfg: ShieldConfig, judge: Judge): CaseResult[] {
  return cases.map(c => runCase(c, cfg, judge));
}
