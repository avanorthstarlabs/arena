import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  formatEther,
  Hash,
} from "viem";
import { base } from "viem/chains";
import { config } from "../config.js";
import { prisma } from "../db/client.js";
import { erc20Abi } from "./abi.js";
import { Decimal } from "@prisma/client/runtime/library.js";

let watchUnsubscribe: (() => void) | null = null;

/**
 * Start watching for deposit events on the ARENA token
 */
export async function startDepositWatcher(): Promise<void> {
  if (!config.masterDepositAddress) {
    console.error("Missing MASTER_DEPOSIT_ADDRESS config");
    return;
  }

  const publicClient = createPublicClient({
    chain: base,
    transport: http(config.baseRpcUrl),
  });

  const useErc20 = !!config.arenaTokenAddress;
  const mode = useErc20 ? "ERC-20" : "native ETH";
  console.log(
    `[Deposit Watcher] Starting in ${mode} mode, watching deposits to ${config.masterDepositAddress}`
  );

  try {
    if (useErc20) {
      // ERC-20 mode: watch Transfer events on the token contract
      watchUnsubscribe = publicClient.watchContractEvent({
        address: config.arenaTokenAddress as `0x${string}`,
        abi: erc20Abi,
        eventName: "Transfer",
        onLogs: async (logs) => {
          for (const log of logs) {
            if (log.eventName === "Transfer") {
              const { args } = log as {
                args: { from?: string; to?: string; value?: bigint };
              };

              if (
                args.to?.toLowerCase() ===
                  config.masterDepositAddress!.toLowerCase() &&
                args.from &&
                args.value
              ) {
                try {
                  await processDeposit(
                    args.from,
                    formatUnits(args.value, 18),
                    (log.transactionHash || "") as string
                  );
                } catch (error) {
                  console.error(
                    `[Deposit Watcher] Error processing deposit: ${error}`
                  );
                }
              }
            }
          }
        },
        onError: (error) => {
          console.error("[Deposit Watcher] Watch error:", error);
        },
      });
    } else {
      // Native ETH mode: scan blocks for value transfers to deposit address
      watchUnsubscribe = publicClient.watchBlockNumber({
        onBlockNumber: async (blockNumber) => {
          try {
            const block = await publicClient.getBlock({
              blockNumber,
              includeTransactions: true,
            });
            for (const tx of block.transactions) {
              if (
                typeof tx === "object" &&
                tx.to?.toLowerCase() ===
                  config.masterDepositAddress!.toLowerCase() &&
                tx.value > 0n
              ) {
                await processDeposit(
                  tx.from,
                  formatEther(tx.value),
                  tx.hash
                );
              }
            }
          } catch (error) {
            console.error(
              "[Deposit Watcher] Block processing error:",
              error
            );
          }
        },
        onError: (error) => {
          console.error("[Deposit Watcher] Watch error:", error);
        },
      });
    }
  } catch (error) {
    console.error("[Deposit Watcher] Failed to start watching:", error);
    throw error;
  }
}

/**
 * Stop watching for deposit events
 */
export function stopDepositWatcher(): void {
  if (watchUnsubscribe) {
    watchUnsubscribe();
    watchUnsubscribe = null;
    console.log("[Deposit Watcher] Stopped");
  }
}

/**
 * Process a deposit: credit user balance and create transaction record
 */
export async function processDeposit(
  fromAddress: string,
  amount: string,
  txHash: string
): Promise<void> {
  const amountDecimal = new Decimal(amount);

  try {
    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Look up or create user
      let user = await tx.user.findUnique({
        where: { walletAddress: fromAddress },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            walletAddress: fromAddress,
            balance: amountDecimal,
            totalDeposited: amountDecimal,
          },
        });
        console.log(
          `[Deposit Watcher] Created new user: ${fromAddress} with balance ${amount} ${config.arenaTokenAddress ? "NORTH" : "ETH"}`
        );
      } else {
        // Update existing user balance
        user = await tx.user.update({
          where: { walletAddress: fromAddress },
          data: {
            balance: {
              increment: amountDecimal,
            },
            totalDeposited: {
              increment: amountDecimal,
            },
          },
        });
        console.log(
          `[Deposit Watcher] Credited ${amount} ${config.arenaTokenAddress ? "NORTH" : "ETH"} to ${fromAddress}, new balance: ${user.balance}`
        );
      }

      // Create transaction record
      await tx.transaction.create({
        data: {
          walletAddress: fromAddress,
          type: "deposit",
          amount: amountDecimal,
          txHash,
        },
      });
    });

    console.log(
      `[Deposit Watcher] Processed deposit: ${amount} ${config.arenaTokenAddress ? "NORTH" : "ETH"} from ${fromAddress}, txHash: ${txHash}`
    );
  } catch (error) {
    console.error(
      `[Deposit Watcher] Failed to process deposit for ${fromAddress}:`,
      error
    );
    throw error;
  }
}
