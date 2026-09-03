import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sourceAssetAtom: Symbol("sourceAssetAtom"),
  walletsAtom: Symbol("walletsAtom"),
  extraChainIdsAtom: Symbol("extraChainIdsAtom"),
  sourceAsset: { chainId: "osmosis-1", isEvm: false, isSvm: false },
  wallets: { cosmos: { walletName: "walletconnect" } } as {
    cosmos?: { walletName: string };
  },
  extraChainIds: {},
  accounts: undefined as Record<string, unknown> | undefined,
  connect: vi.fn(),
  addExtraChainId: vi.fn(),
  track: vi.fn(),
}));

vi.mock("jotai", () => ({
  useAtomValue: (atom: symbol) => {
    if (atom === mocks.sourceAssetAtom) return mocks.sourceAsset;
    if (atom === mocks.walletsAtom) return mocks.wallets;
    if (atom === mocks.extraChainIdsAtom) return mocks.extraChainIds;
    throw new Error("Unexpected atom");
  },
  useSetAtom: () => mocks.addExtraChainId,
}));

vi.mock("@/hooks/useCreateCosmosWallets", () => ({
  extraCosmosChainIdsToConnectPerWalletAtom: mocks.extraChainIdsAtom,
  addExtraChainIdsToConnectForWalletTypeAtom: Symbol("addExtraChainIdsAtom"),
  getInitialChainIds: () => ["cosmoshub-4"],
}));

vi.mock("@/state/swapPage", () => ({ sourceAssetAtom: mocks.sourceAssetAtom }));
vi.mock("@/state/wallets", () => ({ walletsAtom: mocks.walletsAtom }));
vi.mock("@amplitude/analytics-browser", () => ({ track: mocks.track }));
vi.mock("@skip-go/client", () => ({ ChainType: { Cosmos: "cosmos" } }));
vi.mock("graz", () => ({
  WalletType: { WALLETCONNECT: "walletconnect" },
  connect: mocks.connect,
  getChainInfo: ({ chainId }: { chainId: string }) => ({ chainId }),
  getWallet: () => ({}),
  isWalletConnect: () => true,
  useAccount: () => ({ data: mocks.accounts }),
}));

import { useConnectToMissingCosmosChain } from "./useConnectToMissingCosmosChain";

describe("useConnectToMissingCosmosChain", () => {
  beforeEach(() => {
    mocks.wallets = { cosmos: { walletName: "walletconnect" } };
    mocks.accounts = undefined;
    mocks.connect.mockReset();
    mocks.addExtraChainId.mockReset();
    mocks.track.mockReset();
    mocks.connect.mockResolvedValue({
      accounts: { "dimension_37-1": { bech32Address: "xpla1approved" } },
    });
  });

  it("does not reopen a proposal for the same chain after partial approval", async () => {
    const { rerender } = renderHook(() => useConnectToMissingCosmosChain());

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.track).toHaveBeenCalledTimes(1));

    mocks.accounts = {
      "dimension_37-1": { bech32Address: "xpla1approved" },
    };
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it("allows a new proposal after the wallet is disconnected", async () => {
    const { rerender } = renderHook(() => useConnectToMissingCosmosChain());

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(1));

    mocks.wallets = {};
    rerender();
    mocks.wallets = { cosmos: { walletName: "walletconnect" } };
    rerender();

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(2));
  });
});
