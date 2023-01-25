import { readFile } from "fs/promises";
import path from "path";
import https from "https";

import { Strategy } from "./strategies/strategy.types.js";
import { Contracts, RpcConfig } from "./types.js";

import Sound from './strategies/sound.js';
import SoundProtocol from "./strategies/sound_protocol.js";
import Zora from "./strategies/zora.js";
import CatalogV2 from "./strategies/catalog_v2.js";
import MintSongsV2 from "./strategies/mintsongs_v2.js";
import Noizd from "./strategies/noizd.js";


export function randomItem<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

//curl -s https://cloudflare-eth.com/v1/mainnet -X POST --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

export function getLatestBlockNumber(rpcHost: RpcConfig): Promise<number> {
  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.request(
      rpcHost.url,
      {
        method: 'POST',
        headers: {
          ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
        },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('error', reject);
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const ret = JSON.parse(data);
          if (ret.error) reject(ret.error);
          resolve(parseInt(ret.result, 16));
        });
      },
    );

    req.on('error', reject);
    req.write('{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}');
    req.end();
  });
}

export async function getDefaultContracts(): Promise<Contracts> {
  const defaultContractsPath = new URL('../assets/contracts.hardcode.json', import.meta.url);

  return JSON.parse(await readFile(defaultContractsPath, 'utf-8'));
}

export async function getUserContracts(): Promise<Contracts> {
  const userContractsPath = path.resolve('./contracts.json');

  return JSON.parse(await readFile(userContractsPath, 'utf-8'));
}

/**
 * User's contracts.json contains the new found addresses
 * Neume's contracts.hardcode.json contains hardcoded addresses
 * This function reads and merge them both.
 */
export async function getAllContracts(): Promise<Contracts> {
  return {
    ...(await getDefaultContracts()),
    ...(await getUserContracts()),
  };
}

/**
 * New strategies should be added here.
 */
export function getStrategies(
  strategyNames: string[],
  from: number,
  to: number
) {
  const strategies: Array<typeof Strategy> = [
    Sound,
    SoundProtocol,
    Zora,
    CatalogV2,
    MintSongsV2,
    Noizd

  ];

  return strategies.filter(
    (s) =>
      s.createdAtBlock <= from &&
      to <= (s.deprecatedAtBlock ?? Number.MAX_VALUE) &&
      strategyNames.includes(s.name),
  );
}

export function breakdownIpfs(ipfsUri: string) {
  // Modified from is-ipfs package at https://github.com/ipfs-shipyard/is-ipfs/blob/393859af921ef52d786c0f14bf772eeda7f8930b/src/index.js#L12
  const nativeIpfsPattern = /ipfs:\/\/([^/?#]+)(.*)/;
  const pathGatewayPattern = /^https?:\/\/[^/]+\/ipfs\/([^/?#]+)(.*)/;
  const subdomainGatewayPattern = /^https?:\/\/([^/]+)\.ipfs\.[^/?#]+(.*)/;

  if (typeof ipfsUri !== 'string') throw new Error('Given IPFS URI should be of type string');

  const nativeIpfsMatch = ipfsUri.match(nativeIpfsPattern);
  if (nativeIpfsMatch) {
    const [_, hash, path] = nativeIpfsMatch;
    return {
      cid: hash,
      path: path,
    };
  }

  const pathGatewayMatch = ipfsUri.match(pathGatewayPattern);
  if (pathGatewayMatch) {
    const [_, hash, path] = pathGatewayMatch;
    return {
      cid: hash,
      path: path,
    };
  }

  const subdomainGatewayMatch = ipfsUri.match(subdomainGatewayPattern);
  if (subdomainGatewayMatch) {
    const [_, hash, path] = subdomainGatewayMatch;
    return {
      cid: hash,
      path: path,
    };
  }

  throw new Error(`Couldn't convert ${ipfsUri} to native IPFS URI`);
}

export function anyIpfsToNativeIpfs(ipfsUri: string) {
  const IPFSIANAScheme = 'ipfs://';
  const ipfs = breakdownIpfs(ipfsUri);
  return `${IPFSIANAScheme}${ipfs.cid}${ipfs.path}`;
}

export function ifIpfsConvertToNativeIpfs(uri: string) {
  try {
    return anyIpfsToNativeIpfs(uri);
  } catch {
    return uri;
  }
}
