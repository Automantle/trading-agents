import type { Plugin } from "@elizaos/core";
import { TokenPriceAction } from "./actions/tokenAction";
import {
    LatestBoostedTokensAction,
    LatestTokensAction,
    TopBoostedTokensAction,
} from "./actions/trendsAction";
import { TokenPriceEvaluator } from "./evaluators/tokenEvaluator";
import { TokenPriceProvider } from "./providers/tokenProvider";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const dexScreenerPlugin: Plugin = {
    name: "dexscreener",
    description:
        "Dex Screener Plugin with Token Price Action, Token Trends, Evaluators and Providers",
    actions: [
        new TokenPriceAction(),
        new LatestTokensAction(),
        new LatestBoostedTokensAction(),
        new TopBoostedTokensAction(),
    ],
    evaluators: [new TokenPriceEvaluator()],
    providers: [new TokenPriceProvider()],
};
