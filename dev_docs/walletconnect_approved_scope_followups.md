# WalletConnect Approved Scope Follow-ups — Skip Go Widget

## Status

Review update (2026-09-08): the sections below retain the original investigation
and are not an outstanding-work checklist. The local branch now checks actual
WalletConnect approval for missing source chains, validates target accounts in
the main and retry connection paths, handles missing-chain effect failures, and
defers WalletConnect signer creation instead of preloading it.

Still open before a production PR:

- The extra-chain retry path can start a second proposal after a WalletConnect
  rejection or omitted target. Explicit connection is not yet single-proposal
  across every retry path.
- Explicit target connection validates the target account, but does not yet
  validate all signing-required source/route accounts in the replacement session.
- Normal missing approved addresses still pass through an existing console-error
  path before the address CTA is shown.
- Add a widget changeset and replace local tarball references with the published
  Graz dependency when promoting the POC into a production PR.

The partial-approval POC and its remaining UI limitations are described in
[WalletConnect Partial Approval Policy](walletconnect_partial_approval_policy.md). Run its focused regression tests with
`yarn test-widget:unit`; this does not launch the extension E2E setup.

---

## Original Investigation

This document records the Skip Go widget changes required to consume Graz's
WalletConnect approved-scope behavior safely.

The findings below describe the initial integration check on
`poc/graz-approved-scope`. They explain the changes that were required at that
point; the Status section above identifies the work that remains open.

## Core Invariant

WalletConnect has three different chain sets:

1. **Configured chains**: chains supported by the host application.
2. **Requested chains**: chains included in the session proposal.
3. **Approved chains**: chains for which the resulting session actually contains
   an account.

Requested chains are not connected chains. A wallet may approve only a subset of
optional chains, and that is a successful WalletConnect connection.

Skip Go must use the approved chain/account set returned by Graz when it decides
whether a chain is connected, persists an additional chain, resolves an address,
or preloads a signer.

## Reproduction Scenario

1. Skip Go proposes optional chains `[A, B, C]`.
2. The wallet approves only `[A, C]`.
3. The initial connection succeeds and Graz exposes accounts for `[A, C]`.
4. The user later selects chain `B` as the source chain.

Expected behavior:

- Skip Go requests connection/approval for `B`.
- It proceeds only if `response.accounts[B]` exists.
- A denial does not add `B` to widget connection state.
- Signing client preload does not run for `B` before approval succeeds.

Behavior at the time of investigation:

- `getInitialChainIds()` still includes `B`, so some paths treat it as already
  connected and skip the new approval request.

## Original Consumer Requirements

### 1. Stop using the initial proposal as connection state

Affected code:

- `packages/widget/src/pages/SwapPage/useConnectToMissingCosmosChain.ts`
- `packages/widget/src/hooks/useCreateCosmosWallets.tsx#getInitialChainIds`
- `packages/widget/src/state/swapPage.ts#preloadSigningStargateClientEffect`

`getInitialChainIds(wallet)` should remain proposal/configuration input. It must
not answer whether a chain has been approved.

For WalletConnect, connection checks should use Graz's actual account/active-chain
state, such as `useActiveChainIds()`, or the `accounts` returned by the latest
`connect()` call. Non-WalletConnect wallets may retain their existing behavior if
their connection model requires the initial-chain list.

### 2. Validate the requested chain in every connect path

The guard currently added to `useConnectToMissingCosmosChain` is also required in
the primary `connectWallet({ chainIdToConnect })` flow and its retry flow in
`useCreateCosmosWallets.tsx`.

When a specific chain is requested:

```typescript
const account = response.accounts[chainIdToConnect];
if (!account) {
  throw new Error(`Wallet did not approve ${chainIdToConnect}`);
}
```

Only after this check succeeds may Skip Go:

- add the chain to `extraCosmosChainIdsToConnectPerWalletAtom`;
- call `onWalletConnected` with that chain's address;
- track the connection as successful;
- resolve the `MinimalWallet.connect()` operation as successful.

Checking only `response.accounts` is insufficient because a non-empty response
may contain accounts for other approved chains.

The approval check should be factored into a small shared function so the normal,
missing-chain, and retry paths cannot diverge.

### 3. Gate signer preload on actual approval

`preloadSigningStargateClientEffect` currently builds its eligible chain list from
`getInitialChainIds()` plus locally stored extra chains. For a chain omitted from
the WalletConnect approval, this reaches `wallet.getKey(chainId)` and Graz rejects
the request.

The preload effect should run only when the source chain has an approved account.
If approval is still needed, `useConnectToMissingCosmosChain` should own that flow;
preload should wait for the approved account/state update and run afterward.

The async preload operation must also handle rejection explicitly so an expected
wallet denial cannot become an unhandled promise rejection.

### 4. Route approval failures into widget error handling

`useConnectToMissingCosmosChain` invokes an async function from `useEffect`
without awaiting or catching it. Its new `Wallet did not approve ...` error is
therefore not caught by React error boundaries.

The hook should explicitly catch the failure and route it through the selected
widget UX path. At minimum it must:

- stop the approval loading state;
- avoid persisting the rejected chain;
- record the failure through the existing tracking/error facilities;
- avoid an unhandled promise rejection.

Product/UI decision still required: either keep the user on the swap page with an
inline/retryable connection error, or map the failure to an existing error page.
The implementation should not silently swallow it.

## State Ownership

The existing extra-chain atom may remain useful as the list of chains Skip Go has
successfully added after initial connection. It must not be the authority for
WalletConnect approval by itself.

Recommended authority order:

1. Latest Graz `connect()` response for the operation being performed.
2. Reactive Graz approved account/active-chain state for rendering and effects.
3. Skip Go's extra-chain atom only for widget bookkeeping after approval succeeds.
4. `getInitialChainIds()` only for building a proposal.

## Regression Tests

Add coverage for both success and error paths:

- WalletConnect approves every requested optional chain.
- WalletConnect approves only a subset and initial connection succeeds.
- A chain omitted from initial approval is selected later and triggers a new
  connection request.
- The later request approves the chain and it is persisted.
- The later request omits/rejects the chain and it is not persisted.
- `connectWallet({ chainIdToConnect })` does not resolve successfully with an
  undefined address for the requested chain.
- Signer preload does not call `getKey()` before the source chain is approved.
- Approval failure produces no unhandled promise rejection.

Use mocked Graz responses for the focused logic tests. Keep the existing browser
extension E2E as an integration check rather than the only regression coverage.

## PR Boundary

The production Skip Go PR should contain:

- the consumer logic changes above;
- focused regression tests;
- a patch changeset for `@skip-go/widget`;
- the final published Graz dependency version.

Local `.tgz` dependencies and `.graz-poc` artifacts are intentional for the POC
branch, but should not be included in the production consumer PR.

The following are Graz follow-ups and are not part of this Skip Go change:

- rejecting malformed WalletConnect namespace keys;
- deduplicating repeated requested chain IDs in resolved results.
