import { elizaLogger } from "@elizaos/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";
import { TRADING_CONFIG } from "./config";
import type {
    LendParams,
    LendResponse,
    StakeParams,
    StakeResponse,
    SwapParams,
    SwapResponse,
    TradingServiceConfig,
    TransferParams,
    TransferResponse,
} from "./types";

const SOL_ADDRESS = "So11111111111111111111111111111111111111112";
const MAX_RETRIES = 10;
const INITIAL_SLIPPAGE = 0.03; // 3%
const MAX_SLIPPAGE = 0.3; // 30%

export class TradingService {
    private connection: Connection;
    private agent: SolanaAgentKit;

    constructor(config: TradingServiceConfig) {
        const privateKeyString = process.env.COOKFI_SOLANA_PRIVATE_KEY;
        if (!privateKeyString) {
            throw new Error("COOKFI_SOLANA_PRIVATE_KEY is required");
        }

        const rpcUrl = process.env.COOKFI_SOLANA_RPC_URL;
        if (!rpcUrl) {
            throw new Error("COOKFI_SOLANA_RPC_URL is required");
        }

        this.connection = new Connection(rpcUrl);

        // Initialize SolanaAgentKit with decoded private key
        this.agent = new SolanaAgentKit(
            privateKeyString,
            rpcUrl,
            { OPENAI_API_KEY: process.env.OPENAI_API_KEY! }
        );
    }

    /**
     * Swap tokens using Jupiter aggregator with retry mechanism
     * @param params Swap parameters including fromToken, toToken, and amount
     * @returns Promise containing swap transaction signature and amounts
     */
    async swap(params: SwapParams): Promise<SwapResponse> {
        let lastError: Error | undefined;
        let currentSlippage = params.slippage || INITIAL_SLIPPAGE;
        let retryCount = 0;

        while (retryCount < MAX_RETRIES && currentSlippage <= MAX_SLIPPAGE) {
            try {
                // Handle SOL address consistently
                const outputMint = new PublicKey(
                    params.toToken === "SOL" ? SOL_ADDRESS : params.toToken
                );
                const inputMint = params.fromToken ? new PublicKey(
                    params.fromToken === "SOL" ? SOL_ADDRESS : params.fromToken
                ) : undefined;

                // Convert slippage to basis points (1% = 100 basis points)
                const slippageBps = Math.floor(currentSlippage * 100);

                elizaLogger.log("Executing swap attempt:", {
                    outputMint: outputMint.toString(),
                    inputMint: inputMint?.toString(),
                    inputAmount: params.amount,
                    slippageBps,
                    retryCount: retryCount + 1,
                    currentSlippage: `${currentSlippage * 100}%`
                });

                const signature = await this.agent.trade(
                    outputMint,
                    params.amount,
                    inputMint,
                    slippageBps
                );

                elizaLogger.log("Swap successful:", {
                    signature,
                    finalSlippage: `${currentSlippage * 100}%`,
                    attempts: retryCount + 1
                });

                return {
                    signature,
                    fromAmount: params.amount,
                    toAmount: params.amount
                };

            } catch (error) {
                lastError = error as Error;
                retryCount++;
                currentSlippage *= 2;

                // Check if we should continue retrying
                if (retryCount < MAX_RETRIES && currentSlippage <= MAX_SLIPPAGE) {
                    elizaLogger.warn("Swap failed, retrying with higher slippage", {
                        attempt: retryCount,
                        newSlippage: `${currentSlippage * 100}%`,
                        error: error instanceof Error ? error.message : "Unknown error"
                    });
                    
                    // Add a small delay before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                // If we reach here, we've hit max retries or max slippage
                break;
            }
        }

        // If we've exhausted all retries or hit max slippage
        const finalError = new Error(
            `Swap failed after ${retryCount} retries. ` +
            `Last error: ${lastError?.message || "Unknown error"}. ` +
            `Final slippage attempted: ${currentSlippage * 100}%`
        );
        
        elizaLogger.error("Swap failed permanently:", {
            error: finalError,
            attempts: retryCount,
            maxSlippageReached: currentSlippage >= MAX_SLIPPAGE,
            token: params.toToken,
            amount: params.amount
        });
        
        throw finalError;
    }

    /**
     * Transfer tokens to another address
     * @param params Transfer parameters including token, recipient, and amount
     * @returns Promise containing transfer transaction signature
     */
    async transfer(params: TransferParams): Promise<TransferResponse> {
        try {
            const recipient = new PublicKey(params.recipient);
            const tokenMint =
                params.token !== "SOL"
                    ? new PublicKey(params.token)
                    : undefined;

            const signature = await this.agent.transfer(
                recipient,
                params.amount,
                tokenMint
            );

            return {
                signature,
                amount: params.amount,
            };
        } catch (error) {
            elizaLogger.error("Transfer failed:", error);
            throw error;
        }
    }

    /**
     * Lend tokens to a lending protocol
     * @param params Lending parameters including token and amount
     * @returns Promise containing lending transaction signature
     */
    async lend(params: LendParams): Promise<LendResponse> {
        try {
            // Implementation here
            throw new Error(
                "Lending functionality not implemented in Solana Agent Kit"
            );
        } catch (error) {
            elizaLogger.error("Lending failed:", error);
            throw error;
        }
    }

    /**
     * Stake SOL to receive jupSOL
     * @param params Staking parameters including amount
     * @returns Promise containing staking transaction signature
     */
    async stake(params: StakeParams): Promise<StakeResponse> {
        try {
            if (params.amount < TRADING_CONFIG.STAKE.MINIMUM_AMOUNT) {
                throw new Error(
                    `Minimum staking amount is ${TRADING_CONFIG.STAKE.MINIMUM_AMOUNT} SOL`
                );
            }

            // Use the agent's stake method
            const signature = await this.agent.stake(params.amount);

            // Get jupSOL balance after staking
            const jupsolMint = new PublicKey(TRADING_CONFIG.TOKENS.JUPSOL);
            const jupsolBalance = await this.agent.getBalance(jupsolMint);

            return {
                signature,
                amount: params.amount,
                jupsolAmount: jupsolBalance,
            };
        } catch (error) {
            elizaLogger.error("Staking failed:", error);
            throw error;
        }
    }
}

export default TradingService;
