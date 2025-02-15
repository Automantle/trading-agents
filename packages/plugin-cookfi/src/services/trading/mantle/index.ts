import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { TRADING_CONFIG } from "./config";
import type { MantleSwapParams, MantleSwapResponse } from "./types";
import {
    initWalletProvider,
    SwapAction,
    WalletProvider,
} from "@elizaos/plugin-evm";
import type { Address } from "viem";

export class MantleTradingService {
    private wallet: WalletProvider | null = null;
    private isConfigured: boolean = false;

    constructor(private runtime: IAgentRuntime) {
        const privateKeyString = process.env.COOKFI_MANTLE_PRIVATE_KEY;
        if (!privateKeyString) {
            throw new Error("COOKFI_MANTLE_PRIVATE_KEY is required");
        }

        const rpcUrl = process.env.COOKFI_MANTLE_RPC_URL;
        if (!rpcUrl) {
            throw new Error("COOKFI_MANTLE_RPC_URL is required");
        }

        this.isConfigured = true;
    }

    /**
     * Initialize or retrieve a wallet
     */
    private async getWallet(networkId?: string): Promise<WalletProvider> {
        if (!this.isConfigured) {
            throw new Error(
                "Mantle trading service not configured - missing environment variables"
            );
        }

        try {
            if (!this.wallet) {
                this.wallet = await initWalletProvider(this.runtime);
            }
            return this.wallet;
        } catch (error) {
            elizaLogger.error("Failed to initialize wallet:", error);
            throw error;
        }
    }

    /**
     * Attempt swap with retries and increasing slippage
     */
    async swapWithRetry(params: MantleSwapParams): Promise<MantleSwapResponse> {
        let retryCount = 0;
        let currentSlippage =
            params.slippage || TRADING_CONFIG.DEFAULT_SLIPPAGE;
        let lastError: Error | null = null;

        // Check initial slippage is within bounds
        if (currentSlippage > TRADING_CONFIG.MAX_SLIPPAGE) {
            const error = new Error(
                `Initial slippage ${currentSlippage.toFixed(
                    1
                )}% exceeds maximum allowed ${TRADING_CONFIG.MAX_SLIPPAGE}%`
            );
            elizaLogger.error("Swap failed - slippage too high:", {
                initialSlippage: `${currentSlippage.toFixed(1)}%`,
                maxAllowed: `${TRADING_CONFIG.MAX_SLIPPAGE}%`,
            });
            throw error;
        }

        while (retryCount < TRADING_CONFIG.MAX_RETRIES) {
            try {
                elizaLogger.log(
                    `Swap attempt ${retryCount + 1}/${
                        TRADING_CONFIG.MAX_RETRIES
                    }`,
                    {
                        slippage: `${currentSlippage}%`,
                        fromToken: params.fromToken,
                        toToken: params.toToken,
                        amount: params.amount,
                        network:
                            params.networkId || TRADING_CONFIG.DEFAULT_NETWORK,
                    }
                );

                return await this.swap({
                    ...params,
                    slippage: currentSlippage,
                });
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error));
                retryCount++;

                elizaLogger.warn(
                    `Swap failed, attempt ${retryCount}/${TRADING_CONFIG.MAX_RETRIES}`,
                    {
                        error: lastError.message,
                        currentSlippage: `${currentSlippage}%`,
                        nextSlippage: `${Math.min(
                            currentSlippage * 2,
                            TRADING_CONFIG.MAX_SLIPPAGE
                        )}%`,
                    }
                );

                const nextSlippage = Math.min(
                    currentSlippage * 2,
                    TRADING_CONFIG.MAX_SLIPPAGE
                );

                if (
                    retryCount >= TRADING_CONFIG.MAX_RETRIES ||
                    nextSlippage > TRADING_CONFIG.MAX_SLIPPAGE
                ) {
                    break;
                }

                currentSlippage = nextSlippage;
                await new Promise((resolve) =>
                    setTimeout(resolve, TRADING_CONFIG.RETRY_DELAY)
                );
            }
        }

        const errorMessage =
            `Swap failed after ${retryCount} attempts. ` +
            `Last error: ${lastError?.message || "Unknown error"}. ` +
            `Final slippage tried: ${currentSlippage.toFixed(1)}%`;

        elizaLogger.error("All swap attempts failed:", {
            attempts: retryCount,
            maxSlippageReached: currentSlippage >= TRADING_CONFIG.MAX_SLIPPAGE,
            lastError: lastError?.message || "Unknown error",
            finalSlippage: `${currentSlippage.toFixed(1)}%`,
        });

        throw new Error(errorMessage);
    }

    /**
     * Execute a token swap on Base network
     */
    async swap(params: MantleSwapParams): Promise<MantleSwapResponse> {
        try {
            const wallet = await this.getWallet();

            elizaLogger.log("Executing Base network swap:", {
                fromToken: params.fromToken,
                toToken: params.toToken,
                amount: params.amount,
                network: params.networkId,
            });

            // Create and execute trade using swap action
            const swapAction = new SwapAction(this.wallet);

            const transaction = await swapAction.swap({
                chain: params.networkId,
                fromToken: params.fromToken as Address,
                toToken: params.toToken as Address,
                amount: params.amount.toString(),
                slippage: params.slippage,
            });

            return {
                signature: transaction.hash,
                fromAmount: params.amount,
                toAmount: params.amount, // Actual amount should be retrieved from trade result
                networkId: params.networkId,
            };
        } catch (error) {
            elizaLogger.error("Base swap failed:", {
                error,
                message:
                    error instanceof Error ? error.message : "Unknown error",
                params,
            });
            throw error;
        }
    }
}

export default MantleTradingService;
