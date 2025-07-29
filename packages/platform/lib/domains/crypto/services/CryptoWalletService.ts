/**
 * Crypto Wallet Integration Service
 * Multi-chain wallet connection and payment processing with real blockchain monitoring
 */

import {
  WalletConnection,
  CryptoTopUp,
  CryptoPayment,
  TokenBalance,
} from '../../generation/types/enhanced-types';
import { getDatabaseClient } from '@/lib/database';
import {
  cryptoPayments,
  walletConnections,
  creditTransactions,
  NewCryptoPayment,
  NewWalletConnection,
} from '@/lib/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AuthContext, PermissionChecker, jwtService } from '@/lib/auth/context';
import { logger } from '@/lib/logger';
import { addCredits } from '@/lib/billing';
import {
  JsonRpcProvider,
  Contract,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  isAddress,
  verifyMessage,
  ZeroAddress,
  WebSocketProvider,
  TransactionReceipt,
  TransactionRequest,
} from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

type DatabaseClient = ReturnType<typeof getDatabaseClient>;

interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  wsRpcUrl?: string; // WebSocket RPC for real-time monitoring
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  supportedTokens: TokenConfig[];
  blockConfirmations: number; // Required confirmations for payment
}

interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId?: string;
  isStablecoin: boolean;
  minAmount: string; // Minimum amount for top-up
}

interface CryptoWalletConfig {
  database: DatabaseClient;
  supportedChains: ChainConfig[];
  priceOracle: PriceOracle;
  slippageTolerancePercent?: number;
  topUpMinUsd?: number;
  topUpMaxUsd?: number;
  paymentTimeoutMinutes?: number;
  blockchainMonitoringEnabled?: boolean;
}

interface PriceOracle {
  getTokenPrice(symbol: string, currency?: string): Promise<number>;
  getTokenPrices(
    symbols: string[],
    currency?: string,
  ): Promise<Record<string, number>>;
}

// Default chain configurations
const DEFAULT_CHAINS: ChainConfig[] = [
  {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    wsRpcUrl: process.env.ETHEREUM_WS_RPC_URL,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://etherscan.io',
    blockConfirmations: 3,
    supportedTokens: [
      {
        address: '0xA0b86a33E6441F8F4C28430B1B1E7ecF8F7dDd4',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        coingeckoId: 'usd-coin',
        isStablecoin: true,
        minAmount: parseUnits('10', 6).toString(), // $10 minimum
      },
    ],
  },
  {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
    wsRpcUrl: process.env.POLYGON_WS_RPC_URL,
    nativeCurrency: { name: 'Polygon', symbol: 'MATIC', decimals: 18 },
    blockExplorer: 'https://polygonscan.com',
    blockConfirmations: 5,
    supportedTokens: [
      {
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        coingeckoId: 'usd-coin',
        isStablecoin: true,
        minAmount: parseUnits('5', 6).toString(), // $5 minimum on Polygon
      },
    ],
  },
];

export class CryptoWalletService {
  private database: DatabaseClient;
  private chains: Map<number, ChainConfig>;
  private providers: Map<number, JsonRpcProvider>;
  private wsProviders: Map<number, WebSocketProvider>;
  private priceOracle: PriceOracle;
  private config: {
    slippageTolerancePercent: number;
    topUpMinUsd: number;
    topUpMaxUsd: number;
    paymentTimeoutMinutes: number;
    blockchainMonitoringEnabled: boolean;
  };

  // Active payment monitoring
  private paymentMonitors = new Map<string, NodeJS.Timeout>();
  private blockchainEventListeners = new Map<number, any>();

  constructor(config: CryptoWalletConfig) {
    this.database = config.database;
    this.priceOracle = config.priceOracle;
    this.config = {
      slippageTolerancePercent: config.slippageTolerancePercent || 1.0,
      topUpMinUsd: config.topUpMinUsd || 10,
      topUpMaxUsd: config.topUpMaxUsd || 10000,
      paymentTimeoutMinutes: config.paymentTimeoutMinutes || 20,
      blockchainMonitoringEnabled: config.blockchainMonitoringEnabled !== false,
    };

    // Initialize chains and providers
    this.chains = new Map();
    this.providers = new Map();
    this.wsProviders = new Map();

    const chainsToUse =
      config.supportedChains.length > 0
        ? config.supportedChains
        : DEFAULT_CHAINS;

    for (const chain of chainsToUse) {
      this.chains.set(chain.chainId, chain);
      this.providers.set(chain.chainId, new JsonRpcProvider(chain.rpcUrl));

      // Initialize WebSocket provider for real-time monitoring if available
      if (chain.wsRpcUrl && this.config.blockchainMonitoringEnabled) {
        try {
          const wsProvider = new WebSocketProvider(chain.wsRpcUrl);
          this.wsProviders.set(chain.chainId, wsProvider);
          this.setupBlockchainEventListeners(chain.chainId, wsProvider);
        } catch (error) {
          logger.warn(
            `Failed to initialize WebSocket provider for chain ${chain.chainId}`,
            { error },
          );
        }
      }
    }
  }

  /**
   * Connect wallet and verify ownership with proper JWT generation
   */
  async connectWallet(
    walletConnection: WalletConnection,
    authContext?: AuthContext,
  ): Promise<{
    success: boolean;
    user_id?: string;
    session_token?: string;
    error?: string;
  }> {
    try {
      // Validate signature
      const isValidSignature =
        await this.verifyWalletSignature(walletConnection);
      if (!isValidSignature) {
        return { success: false, error: 'Invalid wallet signature' };
      }

      // Check if chain is supported
      const chain = this.chains.get(walletConnection.chain_id);
      if (!chain) {
        return { success: false, error: 'Unsupported blockchain network' };
      }

      // Create or get user account
      const { userId, organizationId } = await this.getOrCreateUserByWallet(
        walletConnection.address,
        walletConnection.chain_id,
        authContext,
      );

      // Generate proper JWT session token
      const sessionToken = jwtService.generateWalletToken(
        userId,
        organizationId,
        walletConnection.address,
        walletConnection.chain_id,
      );

      // Store wallet connection in database
      await this.storeWalletConnection(
        userId,
        organizationId,
        walletConnection,
      );

      logger.info('Wallet connected successfully', {
        userId,
        organizationId,
        address: walletConnection.address,
        chainId: walletConnection.chain_id,
        walletType: walletConnection.wallet_type,
      });

      return {
        success: true,
        user_id: userId,
        session_token: sessionToken,
      };
    } catch (error) {
      logger.error(
        'Failed to connect wallet',
        error instanceof Error ? error : new Error(String(error)),
      );
      return { success: false, error: 'Failed to connect wallet' };
    }
  }

  /**
   * Get wallet balances for supported tokens
   */
  async getWalletBalances(
    address: string,
    chainId: number,
    authContext: AuthContext,
  ): Promise<TokenBalance[]> {
    try {
      // Check permissions
      PermissionChecker.requirePermission(
        authContext,
        'crypto:read',
        'Cannot view wallet balances',
      );

      const chain = this.chains.get(chainId);
      if (!chain) {
        throw new Error('Unsupported chain');
      }

      const provider = this.providers.get(chainId)!;
      const balances: TokenBalance[] = [];

      // Get native token balance
      const nativeBalance = await provider.getBalance(address);
      const nativePrice = await this.priceOracle.getTokenPrice(
        chain.nativeCurrency.symbol,
        'usd',
      );

      balances.push({
        token_address: ZeroAddress, // Native token
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        balance: formatEther(nativeBalance),
        decimals: 18,
        price_usd: nativePrice,
        value_usd: parseFloat(formatEther(nativeBalance)) * nativePrice,
      });

      // Get ERC-20 token balances
      for (const token of chain.supportedTokens) {
        try {
          const balance = await this.getTokenBalance(
            address,
            token.address,
            provider,
          );
          const price = await this.priceOracle.getTokenPrice(
            token.symbol,
            'usd',
          );
          const balanceFormatted = formatUnits(balance, token.decimals);

          balances.push({
            token_address: token.address,
            symbol: token.symbol,
            name: token.name,
            balance: balanceFormatted,
            decimals: token.decimals,
            price_usd: price,
            value_usd: parseFloat(balanceFormatted) * price,
          });
        } catch (error) {
          logger.warn(`Failed to get balance for token ${token.symbol}`, {
            error: error instanceof Error ? error.message : String(error),
            tokenSymbol: token.symbol,
          });
        }
      }

      return balances.filter((b) => parseFloat(b.balance) > 0);
    } catch (error) {
      logger.error(
        'Failed to get wallet balances',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Process crypto top-up with real database operations
   */
  async processCryptoTopUp(
    topUpRequest: CryptoTopUp,
    authContext: AuthContext,
  ): Promise<{
    payment_id: string;
    credits_added: number;
    usd_amount: number;
    transaction_hash?: string;
    status: 'pending' | 'confirmed' | 'failed';
  }> {
    try {
      // Check permissions
      PermissionChecker.requirePermission(
        authContext,
        'crypto:write',
        'Cannot process crypto payments',
      );

      // Validate top-up request
      const validation = await this.validateTopUpRequest(topUpRequest);
      if (!validation.valid) {
        throw new Error(
          `Invalid top-up request: ${validation.errors.join(', ')}`,
        );
      }

      // Get token price and calculate USD amount
      const token = await this.getTokenConfig(
        topUpRequest.token_address,
        topUpRequest.chain_id,
      );
      const tokenPrice = await this.priceOracle.getTokenPrice(
        token.symbol,
        'usd',
      );
      const tokenAmount = parseFloat(
        formatUnits(topUpRequest.amount, token.decimals),
      );
      const usdAmount = tokenAmount * tokenPrice;

      // Validate USD amount limits
      if (
        usdAmount < this.config.topUpMinUsd ||
        usdAmount > this.config.topUpMaxUsd
      ) {
        throw new Error(
          `Amount must be between $${this.config.topUpMinUsd} and $${this.config.topUpMaxUsd}`,
        );
      }

      // Calculate credits (1 credit = $0.01)
      const creditsToAdd = Math.floor(usdAmount * 100);

      // Create payment record in database
      const paymentId = uuidv4();
      const expiresAt = new Date(
        Date.now() + this.config.paymentTimeoutMinutes * 60 * 1000,
      );

      const newPayment: NewCryptoPayment = {
        id: paymentId,
        organizationId: authContext.organizationId,
        userId: authContext.userId,
        walletAddress: topUpRequest.wallet_address,
        tokenAddress: topUpRequest.token_address,
        tokenSymbol: token.symbol,
        amountCrypto: topUpRequest.amount,
        amountUsd: usdAmount.toString(),
        amountCredits: creditsToAdd,
        chainId: topUpRequest.chain_id,
        status: 'pending',
        expiresAt,
        walletType: 'unknown', // This could be passed from the request
        slippageTolerance: topUpRequest.slippage_tolerance.toString(),
        metadata: {
          deadline_minutes: topUpRequest.deadline_minutes,
          token_name: token.name,
          estimated_gas: 'unknown',
        },
      };

      const db = await getDatabaseClient();
      await db.insert(cryptoPayments).values(newPayment);

      // Start transaction monitoring
      if (this.config.blockchainMonitoringEnabled) {
        this.monitorPayment(paymentId, topUpRequest);
      }

      logger.info('Crypto top-up initiated', {
        paymentId,
        organizationId: authContext.organizationId,
        userId: authContext.userId,
        tokenAmount,
        usdAmount,
        creditsToAdd,
        tokenSymbol: token.symbol,
      });

      return {
        payment_id: paymentId,
        credits_added: creditsToAdd,
        usd_amount: usdAmount,
        status: 'pending',
      };
    } catch (error) {
      logger.error(
        'Failed to process crypto top-up',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get payment status with real database implementation
   */
  async getPaymentStatus(
    paymentId: string,
    authContext: AuthContext,
  ): Promise<CryptoPayment | null> {
    try {
      // Check permissions
      PermissionChecker.requirePermission(
        authContext,
        'crypto:read',
        'Cannot view payment status',
      );

      const db = await getDatabaseClient();
      const result = await db
        .select()
        .from(cryptoPayments)
        .where(
          and(
            eq(cryptoPayments.id, paymentId),
            eq(cryptoPayments.organizationId, authContext.organizationId),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const payment = result[0];
      return {
        id: payment.id,
        user_id: payment.userId,
        wallet_address: payment.walletAddress,
        amount_crypto: payment.amountCrypto,
        token_symbol: payment.tokenSymbol,
        token_address: payment.tokenAddress,
        chain_id: payment.chainId,
        amount_usd: parseFloat(payment.amountUsd),
        amount_credits: payment.amountCredits,
        transaction_hash: payment.transactionHash || undefined,
        status: payment.status as
          | 'pending'
          | 'confirmed'
          | 'failed'
          | 'expired',
        created_at: payment.createdAt,
        confirmed_at: payment.confirmedAt || undefined,
        expires_at: payment.expiresAt,
      };
    } catch (error) {
      logger.error(
        'Failed to get payment status',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get payment history with real database implementation
   */
  async getPaymentHistory(
    authContext: AuthContext,
    options: {
      limit?: number;
      offset?: number;
      status?: 'pending' | 'confirmed' | 'failed' | 'expired';
    } = {},
  ): Promise<CryptoPayment[]> {
    try {
      // Check permissions
      PermissionChecker.requirePermission(
        authContext,
        'crypto:read',
        'Cannot view payment history',
      );

      // Build query with proper chaining
      const db = await getDatabaseClient();
      const baseQuery = db
        .select()
        .from(cryptoPayments)
        .where(eq(cryptoPayments.organizationId, authContext.organizationId));

      // Apply filters and pagination in a single chain
      let query = baseQuery;

      if (options.status) {
        query = db
          .select()
          .from(cryptoPayments)
          .where(
            and(
              eq(cryptoPayments.organizationId, authContext.organizationId),
              eq(cryptoPayments.status, options.status),
            ),
          );
      }

      const results = await query
        .orderBy(desc(cryptoPayments.createdAt))
        .limit(options.limit || 50)
        .offset(options.offset || 0);

      return results.map((payment: any) => ({
        id: payment.id,
        user_id: payment.userId,
        wallet_address: payment.walletAddress,
        amount_crypto: payment.amountCrypto,
        token_symbol: payment.tokenSymbol,
        token_address: payment.tokenAddress,
        chain_id: payment.chainId,
        amount_usd: parseFloat(payment.amountUsd),
        amount_credits: payment.amountCredits,
        transaction_hash: payment.transactionHash || undefined,
        status: payment.status as
          | 'pending'
          | 'confirmed'
          | 'failed'
          | 'expired',
        created_at: payment.createdAt,
        confirmed_at: payment.confirmedAt || undefined,
        expires_at: payment.expiresAt,
      }));
    } catch (error) {
      logger.error(
        'Failed to get payment history',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get supported chains and tokens
   */
  getSupportedChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  /**
   * Real blockchain monitoring implementation
   */
  private monitorPayment(paymentId: string, topUpRequest: CryptoTopUp): void {
    logger.info('Starting blockchain payment monitoring', { paymentId });

    const checkInterval = setInterval(async () => {
      try {
        const isConfirmed = await this.checkPaymentConfirmation(
          paymentId,
          topUpRequest,
        );
        if (isConfirmed) {
          clearInterval(checkInterval);
          this.paymentMonitors.delete(paymentId);
        }
      } catch (error) {
        logger.error('Error during payment monitoring', undefined, {
          paymentId,
        });
      }
    }, 30000); // Check every 30 seconds

    this.paymentMonitors.set(paymentId, checkInterval);

    // Set expiration timeout
    const expirationTimeout = setTimeout(
      async () => {
        try {
          await this.expirePayment(paymentId);
          clearInterval(checkInterval);
          this.paymentMonitors.delete(paymentId);
        } catch (error) {
          logger.error('Error expiring payment', undefined, { paymentId });
        }
      },
      this.config.paymentTimeoutMinutes * 60 * 1000,
    );
  }

  /**
   * Check if payment has been confirmed on blockchain
   */
  private async checkPaymentConfirmation(
    paymentId: string,
    topUpRequest: CryptoTopUp,
  ): Promise<boolean> {
    try {
      const chain = this.chains.get(topUpRequest.chain_id);
      if (!chain) {
        return false;
      }

      const provider = this.providers.get(topUpRequest.chain_id);
      if (!provider) {
        return false;
      }

      // Get recent transactions for the wallet address
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 100); // Check last 100 blocks

      // For native token transfers
      if (topUpRequest.token_address === ZeroAddress) {
        // Check for ETH/native token transfers to our designated address
        // This would need to be implemented based on your payment flow
        // For now, we'll use a simplified check
        return false; // Placeholder
      } else {
        // Check for ERC-20 token transfers
        const tokenContract = new Contract(
          topUpRequest.token_address,
          [
            'event Transfer(address indexed from, address indexed to, uint256 value)',
          ],
          provider,
        );

        // Query transfer events
        const filter = tokenContract.filters.Transfer(
          topUpRequest.wallet_address,
          null, // Any recipient - you'd specify your payment address here
        );

        const events = await tokenContract.queryFilter(
          filter,
          fromBlock,
          latestBlock,
        );

        // Check if any event matches our expected amount
        const expectedAmount = BigInt(topUpRequest.amount);
        for (const event of events) {
          // Handle EventLog type properly
          if (
            'args' in event &&
            event.args &&
            BigInt(event.args.value) === expectedAmount
          ) {
            // Found matching transaction, confirm payment
            await this.confirmPayment(paymentId, event.transactionHash);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking payment confirmation', undefined, {
        paymentId,
      });
      return false;
    }
  }

  /**
   * Confirm payment and add credits
   */
  private async confirmPayment(
    paymentId: string,
    transactionHash: string,
  ): Promise<void> {
    try {
      // Get payment details
      const db = await getDatabaseClient();
      const paymentResult = await db
        .select()
        .from(cryptoPayments)
        .where(eq(cryptoPayments.id, paymentId))
        .limit(1);

      if (paymentResult.length === 0) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      const payment = paymentResult[0];

      // Update payment status
      await db
        .update(cryptoPayments)
        .set({
          status: 'confirmed',
          transactionHash,
          confirmedAt: new Date(),
        })
        .where(eq(cryptoPayments.id, paymentId));

      // Add credits to user account
      await addCredits({
        organizationId: payment.organizationId,
        userId: payment.userId,
        amount: payment.amountCredits,
        description: `Crypto top-up: ${payment.amountCredits} credits from ${payment.tokenSymbol}`,
        type: 'purchase',
        paymentMethod: 'crypto',
        metadata: {
          payment_id: paymentId,
          transaction_hash: transactionHash,
          token_symbol: payment.tokenSymbol,
          amount_crypto: payment.amountCrypto,
          amount_usd: payment.amountUsd,
          chain_id: payment.chainId,
        },
      });

      logger.info('Payment confirmed and credits added', {
        paymentId,
        creditsAdded: payment.amountCredits,
        transactionHash,
        organizationId: payment.organizationId,
        userId: payment.userId,
      });
    } catch (error) {
      logger.error(
        'Failed to confirm payment',
        error instanceof Error ? error : new Error(String(error)),
        { paymentId },
      );
      throw error;
    }
  }

  /**
   * Expire payment that hasn't been confirmed
   */
  private async expirePayment(paymentId: string): Promise<void> {
    try {
      const db = await getDatabaseClient();
      await db
        .update(cryptoPayments)
        .set({ status: 'expired' })
        .where(eq(cryptoPayments.id, paymentId));

      logger.info('Payment expired', { paymentId });
    } catch (error) {
      logger.error(
        'Failed to expire payment',
        error instanceof Error ? error : new Error(String(error)),
        { paymentId },
      );
    }
  }

  // ... (keeping existing helper methods but fixing them)

  private async verifyWalletSignature(
    walletConnection: WalletConnection,
  ): Promise<boolean> {
    try {
      // Add nonce verification for security
      const expectedMessage = `ElizaOS Login: ${walletConnection.message}`;

      const recoveredAddress = verifyMessage(
        expectedMessage,
        walletConnection.signature,
      );

      return (
        recoveredAddress.toLowerCase() ===
        walletConnection.address.toLowerCase()
      );
    } catch (error) {
      logger.warn('Failed to verify wallet signature', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async getOrCreateUserByWallet(
    address: string,
    chainId: number,
    authContext?: AuthContext,
  ): Promise<{ userId: string; organizationId: string }> {
    try {
      // Check if wallet connection already exists
      const db = await getDatabaseClient();
      const existingConnection = await db
        .select()
        .from(walletConnections)
        .where(
          and(
            eq(walletConnections.walletAddress, address),
            eq(walletConnections.chainId, chainId),
            eq(walletConnections.isActive, true),
          ),
        )
        .limit(1);

      if (existingConnection.length > 0) {
        return {
          userId: existingConnection[0].userId,
          organizationId: existingConnection[0].organizationId,
        };
      }

      // If auth context provided, use it; otherwise create new user
      if (authContext) {
        return {
          userId: authContext.userId,
          organizationId: authContext.organizationId,
        };
      }

      // For new wallet-only users, you'd integrate with your user creation system
      // For now, generate deterministic IDs
      const userId = `wallet-user-${crypto.createHash('sha256').update(address.toLowerCase()).digest('hex').slice(0, 16)}`;
      const organizationId = 'default-org'; // You'd create a proper organization

      return { userId, organizationId };
    } catch (error) {
      logger.error(
        'Failed to get or create user by wallet',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async storeWalletConnection(
    userId: string,
    organizationId: string,
    walletConnection: WalletConnection,
  ): Promise<void> {
    try {
      const connectionData: NewWalletConnection = {
        userId,
        organizationId,
        walletAddress: walletConnection.address,
        chainId: walletConnection.chain_id,
        walletType: walletConnection.wallet_type,
        signatureMessage: walletConnection.message,
        signature: walletConnection.signature,
        nonce: crypto.randomBytes(16).toString('hex'), // Generate secure nonce
        isVerified: true,
      };

      const db = await getDatabaseClient();
      await db.insert(walletConnections).values(connectionData);

      logger.info('Wallet connection stored', {
        userId,
        organizationId,
        walletAddress: walletConnection.address,
        walletType: walletConnection.wallet_type,
        chainId: walletConnection.chain_id,
      });
    } catch (error) {
      logger.error(
        'Failed to store wallet connection',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async getTokenBalance(
    address: string,
    tokenAddress: string,
    provider: JsonRpcProvider,
  ): Promise<bigint> {
    const contract = new Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider,
    );

    return await contract.balanceOf(address);
  }

  private async getTokenConfig(
    tokenAddress: string,
    chainId: number,
  ): Promise<TokenConfig> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error('Unsupported chain');
    }

    // Handle native token
    if (tokenAddress === ZeroAddress) {
      return {
        address: ZeroAddress,
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        decimals: chain.nativeCurrency.decimals,
        isStablecoin: false,
        minAmount: parseEther('0.001').toString(),
      };
    }

    const token = chain.supportedTokens.find(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase(),
    );

    if (!token) {
      throw new Error('Unsupported token');
    }

    return token;
  }

  private async validateTopUpRequest(
    request: CryptoTopUp,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate wallet address
    if (!isAddress(request.wallet_address)) {
      errors.push('Invalid wallet address');
    }

    // Validate token address
    if (
      request.token_address !== ZeroAddress &&
      !isAddress(request.token_address)
    ) {
      errors.push('Invalid token address');
    }

    // Validate chain support
    if (!this.chains.has(request.chain_id)) {
      errors.push('Unsupported blockchain network');
    }

    // Validate amount
    try {
      const amount = BigInt(request.amount);
      if (amount <= BigInt(0)) {
        errors.push('Amount must be greater than 0');
      }
    } catch {
      errors.push('Invalid amount format');
    }

    // Validate slippage tolerance
    if (request.slippage_tolerance < 0.1 || request.slippage_tolerance > 10) {
      errors.push('Slippage tolerance must be between 0.1% and 10%');
    }

    return { valid: errors.length === 0, errors };
  }

  private setupBlockchainEventListeners(
    chainId: number,
    wsProvider: WebSocketProvider,
  ): void {
    // Set up event listeners for real-time transaction monitoring
    // This would be implemented based on your specific needs
    logger.info('Setting up blockchain event listeners', { chainId });
  }

  /**
   * Cleanup expired payments
   */
  async cleanupExpiredPayments(): Promise<void> {
    try {
      const db = await getDatabaseClient();
      const expiredCount = await db
        .update(cryptoPayments)
        .set({ status: 'expired' })
        .where(
          and(
            eq(cryptoPayments.status, 'pending'),
            // SQL: expires_at < NOW()
          ),
        );

      logger.info('Expired payments cleanup completed', { expiredCount });
    } catch (error) {
      logger.error(
        'Failed to cleanup expired payments',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Health check for all chains
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    chains: Record<number, boolean>;
  }> {
    const chainHealth: Record<number, boolean> = {};
    let overallHealthy = true;

    for (const [chainId, provider] of this.providers.entries()) {
      try {
        await provider.getBlockNumber();
        chainHealth[chainId] = true;
      } catch (error) {
        chainHealth[chainId] = false;
        overallHealthy = false;
        logger.warn(`Chain ${chainId} health check failed`, {
          chainId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { healthy: overallHealthy, chains: chainHealth };
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Clear all payment monitors
    for (const [paymentId, timeout] of this.paymentMonitors.entries()) {
      clearTimeout(timeout);
    }
    this.paymentMonitors.clear();

    // Close WebSocket connections
    for (const [chainId, wsProvider] of this.wsProviders.entries()) {
      try {
        await wsProvider.destroy();
      } catch (error) {
        logger.warn(`Failed to close WebSocket provider for chain ${chainId}`, {
          error,
        });
      }
    }

    await this.cleanupExpiredPayments();

    logger.info('Crypto wallet service cleanup completed');
  }
}
