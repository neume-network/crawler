// All common types are declared here
import { Config as ExtractionWorkerConfig } from "@neume-network/schema";

export const CONSTANTS = {
  DATA_DIR: "data",
  STATE: {
    LAST_SYNC: "last_synced_block",
    LAST_CRAWL: "last_crawled_block",
  },
  FIRST_BLOCK: 11000000,
};

export type RpcConfig = {
  url: string;
  key?: string;
};

export type IpfsConfig = {
  httpsGateway: string;
  httpsGatewayKey: string;
};

export type Config = {
  rpc: RpcConfig[];
  ipfs?: IpfsConfig;
  arweave?: {
    httpsGateway: string;
  };
  step: {
    block: number;
    contract: number;
  };
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
  erc721: {
    blockNumber: number;
    address: string;
    token: {
      minting: {
        transactionHash: JsonRpcLog["transactionHash"];
      };
      id: string;
      uri?: string;
      uriContent?: Record<any, any>;
    };
  };
  metadata: Record<string, any>;
};
