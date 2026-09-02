# Claude Directive — GYEON Order V3 D16-P2B1-R1 Diagnosis Result Correction

## 1. Identity

- Directive: `GYEON_ORDER_V3_D16_P2B1_R1_STRIPE_PRECONNECTION_DIAGNOSIS_RESULT_CORRECTION_V1`
- Required result marker: `GYEON_ORDER_V3_D16_P2B1_R1_STRIPE_PRECONNECTION_DIAGNOSIS_RESULT_V1`
- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `https://github.com/nisikawa-officeAZ/GYEON/pull/51`
- Fixed execution HEAD: `f77f32d8ec908e4da76dd9a7f1406e4026cc1465`
- Fixed execution tree: `be989afd0d5394340e372ee51c780c3ae33a9174`
- Original result marker: `GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Mode: one delta-only result correction; no source re-diagnosis

The original Claude diagnosis found the central stale-contract and bypass problems, but MacBook Codex rejected its `PASS_DIAGNOSIS_COMPLETE` verdict because the required result was incomplete and internally inconsistent. This R1 phase corrects only the submitted result. It does not reopen the original 25 private files and does not authorize implementation.

## 2. Inputs Authorized for a Later R1 Invocation

Claude may receive only:

1. this R1 directive;
2. the complete text of the original Claude result;
3. the MacBook Codex correction facts in section 3;
4. the 25 SHA-256 attestations in section 4.

The original 25 private repository files must not be retransmitted or reopened. No repository tool, filesystem tool, Git tool, sub-agent, network lookup, test, typecheck, build, package operation, Stripe access, Supabase access, DB access, Vercel access, or GitHub mutation is authorized.

## 3. Mandatory Corrections

The corrected result must resolve all of the following:

1. **Five stale RPCs, not four.** The forward-only DB correction must cover at least:
   - `public.prepare_gyeon_order_v3_owner_submit_rpc`
   - `public.finalize_gyeon_order_v3_owner_submit_rpc`
   - `public.prepare_gyeon_order_v3_edit_rpc`
   - `public.finalize_gyeon_order_v3_edit_rpc`
   - `public.release_gyeon_order_v3_warehouse_rpc`
   New refund and reconciliation RPCs must be listed separately as new work.
2. **Retrieval belongs in the adapter surface.** The proposed server-only Stripe adapter must name explicit PaymentIntent create/retrieve and Refund create/retrieve operations. A narrative reference to retrieval is insufficient.
3. **Webhook route and worker must both exist in the proposed literal allowlist.** Signature verification and immutable inbox acceptance belong to the route boundary; asynchronous/order-independent reconciliation belongs to a separate worker/core boundary.
4. **All later allowlists must use full repository-relative paths.** Every proposed test file and every new file must have a literal path and must be marked `NEW`. If a timestamped migration filename has not been generated, classify its exact path as `NOT_CONFIGURED` and state that its implementation gate cannot open until a later owner instruction pins the generated literal path.
5. **Dependency lockfile must not be omitted.** A later Stripe SDK dependency phase requires both `package.json` and `package-lock.json`; this R1 result must not authorize or perform that dependency change.
6. **Original SHA-256 omission must be repaired.** Include all 25 attestations from section 4 in the corrected result and state that MacBook Codex computed them before the original invocation. Do not claim Claude computed them with a tool.
7. **Do not call the DRAFT and formal migrations byte-identical.** Their central SQL contract is materially aligned, but their headers differ and the DRAFT ends in `rollback;` while the formal migration ends in `commit;`.
8. **Do not reopen the accepted pure contract without evidence.** D16-P2B0 already aligned the four pure files. The corrected result must classify an additional pure-contract correction as `NOT_REQUIRED_ON_CURRENT_EVIDENCE`, while preserving those four files as read-only authority for later DB/provider conformance tests.
9. **Separate the direct-CRUD cutover from the pure contract.** The later Book cutover candidate must explicitly account for:
   - `src/lib/product-orders/product-order-types.ts`
   - `src/lib/product-orders/create-product-order.ts`
   - `src/lib/product-orders/update-product-order.ts`
   - one new focused cutover-contract test with a literal path
   It must not silently reuse the four-state generic order model as the V3 six-state contract.
10. **Legacy finance separation is a boundary, not a proof from unread protected content.** State that the diagnosed V3 files do not require reuse of the generic finance ledger, while protected finance files remain unread and unchanged. Do not claim their internal references were inspected.

## 4. MacBook Codex SHA-256 Attestations

These hashes were computed against the exact fixed execution HEAD before the original Claude invocation:

```text
1c3b986a66bda93ddde74ff9c6d7310facca402dcb21c7713497eb54ef0879e2  AGENTS.md
c8ca7d0969b2e2ef1d9a6da4cb3c3f7f299cfbce3eb40d72d97814319bc59856  CLAUDE.md
e0e321610d58c3bbc1ad291ff79f03b1e633b923c4c30794e203ad005f9eb472  docs/master_specification/GYEON_DA_COMPLETION_PLAN.md
367ca4f96a149ce55d9b18b84d0326f48076c92400de1c5a3801967ea2ee2d49  docs/master_specification/GYEON_DA_PHASE_RESULTS.md
f40bd8f4806357c5cf830b5d853cb6e617fe873e3fda61c582ddf35cc9212038  docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT.md
824e68d2edde916f4a1cac3b59cc067462a858224552aa3540527d3997a6a1c9  docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS.md
8f40e0d4e96ff0f0fb6ef198daea62cf87bd64e8e593efb880bd1dfc8b966d35  docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md
3a486775ecbd9484ebc24df2e0e35d300f1ba0d42bac908f25424c71719ad877  docs/integrations/gyeon-order/v3-c5-external-authority-design-and-impact.md
4642acd70c850c14e9f259c368194685f152d687e0671d30e71d10c74263c473  docs/integrations/gyeon-order/v3-db-rpc-rls-design.md
02dbf1a76b8d0e8a8be1845a13711101f434f52db6431d2e9931297f11d5d927  package.json
f0920eba3c10a2a3bc689cc8973b261d2c7131c5bbf8435912c5bcbde3422a3e  src/lib/product-orders/gyeon-order-v3-contract-core.ts
e9e83478d5df12e7fb5df4f131b79354f79092b31dcb2840f655b916ef99c733  src/lib/product-orders/gyeon-order-v3-contract-core.test.ts
1cfcdea7bdedc53ab7bfb93c9dccfb6c3133d8cf4c03f0392a4831efe8213c7d  src/lib/product-orders/gyeon-order-v3-external-authority-core.ts
5b698fb0bbebd27773af10b70f4e3dcbbb44110303985cb7b142a07eaafc71e4  src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts
b1aa234246de14315b9bf4fd906ecbb3c1a1d96ae10c72e8d196c2393d43d7e2  src/lib/product-orders/product-order-types.ts
1d54468866fb7456f492707014ecb3a1ca09f7cb6b6701756d274875d7512e16  src/lib/product-orders/create-product-order.ts
8db479f3dd33d8913ffbc5a81def0e30d29be828366b0aa346e1724d77902f47  src/lib/product-orders/update-product-order.ts
e609810fe165536e00d551e88ef65ac3f0d899c46ca6e6d16e84758b398da2da  src/lib/supabase/admin.ts
6786460f23b68b33b496e289e7de35bc10de518e8f5cf8e85b8adb79731d1c85  src/lib/supabase/server.ts
f2309aad19f581dc7a7108d8d1051df6c0b48b0325ea4f91bbfe378a745946ac  src/app/api/line/webhook/route.ts
d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73  supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql
c7c6acdaf5938a0039be8606564e853556e1919a2f4173e21a45ff470bf85abd  supabase/migrations/DRAFT_DO_NOT_APPLY/README.md
bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b  supabase/migrations/20260829101726_gyeon_order_v3_contract.sql
fbc0d4d95869424c1758008e7c5f4e41f25db68bca6fe4a34efd9571f6dbdcc1  src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts
03f00b589111c5027b8b945e61adb49022b5b963acb7336ed4338666fb74f95a  src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts
```

## 5. Required Corrected Result

Return exactly one result headed by:

`GYEON_ORDER_V3_D16_P2B1_R1_STRIPE_PRECONNECTION_DIAGNOSIS_RESULT_V1`

It must contain:

- verdict: `PASS_CORRECTION_COMPLETE`, `CHANGES_REQUIRED_CORRECTION`, or `BLOCKED_CORRECTION_INPUT`;
- the unchanged PR, base, fixed HEAD/tree, and original invocation identity;
- confirmation that no original private source file was retransmitted or reopened during R1;
- every mandatory correction from section 3;
- the complete 25-hash attestation block, attributed to MacBook Codex;
- four separate future gates with literal repository-relative allowlists:
  1. direct-CRUD Book cutover;
  2. forward-only DB migration and DB contract tests;
  3. Stripe adapter, Webhook route/worker, tests, and dependency files;
  4. disposable Stripe sandbox harness;
- all unknown environment, API-version, generated migration-path, account, endpoint-secret, schema-application, and deployment facts classified as `NOT_CONFIGURED`;
- confirmation of zero source edit, test, Git mutation, PR mutation, provider access, DB/Supabase access, dependency action, or deployment action.

Stop after the corrected result. Do not implement, test, stage, commit, push, comment, mark Ready, merge, configure Stripe, apply a migration, or begin Book C1.
