// All common types are declared here
import { Config as ExtractionWorkerConfig } from "@neume-network/schema";

export enum CHAINS {
  "eth" = "eth",
  "polygon" = "polygon",
}

export enum PROTOCOLS {
  "arweave" = "arweave",
  "https" = "https",
  "ipfs" = "ipfs",
}

export const CONSTANTS = {
  DATA_DIR: "data",
  STATE: {
    LAST_SYNC: "last_synced_block",
    LAST_CRAWL: "last_crawled_block",
  },
  FIRST_BLOCK: {
    [CHAINS.eth]: 11000000,
    [CHAINS.polygon]: 11000000,
  },
};

export type RpcConfig = {
  url: string;
  key?: string;
};

export type IpfsConfig = {
  httpsGateway: string;
  httpsGatewayKey: string;
};

type ChainConfig = {
  /**
   * RPC endpoints will not fetch events for a large block span. getLogsBlockSpanSize
   * is the maximum size limit enforced by the RPC endpoint.
   */
  getLogsBlockSpanSize: number;
  /**
   * RPC endpoints will not fetch events for a large number of contracts. getLogsAddressSize
   * expresses the maximum size limit enforced by the RPC endpoint.
   */
  getLogsAddressSize: number;
  rpc: RpcConfig[];
  crawlStep: number;
};

export type Config = {
  ipfs?: IpfsConfig;
  arweave?: {
    httpsGateway: string;
  };
  chain: {
    [CHAINS.eth]: ChainConfig;
    [CHAINS.polygon]: ChainConfig;
  };
  /**
   * In order not to overwhelm the crawler we crawl in steps of block number.
   */
  crawlStep: number;
  /**
   * The time to wait (in milliseconds) before starting the next
   * crawl cycle. If the crawler has not crawled up to the latest block
   * it will ignore breatheTime and start the cycle immediately.
   **/
  breatheTimeMS: number;
  worker: ExtractionWorkerConfig;
};

// FROM: https://github.com/ethereumjs/ethereumjs-monorepo/blob/256bdb92f6dd57f6b4e1ab4ca44b25ed37385c3c/packages/client/lib/rpc/modules/eth.ts#L62
export type JsonRpcLog = {
  removed: boolean; // TAG - true when the log was removed, due to a chain reorganization. false if it's a valid log.
  logIndex: string | null; // QUANTITY - integer of the log index position in the block. null when it's pending.
  transactionIndex: string | null; // QUANTITY - integer of the transactions index position log was created from. null when it's pending.
  transactionHash: string | null; // DATA, 32 Bytes - hash of the transactions this log was created from. null when it's pending.
  blockHash: string | null; // DATA, 32 Bytes - hash of the block where this log was in. null when it's pending.
  blockNumber: string | null; // QUANTITY - the block number where this log was in. null when it's pending.
  address: string; // DATA, 20 Bytes - address from which this log originated.
  data: string; // DATA - contains one or more 32 Bytes non-indexed arguments of the log.
  topics: string[]; // Array of DATA - Array of 0 to 4 32 Bytes DATA of indexed log arguments.
  // (In solidity: The first topic is the hash of the signature of the event
  // (e.g. Deposit(address,bytes32,uint256)), except you declared the event with the anonymous specifier.)
};

export type Contract = {
  address: string;
  name: string;
  version: string;
};

export type Contracts = Record<string, Omit<Contract, "address">>;

export type NFT = {
  platform: Omit<Contract, "address">;
  creator?: string;
  erc721: {
    blockNumber: number;
    address: string;
    transaction: {
      from: string;
      to: string;
      transactionHash: string;
      blockNumber: number;
    };
    token: {
      id: string;
      uri?: string;
      uriContent?: Record<any, any>;
    };
  };
  metadata: Record<string, any>;
};
