import {
    SwapParams,
    SwapResponse,
    TransferParams,
    TransferResponse,
} from "../solana/types";
import { TRADING_CONFIG } from "./config";

type NetworkType =
    (typeof TRADING_CONFIG.NETWORKS)[keyof typeof TRADING_CONFIG.NETWORKS];

export interface MantleSwapParams extends SwapParams {
    networkId?: NetworkType;
}

export interface MantleSwapResponse extends SwapResponse {
    networkId: NetworkType;
}

export interface MantleTransferParams extends TransferParams {
    networkId?: NetworkType;
}

export interface MantleTransferResponse extends TransferResponse {
    networkId: NetworkType;
}
