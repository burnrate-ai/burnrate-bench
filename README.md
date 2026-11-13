# burnrate-bench

![version](https://img.shields.io/badge/version-0.1.0-orange) ![License](https://img.shields.io/badge/License-MIT-green) ![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![networks](https://img.shields.io/badge/networks-EVM%20%2B%20Solana-blueviolet) ![judge](https://img.shields.io/badge/judge-fork%20%2B%20instruction--level-informational)

> An **independent benchmark** for a containment layer in front of an AI agent that controls a wallet. It measures how much value drains in simulation **without** protection vs **with** Burnrate Shield — and is built so the benchmark can **fail the product itself**.

If the shield passes everything, it is a demo, not a benchmark. This one still reports a residual, on purpose.

---

## Quickstart

```bash
npm install
npm run bench                 # offline judge (ground-truth), 0 network
JUDGE=fork npx tsx bench.ts    # LIVE fork judge: anvil auto-starts, actions execute on a local chain
```

## What's inside

| File | Role |
|---|---|
| `matrix.ts` | 10 attack primitives (EVM + Solana), each abstracted from a real incident and mapped to a shield rule, + negative controls |
| `types.ts` | action model — a superset of `ProposedTx` that can express primitives the shield has no rule for |
| `runner.ts` | runs each case through the shield; a gap primitive is honestly reported as `allowed` with a "no rule" note |
| `judge.ts` | external judge — balance-to-attacker ($ metric) + instruction-level (catches primitives that move no balance) |
| `fork-judge.ts` | live fork judge: ETH-transfer cases execute for real on a local anvil and are scored from the real balance delta (0 real funds) |
| `report.ts` | matrix table + tally + a "where the shield does NOT hold" section |
| `SPEC.md` | full v0 spec: independence, sources, the 10 primitives, roadmap, judge |

## Headline result (after the gap-closing pass)

| | count |
|---|---|
| ✅ CONTAINED | 11 |
| 🟠 PARTIAL | 1 (drip — velocity caps at ~50%) |
| ❌ LEAK | 0 |
| ✅ PASS (legit) | 2 |
| ⚪ OUT-OF-LAYER | 2 (raw-key, contract bug) |

~**0.8%** of modelled loss still gets through (was ~49% before the fix). Gaps for SPL-delegate, setAuthority, set-code, bridge and durable-nonce were closed by extending the `shield.ts` rule vocabulary, not by fitting the tests.

**Honest framing:** 99.2% is over *known* incident primitives. Independence rests on the benchmark still showing a residual (P7 drip) and two OUT-OF-LAYER limits it openly cannot cover.

**Cross-validation:** the offline and the live fork judge agree on every cross-checkable case — the fork judge measured P7-drip as exactly **40/100 wei** actually reaching the attacker, and the legit payment at 0.

## Live rigs

Verified against two third-party harnesses with real agents (see `RESULTS_*.md`):

- **AgentKit** (Sepolia / EVM): a real agent under injection — 4 models self-refused; the shield blocked the direct drain (real tx).
- **SolVerdict** (Solana, surfpool mainnet fork): scenario A2 (full drain), `n=20` — new shield **20/20 (100%)**, old vault 0/20, bare agent 0/20.

## Ecosystem

- [`burnrate-shield`](../burnrate-shield) — the containment layer under test.

## License

MIT — see [LICENSE](./LICENSE).
