export const TRADING_CONFIG = {
    NETWORKS: {
        MANTLE_MAINNET: "mantle",
        MANTLE_TESTNET: "mantleTestnet",
    },
    DEFAULT_NETWORK: "mantleTestnet",
    DEFAULT_SLIPPAGE: 1, // 1%
    MAX_SLIPPAGE: 30, // 30%
    MAX_RETRIES: 5,
    RETRY_DELAY: 5000, // 5 seconds
} as const;
