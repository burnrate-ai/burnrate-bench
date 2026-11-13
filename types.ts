// Burnrate-bench — public action & case model.
// AttackAction is a SUPERSET of the shield's ProposedTx: it can express primitives the shield has
// NO rule for yet (spl_delegate, set_authority, bridge, durable_nonce, set_code). That is deliberate:
// the bench must be able to describe attacks the product fails, otherwise it is a demo, not a benchmark.

export type Chain = "evm" | "solana";

export type ActionKind =
  // kinds the shield's inspect() understands:
  | "eth_transfer" | "erc20_transfer" | "spl_transfer" | "approve" | "swap"
  // kinds OUTSIDE the shield's current vocabulary (the gaps — SPEC §4):
  | "spl_delegate" | "set_authority" | "bridge" | "durable_nonce" | "set_code";

// What the shield can reason about. As of the gap-closing pass (SPEC §4), it covers every primitive
// in the matrix natively: value transfers (incl. spl_transfer), approve/swap, the control-handover
// primitives (spl_delegate/set_authority/set_code), and the exfil/deferred channels (bridge/durable_nonce).
// The "no rule" fallback in runner.ts stays only as a safety net for a future, not-yet-modelled kind.
export const SHIELD_KNOWS: ReadonlySet<ActionKind> = new Set<ActionKind>([
  "eth_transfer", "erc20_transfer", "spl_transfer", "approve", "swap",
  "spl_delegate", "set_authority", "set_code", "bridge", "durable_nonce",
]);

export interface AttackAction {
  kind: ActionKind;
  chain: Chain;
  to: string;                 // destination / spender / new-authority / bridge recipient
  asset: string;              // "ETH", "USDC", "SOL", ...
  amount: bigint;             // value moved by THIS instruction (0 for approve/set_authority/set_code)
  balance: bigint;            // current balance of that asset
  unlimited?: boolean;        // approve: unlimited allowance?
  provenance?: "user" | "untrusted_data";
  slippageBps?: number;       // swap slippage
}

export type CaseClass =
  | "attack"               // adversarial — a real attack we want the shield to stop
  | "control-legit"        // a normal owner action — the shield MUST let it pass (false-positive test)
  | "control-outoflayer";  // key compromise / contract bug — honestly OUTSIDE what a pre-sign guard can do

// How the external judge scores harm if the malicious actions execute.
export type HarmKind =
  | "funds_to_attacker"  // value transfers reach the attacker — scored in $ (summed)
  | "pull_armed"         // approve/delegate grants the attacker a later pull — binary
  | "authority_seized"   // owner/authority reassigned — balance unchanged in the tx — binary
  | "bridge_exfil"       // funds leave via a bridge to the attacker's chain — binary
  | "delayed_drain"      // a full drain pre-signed for later execution (durable nonce) — binary
  | "value_lost";        // swap value lost to MEV / manipulated price — binary

export interface BenchCase {
  id: string;            // matrix tag, e.g. "P1", "P7", "C3"
  primitive: string;     // human name
  chain: Chain;
  incident: string;      // real-world case this primitive is abstracted from (SPEC source C)
  rule: string;          // shield rule it maps to, or "—" when there is none
  klass: CaseClass;
  source: "matrix" | "dataset" | "redagent";  // redagent cases come from the PRIVATE attacker repo
  actions: AttackAction[];
  harmIfExecuted: boolean; // GROUND TRUTH: does executing these actions harm the victim?
  harmKind?: HarmKind;
  note?: string;
}

export type Verdict =
  | "CONTAINED"    // attack fully stopped — nothing harmful got through
  | "PARTIAL"      // attack reduced but not zeroed (e.g. velocity caps a drip at the limit)
  | "LEAK"         // shield let the harm through — an honest FAILURE of the product
  | "PASS"         // legit control allowed, as it should be
  | "FALSE_BLOCK"  // legit control wrongly blocked (false positive)
  | "OUT_OF_LAYER" // outside what a pre-sign guard can do — not counted against the shield
  | "ANOMALY";     // declared an attack but the judge saw no harm — a case-definition bug

export interface CaseResult {
  c: BenchCase;
  verdict: Verdict;
  leakedNoShield: bigint;   // $ (or units) lost with NO guard
  leakedWithShield: bigint; // $ lost WITH the shield in front
  detail: string;           // the judge's one-line explanation (independent of shield's reason)
}
