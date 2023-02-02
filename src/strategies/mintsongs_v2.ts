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
import { Config, NFT } from "../types.js";
import { randomItem } from "../utils.js";
import { Strategy } from "./strategy.types.js";

export default class MintSongsV2 implements Strategy {
  public static version = "2.0.0";
  // Oldest NFT mint found using OpenSea: https://etherscan.io/tx/0x4dd17de92c1d1ae0a7d17c127c57d99fd509f1b22dd176a483e5587fddf7e0a0
  public static createdAtBlock = 14799837;
  public static deprecatedAtBlock = null;
  public static invalidIDs = [
    /^0x2b5426a5b98a3e366230eba9f95a24f09ae4a584\/13$/, // Ignore track because URI contains a space at the end
  ];

  private worker: ExtractionWorkerHandler;
  private config: Config;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
  }

  crawl = async (nft: NFT) => {
    // Crawling MintSongs at this block number or higher
    // because the contract is broken at the block the NFTs
    // were minted. Contract was upgraded later many times.
    const BLOCK_NUMBER = 16543384;

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

    nft.erc721.token.uri = await callTokenUri(
      this.worker,
      this.config,
      Math.max(nft.erc721.blockNumber, BLOCK_NUMBER),
      nft,
    );
    try {
      nft.erc721.token.uriContent = await getIpfsTokenUri(
        nft.erc721.token.uri,
        this.worker,
        this.config,
      );
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
        transaction: {
          from: nft.erc721.transaction.from,
          to: nft.erc721.transaction.to,
          blockNumber: nft.erc721.transaction.blockNumber,
          transactionHash: nft.erc721.transaction.transactionHash,
        },
        version: MintSongsV2.version,
        createdAt: nft.erc721.blockNumber,
        tokenId: nft.erc721.token.id,
        address: nft.erc721.address,
        tokenURI: nft.erc721.token.uri,
        metadata: {
          ...datum,
          name: datum.title,
          description: datum.description,
          image: datum.image,
        },
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

  updateOwner(nft: NFT) {}

  private callTokenCreator = async (
    to: string,
    blockNumber: number,
    tokenId: string,
  ): Promise<string> => {
    const rpc = randomItem(this.config.rpc);
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
