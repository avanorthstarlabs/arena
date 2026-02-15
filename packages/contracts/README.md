# $NORTH Token

Standard ERC-20 on Base chain. 100B fixed supply, minted to distributor address on deploy.

## Deploy

Using Foundry:
```bash
forge create --rpc-url https://mainnet.base.org --private-key $DEPLOYER_KEY NorthToken --constructor-args $DISTRIBUTOR_ADDRESS
```

Or using Hardhat — install deps and configure as needed.

## Contract

- Name: Northstar
- Symbol: NORTH
- Supply: 100,000,000,000 (100B)
- Decimals: 18
- Standard: ERC-20 (OpenZeppelin)
