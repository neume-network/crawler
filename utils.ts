import { readFile } from "fs/promises";
import path from "path";
import https from "https";
import SoundProtocol from "./strategies/sound_protocol.js";
import { Strategy } from "./strategies/strategy.types.js";
import { CONSTANTS, RpcConfig } from "./types.js";
import Zora from "./strategies/zora.js";

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
      }
    );

    req.on("error", reject);
    req.write(
      '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
    );
    req.end();
  });
}

export async function getDefaultContracts(): Promise<Record<string, any>> {
  const defaultContractsPath = new URL(
    CONSTANTS.HARDCODE_CONTRACTS,
    import.meta.url
  );

  return JSON.parse(await readFile(defaultContractsPath, "utf-8"));
}

export async function getUserContracts(): Promise<Record<string, any>> {
  const userContractsPath = path.resolve(CONSTANTS.USER_CONTRACTS);

  return JSON.parse(await readFile(userContractsPath, "utf-8"));
}

/**
 * User's contracts.json contains the new found addresses
 * Neume's contracts.hardcode.json contains hardcoded addresses
 * This function reads and merge them both.
 */
export async function getAllContracts(): Promise<Record<string, any>> {
  return {
    ...(await getDefaultContracts()),
    ...(await getUserContracts()),
  };
}

/**
 * New strategies should be added here.
 *
 * For development if you wish to run only a few selected strategies
 * then modify this function.
 */
export function getStrategies(
  strategyNames: string[],
  from: number,
  to: number
) {
  const strategies: Array<typeof Strategy> = [SoundProtocol, Zora];

  return strategies.filter(
    (s) =>
      s.createdAtBlock <= from &&
      to <= (s.deprecatedAtBlock ?? Number.MAX_VALUE) &&
      strategyNames.includes(s.name)
  );
}
