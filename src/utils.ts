import https from "https";

import { Strategy } from "./strategies/strategy.types.js";
import { PROTOCOLS, RpcConfig } from "./types.js";

import Sound from "./strategies/sound.js";
import SoundProtocol from "./strategies/sound_protocol.js";
import Zora from "./strategies/zora.js";
import CatalogV2 from "./strategies/catalog_v2.js";
import MintSongsV2 from "./strategies/mintsongs_v2.js";
import Noizd from "./strategies/noizd.js";
import Lens from "./strategies/lens/lens.js";

export function randomItem<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

//curl -s https://cloudflare-eth.com/v1/mainnet -X POST --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

export function getLatestBlockNumber(rpcHost: RpcConfig): Promise<number> {
  return new Promise((resolve, reject) => {
    let data = "";
    const req = https.request(
      rpcHost.url,
      {
        method: "POST",
        headers: {
          ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
        },
      },
      (res) => {
        res.setEncoding("utf8");
        res.on("error", reject);
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const ret = JSON.parse(data);
          if (ret.error) reject(ret.error);
          resolve(parseInt(ret.result, 16));
        });
      },
    );

    req.on("error", reject);
    req.write('{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}');
    req.end();
  });
}

/**
 * New strategies should be added here.
 */
export function getStrategies(strategyNames: string[]) {
  const strategies: Array<typeof Strategy> = [
    Sound,
    Lens,
    SoundProtocol,
    Zora,
    CatalogV2,
    MintSongsV2,
    Noizd,
  ];

  return strategies.filter((s) => strategyNames.includes(s.name));
}

export function getProtocol(uri: string): PROTOCOLS | null {
  if (uri.startsWith("ar://")) return PROTOCOLS.arweave;
  else if (uri.startsWith("ipfs://")) return PROTOCOLS.ipfs;
  else if (uri.startsWith("http://") || uri.startsWith("https://")) return PROTOCOLS.https;
  return null;
}
