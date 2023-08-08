/**
 * Strategy to crawl MintSongs V2 songs at 0x2b5426a5b98a3e366230eba9f95a24f09ae4a584.
 *
 * MintSongs also has a NFT collection on Polygon. The collection on Ethereum is known
 * as MintSongsV2.
 *
 * MintSongsV2 no longer mints new songs as of Sept 2022.
 * Last mint: https://etherscan.io/tx/0xccc0e691a5a509e731e76f2218f70637ed90edc1752015c4ba94fc01a205f761
 */

import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { toHex, encodeFunctionCall, decodeParameters } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { CHAINS, Config, Contract, NFT } from "../types.js";
import { randomItem } from "../utils.js";
import { ERC721Strategy, Strategy } from "./strategy.types.js";
import { AbstractSublevel } from "abstract-level";
import { Level } from "level";
import { handleTransfer } from "../components/handle-transfer.js";
import { localStorage } from "../../database/localstorage.js";

export default class MintSongsV2 implements ERC721Strategy {
  public static version = "2.0.0";
  // Oldest NFT mint found using OpenSea: https://etherscan.io/tx/0x4dd17de92c1d1ae0a7d17c127c57d99fd509f1b22dd176a483e5587fddf7e0a0
  static createdAtBlock = 14799837;
  createdAtBlock = MintSongsV2.createdAtBlock;
  deprecatedAtBlock = null;
  static invalidIDs = [
    /^0x2b5426a5b98a3e366230eba9f95a24f09ae4a584\/13$/, // Ignore track because URI contains a space at the end
    /^0x2b5426a5b98a3e366230eba9f95a24f09ae4a584\/113$/, // NFT has been burned
  ];
  chain = CHAINS.eth;
  worker: ExtractionWorkerHandler;
  config: Config;
  localStorage: AbstractSublevel<Level<string, any>, string | Buffer | Uint8Array, string, any>;
  contracts: AbstractSublevel<typeof this.localStorage, any, string, Contract>;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
    this.localStorage = localStorage.sublevel(MintSongsV2.name, {
      valueEncoding: "json",
    });
    this.contracts = this.localStorage.sublevel("contracts", {
      valueEncoding: "json",
    });

    const MINGSONGS_NFT_CONTRACT = "0x2b5426a5b98a3e366230eba9f95a24f09ae4a584";
    this.contracts.put(MINGSONGS_NFT_CONTRACT, {
      name: MintSongsV2.name,
      version: MintSongsV2.version,
    });
  }

  crawl = async (from: number, to: number, recrawl: boolean) => {
    await handleTransfer.call(this, from, to, recrawl);
  };

  fetchMetadata = async (nft: NFT) => {
    // Crawling MintSongs at this block number or higher
    // because the contract is broken at the block the NFTs
    // were minted. Contract was upgraded later many times.
    const BLOCK_NUMBER = 15504610;

    if (
      MintSongsV2.invalidIDs.filter((id) =>
        `${nft.erc721.address}/${nft.erc721.token.id}`.match(id),
      ).length != 0
    ) {
      console.log(
        `Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because it is blacklisted`,
      );
      return null;
    }

    nft.erc721.token.uri = await callTokenUri.call(
      this,
      Math.max(nft.erc721.blockNumber, BLOCK_NUMBER),
      nft,
    );
    try {
      nft.erc721.token.uriContent = (await getIpfsTokenUri.call(
        this,
        nft.erc721.token.uri,
      )) as Record<string, any>;
    } catch (err: any) {
      if (err.message.includes("Invalid CID")) {
        console.warn("Invalid CID: Ignoring the given track.", JSON.stringify(nft, null, 2));
        return null;
      }
      if (err.message.includes("504") || err.message.includes("AbortError")) {
        console.warn(
          "Couldn't find CID on the IPFS network: Ignoring NFT",
          JSON.stringify(nft, null, 2),
        );
        return null;
      }
      throw err;
    }
    nft.creator = await this.callTokenCreator(
      nft.erc721.address,
      Math.max(nft.erc721.blockNumber, BLOCK_NUMBER),
      nft.erc721.token.id,
    );

    const datum = nft.erc721.token.uriContent;

    let duration;
    if (datum?.duration) {
      duration = `PT${Math.floor(datum.duration / 60)}M${(datum.duration % 60).toFixed(0)}S`;
    }

    return {
      version: MintSongsV2.version,
      title: datum.title,
      duration,
      uid: await this.nftToUid(nft),
      artist: {
        version: MintSongsV2.version,
        name: datum.artist,
        address: nft.creator,
      },
      platform: {
        version: MintSongsV2.version,
        name: "Mint Songs",
        uri: "https://www.mintsongs.com/",
      },
      erc721: {
        version: MintSongsV2.version,
        createdAt: nft.erc721.blockNumber,
        address: nft.erc721.address,
        tokens: [
          {
            id: nft.erc721.token.id,
            uri: nft.erc721.token.uri,
            metadata: {
              ...datum,
              name: datum.title,
              description: datum.description,
              image: datum.image,
            },
            owners: [
              {
                from: nft.erc721.transaction.from,
                to: nft.erc721.transaction.to,
                blockNumber: nft.erc721.blockNumber,
                transactionHash: nft.erc721.transaction.transactionHash,
                alias: undefined,
              },
            ],
          },
        ],
      },
      manifestations: [
        {
          version: MintSongsV2.version,
          uri: datum.losslessAudio,
          mimetype: datum.mimeType,
        },
        {
          version: MintSongsV2.version,
          uri: datum.artwork.uri,
          mimetype: datum.artwork.mimeType,
        },
      ],
    };
  };

  nftToUid = async (nft: NFT) =>
    `${this.chain}/${MintSongsV2.name}/${nft.erc721.address.toLowerCase()}/${nft.erc721.token.id}`;

  private callTokenCreator = async (
    to: string,
    blockNumber: number,
    tokenId: string,
  ): Promise<string> => {
    const rpc = randomItem(this.config.chain[this.chain].rpc);
    const data = encodeFunctionCall(
      {
        name: "tokenCreator",
        type: "function",
        inputs: [
          {
            type: "uint256",
            name: "<input>",
          },
        ],
      },
      [tokenId],
    );
    const msg = await this.worker({
      type: "json-rpc",
      commissioner: "",
      version: "0.0.1",
      method: "eth_call",
      options: {
        url: rpc.url,
        retry: {
          retries: 3,
        },
      },
      params: [
        {
          to,
          data,
        },
        toHex(blockNumber),
      ],
    });

    if (msg.error)
      throw new Error(
        `Error while calling owner on contract: ${to} ${JSON.stringify(msg, null, 2)}`,
      );

    const creator = decodeParameters(["address"], msg.results)[0];

    if (typeof creator !== "string")
      throw new Error(`typeof owner invalid ${JSON.stringify(msg, null, 2)}`);

    return creator;
  };
}
