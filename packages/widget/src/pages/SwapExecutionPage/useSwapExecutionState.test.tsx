import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentTransactionAtom: Symbol("currentTransactionAtom"),
  gasOnReceiveAtom: Symbol("gasOnReceiveAtom"),
  currentTransaction: undefined as { status?: string } | undefined,
  gasOnReceive: false,
}));

vi.mock("react", async () => {
  return vi.importActual("../../../node_modules/react/index.js");
});
vi.mock("jotai", () => ({
  useAtomValue: (atom: symbol) => {
    if (atom === mocks.currentTransactionAtom) return mocks.currentTransaction;
    if (atom === mocks.gasOnReceiveAtom) return mocks.gasOnReceive;
    throw new Error("Unexpected atom");
  },
}));
vi.mock("@/state/history", () => ({ currentTransactionAtom: mocks.currentTransactionAtom }));
vi.mock("@/state/gasOnReceive", () => ({ gasOnReceiveAtom: mocks.gasOnReceiveAtom }));
vi.mock("./SwapExecutionPage", () => ({
  SwapExecutionState: {
    recoveryAddressUnset: "recoveryAddressUnset",
    destinationAddressUnset: "destinationAddressUnset",
    ready: "ready",
    pending: "pending",
    waitingForSigning: "waitingForSigning",
    signaturesRemaining: "signaturesRemaining",
    confirmed: "confirmed",
    validatingGasBalance: "validatingGasBalance",
    approving: "approving",
    pendingGettingAddresses: "pendingGettingAddresses",
    pendingGettingDestinationBalance: "pendingGettingDestinationBalance",
    pendingGettingGasRouteAddresses: "pendingGettingGasRouteAddresses",
    gasRouteRecoveryAddressUnset: "gasRouteRecoveryAddressUnset",
    pendingError: "pendingError",
  },
}));

import { useSwapExecutionState } from "./useSwapExecutionState";
import { SwapExecutionState } from "./SwapExecutionPage";

describe("useSwapExecutionState partial approval addresses", () => {
  beforeEach(() => {
    mocks.currentTransaction = undefined;
    mocks.gasOnReceive = false;
  });

  it("shows the destination CTA when only the approved source address is set", () => {
    const { result } = renderHook(() =>
      useSwapExecutionState({
        chainAddresses: {
          0: { chainId: "dimension_37-1", address: "xpla1approved" },
          1: { chainId: "noble-1", address: "" },
        },
        requiredChainAddresses: ["dimension_37-1", "noble-1"],
        isGettingAddressesLoading: false,
        isFetchingDestinationBalance: false,
      }),
    );

    expect(result.current).toBe(SwapExecutionState.destinationAddressUnset);
  });

  it("becomes ready after the Noble destination is entered manually", () => {
    const { result } = renderHook(() =>
      useSwapExecutionState({
        chainAddresses: {
          0: { chainId: "dimension_37-1", address: "xpla1approved" },
          1: { chainId: "noble-1", address: "noble1manual", source: "input" },
        },
        requiredChainAddresses: ["dimension_37-1", "noble-1"],
        isGettingAddressesLoading: false,
        isFetchingDestinationBalance: false,
      }),
    );

    expect(result.current).toBe(SwapExecutionState.ready);
  });

  it("still shows the intermediary CTA when a middle address is missing", () => {
    const { result } = renderHook(() =>
      useSwapExecutionState({
        chainAddresses: {
          0: { chainId: "dimension_37-1", address: "xpla1approved" },
          1: { chainId: "noble-1", address: "" },
          2: { chainId: "dimension_37-1", address: "xpla1approved" },
        },
        requiredChainAddresses: ["dimension_37-1", "noble-1", "dimension_37-1"],
        isGettingAddressesLoading: false,
        isFetchingDestinationBalance: false,
      }),
    );

    expect(result.current).toBe(SwapExecutionState.recoveryAddressUnset);
  });
});
