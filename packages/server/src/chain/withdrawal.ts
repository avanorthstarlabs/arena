import {
  createWalletClient,
  http,
  parseUnits,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { config } from "../config.js";
import { prisma } from "../db/client.js";
import { erc20Abi } from "./abi.js";
import { Decimal } from "@prisma/client/runtime/library.js";

/**
 * Process a withdrawal: debit user balance and send tokens from hot wallet
 * @param walletAddress - User wallet address
 * @param amount - Amount to withdraw in human-readable token units (e.g., "10.5")
 * @returns Transaction hash
 */
export async function processWithdrawal(
  walletAddress: string,
  amount: string
): Promise<{ txHash: string }> {
  if (!config.hotWalletKey) {
    throw new Error("HOT_WALLET_PRIVATE_KEY not configured");
  }

  const useErc20 = !!config.arenaTokenAddress;

  const amountDecimal = new Decimal(amount);

  // Validate user exists and has sufficient balance
  const user = await prisma.user.findUnique({
    where: { walletAddress },
  });

  if (!user) {
    throw new Error(`User not found: ${walletAddress}`);
  }

  const tokenLabel = useErc20 ? "NORTH" : "ETH";
  if (user.balance.lessThan(amountDecimal)) {
    throw new Error(
      `Insufficient balance. User has ${user.balance} ${tokenLabel}, requested ${amount} ${tokenLabel}`
    );
  }

  let transactionId: string;
  let txHash: string | null = null;

  try {
    // Create transaction record with initial state (txHash will be filled after chain send)
    const transaction = await prisma.$transaction(async (tx) => {
      // Debit user balance
      await tx.user.update({
        where: { walletAddress },
        data: {
          balance: {
            decrement: amountDecimal,
          },
          totalWithdrawn: {
            increment: amountDecimal,
          },
        },
      });

      // Create transaction record
      const record = await tx.transaction.create({
        data: {
          walletAddress,
          type: "withdrawal",
          amount: amountDecimal,
          referenceId: null,
          txHash: null, // Will update after chain send
        },
      });

      return record;
    });

    transactionId = transaction.id;

    // Send tokens from hot wallet
    try {
      const account = privateKeyToAccount(config.hotWalletKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(config.baseRpcUrl),
      });

      const tokenLabel = useErc20 ? "NORTH" : "ETH";
      console.log(
        `[Withdrawal] Sending ${amount} ${tokenLabel} to ${walletAddress} from hot wallet ${account.address}`
      );

      if (useErc20) {
        // ERC-20 mode: call transfer() on token contract
        const amountInWei = parseUnits(amount, 18);
        txHash = await walletClient.writeContract({
          account,
          address: config.arenaTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "transfer",
          args: [walletAddress as `0x${string}`, amountInWei],
        });
      } else {
        // Native ETH mode: direct value transfer
        txHash = await walletClient.sendTransaction({
          account,
          to: walletAddress as `0x${string}`,
          value: parseEther(amount),
        });
      }

      console.log(
        `[Withdrawal] Transaction sent: ${txHash} for ${amount} ${tokenLabel} to ${walletAddress}`
      );

      // Update transaction record with txHash
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { txHash },
      });

      return { txHash };
    } catch (chainError) {
      // Rollback: refund the user balance
      console.error(
        `[Withdrawal] Chain send failed for ${walletAddress}: ${chainError}`
      );

      await prisma.$transaction(async (tx) => {
        // Refund balance
        await tx.user.update({
          where: { walletAddress },
          data: {
            balance: {
              increment: amountDecimal,
            },
            totalWithdrawn: {
              decrement: amountDecimal,
            },
          },
        });

        // Delete the failed transaction record
        await tx.transaction.delete({
          where: { id: transactionId },
        });
      });

      throw new Error(`Failed to send tokens on chain: ${chainError}`);
    }
  } catch (error) {
    console.error(
      `[Withdrawal] Error processing withdrawal for ${walletAddress}:`,
      error
    );
    throw error;
  }
}
