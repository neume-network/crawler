import { env } from "process";

const rpcHosts = [
  { url: "https://rpc.ankr.com/eth" },
  { url: "https://cloudflare-eth.com/" },
];

export const strategies = ["SoundProtocol"];

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
