import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callbacksAtom: Symbol("callbacksAtom"),
  effects: [] as Array<(get: (atom: unknown) => unknown) => void>,
  extraChainIdsAtom: Symbol("extraChainIdsAtom"),
  getConnectedSignersAtom: Symbol("getConnectedSignersAtom"),
  getSigningStargateClient: vi.fn(),
  getWallet: vi.fn(() => ({})),
  isWalletConnect: vi.fn(() => true),
  skipAssetsAtom: Symbol("skipAssetsAtom"),
  walletsAtom: Symbol("walletsAtom"),
}));

vi.mock("jotai", () => ({ atom: vi.fn(() => Symbol("atom")) }));
vi.mock("jotai-effect", () => ({
  atomEffect: (effect: (get: (atom: unknown) => unknown) => void) => {
    mocks.effects.push(effect);
    return Symbol("effectAtom");
  },
}));
vi.mock("@skip-go/client", () => ({
  getSigningStargateClient: mocks.getSigningStargateClient,
}));
vi.mock("graz", () => ({
  getWallet: mocks.getWallet,
  isWalletConnect: mocks.isWalletConnect,
  WalletType: { WALLETCONNECT: "walletconnect" },
}));
vi.mock("@/hooks/useCreateCosmosWallets", () => ({
  extraCosmosChainIdsToConnectPerWalletAtom: mocks.extraChainIdsAtom,
  getInitialChainIds: () => ["cosmoshub-4"],
}));
vi.mock("@/state/callbacks", () => ({ callbacksAtom: mocks.callbacksAtom }));
vi.mock("@/state/errorWarning", () => ({ errorWarningAtom: Symbol("errorWarningAtom") }));
vi.mock("@/state/route", () => ({
  setRouteToDefaultRouteAtom: Symbol("setRouteToDefaultRouteAtom"),
  skipRouteAtom: Symbol("skipRouteAtom"),
}));
vi.mock("@/state/router", () => ({
  currentPageAtom: Symbol("currentPageAtom"),
  Routes: { SwapPage: "swap" },
}));
vi.mock("@/state/skipClient", () => ({ skipAssetsAtom: mocks.skipAssetsAtom }));
vi.mock("@/state/wallets", () => ({
  getConnectedSignersAtom: mocks.getConnectedSignersAtom,
  walletsAtom: mocks.walletsAtom,
}));
vi.mock("@/utils/atomWithDebounce", () => ({
  atomWithDebounce: () => ({
    clearTimeoutAtom: Symbol("clearTimeoutAtom"),
    debouncedValueAtom: Symbol("debouncedValueAtom"),
    valueInitialized: Symbol("valueInitialized"),
  }),
}));
vi.mock("@/utils/storage", () => ({
  atomWithStorageNoCrossTabSync: () => Symbol("storageAtom"),
}));
vi.mock("@/widget/Widget", () => ({
  jotaiStore: { get: vi.fn(), set: vi.fn() },
}));

import { sourceAssetAtom } from "./swapPage";

describe("preloadSigningStargateClientEffect", () => {
  beforeEach(() => {
    mocks.getSigningStargateClient.mockReset();
    mocks.getWallet.mockClear();
    mocks.isWalletConnect.mockReset();
    mocks.isWalletConnect.mockReturnValue(true);
  });

  it("does not preload a WalletConnect signer while its client is reconnecting after refresh", async () => {
    const preloadEffect = mocks.effects[1];
    expect(preloadEffect).toBeDefined();

    preloadEffect?.((atom) => {
      if (atom === sourceAssetAtom) return { chainId: "cosmoshub-4" };
      if (atom === mocks.walletsAtom) {
        return { cosmos: { walletName: "walletconnect" } };
      }
      if (atom === mocks.getConnectedSignersAtom) return undefined;
      if (atom === mocks.extraChainIdsAtom) return {};
      throw new Error("Unexpected atom");
    });
    await Promise.resolve();

    expect(mocks.getSigningStargateClient).not.toHaveBeenCalled();
  });

  it("keeps preloading non-WalletConnect Cosmos signers", async () => {
    mocks.isWalletConnect.mockReturnValue(false);
    mocks.getSigningStargateClient.mockResolvedValue(undefined);
    const preloadEffect = mocks.effects[1];

    preloadEffect?.((atom) => {
      if (atom === sourceAssetAtom) return { chainId: "cosmoshub-4" };
      if (atom === mocks.walletsAtom) return { cosmos: { walletName: "keplr" } };
      if (atom === mocks.getConnectedSignersAtom) return undefined;
      if (atom === mocks.extraChainIdsAtom) return {};
      throw new Error("Unexpected atom");
    });
    await Promise.resolve();

    expect(mocks.getSigningStargateClient).toHaveBeenCalledOnce();
  });
});
