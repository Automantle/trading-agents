export interface CMCResponseStatus {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: any | null;
    total_count: number;
}

export interface CMCPlatform {
    id: string;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
}

export interface CMCContractAddressObj {
    contract_address: string;
    platform: {
        name: string;
        coin: {
            id: string;
            name: string;
            symbol: string;
            slug: string;
        };
    };
}

export interface CMCTokenStats {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    num_market_pairs: number;
    date_added: string;
    tags: string[];
    max_supply: number;
    circulating_supply: number;
    total_supply: number;
    infinite_supply: boolean;
    platform: CMCPlatform | null;
    cmc_rank: number;
    self_reported_circulating_supply: number | null;
    self_reported_market_cap: number | null;
    tvl_ratio: number | null;
    last_updated: string;
    quote: {
        USD: {
            price: number;
            volume_24h: number;
            volume_change_24h: number;
            percent_change_1h: number;
            percent_change_24h: number;
            percent_change_7d: number;
            percent_change_30d: number;
            percent_change_60d: number;
            percent_change_90d: number;
            market_cap: number;
            market_cap_dominance: number;
            fully_diluted_market_cap: number;
            tvl: number | null;
            last_updated: string;
        };
    };
}

export interface CMCTokenResponse {
    status: CMCResponseStatus;
    data: CMCTokenStats[];
}

export interface CMCTokenInfoResponse {
    status: CMCResponseStatus;
    data: Record<
        string,
        {
            id: number;
            name: string;
            symbol: string;
            category: string;
            description: string;
            slug: string;
            logo: string;
            subreddit: string;
            notice: string;
            tags: string[];
            "tag-names": string[];
            "tag-groups": string[];
            urls: {
                website: string[];
                twitter: string[];
                message_board: string[];
                chat: string[];
                facebook: string[];
                explorer: string[];
                reddit: string[];
                technical_doc: string[];
                source_code: string[];
                announcement: string[];
            };
            platform: CMCPlatform | null;
            date_added: string;
            twitter_username: string;
            is_hidden: number;
            date_launched: string | null;
            contract_address: CMCContractAddressObj[];
            self_reported_circulating_supply: number | null;
            self_reported_tags: any | null;
            self_reported_market_cap: number | null;
            infinite_supply: boolean;
        }
    >;
}
