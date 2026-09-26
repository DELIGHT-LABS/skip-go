---
"@skip-go/widget": patch
---

Fix Cosmos WalletConnect routes to use approved accounts, avoid automatic connection prompts for missing destination addresses, and defer signer creation. Update Graz to 0.7.0 and isolate WalletConnect storage by ecosystem.

Fix missed source-chain approval requests when the Cosmos wallet becomes available after a source change.

Fix gas-route address entry to open one modal per action and save addresses to the gas route.
