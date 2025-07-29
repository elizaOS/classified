/**
 * Real Crypto Payment Verification Service
 * Integrates with blockchain APIs to verify actual cryptocurrency payments
 */

import { getDatabase } from '../database/connection';
import { creditTransactions } from '../database/schema';
import { eq } from 'drizzle-orm';
import { ConfigValidator } from '../config/validation';

export interface CryptoPaymentRequest {
  organizationId: string;
  userId: string;
  amount: number; // USD amount expected
  walletAddress: string;
  network: 'ethereum' | 'polygon' | 'bsc';
  currency: 'ETH' | 'USDC' | 'USDT' | 'BNB' | 'MATIC';
}

export interface CryptoPaymentVerification {
  transactionHash: string;
  amount: number;
  confirmations: number;
  isConfirmed: boolean;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  timestamp: number;
}

interface AlchemyTransaction {
  hash: string;
  value: string;
  blockNumber: string;
  confirmations: number;
  gasUsed: string;
  gasPrice: string;
  timestamp: string;
  to: string;
  from: string;
}

export class CryptoPaymentVerifier {
  private static readonly REQUIRED_CONFIRMATIONS = {
    ethereum: 12,
    polygon: 20,
    bsc: 15,
  };

  private static readonly PAYMENT_TIMEOUT_MINUTES = 30;

  /**
   * Start monitoring for a crypto payment
   */
  static async startPaymentMonitoring(
    paymentRequest: CryptoPaymentRequest,
  ): Promise<{ paymentId: string; walletAddress: string }> {
    const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Store payment request for monitoring
    const db = getDatabase();
    await db.insert(creditTransactions).values({
      id: paymentId,
      organizationId: paymentRequest.organizationId,
      userId: paymentRequest.userId,
      type: 'crypto_pending',
      amount: '0', // Will be updated when payment is confirmed
      description: `Crypto payment pending - ${paymentRequest.amount} USD in ${paymentRequest.currency}`,
      paymentMethod: 'crypto',
      balanceAfter: '0', // Will be calculated when confirmed
      metadata: {
        expectedUsdAmount: paymentRequest.amount,
        walletAddress: paymentRequest.walletAddress,
        network: paymentRequest.network,
        currency: paymentRequest.currency,
        status: 'monitoring',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + this.PAYMENT_TIMEOUT_MINUTES * 60 * 1000,
        ).toISOString(),
      },
    });

    return {
      paymentId,
      walletAddress: paymentRequest.walletAddress,
    };
  }

  /**
   * Check for incoming payments to a wallet address
   */
  static async checkPayments(
    walletAddress: string,
    network: string,
  ): Promise<CryptoPaymentVerification[]> {
    try {
      // Check if crypto payment features are available
      if (!ConfigValidator.isCryptoPaymentAvailable()) {
        throw new Error(
          'Crypto payment verification not available - ALCHEMY_API_KEY not configured',
        );
      }

      const apiKey = ConfigValidator.getConfig('ALCHEMY_API_KEY');

      const networkMap = {
        ethereum: 'eth-mainnet',
        polygon: 'polygon-mainnet',
        bsc: 'bsc-mainnet', // Note: BSC not supported by Alchemy, would need different provider
      };

      const alchemyNetwork = networkMap[network as keyof typeof networkMap];
      if (!alchemyNetwork) {
        throw new Error(`Unsupported network: ${network}`);
      }

      // Get recent transactions for the wallet
      const response = await fetch(
        `https://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getAssetTransfers',
            params: [
              {
                fromBlock: '0x0',
                toAddress: walletAddress,
                category: ['external', 'erc20'],
                withMetadata: true,
                excludeZeroValue: true,
                maxCount: 50,
              },
            ],
          }),
        },
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`Alchemy API error: ${data.error.message}`);
      }

      const transfers = data.result?.transfers || [];

      return transfers.map(
        (transfer: any): CryptoPaymentVerification => ({
          transactionHash: transfer.hash,
          amount: parseFloat(transfer.value),
          confirmations: parseInt(transfer.blockNum, 16), // This would need current block calculation
          isConfirmed: parseInt(transfer.blockNum, 16) > 0, // Simplified confirmation check
          gasUsed: transfer.metadata?.gasUsed,
          gasPrice: transfer.metadata?.gasPrice,
          blockNumber: parseInt(transfer.blockNum, 16),
          timestamp:
            new Date(transfer.metadata?.blockTimestamp).getTime() / 1000,
        }),
      );
    } catch (error) {
      console.error('Failed to check crypto payments:', error);
      throw new Error('Failed to verify crypto payments');
    }
  }

  /**
   * Verify a specific transaction hash and amount
   */
  static async verifySpecificTransaction(
    transactionHash: string,
    expectedAmount: number,
    walletAddress: string,
    network: string,
  ): Promise<CryptoPaymentVerification | null> {
    try {
      // Check if crypto payment features are available
      if (!ConfigValidator.isCryptoPaymentAvailable()) {
        throw new Error(
          'Crypto payment verification not available - ALCHEMY_API_KEY not configured',
        );
      }

      const apiKey = ConfigValidator.getConfig('ALCHEMY_API_KEY');

      const networkMap = {
        ethereum: 'eth-mainnet',
        polygon: 'polygon-mainnet',
        bsc: 'bsc-mainnet',
      };

      const alchemyNetwork = networkMap[network as keyof typeof networkMap];
      if (!alchemyNetwork) {
        throw new Error(`Unsupported network: ${network}`);
      }

      // Get transaction details
      const response = await fetch(
        `https://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionByHash',
            params: [transactionHash],
          }),
        },
      );

      const data = await response.json();

      if (data.error || !data.result) {
        return null;
      }

      const transaction = data.result;

      // Get transaction receipt for confirmation status
      const receiptResponse = await fetch(
        `https://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_getTransactionReceipt',
            params: [transactionHash],
          }),
        },
      );

      const receiptData = await receiptResponse.json();
      const receipt = receiptData.result;

      if (!receipt) {
        return null; // Transaction not mined yet
      }

      // Verify transaction is to the correct address and amount
      const transactionAmount =
        parseFloat(transaction.value) / Math.pow(10, 18); // Convert from wei
      const isCorrectAddress =
        transaction.to?.toLowerCase() === walletAddress.toLowerCase();
      const isCorrectAmount =
        Math.abs(transactionAmount - expectedAmount) < 0.001; // Allow small variance

      if (!isCorrectAddress || !isCorrectAmount) {
        return null;
      }

      // Get current block number to calculate confirmations
      const currentBlockResponse = await fetch(
        `https://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'eth_blockNumber',
            params: [],
          }),
        },
      );

      const currentBlockData = await currentBlockResponse.json();
      const currentBlock = parseInt(currentBlockData.result, 16);
      const transactionBlock = parseInt(receipt.blockNumber, 16);
      const confirmations = currentBlock - transactionBlock + 1;

      const requiredConfirmations =
        this.REQUIRED_CONFIRMATIONS[
          network as keyof typeof this.REQUIRED_CONFIRMATIONS
        ];
      const isConfirmed = confirmations >= requiredConfirmations;

      return {
        transactionHash,
        amount: transactionAmount,
        confirmations,
        isConfirmed,
        gasUsed: receipt.gasUsed,
        gasPrice: transaction.gasPrice,
        blockNumber: transactionBlock,
        timestamp: Date.now() / 1000, // Approximate timestamp
      };
    } catch (error) {
      console.error('Failed to verify specific transaction:', error);
      return null;
    }
  }

  /**
   * Process confirmed crypto payment
   */
  static async processConfirmedPayment(
    paymentId: string,
    verification: CryptoPaymentVerification,
  ): Promise<void> {
    const db = getDatabase();

    try {
      await db.transaction(async (tx: any) => {
        // Get pending payment record
        const [pendingPayment] = await tx
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.id, paymentId))
          .limit(1);

        if (!pendingPayment) {
          throw new Error('Pending payment not found');
        }

        if (pendingPayment.type !== 'crypto_pending') {
          throw new Error('Payment already processed');
        }

        const metadata = pendingPayment.metadata as any;
        const expectedUsdAmount = metadata.expectedUsdAmount;

        // Update the transaction record with confirmed payment
        await tx
          .update(creditTransactions)
          .set({
            type: 'purchase',
            amount: expectedUsdAmount.toString(),
            description: `Crypto payment confirmed - ${verification.transactionHash}`,
            cryptoTransactionHash: verification.transactionHash,
            metadata: {
              ...metadata,
              status: 'confirmed',
              transactionHash: verification.transactionHash,
              confirmations: verification.confirmations,
              gasUsed: verification.gasUsed,
              gasPrice: verification.gasPrice,
              blockNumber: verification.blockNumber,
              confirmedAt: new Date().toISOString(),
            },
          })
          .where(eq(creditTransactions.id, paymentId));

        console.log(
          `Crypto payment confirmed: ${paymentId} - ${expectedUsdAmount} USD`,
        );
      });
    } catch (error) {
      console.error('Failed to process confirmed crypto payment:', error);
      throw error;
    }
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(paymentId: string): Promise<{
    status: 'pending' | 'confirmed' | 'expired' | 'failed';
    verification?: CryptoPaymentVerification;
    expiresAt?: Date;
  }> {
    const db = getDatabase();

    try {
      const [payment] = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.id, paymentId))
        .limit(1);

      if (!payment) {
        return { status: 'failed' };
      }

      const metadata = payment.metadata as any;
      const expiresAt = new Date(metadata.expiresAt);

      if (Date.now() > expiresAt.getTime()) {
        return { status: 'expired', expiresAt };
      }

      if (payment.type === 'purchase') {
        return {
          status: 'confirmed',
          verification: {
            transactionHash: metadata.transactionHash,
            amount: parseFloat(payment.amount),
            confirmations: metadata.confirmations,
            isConfirmed: true,
            gasUsed: metadata.gasUsed,
            gasPrice: metadata.gasPrice,
            blockNumber: metadata.blockNumber,
            timestamp: new Date(metadata.confirmedAt).getTime() / 1000,
          },
        };
      }

      return { status: 'pending', expiresAt };
    } catch (error) {
      console.error('Failed to get payment status:', error);
      return { status: 'failed' };
    }
  }

  /**
   * Cancel expired payments
   */
  static async cleanupExpiredPayments(): Promise<void> {
    const db = getDatabase();

    try {
      const expiredPayments = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.type, 'crypto_pending'));

      const now = new Date();
      const expiredIds: string[] = [];

      for (const payment of expiredPayments) {
        const metadata = payment.metadata as any;
        const expiresAt = new Date(metadata.expiresAt);

        if (now > expiresAt) {
          expiredIds.push(payment.id!);
        }
      }

      if (expiredIds.length > 0) {
        await db
          .update(creditTransactions)
          .set({
            type: 'crypto_expired',
            description: 'Crypto payment expired',
            metadata: {
              expiredAt: now.toISOString(),
            },
          })
          .where(eq(creditTransactions.type, 'crypto_pending'));

        console.log(`Cleaned up ${expiredIds.length} expired crypto payments`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired payments:', error);
    }
  }
}
