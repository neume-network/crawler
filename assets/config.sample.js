/**
 * Types of configuration present here:
 * - Configuration common for all commands
 * - Configuration too verbose for CLI
 * - Sensitive information
 * 
 * neume will read values from .env. Therefore, you can do
 * env.RPC_API_KEYS
 * 
 */

import { env } from "process";

const rpcHosts = [
  { url: "https://rpc.ankr.com/eth" },
  { url: "https://cloudflare-eth.com/" },
];

/**
 * A list of strategies to enable. Remove entries from the list to run
 * selected strategies.
 * 
 * Note:
 * - The name should match the class name of the strategy.
 * - The name is case-sensitive.
 * */
export const strategies = ["SoundProtocol", "MintSongsV2", "CatalogV2", "Zora"];


/**
 * Configuration for neume
 * 
 * TypeScipt type for configuration can be found at:
 * https://github.com/neume-network/crawler/blob/main/types.ts#L25
 */
export const config = {
  rpc: rpcHosts,
  arweave: {
    httpsGateway: "https://arweave.net",
  },
  step: {
    block: 799,
    contract: 100,
  },
  worker: {
    queue: {
      options: {
        concurrent: 200,
      },
    },
    endpoints: {
      ...rpcHosts.reduce((prevValue, host) => {
        prevValue[host.url] = {
          timeout: 120_000,
          requestsPerUnit: 300,
          unit: "second",
        };
        return prevValue;
      }, {}),
      "https://arweave.net": {
        timeout: 120_000,
        requestsPerUnit: 1000,
        unit: "second",
      },
    },
  },
};
