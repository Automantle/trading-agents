import { elizaLogger } from "@elizaos/core";
import axios, { AxiosInstance } from "axios";
import type { TokenResult } from "../../types/token";
import { COINMARKETCAP_CONFIG } from "./config";
import type {
    CMCTokenInfoResponse,
    CMCTokenResponse,
    CMCTokenStats,
} from "./types";

export class CoinmarketcapService {
    private client: AxiosInstance;
    private static instance: CoinmarketcapService;

    private constructor() {
        if (!COINMARKETCAP_CONFIG.API_KEY) {
            throw new Error(
                "Missing COOKFI_TOPWALLETS_API_KEY environment variable. Please set it in your .env file"
            );
        }

        this.client = axios.create({
            baseURL: COINMARKETCAP_CONFIG.API_URL,
            headers: {
                "X-CMC_PRO_API_KEY": COINMARKETCAP_CONFIG.API_KEY,
                "Content-Type": "application/json",
            },
        });
    }

    public static getInstance(): CoinmarketcapService {
        if (!CoinmarketcapService.instance) {
            CoinmarketcapService.instance = new CoinmarketcapService();
        }
        return CoinmarketcapService.instance;
    }

    /**
     * Get the top 3 tokens traded in the last hour on Solana by top 100 traders + top kols
     * @returns TokenResult[]
     */
    async getAllTokenAfterFilter(
        filterTag: string,
        chainId: string,
        cmcChainName: string
    ): Promise<TokenResult[]> {
        const allFilteredTokens: CMCTokenStats[] = [];

        let start = 1;

        while (true) {
            try {
                const response = await this.client.get<CMCTokenResponse>(
                    "/v1/cryptocurrency/listings/latest",
                    {
                        params: {
                            limit: 1000,
                            start,
                        },
                    }
                );

                if (response.data.status.error_code !== 0) {
                    elizaLogger.warn("Coinmarketcap token fetch failed", {
                        error: response.data.status.error_message,
                    });
                    throw new Error(response.data.status.error_message);
                }

                if (response.data.data.length === 0) {
                    break;
                }

                // filter tokens
                const filteredTokens = response.data.data.filter(
                    (token) =>
                        !token.tags.includes("stablecoin") &&
                        token.tags.includes(filterTag)
                );

                allFilteredTokens.push(...filteredTokens);

                await new Promise((resolve) => setTimeout(resolve, 5000));
                start += 1000;
            } catch (error) {
                elizaLogger.error("CMC token error", { error });
            }
        }

        // Take only the first 3 tokens
        const topTokens = allFilteredTokens;

        // Batch tokens into groups of 40 due to API limits
        const batchSize = 40;
        const responseTokenList: TokenResult[] = [];
        for (let i = 0; i < topTokens.length; i += batchSize) {
            const batch = topTokens.slice(i, i + batchSize);

            try {
                // fetch the addresses for all the tokens
                const { data } = await this.client.get<CMCTokenInfoResponse>(
                    "/v2/cryptocurrency/info",
                    {
                        params: {
                            id: batch
                                .map((token) => token.id.toString())
                                .join(","),
                        },
                    }
                );

                if (data.status.error_code !== 0) {
                    elizaLogger.warn("Coinmarketcap token fetch failed", {
                        error: data.status.error_message,
                    });
                    throw new Error(data.status.error_message);
                }

                responseTokenList.push(
                    ...batch.map((token) => {
                        const contractInfo = data.data[
                            token.id.toString()
                        ].contract_address.find(
                            (contract) =>
                                contract.platform.name === cmcChainName
                        );

                        return {
                            symbol: contractInfo.platform.coin.symbol,
                            name: contractInfo.platform.coin.name,
                            address: contractInfo.contract_address,
                            chainId,
                        };
                    })
                );

                await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (error) {
                elizaLogger.error("CMC token info error", { error });
                continue;
            }
        }

        return responseTokenList;
    }
}

export default CoinmarketcapService;
