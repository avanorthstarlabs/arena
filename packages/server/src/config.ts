export const config = {
  port: parseInt(process.env.PORT ?? "3001"),
  corsOrigins: process.env.CORS_ORIGINS?.split(",") ?? [
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  baseRpcUrl: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
  northTokenAddress: process.env.NORTH_TOKEN_ADDRESS,
  hotWalletKey: process.env.HOT_WALLET_PRIVATE_KEY,
  masterDepositAddress: process.env.MASTER_DEPOSIT_ADDRESS,
  nodeEnv: process.env.NODE_ENV ?? "development",
} as const;
