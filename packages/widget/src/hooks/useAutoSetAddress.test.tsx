import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chainAddressesAtom: Symbol("chainAddressesAtom"),
  connectedAddressesAtom: Symbol("connectedAddressesAtom"),
  currentTransactionAtom: Symbol("currentTransactionAtom"),
  skipChainsAtom: Symbol("skipChainsAtom"),
  swapExecutionStateAtom: Symbol("swapExecutionStateAtom"),
  userAddressesEffectAtom: Symbol("userAddressesEffectAtom"),
  walletsAtom: Symbol("walletsAtom"),
  chainAddresses: {} as Record<
    number,
    { chainId: string; address?: string; source?: string }
  >,
  requiredChainAddresses: ["dimension_37-1", "noble-1"],
  operations: [
    {
      signRequired: true,
      fromChainId: "dimension_37-1",
    },
  ],
  approvedAddresses: {
    "dimension_37-1": "xpla1approved",
  } as Record<string, string | undefined>,
  walletName: "walletconnect",
  getAddress: vi.fn(),
  getConnectedAddress: vi.fn(),
  showModal: vi.fn(),
  setChainAddresses: vi.fn(),
}));

vi.mock("react", async () => {
  return vi.importActual("../../node_modules/react/index.js");
});

vi.mock("jotai", () => ({
  useAtom: (atom: symbol) => {
    if (atom === mocks.chainAddressesAtom) {
      return [mocks.chainAddresses, mocks.setChainAddresses];
    }
    if (atom === mocks.userAddressesEffectAtom) return [undefined, vi.fn()];
    throw new Error("Unexpected atom");
  },
  useAtomValue: (atom: symbol) => {
    if (atom === mocks.swapExecutionStateAtom) {
      return {
        route: {
          requiredChainAddresses: mocks.requiredChainAddresses,
          operations: mocks.operations,
        },
      };
    }
    if (atom === mocks.currentTransactionAtom) return undefined;
    if (atom === mocks.skipChainsAtom) {
      return {
        data: mocks.requiredChainAddresses.map((chainId) => ({
          chainId,
          chainType: "cosmos",
        })),
      };
    }
    if (atom === mocks.walletsAtom) {
      return { cosmos: { walletName: mocks.walletName } };
    }
    if (atom === mocks.connectedAddressesAtom) return undefined;
    throw new Error("Unexpected atom");
  },
}));

vi.mock("@/state/skipClient", () => ({ skipChainsAtom: mocks.skipChainsAtom }));
vi.mock("@/state/swapExecutionPage", () => ({
  chainAddressesAtom: mocks.chainAddressesAtom,
  swapExecutionStateAtom: mocks.swapExecutionStateAtom,
  userAddressesEffectAtom: mocks.userAddressesEffectAtom,
}));
vi.mock("@/state/wallets", () => ({
  connectedAddressesAtom: mocks.connectedAddressesAtom,
  walletsAtom: mocks.walletsAtom,
}));
vi.mock("@/state/history", () => ({ currentTransactionAtom: mocks.currentTransactionAtom }));
vi.mock("@/utils/clientType", () => ({
  getClientOperations: () => mocks.operations,
}));
vi.mock("@/modals/SetAddressModal/SetAddressModal", () => ({
  WalletSource: {
    Input: "input",
    Wallet: "wallet",
    Injected: "injected",
  },
}));
vi.mock("@/modals/registerModals", () => ({
  Modals: { SetAddressModal: "SetAddressModal" },
}));
vi.mock("@ebay/nice-modal-react", () => ({
  default: { show: mocks.showModal },
}));
vi.mock("@/constants/graz", () => ({
  getCosmosWalletInfo: () => ({ imgSrc: "keplr.svg" }),
}));
vi.mock("graz", () => ({ WalletType: { KEPLR: "keplr" } }));
vi.mock("@skip-go/client", () => ({
  ChainType: { Cosmos: "cosmos", Evm: "evm", Svm: "svm" },
}));

const makeWallet = (chainId: string) => ({
  walletName: mocks.walletName,
  walletPrettyName: mocks.walletName,
  walletChainType: "cosmos",
  walletInfo: {},
  connect: vi.fn(),
  disconnect: vi.fn(),
  isWalletConnected: true,
  getAddress: mocks.getAddress,
  ...(mocks.walletName === "walletconnect"
    ? { getConnectedAddress: () => mocks.getConnectedAddress(chainId) }
    : {}),
});

vi.mock("./useCreateCosmosWallets", () => ({
  useCreateCosmosWallets: () => ({
    createCosmosWallets: (chainId: string) => [makeWallet(chainId)],
  }),
}));
vi.mock("./useCreateEvmWallets", () => ({
  useCreateEvmWallets: () => ({ createEvmWallets: () => [] }),
}));
vi.mock("./useCreateSolanaWallets", () => ({
  useCreateSolanaWallets: () => ({ createSolanaWallets: () => [] }),
}));

import { useAutoSetAddress } from "./useAutoSetAddress";

describe("useAutoSetAddress WalletConnect partial approval", () => {
  beforeEach(() => {
    mocks.requiredChainAddresses = ["dimension_37-1", "noble-1"];
    mocks.operations = [{ signRequired: true, fromChainId: "dimension_37-1" }];
    mocks.approvedAddresses = { "dimension_37-1": "xpla1approved" };
    mocks.walletName = "walletconnect";
    mocks.chainAddresses = {
      0: { chainId: "dimension_37-1", address: "" },
      1: { chainId: "noble-1", address: "" },
    };
    mocks.getAddress.mockReset();
    mocks.getAddress.mockResolvedValue({ address: "connected-by-command" });
    mocks.getConnectedAddress.mockReset();
    mocks.getConnectedAddress.mockImplementation(async (chainId: string) => ({
      address: mocks.approvedAddresses[chainId],
    }));
    mocks.showModal.mockReset();
    mocks.setChainAddresses.mockReset();
    mocks.setChainAddresses.mockImplementation(
      (
        update: (
          previous: typeof mocks.chainAddresses,
        ) => typeof mocks.chainAddresses,
      ) => {
        mocks.chainAddresses = update(mocks.chainAddresses);
      },
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("reuses the approved XPLA address and leaves an address-only Noble destination unset", async () => {
    const { result } = renderHook(() => useAutoSetAddress());

    await act(async () => {
      await result.current.connectRequiredChains();
    });
    await waitFor(() => expect(mocks.getConnectedAddress).toHaveBeenCalledTimes(2));

    expect(mocks.chainAddresses[0]?.address).toBe("xpla1approved");
    expect(mocks.chainAddresses[1]?.address).toBe("");
    expect(mocks.getAddress).not.toHaveBeenCalled();
    expect(mocks.showModal).not.toHaveBeenCalled();
  });

  it("fills every occurrence of the same approved chain without connecting", async () => {
    mocks.requiredChainAddresses = ["dimension_37-1", "dimension_37-1", "noble-1"];
    mocks.chainAddresses = {
      0: { chainId: "dimension_37-1", address: "" },
      1: { chainId: "dimension_37-1", address: "" },
      2: { chainId: "noble-1", address: "" },
    };
    const { result } = renderHook(() => useAutoSetAddress());

    await act(async () => {
      await result.current.connectRequiredChains();
    });
    await waitFor(() => expect(mocks.getConnectedAddress).toHaveBeenCalledTimes(3));

    expect(mocks.chainAddresses[0]?.address).toBe("xpla1approved");
    expect(mocks.chainAddresses[1]?.address).toBe("xpla1approved");
    expect(mocks.chainAddresses[2]?.address).toBe("");
    expect(mocks.getAddress).not.toHaveBeenCalled();
  });

  it("opens the existing address modal without starting a WalletConnect proposal", async () => {
    const { result } = renderHook(() => useAutoSetAddress());

    await act(async () => {
      await result.current.connectRequiredChains(true);
    });
    await waitFor(() => expect(mocks.showModal).toHaveBeenCalled());

    expect(mocks.showModal).toHaveBeenCalledWith("SetAddressModal", {
      signRequired: false,
      chainId: "noble-1",
      chainAddressIndex: 1,
    });
    expect(mocks.getAddress).not.toHaveBeenCalled();
    expect(mocks.chainAddresses[0]?.address).toBe("xpla1approved");
  });

  it("keeps the existing automatic address lookup for a full-approval non-WalletConnect wallet", async () => {
    mocks.walletName = "keplr";
    mocks.approvedAddresses = {};
    const { result } = renderHook(() => useAutoSetAddress());

    await act(async () => {
      await result.current.connectRequiredChains();
    });
    await waitFor(() => expect(mocks.getAddress).toHaveBeenCalledTimes(2));

    expect(mocks.chainAddresses[0]?.address).toBe("connected-by-command");
    expect(mocks.chainAddresses[1]?.address).toBe("connected-by-command");
  });

  it("automatically fills every required chain for a fully approved WalletConnect session", async () => {
    mocks.approvedAddresses = {
      "dimension_37-1": "xpla1approved",
      "noble-1": "noble1approved",
    };
    const { result } = renderHook(() => useAutoSetAddress());

    await act(async () => {
      await result.current.connectRequiredChains();
    });
    await waitFor(() => expect(mocks.getConnectedAddress).toHaveBeenCalledTimes(2));

    expect(mocks.chainAddresses[0]?.address).toBe("xpla1approved");
    expect(mocks.chainAddresses[1]?.address).toBe("noble1approved");
    expect(mocks.getAddress).not.toHaveBeenCalled();
  });

  it("does not auto-connect a missing sign-required WalletConnect chain", async () => {
    mocks.operations = [{ signRequired: true, fromChainId: "noble-1" }];
    const { result } = renderHook(() => useAutoSetAddress());

    await act(async () => {
      await result.current.connectRequiredChains();
    });
    await waitFor(() => expect(mocks.getConnectedAddress).toHaveBeenCalledTimes(2));

    expect(mocks.chainAddresses[0]?.address).toBe("xpla1approved");
    expect(mocks.chainAddresses[1]?.address).toBe("");
    expect(mocks.getAddress).not.toHaveBeenCalled();
  });

  it("opens only one existing address modal when multiple WalletConnect chains are missing", async () => {
    mocks.requiredChainAddresses = ["dimension_37-1", "noble-1", "osmosis-1"];
    mocks.chainAddresses = {
      0: { chainId: "dimension_37-1", address: "" },
      1: { chainId: "noble-1", address: "" },
      2: { chainId: "osmosis-1", address: "" },
    };
    const { result } = renderHook(() => useAutoSetAddress());

    await act(async () => {
      await result.current.connectRequiredChains(true);
    });
    await waitFor(() => expect(mocks.getConnectedAddress).toHaveBeenCalledTimes(3));

    expect(mocks.showModal).toHaveBeenCalledTimes(1);
    expect(mocks.getAddress).not.toHaveBeenCalled();
  });
});
