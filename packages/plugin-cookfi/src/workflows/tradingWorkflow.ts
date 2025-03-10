import { elizaLogger, type IAgentRuntime } from "@elizaos/core";
import { DecisionMakerService } from "../services/decisionMaker";
import { ExecutionService } from "../services/execution";
import { MoralisService } from "../services/moralis";
import { PortfolioService } from "../services/portfolio";
import { TokenAnalysisService } from "../services/tokenAnalysis";
import { TopWalletsService } from "../services/topwallets";
import { TwitterService } from "../services/twitter";
import { deduplicateTokens } from "../utils/token";
import { CoinmarketcapService } from "../services/coinmarketcap";

export class TradingWorkflow {
    private isProcessing = false;
    private stopProcessing = false;
    private readonly ANALYSIS_INTERVAL = 6 * 60 * 1000; // 6 minutes
    private isDryRun: boolean;

    private topWalletsService: TopWalletsService;
    private portfolioService: PortfolioService;
    private tokenAnalysisService: TokenAnalysisService;
    private decisionMakerService: DecisionMakerService;
    private executionService: ExecutionService;
    private twitterService?: TwitterService;
    private moralisService: MoralisService;
    private coinmarketcapService: CoinmarketcapService;

    constructor(private runtime: IAgentRuntime) {
        this.isDryRun = process.env.COOKFI_DRY_RUN === "true";
        this.topWalletsService = TopWalletsService.getInstance();
        this.portfolioService = new PortfolioService();
        this.coinmarketcapService = CoinmarketcapService.getInstance();
        this.tokenAnalysisService = new TokenAnalysisService();
        this.decisionMakerService = new DecisionMakerService(this.runtime);
        this.executionService = new ExecutionService(
            {
                isDryRun: this.isDryRun,
                rpcUrl: process.env.SOLANA_RPC_URL,
            },
            this.runtime
        );
        this.moralisService = new MoralisService();

        // Initialize Twitter service
        TwitterService.getInstance(runtime).then((service) => {
            this.twitterService = service;
        });
    }

    async start() {
        elizaLogger.log("Starting trading workflow");
        this.runAnalysisLoop();
    }

    async stop() {
        elizaLogger.log("Stopping trading workflow");
        this.stopProcessing = true;
    }

    private async runAnalysisLoop() {
        if (this.isProcessing) {
            elizaLogger.log("Already processing trading analysis, skipping");
            return;
        }

        while (!this.stopProcessing) {
            try {
                this.isProcessing = true;

                // Fetch trending tokens and portfolio data in parallel
                const [
                    trendingTokens,
                    portfolioTokens,
                    mantleCMCTokens,
                    // experiencedBuyerTokens,
                ] = await Promise.all([
                    this.topWalletsService.getTopWalletsToken(),
                    this.portfolioService.getTokens(),
                    this.coinmarketcapService.getAllTokenAfterFilter(
                        "mantle-ecosystem",
                        "mantle",
                        "Mantle"
                    ),
                    // this.moralisService.getExperiencedBuyerTokens(),
                ]);

                console.log({ mantleCMCTokens });

                // Combine and deduplicate tokens
                const tokensToAnalyze = deduplicateTokens([
                    ...portfolioTokens, // Portfolio tokens take priority
                    ...trendingTokens,
                    ...mantleCMCTokens,
                ]);

                console.log(tokensToAnalyze);

                elizaLogger.log(
                    `Analyzing ${tokensToAnalyze.length} unique tokens`
                );

                // Analyze each token
                const analysisResults = await Promise.all(
                    tokensToAnalyze.map((token) =>
                        this.tokenAnalysisService.analyzeToken(token)
                    )
                );

                // Make trading decisions using complete analysis results
                const decisions = await Promise.all(
                    tokensToAnalyze.map((token, index) =>
                        this.decisionMakerService.analyzeToken(
                            token,
                            analysisResults[index]
                        )
                    )
                );

                console.log(decisions);

                // Log results
                tokensToAnalyze.forEach((token, index) => {
                    const analysis = analysisResults[index];
                    const decision = decisions[index];
                    elizaLogger.log(`Analysis for ${token.symbol}:`, {
                        pairs: analysis.marketAnalysis.length,
                        bestPrice: analysis.marketAnalysis[0]?.priceUsd,
                        socialMentions: analysis.socialAnalysis.length,
                        decision: decision?.recommendation,
                        confidence: decision?.confidence,
                        balance: token.balance,
                    });
                });

                // Execute trading decisions
                const executionResults = await Promise.all(
                    tokensToAnalyze.map((token, index) =>
                        this.executionService.executeDecision(
                            token,
                            decisions[index],
                            analysisResults[index].marketAnalysis
                        )
                    )
                );

                // Notify successful trades using the Twitter service
                if (this.twitterService) {
                    await this.twitterService.notifySuccessfulTrades(
                        executionResults
                    );
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, this.ANALYSIS_INTERVAL)
                );
            } catch (error) {
                elizaLogger.error("Error in trading analysis loop");
                console.error(error);
                await new Promise((resolve) => setTimeout(resolve, 30000));
            } finally {
                this.isProcessing = false;
            }
        }
    }
}
