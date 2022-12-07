import { env } from "process";
import SoundProtocol from "./strategies/sound_protocol";
import { Strategy } from "./strategies/strategy.types";

import { Config } from "./types";

const rpcApiKeys = env.RPC_API_KEYS?.split(",");
const rpcHosts = env.RPC_HTTP_HOSTS?.split(",").map((host, i) => ({
  url: host,
  key: rpcApiKeys?.[i],
}));

if (!rpcHosts) throw new Error("Atleast one RPC host is required");

/**
 * New strategies should be added here.
 *
 * For development if you wish to run only a few selected strategies
 * then modify this function.
 */
export function getStrategies(from: number, to: number) {
  const strategies: Array<typeof Strategy> = [SoundProtocol];

  return strategies.filter(
    (s) =>
      s.createdAtBlock <= from &&
      to <= (s.deprecatedAtBlock ?? Number.MAX_VALUE)
  );
}

export const config: Config = {
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
        concurrent: parseInt(env.EXTRACTION_WORKER_CONCURRENCY ?? "100"),
      },
    },
    endpoints: {
      ...rpcHosts.reduce((prevValue: any, host) => {
        prevValue[host.url] = {
          timeout: 120_000,
          requestsPerUnit: 300,
          unit: "second",
        };
        return prevValue;
      }, {}),
      ...(env.ARWEAVE_HTTPS_GATEWAY && {
        [env.ARWEAVE_HTTPS_GATEWAY]: {
          timeout: 120_000,
          requestsPerUnit: 1000,
          unit: "second",
        },
      }),
    },
  },
};
