# WalletConnect Partial Approval Policy — Skip Go Widget

## Overview

This document proposes a policy for routes used with wallets that approve only some of the optional Cosmos chains in a WalletConnect proposal. The POC keeps the existing address-selection UI and separates automatic address lookup from user-initiated wallet connections.

For implementation gaps and the original investigation, see [WalletConnect Approved Scope Follow-ups](walletconnect_approved_scope_followups.md).

---

## Current UX Problem

Graz exposes accounts from the approved session namespace, but Skip Go's automatic address resolution previously called `getAddress()` even when a chain had no approved account. The Cosmos adapter turns a failed lookup into a `connect()` fallback. As a result, a destination or intermediary chain that only needs an address can open a WalletConnect QR modal without the user choosing to connect.

For example, an XPLA-only wallet approves `dimension_37-1`, and the route sends from XPLA to Noble. The XPLA account is already available for signing; Noble only needs a destination address. Automatically looking up the Noble account starts another proposal before the user can enter that address manually.

## POC Behavior

- Automatic WalletConnect address resolution reads the current approved accounts returned by Graz's `useAccount()`.
- An approved address fills every occurrence of its chain in the route's required address list.
- A destination or intermediary chain without an approved account remains unset. Automatic resolution does not call `getKey()` or `connect()`.
- The existing `Set destination address`, `Set intermediary address`, and `SetAddressModal` flows remain in use.
- Choosing a wallet explicitly in the modal invokes the existing `getAddress()` and connection flow.
- If the wallet omits the required target chain, that target address is not set.
- A chain requiring a signature also waits for explicit wallet selection instead of opening a QR modal from a background effect. Manual address entry remains hidden for that chain.
- The full asset/token list remains available. Balance requests use available addresses; signing requires an approved wallet account. A manually entered address does not grant signing capability.

The POC adds no new modal, CTA, toast, or explanatory screen.

## Compatibility

The passive address-lookup boundary is provided only by the WalletConnect adapter. Non-WalletConnect wallets such as Keplr keep their existing automatic `getAddress()` flow. EVM, Solana, and injected-address handling are unchanged by this POC.

A WalletConnect session that approves every required chain can still fill the route addresses from the Graz account map and reach the ready state. The change is that a missing approved account is no longer interpreted as an automatic connection command.

## XPLA-Only Wallet Support

An XPLA-only wallet can execute a route when all wallet signatures are required on XPLA. Destination or intermediary chains that do not require signatures can use manually entered addresses or addresses obtained through explicit wallet selection.

If another chain also requires a signature, the wallet must provide an approved account for that chain. A manual address cannot satisfy a signing requirement.

---

## Responsibilities

### Graz

- Resolve the latest valid WalletConnect session namespace.
- Materialize accounts only for approved `(chainId, address)` pairs.
- Expose the approved account scope through `useAccount()` and connection results.
- Reject account lookup or signing for a chain not approved by the selected session.

### Skip Go

- Treat configured/requested chains as proposal input, not proof of connection.
- Use Graz's approved accounts for automatic wallet address resolution, wallet balances, and signer selection.
- Leave missing address-only chains to the existing manual-address or wallet-selection UI.
- Start additional connections only after explicit wallet selection, and validate the required account coverage.
- Keep asset/token browsing independent of wallet approval.

## Policy Options

### 1. Signing-Required Approval with Address Fallback — Recommended

Require wallet approval only for chains that need signatures. Other chains can use an approved address automatically or a manually entered address.

**Advantages:**

- Supports wallets with limited chain coverage, including XPLA-only wallets.
- Avoids unnecessary proposals and QR prompts.
- Fits WalletConnect's optional approval model.
- Preserves full asset browsing while separating available addresses from signing capability.

**Trade-offs:**

- Each route must distinguish signing requirements from address requirements.
- Complex routes may require users to supply several intermediary addresses.

### 2. Require Approval for Every Route Chain

Require wallet accounts for every source, destination, and intermediary chain in the route.

**Advantages:**

- All route addresses come from one wallet, simplifying the state model and explanation.
- Reduces combinations of manual and wallet-provided addresses.

**Trade-offs:**

- Requires support for chains that do not need signatures, excluding many wallets with limited coverage.
- Loses the benefit of optional approval and increases connection failures.

### 3. Require Approval for Every Requested Chain

Require approval for every configured/requested chain included in the initial proposal.

**Advantages:**

- Reduces the need to handle different approved chain sets after connection.

**Trade-offs:**

- One unsupported chain can prevent connection even when it is unrelated to the route.
- Treats configured, requested, and approved chains as equivalent, contrary to partial approval.
- Prevents XPLA-only wallet support when the proposal includes other chains.

## Recommendation

Use policy 1. Signing requires wallet authorization, whereas an address-only destination or intermediary does not require a signer. Automatically reuse approved accounts and send missing addresses through the existing selection UI.

Stepwise session replacement and separate clients per network are not policy candidates in this POC.

---

## Future UI Work

These ideas are proposals only and are not implemented in the POC:

- Explain the requested network coverage before opening a QR modal.
- Offer explicit choices such as `Enter Noble address manually` and `Connect a wallet for XPLA and Noble`.
- Explain that connecting another wallet may replace the current wallet.
- Summarize approved and missing networks.
- Explain partial approval or rejection results.
- Provide retry and change-wallet flows.

## POC Limitations

- The existing extra-chain retry can start a second proposal after rejection or omission of the target chain. Single-proposal behavior is not yet guaranteed across all explicit connection paths.
- Explicit connection validates the target account, but not every signing-required account in the replacement session, including the previous source account.
- A normal missing approved address still passes through an existing `console.error` path. Separating an unset address from an actual lookup failure remains follow-up work; no new error UI was added.
- Existing CTAs and modals do not explain the requested network coverage in detail before the QR prompt.
- Routes with several missing intermediary addresses require sequential address entry.
- There is no dedicated rejection or recovery UI.

Run the focused automatic-address and CTA regression tests with `yarn test-widget:unit`. These are not mobile-wallet E2E tests and do not cover the entire SetAddressModal connection flow.

---

## Local Package Snapshot (2026-09-08)

This section records the local validation setup at that date, not production dependency requirements.

| Consumer | Package | Local Tarball |
|----------|---------|---------------|
| Skip Go development workspace | Graz | `.graz-poc/graz-approved-scope-persisted-key-fix-1e53f82-0.6.0.tgz` |
| Skip Go App | Graz | `.graz-poc/graz-approved-scope-topic-resubscribe-v3-1e53f82-0.6.0.tgz` |
| Skip Go App | Widget | `.skip-go-poc/skip-go-widget-wc-partial-approval-clean-69b81819-3.17.2.tgz` |
| Skip Go App | Client | `.skip-go-poc/skip-go-client-approved-scope-clean-69b81819-1.6.1.tgz` |

The widget treats Graz as an external dependency. The app therefore uses its directly installed Graz package at runtime. Subscription recovery observed in the app must not be assumed to exist in the development workspace's different Graz tarball.

The commit cleanup preserved the tested app installation without repackaging or reinstalling it. Local tarballs are POC reproduction artifacts and are not intended for the production PR.
